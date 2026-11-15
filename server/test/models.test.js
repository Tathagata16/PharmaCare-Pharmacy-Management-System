import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  AuditLog,
  Batch,
  Category,
  Medicine,
  Purchase,
  Return,
  Sale,
  StockMovement,
  Supplier,
  User,
} from '../src/models/index.js'

const objectId = () => '507f1f77bcf86cd799439011'

test('all requested Mongoose models are registered and exported', () => {
  assert.deepEqual(
    [User, Category, Medicine, Supplier, Batch, Purchase, Return, Sale, StockMovement, AuditLog]
      .map((model) => model.modelName)
      .sort(),
    [
      'AuditLog',
      'Batch',
      'Category',
      'Medicine',
      'Purchase',
      'Return',
      'Sale',
      'StockMovement',
      'Supplier',
      'User',
    ],
  )
})

test('User normalizes email, hides password hash, and enforces roles', async () => {
  const user = new User({
    name: ' Demo Cashier ',
    email: 'CASHIER@EXAMPLE.TEST',
    password: 'a-demo-password',
    role: 'owner',
  })

  assert.equal(user.email, 'cashier@example.test')
  assert.equal(user.passwordHash, 'a-demo-password')
  assert.equal(User.schema.path('passwordHash').options.select, false)
  await assert.rejects(user.validate(), (error) => {
    assert.ok(error.errors.role)
    return true
  })
  assert.ok(User.schema.indexes().some(([index, options]) => index.email === 1 && options.unique))
})

test('Batch rejects negative or fractional stock and scopes batch uniqueness by medicine', async () => {
  const batch = new Batch({
    medicine: objectId(),
    supplier: objectId(),
    batchNumber: 'DEMO-1',
    quantity: -1,
    purchasePrice: 1,
    sellingPrice: 2,
    expiryDate: new Date('2028-01-01'),
  })

  await assert.rejects(batch.validate(), (error) => {
    assert.ok(error.errors.quantity)
    return true
  })
  assert.ok(
    Batch.schema.indexes().some(
      ([index, options]) =>
        index.medicine === 1 && index.batchNumber === 1 && options.unique,
    ),
  )
})

test('Medicine has no independently editable stock field', () => {
  assert.equal(Medicine.schema.path('quantity'), undefined)
  assert.equal(Medicine.schema.path('stock'), undefined)
  assert.equal(Medicine.schema.path('category').options.ref, 'Category')
})

test('Purchase and Sale require at least one valid item', async () => {
  const purchase = new Purchase({
    supplier: objectId(),
    invoiceNumber: 'PUR-1',
    items: [],
    totalAmount: 0,
  })
  const sale = new Sale({
    invoiceNumber: 'SALE-1',
    items: [
      {
        medicine: objectId(),
        batch: objectId(),
        quantity: 1,
        unitPrice: 2,
        lineTotal: 2,
      },
    ],
    subtotal: 2,
    totalAmount: 2,
    paymentMethod: 'cash',
    soldBy: objectId(),
  })

  await assert.rejects(purchase.validate(), (error) => {
    assert.ok(error.errors.items)
    return true
  })
  await assert.rejects(sale.validate(), (error) => {
    assert.ok(error.errors['items.0.medicineName'])
    return true
  })
})

test('StockMovement rejects negative resulting stock and inconsistent transitions', async () => {
  const movement = new StockMovement({
    medicine: objectId(),
    batch: objectId(),
    movementType: 'sale',
    quantityChanged: -2,
    previousQuantity: 1,
    newQuantity: -1,
    reason: 'Demo validation',
  })

  await assert.rejects(movement.validate(), (error) => {
    assert.ok(error.errors.newQuantity)
    return true
  })
  assert.equal(StockMovement.schema.path('quantityChanged').options.immutable, true)
})

test('StockMovement and AuditLog reject mutation and deletion', async () => {
  assert.equal(AuditLog.schema.path('performedBy').options.immutable, true)
  assert.equal(AuditLog.schema.path('details').options.immutable, true)
  assert.equal(StockMovement.schema.path('timestamp').options.immutable, true)
  await assert.rejects(
    StockMovement.deleteOne({}),
    /StockMovement records are append-only/,
  )
  await assert.rejects(
    AuditLog.updateOne({}, { $set: { action: 'changed' } }),
    /AuditLog records are append-only/,
  )
})
