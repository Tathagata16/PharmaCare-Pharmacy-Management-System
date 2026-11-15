import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'

const [
  { AuditLog, Batch, Return, Sale, StockMovement },
  mongoose,
  { createReturn },
  { adjustBatchStock },
  { returnCreateSchema },
  { stockAdjustmentSchema },
] = await Promise.all([
  import('../src/models/index.js'),
  import('mongoose'),
  import('../src/services/returnService.js'),
  import('../src/services/stockAdjustmentService.js'),
  import('../src/validators/returnValidators.js'),
  import('../src/validators/inventoryValidators.js'),
])

const saleId = new mongoose.default.Types.ObjectId()
const batchId = new mongoose.default.Types.ObjectId()
const userId = new mongoose.default.Types.ObjectId()
const returnInput = {
  idempotencyKey: 'return-request-001',
  invoiceNumber: 'SALE-0001',
  reason: 'Customer returned unopened package',
  items: [{ batch: batchId.toString(), quantity: 1 }],
  processedBy: userId,
}

function installReturnMocks({ alreadyReturned = 0, updateCount = 1, existingReturn } = {}) {
  const originals = {
    startSession: mongoose.default.startSession,
    returnFindOne: Return.findOne,
    returnSave: Return.prototype.save,
    saleFindOne: Sale.findOne,
    saleUpdate: Sale.updateOne,
    auditCreate: AuditLog.create,
  }
  const state = { transactionCount: 0, ended: 0, returnRecord: undefined, audit: undefined, saleUpdateOptions: undefined }
  mongoose.default.startSession = async () => ({
    withTransaction: async (callback) => {
      state.transactionCount += 1
      return callback()
    },
    endSession: async () => { state.ended += 1 },
  })
  Return.findOne = () => ({
    select() { return this },
    session() { return this },
    lean: async () => existingReturn ?? null,
  })
  Return.prototype.save = async function save(options) {
    assert.ok(options.session)
    state.returnRecord = this
    return this
  }
  Sale.findOne = () => ({
    session: async () => ({
      _id: saleId,
      invoiceNumber: 'SALE-0001',
      status: 'completed',
      items: [{
        medicine: new mongoose.default.Types.ObjectId(),
        batch: batchId,
        batchNumber: 'BATCH-1',
        quantity: 2,
        returnedQuantity: alreadyReturned,
        unitPrice: 10,
      }],
    }),
  })
  Sale.updateOne = async (_filter, update, options) => {
    state.saleUpdateOptions = options
    state.saleUpdate = update
    return { modifiedCount: updateCount }
  }
  AuditLog.create = async (records, options) => {
    assert.ok(options.session)
    state.audit = records[0]
    return records
  }
  return {
    state,
    restore() {
      mongoose.default.startSession = originals.startSession
      Return.findOne = originals.returnFindOne
      Return.prototype.save = originals.returnSave
      Sale.findOne = originals.saleFindOne
      Sale.updateOne = originals.saleUpdate
      AuditLog.create = originals.auditCreate
    },
  }
}

test('return validator requires an original invoice, reason, positive quantities, and unique key', () => {
  const { idempotencyKey, invoiceNumber, reason, items } = returnInput
  const body = { idempotencyKey, invoiceNumber, reason, items }
  assert.equal(returnCreateSchema.safeParse({ body }).success, true)
  assert.equal(
    returnCreateSchema.safeParse({
      body: { ...body, items: [{ batch: batchId.toString(), quantity: 0 }] },
    }).success,
    false,
  )
  assert.equal(returnCreateSchema.safeParse({ body: { ...body, reason: ' ' } }).success, false)
})

test('return references sale, caps quantities, records amount and remains pending inspection', async () => {
  const mocks = installReturnMocks()
  try {
    const result = await createReturn(returnInput)
    assert.equal(result.replayed, false)
    assert.equal(result.returnRecord.sale.toString(), saleId.toString())
    assert.equal(result.returnRecord.invoiceNumber, 'SALE-0001')
    assert.equal(result.returnRecord.totalAmount, 10)
    assert.equal(result.returnRecord.status, 'pending_inspection')
    assert.equal(mocks.state.saleUpdateOptions.session !== undefined, true)
    assert.equal(mocks.state.saleUpdate['$inc']['items.$.returnedQuantity'], 1)
    assert.equal(mocks.state.audit.action, 'sale.returned')
    assert.equal(mocks.state.audit.entityId.toString(), saleId.toString())
  } finally {
    mocks.restore()
  }
})

test('return rejects quantities exceeding original quantity minus prior returns', async () => {
  const mocks = installReturnMocks({ alreadyReturned: 1 })
  try {
    await assert.rejects(
      createReturn({
        ...returnInput,
        items: [{ batch: batchId.toString(), quantity: 2 }],
      }),
      { statusCode: 409 },
    )
    assert.equal(mocks.state.returnRecord, undefined)
    assert.equal(mocks.state.audit, undefined)
  } finally {
    mocks.restore()
  }
})

test('return uses conditional update to reject a concurrent excessive return', async () => {
  const mocks = installReturnMocks({ updateCount: 0 })
  try {
    await assert.rejects(createReturn(returnInput), { statusCode: 409 })
    assert.equal(mocks.state.returnRecord, undefined)
  } finally {
    mocks.restore()
  }
})

test('duplicate return key replays the original record and rejects changed payloads', async () => {
  const { invoiceNumber, reason, items } = returnInput
  const requestHash = createHash('sha256')
    .update(JSON.stringify({ invoiceNumber, reason, items }))
    .digest('hex')
  const mocks = installReturnMocks({
    existingReturn: {
      requestHash,
      returnReference: 'RET-ORIGINAL',
    },
  })
  try {
    const result = await createReturn(returnInput)
    assert.equal(result.returnRecord.returnReference, 'RET-ORIGINAL')
    assert.equal(result.replayed, true)
    assert.equal(mocks.state.transactionCount, 0)
    await assert.rejects(
      createReturn({ ...returnInput, reason: 'Different reason' }),
      { statusCode: 409 },
    )
  } finally {
    mocks.restore()
  }
})

test('stock adjustment validator rejects zero changes and positive damaged stock', () => {
  const base = { batch: batchId.toString(), reason: 'Inventory count', adjustmentType: 'other' }
  assert.equal(stockAdjustmentSchema.safeParse({ body: { ...base, quantityChange: 0 } }).success, false)
  assert.equal(
    stockAdjustmentSchema.safeParse({
      body: { ...base, adjustmentType: 'damaged', quantityChange: 2 },
    }).success,
    false,
  )
  assert.equal(
    stockAdjustmentSchema.safeParse({
      body: { ...base, adjustmentType: 'physical_correction', quantityChange: -2 },
    }).success,
    true,
  )
})

test('stock adjustment atomically records movement and audit event', async () => {
  const originals = {
    startSession: mongoose.default.startSession,
    findById: Batch.findById,
    updateOne: Batch.updateOne,
    movementCreate: StockMovement.create,
    auditCreate: AuditLog.create,
  }
  const session = {
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  }
  let movement
  let audit
  mongoose.default.startSession = async () => session
  Batch.findById = () => ({
    session: async () => ({
      _id: batchId,
      medicine: new mongoose.default.Types.ObjectId(),
      quantity: 5,
    }),
  })
  Batch.updateOne = async (filter, update, options) => {
    assert.equal(filter.quantity.$eq, 5)
    assert.equal(filter.quantity.$gte, 2)
    assert.equal(update.$inc.quantity, -2)
    assert.equal(options.session, session)
    return { modifiedCount: 1 }
  }
  StockMovement.create = async (records, options) => {
    assert.equal(options.session, session)
    movement = records[0]
    return [{ ...movement, _id: new mongoose.default.Types.ObjectId() }]
  }
  AuditLog.create = async (records, options) => {
    assert.equal(options.session, session)
    audit = records[0]
    return records
  }
  try {
    const result = await adjustBatchStock({
      batch: batchId,
      adjustmentType: 'damaged',
      quantityChange: -2,
      reason: 'Damaged packaging',
      performedBy: userId,
    })
    assert.equal(result.quantityChanged, -2)
    assert.equal(result.previousQuantity, 5)
    assert.equal(result.newQuantity, 3)
    assert.equal(audit.action, 'inventory.adjusted')
  } finally {
    mongoose.default.startSession = originals.startSession
    Batch.findById = originals.findById
    Batch.updateOne = originals.updateOne
    StockMovement.create = originals.movementCreate
    AuditLog.create = originals.auditCreate
  }
})

test('expired-stock adjustment rejects a batch that has not expired', async () => {
  const originals = {
    startSession: mongoose.default.startSession,
    findById: Batch.findById,
    updateOne: Batch.updateOne,
  }
  mongoose.default.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  })
  Batch.findById = () => ({
    session: async () => ({
      _id: batchId,
      medicine: new mongoose.default.Types.ObjectId(),
      quantity: 5,
      expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }),
  })
  Batch.updateOne = async () => assert.fail('Non-expired batch must not be written off as expired')
  try {
    await assert.rejects(
      adjustBatchStock({
        batch: batchId,
        adjustmentType: 'expired',
        quantityChange: -1,
        reason: 'Expired stock write-off',
        performedBy: userId,
      }),
      { statusCode: 400 },
    )
  } finally {
    mongoose.default.startSession = originals.startSession
    Batch.findById = originals.findById
    Batch.updateOne = originals.updateOne
  }
})
