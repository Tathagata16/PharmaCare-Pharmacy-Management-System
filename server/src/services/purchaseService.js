import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'
import { AuditLog, Medicine, Purchase, StockMovement, Supplier } from '../models/index.js'
import { createReceivedBatch } from './batchService.js'

function httpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function money(value) {
  return Number(value.toFixed(2))
}

function createInvoiceNumber() {
  return `PUR-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID()}`
}

export async function createPurchase({ supplier: supplierId, items, processedBy }) {
  const session = await mongoose.startSession()
  let createdPurchase

  try {
    await session.withTransaction(async () => {
      const supplier = await Supplier.findById(supplierId).session(session)
      if (!supplier || !supplier.isActive) {
        throw httpError(400, 'Supplier does not exist or is inactive')
      }

      const medicineIds = [...new Set(items.map(({ medicine }) => medicine))]
      const medicines = await Medicine.find({
        _id: { $in: medicineIds },
        isActive: true,
      })
        .select('_id')
        .session(session)
        .lean()
      if (medicines.length !== medicineIds.length) {
        throw httpError(400, 'One or more medicines do not exist or are inactive')
      }

      const purchaseId = new mongoose.Types.ObjectId()
      const purchaseItems = []
      const stockMovements = []

      for (const item of items) {
        const batch = await createReceivedBatch(
          {
            medicine: item.medicine,
            supplier: supplierId,
            batchNumber: item.batchNumber,
            quantity: item.quantity,
            purchasePrice: item.purchasePrice,
            sellingPrice: item.sellingPrice,
            expiryDate: item.expiryDate,
            receivedDate: new Date(),
          },
          session,
        )

        const lineTotal = money(item.quantity * item.purchasePrice)
        purchaseItems.push({
          medicine: item.medicine,
          batch: batch._id,
          batchNumber: item.batchNumber,
          quantity: item.quantity,
          unitPrice: item.purchasePrice,
          sellingPrice: item.sellingPrice,
          expiryDate: item.expiryDate,
          lineTotal,
        })
        stockMovements.push({
          medicine: item.medicine,
          batch: batch._id,
          movementType: 'purchase',
          quantityChanged: item.quantity,
          previousQuantity: 0,
          newQuantity: item.quantity,
          reason: `Purchase received: ${item.batchNumber}`,
          reference: { model: 'Purchase', id: purchaseId },
          performedBy: processedBy,
        })
      }

      const totalAmount = money(
        purchaseItems.reduce((sum, item) => sum + item.lineTotal, 0),
      )
      const purchase = new Purchase({
        _id: purchaseId,
        supplier: supplierId,
        invoiceNumber: createInvoiceNumber(),
        items: purchaseItems,
        totalAmount,
        processedBy,
        status: 'received',
      })
      await purchase.save({ session })
      await StockMovement.create(stockMovements, { session, ordered: true })
      await AuditLog.create(
        [
          {
            performedBy: processedBy,
            action: 'purchase.received',
            entityType: 'Purchase',
            entityId: purchaseId,
            details: {
              invoiceNumber: purchase.invoiceNumber,
              totalAmount,
              itemCount: purchaseItems.length,
            },
          },
        ],
        { session, ordered: true },
      )
      createdPurchase = purchase
    })

    return createdPurchase
  } catch (error) {
    if (error.code === 11000) {
      throw httpError(409, 'Batch number or purchase invoice already exists')
    }
    throw error
  } finally {
    await session.endSession()
  }
}

export async function listPurchases({ supplier, page, limit, sortOrder }) {
  const filter = supplier ? { supplier } : {}
  const sort = { purchaseDate: sortOrder === 'asc' ? 1 : -1, _id: 1 }
  const [purchases, total] = await Promise.all([
    Purchase.find(filter)
      .populate('supplier', 'name contactPerson email')
      .populate('processedBy', 'name email')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Purchase.countDocuments(filter),
  ])
  return { purchases, total, page, limit }
}

export async function getPurchaseById(purchaseId) {
  const purchase = await Purchase.findById(purchaseId)
    .populate('supplier', 'name contactPerson email phone address')
    .populate('processedBy', 'name email')
    .populate('items.medicine', 'name genericName brand')
    .populate('items.batch')
    .lean()
  if (!purchase) throw httpError(404, 'Purchase not found')
  return purchase
}
