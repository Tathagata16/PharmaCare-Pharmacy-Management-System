import assert from 'node:assert/strict'
import { test } from 'node:test'

const [
  { Purchase, Supplier, Medicine, Batch, StockMovement, AuditLog },
  mongoose,
  { createPurchase },
  { purchaseCreateSchema },
] = await Promise.all([
  import('../src/models/index.js'),
  import('mongoose'),
  import('../src/services/purchaseService.js'),
  import('../src/validators/purchaseValidators.js'),
])

const supplierId = '507f1f77bcf86cd799439011'
const medicineId = '507f1f77bcf86cd799439012'
const userId = '507f1f77bcf86cd799439013'
const purchaseInput = {
  supplier: supplierId,
  processedBy: userId,
  items: [{
    medicine: medicineId,
    batchNumber: 'BATCH-NEW',
    quantity: 6,
    purchasePrice: 3.25,
    sellingPrice: 5.5,
    expiryDate: new Date('2099-12-31T00:00:00.000Z'),
  }],
}

function installPurchaseMocks({ failure } = {}) {
  const originals = {
    startSession: mongoose.default.startSession,
    supplierFind: Supplier.findById,
    medicineFind: Medicine.find,
    batchExists: Batch.exists,
    batchCreate: Batch.create,
    purchaseSave: Purchase.prototype.save,
    movementCreate: StockMovement.create,
    auditCreate: AuditLog.create,
  }
  const state = {
    batches: [],
    purchase: undefined,
    movements: [],
    audits: [],
    rolledBack: false,
    transactionCalls: 0,
    sessionEnds: 0,
  }
  mongoose.default.startSession = async () => ({
    withTransaction: async (callback) => {
      state.transactionCalls += 1
      try {
        return await callback()
      } catch (error) {
        state.rolledBack = true
        throw error
      }
    },
    endSession: async () => { state.sessionEnds += 1 },
  })
  Supplier.findById = () => ({
    session: async () => ({ _id: supplierId, isActive: true }),
  })
  Medicine.find = () => ({
    select() { return this },
    session() { return this },
    lean: async () => [{ _id: medicineId }],
  })
  Batch.exists = () => ({ session: async () => null })
  Batch.create = async ([data], options) => {
    assert.ok(options.session)
    const batch = { ...data, _id: new mongoose.default.Types.ObjectId() }
    state.batches.push(batch)
    return [batch]
  }
  Purchase.prototype.save = async function save(options) {
    assert.ok(options.session)
    state.purchase = this
    return this
  }
  StockMovement.create = async (movements, options) => {
    assert.ok(options.session)
    if (failure === 'movement') throw new Error('movement write failed')
    state.movements.push(...movements)
    return movements
  }
  AuditLog.create = async (audits, options) => {
    assert.ok(options.session)
    if (failure === 'audit') throw new Error('audit write failed')
    state.audits.push(...audits)
    return audits
  }
  return {
    state,
    restore() {
      mongoose.default.startSession = originals.startSession
      Supplier.findById = originals.supplierFind
      Medicine.find = originals.medicineFind
      Batch.exists = originals.batchExists
      Batch.create = originals.batchCreate
      Purchase.prototype.save = originals.purchaseSave
      StockMovement.create = originals.movementCreate
      AuditLog.create = originals.auditCreate
    },
  }
}

test('purchase validation rejects zero quantities and malformed expiry dates', () => {
  const result = purchaseCreateSchema.safeParse({
    body: {
      supplier: supplierId,
      items: [{
        medicine: medicineId,
        batchNumber: 'B1',
        quantity: 0,
        purchasePrice: 3,
        sellingPrice: 5,
        expiryDate: 'invalid-date',
      }],
    },
  })
  assert.equal(result.success, false)
})

test('purchase transaction creates invoice, batches, purchase and stock movements atomically', async () => {
  const mocks = installPurchaseMocks()
  try {
    const purchase = await createPurchase(purchaseInput)
    assert.equal(purchase.supplier.toString(), supplierId)
    assert.equal(purchase.processedBy.toString(), userId)
    assert.equal(purchase.totalAmount, 19.5)
    assert.equal(purchase.status, 'received')
    assert.match(purchase.invoiceNumber, /^PUR-\d{8}-/)
    assert.equal(purchase.items[0].batchNumber, 'BATCH-NEW')
    assert.equal(purchase.items[0].sellingPrice, 5.5)
    assert.equal(mocks.state.batches[0].quantity, 6)
    assert.equal(mocks.state.movements[0].previousQuantity, 0)
    assert.equal(mocks.state.movements[0].newQuantity, 6)
    assert.equal(mocks.state.movements[0].reference.id.toString(), purchase._id.toString())
    assert.equal(mocks.state.audits[0].action, 'purchase.received')
    assert.equal(mocks.state.transactionCalls, 1)
  } finally {
    mocks.restore()
  }
})

test('transaction failure while recording movements aborts purchase workflow', async () => {
  const mocks = installPurchaseMocks({ failure: 'movement' })
  try {
    await assert.rejects(createPurchase(purchaseInput), /movement write failed/)
    assert.equal(mocks.state.rolledBack, true)
    assert.equal(mocks.state.transactionCalls, 1)
    assert.equal(mocks.state.audits.length, 0)
  } finally {
    mocks.restore()
  }
})

test('transaction failure while auditing aborts purchase workflow', async () => {
  const mocks = installPurchaseMocks({ failure: 'audit' })
  try {
    await assert.rejects(createPurchase(purchaseInput), /audit write failed/)
    assert.equal(mocks.state.rolledBack, true)
    assert.equal(mocks.state.transactionCalls, 1)
  } finally {
    mocks.restore()
  }
})
