import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'

process.env.SALES_TAX_RATE ??= '0.1'
process.env.MAX_SALE_DISCOUNT_PERCENT ??= '20'
process.env.PHARMACY_NAME ??= 'Test Pharmacy'
process.env.JWT_SECRET ??= 'sales-test-secret-that-is-at-least-32-characters'
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/pharmacare-test'

const [{ Sale, Batch, Medicine, StockMovement, AuditLog }, { env }, { createSale, createInvoiceDetails }, mongoose] =
  await Promise.all([
    import('../src/models/index.js'),
    import('../src/config/env.js'),
    import('../src/services/saleService.js'),
    import('mongoose'),
  ])

const medicineId = '507f1f77bcf86cd799439011'
const userId = '507f1f77bcf86cd799439012'
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
const batchEarly = new (await import('mongoose')).default.Types.ObjectId()
const batchLater = new (await import('mongoose')).default.Types.ObjectId()
const batchSingle = new (await import('mongoose')).default.Types.ObjectId()

function installSaleMocks({ batches = [], priorSale, auditError } = {}) {
  const originals = {
    startSession: mongoose.default.startSession,
    findOne: Sale.findOne,
    save: Sale.prototype.save,
    medicineFindOne: Medicine.findOne,
    batchFind: Batch.find,
    batchUpdate: Batch.updateOne,
    movementCreate: StockMovement.create,
    auditCreate: AuditLog.create,
  }
  const state = {
    batches: batches.map((batch) => ({ ...batch })),
    movements: [],
    auditLogs: [],
    savedSale: undefined,
    transactions: 0,
    ended: 0,
  }
  mongoose.default.startSession = async () => ({
    withTransaction: async (callback) => {
      state.transactions += 1
      return callback()
    },
    endSession: async () => { state.ended += 1 },
  })
  Sale.findOne = () => ({
    select() { return this },
    session() { return this },
    lean: async () => priorSale ?? null,
  })
  Sale.prototype.save = async function save() {
    state.savedSale = this
    return this
  }
  Medicine.findOne = () => ({
    session() { return this },
    lean: async () => ({
      _id: medicineId,
      name: 'Test Medicine',
      genericName: 'Test Generic',
      brand: 'Test Brand',
      isActive: true,
    }),
  })
  Batch.find = (filter) => ({
    sort(sort) {
      assert.deepEqual(sort, { expiryDate: 1, _id: 1 })
      assert.ok(filter.expiryDate.$gt instanceof Date)
      assert.equal(filter.quantity.$gt, 0)
      return this
    },
    session() { return this },
    lean: async () => state.batches.map((batch) => ({ ...batch })),
  })
  Batch.updateOne = async (filter, update) => {
    const batch = state.batches.find(({ _id }) => _id.toString() === filter._id.toString())
    const amount = -update.$inc.quantity
    if (!batch || batch.quantity < amount || filter.quantity.$gte !== amount) {
      return { modifiedCount: 0 }
    }
    batch.quantity -= amount
    return { modifiedCount: 1 }
  }
  StockMovement.create = async (movements) => {
    state.movements.push(...movements)
    return movements
  }
  AuditLog.create = async (entries) => {
    if (auditError) throw auditError
    state.auditLogs.push(...entries)
    return entries
  }
  return {
    state,
    restore() {
      mongoose.default.startSession = originals.startSession
      Sale.findOne = originals.findOne
      Sale.prototype.save = originals.save
      Medicine.findOne = originals.medicineFindOne
      Batch.find = originals.batchFind
      Batch.updateOne = originals.batchUpdate
      StockMovement.create = originals.movementCreate
      AuditLog.create = originals.auditCreate
    },
  }
}

const saleRequest = {
  idempotencyKey: 'sale-request-0001',
  items: [{ medicine: medicineId, quantity: 5 }],
  discount: 0,
  paymentMethod: 'cash',
  soldBy: userId,
}

test('successful sale uses multiple FEFO batches, server prices, tax, invoice and movements', async () => {
  const mocks = installSaleMocks({
    batches: [
      {
        _id: batchEarly,
        batchNumber: 'EARLY',
        quantity: 2,
        sellingPrice: 10,
        expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
      {
        _id: batchLater,
        batchNumber: 'LATER',
        quantity: 5,
        sellingPrice: 12,
        expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      },
    ],
  })
  try {
    const { sale, replayed } = await createSale(saleRequest)
    assert.equal(replayed, false)
    assert.equal(sale.subtotal, 56)
    assert.equal(sale.taxRate, env.salesTaxRate)
    assert.equal(sale.tax, 5.6)
    assert.equal(sale.totalAmount, 61.6)
    assert.equal(sale.pharmacyName, env.pharmacyName)
    assert.equal(sale.soldBy.toString(), userId)
    assert.match(sale.invoiceNumber, /^SALE-\d{8}-/)
    assert.deepEqual(
      sale.items.map(({ batchNumber, quantity, unitPrice }) => [batchNumber, quantity, unitPrice]),
      [['EARLY', 2, 10], ['LATER', 3, 12]],
    )
    assert.deepEqual(mocks.state.movements.map(({ quantityChanged }) => quantityChanged), [-2, -3])
    assert.equal(mocks.state.movements.every(({ reference }) => reference.id.toString() === sale._id.toString()), true)
    assert.equal(mocks.state.auditLogs[0].action, 'sale.completed')
    assert.equal(mocks.state.transactions, 1)

    const invoice = createInvoiceDetails({
      ...sale.toObject(),
      soldBy: { name: 'Test Cashier' },
    })
    assert.equal(invoice.pharmacyName, env.pharmacyName)
    assert.equal(invoice.invoiceNumber, sale.invoiceNumber)
    assert.equal(invoice.cashierName, 'Test Cashier')
    assert.equal(invoice.items.length, 2)
    assert.equal(invoice.grandTotal, 61.6)
  } finally {
    mocks.restore()
  }
})

test('sale rejects insufficient or expired-only stock', async () => {
  const mocks = installSaleMocks({ batches: [] })
  try {
    await assert.rejects(createSale(saleRequest), { statusCode: 409 })
    assert.equal(mocks.state.movements.length, 0)
  } finally {
    mocks.restore()
  }
})

test('sale enforces the configured discount ceiling', async () => {
  const mocks = installSaleMocks({
    batches: [{ _id: batchSingle, batchNumber: 'B1', quantity: 10, sellingPrice: 10, expiryDate: tomorrow }],
  })
  try {
    await assert.rejects(
      createSale({ ...saleRequest, items: [{ medicine: medicineId, quantity: 1 }], discount: 3 }),
      { statusCode: 400 },
    )
    assert.equal(mocks.state.savedSale, undefined)
  } finally {
    mocks.restore()
  }
})

test('duplicate idempotency key returns the original sale and rejects a different payload', async () => {
  const requestHash = createHash('sha256')
    .update(JSON.stringify({
      items: saleRequest.items,
      discount: saleRequest.discount,
      paymentMethod: saleRequest.paymentMethod,
    }))
    .digest('hex')
  const original = {
    idempotencyKey: saleRequest.idempotencyKey,
    requestHash,
    invoiceNumber: 'SALE-ORIGINAL',
  }
  const mocks = installSaleMocks({ priorSale: original })
  try {
    const result = await createSale(saleRequest)
    assert.equal(result.sale.invoiceNumber, 'SALE-ORIGINAL')
    assert.equal(result.replayed, true)
    assert.equal(mocks.state.transactions, 0)
    await assert.rejects(
      createSale({ ...saleRequest, items: [{ medicine: medicineId, quantity: 2 }] }),
      { statusCode: 409 },
    )
  } finally {
    mocks.restore()
  }
})

test('sale transaction propagates stock movement or audit write failures', async () => {
  const mocks = installSaleMocks({
    batches: [{ _id: batchSingle, batchNumber: 'B1', quantity: 10, sellingPrice: 10, expiryDate: tomorrow }],
    auditError: new Error('audit write failed'),
  })
  try {
    await assert.rejects(createSale(saleRequest), /audit write failed/)
    assert.equal(mocks.state.transactions, 1)
  } finally {
    mocks.restore()
  }
})

test('concurrent sales cannot oversell the same batch', async () => {
  const mocks = installSaleMocks({
    batches: [{ _id: batchSingle, batchNumber: 'B1', quantity: 5, sellingPrice: 10, expiryDate: tomorrow }],
  })
  try {
    const results = await Promise.allSettled([
      createSale({ ...saleRequest, idempotencyKey: 'concurrent-sale-key-001', items: [{ medicine: medicineId, quantity: 4 }] }),
      createSale({ ...saleRequest, idempotencyKey: 'concurrent-sale-key-002', items: [{ medicine: medicineId, quantity: 4 }] }),
    ])
    assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1)
    assert.equal(results.filter(({ status }) => status === 'rejected').length, 1)
    assert.equal(mocks.state.batches[0].quantity, 1)
    assert.ok(mocks.state.batches[0].quantity >= 0)
  } finally {
    mocks.restore()
  }
})
