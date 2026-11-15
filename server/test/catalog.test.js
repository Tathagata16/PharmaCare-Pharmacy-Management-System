import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Batch, Category, Medicine } from '../src/models/index.js'
import { deleteCategory } from '../src/services/categoryService.js'
import {
  deleteMedicine,
  getCurrentMedicinePrices,
  listMedicines,
} from '../src/services/medicineService.js'
import {
  categoryCreateSchema,
  medicineCreateSchema,
  medicineListSchema,
  medicineUpdateSchema,
  categoryUpdateSchema,
} from '../src/validators/catalogValidators.js'

const objectId = '507f1f77bcf86cd799439011'

test('medicine validators require core fields and reject stock mutation', () => {
  const invalid = medicineCreateSchema.safeParse({
    body: {
      name: 'Sample',
      genericName: 'Sample generic',
      category: objectId,
      manufacturer: 'Demo manufacturer',
      stock: 25,
    },
  })
  assert.equal(invalid.success, false)

  const valid = medicineCreateSchema.safeParse({
    body: {
      name: '  Sample  ',
      genericName: 'Sample generic',
      category: objectId,
      manufacturer: 'Demo manufacturer',
    },
  })
  assert.equal(valid.success, true)
  assert.equal(valid.data.body.name, 'Sample')
  assert.equal(valid.data.body.isActive, true)
})

test('medicine list validates filters, pagination, and sort choices', () => {
  const result = medicineListSchema.safeParse({
    query: { search: 'Pain', category: objectId, page: '2', limit: '10', sortBy: 'name' },
  })
  assert.equal(result.success, true)
  assert.equal(result.data.query.page, 2)
  assert.equal(result.data.query.sortOrder, 'asc')
  assert.equal(medicineListSchema.safeParse({ query: { sortBy: 'password' } }).success, false)
  assert.equal(medicineListSchema.safeParse({ query: { page: '0' } }).success, false)
})

test('medicine and category updates require a non-empty valid patch', () => {
  assert.equal(medicineUpdateSchema.safeParse({ params: { medicineId: objectId }, body: {} }).success, false)
  assert.equal(
    medicineUpdateSchema.safeParse({
      params: { medicineId: objectId },
      body: { reorderLevel: 2, stock: 100 },
    }).success,
    false,
  )
  assert.equal(categoryCreateSchema.safeParse({ body: { name: 'Pain Relief', extra: true } }).success, false)
  assert.equal(
    categoryUpdateSchema.safeParse({ params: { categoryId: objectId }, body: {} }).success,
    false,
  )
})

test('medicine listing applies filters, pagination, safe sorting, and counts', async () => {
  const originalFind = Medicine.find
  const originalCount = Medicine.countDocuments
  let capturedFilter
  let capturedSort
  let capturedSkip
  let capturedLimit

  Medicine.find = (filter) => {
    capturedFilter = filter
    const query = {
      populate() { return this },
      sort(value) { capturedSort = value; return this },
      skip(value) { capturedSkip = value; return this },
      limit(value) { capturedLimit = value; return this },
      lean: async () => [{ name: 'Sample' }],
    }
    return query
  }
  Medicine.countDocuments = async (filter) => {
    assert.equal(filter, capturedFilter)
    return 1
  }

  try {
    const result = await listMedicines({
      search: 'Pain.*',
      name: 'Sample',
      genericName: 'Generic',
      category: objectId,
      manufacturer: 'Maker',
      page: 2,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'desc',
      includeInactive: false,
    })

    assert.equal(capturedFilter.isActive, true)
    assert.equal(capturedFilter.category, objectId)
    assert.equal(capturedFilter.name.test('sample medicine'), true)
    assert.equal(capturedFilter.genericName.test('generic example'), true)
    assert.equal(capturedFilter.manufacturer.test('maker corp'), true)
    assert.equal(capturedFilter.$or[0].name.test('Pain.*'), true)
    assert.equal(capturedFilter.$or[0].name.test('PainXYZ'), false)
    assert.deepEqual(capturedSort, { name: -1, _id: 1 })
    assert.equal(capturedSkip, 10)
    assert.equal(capturedLimit, 10)
    assert.deepEqual(result, { medicines: [{ name: 'Sample' }], total: 1, page: 2, limit: 10 })
  } finally {
    Medicine.find = originalFind
    Medicine.countDocuments = originalCount
  }
})

test('medicine listing includes inactive records only when requested', async () => {
  const originalFind = Medicine.find
  const originalCount = Medicine.countDocuments
  let capturedFilter
  Medicine.find = (filter) => {
    capturedFilter = filter
    return {
      populate() { return this },
      sort() { return this },
      skip() { return this },
      limit() { return this },
      lean: async () => [],
    }
  }
  Medicine.countDocuments = async () => 0

  try {
    await listMedicines({
      page: 1,
      limit: 25,
      sortBy: 'name',
      sortOrder: 'asc',
      includeInactive: true,
    })
    assert.equal('isActive' in capturedFilter, false)
  } finally {
    Medicine.find = originalFind
    Medicine.countDocuments = originalCount
  }
})

test('customer catalog prices come from the earliest eligible batch only', async () => {
  const originalAggregate = Batch.aggregate
  let pipeline
  Batch.aggregate = async (stages) => {
    pipeline = stages
    return [{ _id: objectId, price: 4.25 }]
  }
  try {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const prices = await getCurrentMedicinePrices([objectId], now)
    assert.equal(prices.get(objectId), 4.25)
    assert.deepEqual(pipeline[0].$match, {
      medicine: { $in: [objectId] },
      quantity: { $gt: 0 },
      expiryDate: { $gt: now },
    })
    assert.deepEqual(pipeline[1].$sort, { expiryDate: 1, _id: 1 })
  } finally {
    Batch.aggregate = originalAggregate
  }
})

test('medicine deletion is blocked when historical or batch references exist', async () => {
  const { Batch, Sale, Purchase } = await import('../src/models/index.js')
  const originals = {
    findById: Medicine.findById,
    deleteOne: Medicine.deleteOne,
    batchExists: Batch.exists,
    saleExists: Sale.exists,
    purchaseExists: Purchase.exists,
  }
  Medicine.findById = async () => ({ _id: objectId })
  Medicine.deleteOne = async () => assert.fail('Referenced medicine must not be deleted')

  try {
    for (const reference of ['batch', 'sale', 'purchase']) {
      Batch.exists = async () => reference === 'batch'
      Sale.exists = async () => reference === 'sale'
      Purchase.exists = async () => reference === 'purchase'
      await assert.rejects(deleteMedicine(objectId), { statusCode: 409 })
    }
  } finally {
    Medicine.findById = originals.findById
    Medicine.deleteOne = originals.deleteOne
    Batch.exists = originals.batchExists
    Sale.exists = originals.saleExists
    Purchase.exists = originals.purchaseExists
  }
})

test('category deletion is blocked while referenced by a medicine', async () => {
  const originalFindById = Category.findById
  const originalExists = Medicine.exists
  const originalDeleteOne = Category.deleteOne
  Category.findById = async () => ({ _id: objectId })
  Medicine.exists = async () => true
  Category.deleteOne = async () => assert.fail('Referenced category must not be deleted')

  try {
    await assert.rejects(deleteCategory(objectId), { statusCode: 409 })
  } finally {
    Category.findById = originalFindById
    Medicine.exists = originalExists
    Category.deleteOne = originalDeleteOne
  }
})
