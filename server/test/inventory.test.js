import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Batch, Medicine } from '../src/models/index.js'
import {
  allocateStockFEFO,
  getAvailableStock,
  getBatchWiseStock,
  getExpiredBatches,
  getLowStockMedicines,
  getNearExpiryBatches,
  getStockValuation,
} from '../src/services/inventoryService.js'

const medicineId = '507f1f77bcf86cd799439011'
const day = 24 * 60 * 60 * 1000

function installInventoryMocks({ medicine, batches, onUpdate } = {}) {
  const originals = { findOne: Medicine.findOne, find: Batch.find, updateOne: Batch.updateOne, aggregate: Batch.aggregate, medicineAggregate: Medicine.aggregate }
  Medicine.findOne = () => ({
    session() { return this },
    lean: async () => medicine ?? {
      _id: medicineId,
      name: 'Test Medicine',
      genericName: 'Test Generic',
      brand: 'Test Brand',
      reorderLevel: 5,
      isActive: true,
    },
  })
  Batch.find = (filter) => ({
    sort(sort) {
      assert.deepEqual(sort, { expiryDate: 1, _id: 1 })
      assert.equal(filter.quantity.$gt, 0)
      assert.ok(filter.expiryDate.$gt instanceof Date)
      return this
    },
    session() { return this },
    lean: async () => batches ?? [],
  })
  Batch.updateOne = onUpdate ?? (async () => ({ modifiedCount: 1 }))

  return () => {
    Medicine.findOne = originals.findOne
    Batch.find = originals.find
    Batch.updateOne = originals.updateOne
    Batch.aggregate = originals.aggregate
    Medicine.aggregate = originals.medicineAggregate
  }
}

test('FEFO allocation consumes earliest unexpired batch then continues to the next', async () => {
  const now = Date.now()
  const batches = [
    { _id: 'expired', batchNumber: 'OLD', quantity: 10, expiryDate: new Date(now - day), sellingPrice: 3 },
    { _id: 'zero', batchNumber: 'EMPTY', quantity: 0, expiryDate: new Date(now + day), sellingPrice: 4 },
    { _id: 'first', batchNumber: 'EARLY', quantity: 2, expiryDate: new Date(now + 2 * day), sellingPrice: 5 },
    { _id: 'second', batchNumber: 'LATER', quantity: 4, expiryDate: new Date(now + 4 * day), sellingPrice: 6 },
  ]
  const stock = new Map(batches.map((batch) => [batch._id, batch.quantity]))
  const restore = installInventoryMocks({
    batches: batches.slice(2),
    onUpdate: async (filter, update) => {
      const batch = batches.find(({ _id }) => _id === filter._id)
      const amount = -update.$inc.quantity
      if (stock.get(batch._id) < amount) return { modifiedCount: 0 }
      stock.set(batch._id, stock.get(batch._id) - amount)
      return { modifiedCount: 1 }
    },
  })

  try {
    const allocations = await allocateStockFEFO(medicineId, 5, {})
    assert.deepEqual(
      allocations.map(({ batch, quantity }) => [batch.batchNumber, quantity]),
      [['EARLY', 2], ['LATER', 3]],
    )
    assert.equal(stock.get('first'), 0)
    assert.equal(stock.get('second'), 1)
  } finally {
    restore()
  }
})

test('FEFO rejects insufficient and zero stock without changing batches', async () => {
  let updates = 0
  const restore = installInventoryMocks({
    batches: [],
    onUpdate: async () => {
      updates += 1
      return { modifiedCount: 1 }
    },
  })
  try {
    await assert.rejects(allocateStockFEFO(medicineId, 1, {}), { statusCode: 409 })
    await assert.rejects(allocateStockFEFO(medicineId, 0, {}), { statusCode: 400 })
    assert.equal(updates, 0)
  } finally {
    restore()
  }
})

test('concurrent FEFO updates use a conditional quantity guard to prevent overselling', async () => {
  const batch = {
    _id: 'batch-1',
    batchNumber: 'ONLY',
    quantity: 5,
    expiryDate: new Date(Date.now() + day),
  }
  let actualQuantity = 5
  const restore = installInventoryMocks({
    batches: [batch],
    onUpdate: async (filter, update) => {
      const amount = -update.$inc.quantity
      if (actualQuantity < amount || filter.quantity.$gte !== amount) {
        return { modifiedCount: 0 }
      }
      actualQuantity -= amount
      return { modifiedCount: 1 }
    },
  })
  try {
    const results = await Promise.allSettled([
      allocateStockFEFO(medicineId, 4, {}),
      allocateStockFEFO(medicineId, 4, {}),
    ])
    assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1)
    assert.equal(results.filter(({ status }) => status === 'rejected').length, 1)
    assert.equal(actualQuantity, 1)
    assert.ok(actualQuantity >= 0)
  } finally {
    restore()
  }
})

test('available stock and batch-wise stock exclude expired and inactive medicine', async () => {
  const originals = {
    findOne: Medicine.findOne,
    aggregate: Batch.aggregate,
    find: Batch.find,
  }
  let captured
  Medicine.findOne = () => ({
    session() { return this },
    lean: async () => ({ _id: medicineId, isActive: true }),
  })
  Batch.aggregate = async (pipeline) => {
    captured = pipeline[0].$match
    return [{ quantity: 0 }]
  }
  Batch.find = () => ({
    sort() { return this },
    session() { return this },
    lean: async () => [],
  })
  try {
    assert.equal(await getAvailableStock(medicineId), 0)
    assert.equal(captured.quantity.$gt, 0)
    assert.ok(captured.expiryDate.$gt instanceof Date)
    const result = await getBatchWiseStock(medicineId)
    assert.equal(result.availableStock, 0)
    assert.deepEqual(result.batches, [])

    Medicine.findOne = () => ({ session() { return this }, lean: async () => null })
    await assert.rejects(getAvailableStock(medicineId), { statusCode: 404 })
  } finally {
    Medicine.findOne = originals.findOne
    Batch.aggregate = originals.aggregate
    Batch.find = originals.find
  }
})

test('low stock compares available batch inventory to reorder level for active medicines', async () => {
  const originalAggregate = Medicine.aggregate
  let pipeline
  Medicine.aggregate = async (value) => {
    pipeline = value
    return [{ name: 'Low Medicine', reorderLevel: 5, availableStock: 4 }]
  }
  try {
    const result = await getLowStockMedicines()
    assert.equal(result[0].availableStock, 4)
    assert.deepEqual(pipeline[0], { $match: { isActive: true } })
    assert.deepEqual(pipeline.at(-3), {
      $match: { $expr: { $lte: ['$availableStock', '$reorderLevel'] } },
    })
  } finally {
    Medicine.aggregate = originalAggregate
  }
})

test('near-expiry alert excludes expired/zero stock and supports configurable warning period', async () => {
  const originalAggregate = Batch.aggregate
  let pipeline
  Batch.aggregate = async (value) => {
    pipeline = value
    return []
  }
  const now = new Date('2026-01-01T00:00:00.000Z')
  try {
    await getNearExpiryBatches(10, now)
    assert.equal(pipeline[0].$match.quantity.$gt, 0)
    assert.equal(pipeline[0].$match.expiryDate.$gt, now)
    assert.equal(
      pipeline[0].$match.expiryDate.$lte.toISOString(),
      new Date(now.getTime() + 10 * day).toISOString(),
    )
    assert.equal(pipeline.some((stage) => stage.$match?.['medicine.isActive'] === true), true)
    await assert.rejects(getNearExpiryBatches(0, now), { statusCode: 400 })
  } finally {
    Batch.aggregate = originalAggregate
  }
})

test('expired batch alert includes only positive expired inventory for active medicines', async () => {
  const originalAggregate = Batch.aggregate
  let pipeline
  Batch.aggregate = async (value) => {
    pipeline = value
    return [{ batchNumber: 'EXPIRED', quantity: 3 }]
  }
  const now = new Date('2026-02-01T00:00:00.000Z')
  try {
    const result = await getExpiredBatches(now)
    assert.equal(result[0].quantity, 3)
    assert.equal(pipeline[0].$match.quantity.$gt, 0)
    assert.equal(pipeline[0].$match.expiryDate.$lte, now)
    assert.equal(pipeline.some((stage) => stage.$match?.['medicine.isActive'] === true), true)
  } finally {
    Batch.aggregate = originalAggregate
  }
})

test('stock valuation calculates cost and retail amounts from active medicine batches', async () => {
  const originalAggregate = Batch.aggregate
  let pipeline
  Batch.aggregate = async (value) => {
    pipeline = value
    return [{ totalUnits: 8, totalCostValue: 20, totalRetailValue: 36 }]
  }
  try {
    assert.deepEqual(await getStockValuation(), {
      totalUnits: 8,
      totalCostValue: 20,
      totalRetailValue: 36,
    })
    assert.equal(pipeline[0].$match.quantity.$gt, 0)
    assert.equal(pipeline.some((stage) => stage.$match?.['medicine.isActive'] === true), true)
  } finally {
    Batch.aggregate = originalAggregate
  }
})
