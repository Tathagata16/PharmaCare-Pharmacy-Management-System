import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Purchase, Supplier } from '../src/models/index.js'
import {
  createSupplier,
  getSupplierById,
  listSupplierPurchases,
  listSuppliers,
  updateSupplier,
} from '../src/services/supplierService.js'
import {
  supplierCreateSchema,
  supplierListSchema,
  supplierUpdateSchema,
} from '../src/validators/supplierValidators.js'

const supplierId = '507f1f77bcf86cd799439011'

test('supplier create validator accepts valid data and rejects invalid email, phone, and fields', () => {
  const valid = supplierCreateSchema.safeParse({
    body: {
      name: '  Demo Supplier ',
      email: 'ORDERS@example.test',
      phone: '+1 (555) 010-1234',
    },
  })
  assert.equal(valid.success, true)
  assert.equal(valid.data.body.name, 'Demo Supplier')
  assert.equal(valid.data.body.email, 'orders@example.test')
  assert.equal(valid.data.body.isActive, true)

  assert.equal(
    supplierCreateSchema.safeParse({
      body: { name: 'Supplier', email: 'invalid', phone: 'not-a-phone' },
    }).success,
    false,
  )
  assert.equal(supplierCreateSchema.safeParse({ body: { email: 'orders@example.test' } }).success, false)
  assert.equal(supplierCreateSchema.safeParse({ body: { name: 'Supplier', stock: 5 } }).success, false)
})

test('supplier list and update validators enforce filters and non-empty patches', () => {
  const result = supplierListSchema.safeParse({
    query: { search: 'Northstar', isActive: 'false', page: '2', limit: '10', sortOrder: 'desc' },
  })
  assert.equal(result.success, true)
  assert.equal(result.data.query.page, 2)
  assert.equal(result.data.query.sortBy, 'name')
  assert.equal(supplierListSchema.safeParse({ query: { sortBy: 'email' } }).success, false)
  assert.equal(supplierListSchema.safeParse({ query: { page: '0' } }).success, false)
  assert.equal(
    supplierUpdateSchema.safeParse({ params: { supplierId }, body: {} }).success,
    false,
  )
  assert.equal(
    supplierUpdateSchema.safeParse({
      params: { supplierId },
      body: { phone: 'bad-number' },
    }).success,
    false,
  )
})

test('supplier model validates email and phone and defaults to active', async () => {
  const supplier = new Supplier({
    name: 'Demo Supplier',
    email: 'bad-email',
    phone: 'invalid',
  })
  assert.equal(supplier.isActive, true)
  await assert.rejects(supplier.validate(), (error) => {
    assert.ok(error.errors.email)
    assert.ok(error.errors.phone)
    return true
  })
})

test('supplier create, get, and update services work and report missing suppliers', async () => {
  const originals = {
    create: Supplier.create,
    findById: Supplier.findById,
    findByIdAndUpdate: Supplier.findByIdAndUpdate,
  }
  const created = { _id: supplierId, name: 'Demo Supplier' }
  Supplier.create = async (data) => ({ ...data, _id: supplierId })
  Supplier.findById = () => ({ lean: async () => created })
  Supplier.findByIdAndUpdate = async (_id, update, options) => {
    assert.deepEqual(update, { $set: { isActive: false } })
    assert.equal(options.runValidators, true)
    return { ...created, isActive: false }
  }

  try {
    assert.deepEqual(await createSupplier({ name: 'Demo Supplier' }), {
      name: 'Demo Supplier',
      _id: supplierId,
    })
    assert.deepEqual(await getSupplierById(supplierId), created)
    assert.equal((await updateSupplier(supplierId, { isActive: false })).isActive, false)

    Supplier.findById = () => ({ lean: async () => null })
    await assert.rejects(getSupplierById(supplierId), { statusCode: 404 })
    Supplier.findByIdAndUpdate = async () => null
    await assert.rejects(updateSupplier(supplierId, { name: 'Missing' }), { statusCode: 404 })
  } finally {
    Supplier.create = originals.create
    Supplier.findById = originals.findById
    Supplier.findByIdAndUpdate = originals.findByIdAndUpdate
  }
})

test('supplier search/filter/pagination and purchase history are applied', async () => {
  const originals = {
    find: Supplier.find,
    count: Supplier.countDocuments,
    exists: Supplier.exists,
    purchaseFind: Purchase.find,
    purchaseCount: Purchase.countDocuments,
  }
  let supplierFilter
  let supplierSort
  let supplierSkip
  let supplierLimit
  let purchaseFilter
  let purchaseSkip
  let purchaseLimit
  Supplier.find = (filter) => {
    supplierFilter = filter
    return {
      sort(value) { supplierSort = value; return this },
      skip(value) { supplierSkip = value; return this },
      limit(value) { supplierLimit = value; return this },
      lean: async () => [{ name: 'Northstar Medical' }],
    }
  }
  Supplier.countDocuments = async () => 1
  Supplier.exists = async (filter) => {
    assert.deepEqual(filter, { _id: supplierId })
    return true
  }
  Purchase.find = (filter) => {
    purchaseFilter = filter
    const query = {
      populate() { return this },
      sort() { return this },
      skip(value) { purchaseSkip = value; return this },
      limit(value) { purchaseLimit = value; return this },
      lean: async () => [{ invoiceNumber: 'PUR-1' }],
    }
    return query
  }
  Purchase.countDocuments = async () => 1

  try {
    const suppliers = await listSuppliers({
      search: 'Northstar',
      isActive: 'false',
      page: 2,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'desc',
    })
    assert.equal(supplierFilter.isActive, false)
    assert.equal(supplierFilter.$or[0].name.test('Northstar Medical'), true)
    assert.equal(supplierFilter.$or[0].name.test('Other'), false)
    assert.deepEqual(supplierSort, { name: -1, _id: 1 })
    assert.equal(supplierSkip, 10)
    assert.equal(supplierLimit, 10)
    assert.deepEqual(suppliers, {
      suppliers: [{ name: 'Northstar Medical' }],
      total: 1,
      page: 2,
      limit: 10,
    })

    const history = await listSupplierPurchases(supplierId, { page: 2, limit: 5 })
    assert.deepEqual(purchaseFilter, { supplier: supplierId })
    assert.equal(purchaseSkip, 5)
    assert.equal(purchaseLimit, 5)
    assert.deepEqual(history, {
      purchases: [{ invoiceNumber: 'PUR-1' }],
      total: 1,
      page: 2,
      limit: 5,
    })
    Supplier.exists = async () => false
    await assert.rejects(listSupplierPurchases(supplierId, { page: 1, limit: 25 }), {
      statusCode: 404,
    })
  } finally {
    Supplier.find = originals.find
    Supplier.countDocuments = originals.count
    Supplier.exists = originals.exists
    Purchase.find = originals.purchaseFind
    Purchase.countDocuments = originals.purchaseCount
  }
})
