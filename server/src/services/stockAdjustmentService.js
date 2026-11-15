import mongoose from 'mongoose'
import { AuditLog, Batch, StockMovement } from '../models/index.js'

function httpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

export async function adjustBatchStock({
  batch: batchId,
  adjustmentType,
  quantityChange,
  reason,
  performedBy,
}) {
  const session = await mongoose.startSession()
  let movement

  try {
    await session.withTransaction(async () => {
      const batch = await Batch.findById(batchId).session(session)
      if (!batch) throw httpError(404, 'Batch not found')
      if (adjustmentType === 'expired' && batch.expiryDate > new Date()) {
        throw httpError(400, 'Expired-stock adjustment requires an expired batch')
      }
      const previousQuantity = batch.quantity
      const newQuantity = previousQuantity + quantityChange
      if (newQuantity < 0) throw httpError(409, 'Adjustment would make batch stock negative')

      const update = await Batch.updateOne(
        {
          _id: batchId,
          quantity: {
            $eq: previousQuantity,
            ...(quantityChange < 0 ? { $gte: Math.abs(quantityChange) } : {}),
          },
        },
        { $inc: { quantity: quantityChange } },
        { session, ordered: true },
      )
      if (update.modifiedCount !== 1) {
        throw httpError(409, 'Inventory changed during adjustment; retry the request')
      }

      const [createdMovement] = await StockMovement.create(
        [
          {
            medicine: batch.medicine,
            batch: batch._id,
            movementType: 'adjustment',
            quantityChanged: quantityChange,
            previousQuantity,
            newQuantity,
            reason: `${adjustmentType}: ${reason}`,
            performedBy,
          },
        ],
        { session, ordered: true },
      )
      await AuditLog.create(
        [
          {
            performedBy,
            action: 'inventory.adjusted',
            entityType: 'Batch',
            entityId: batch._id,
            details: {
              adjustmentType,
              quantityChange,
              previousQuantity,
              newQuantity,
              reason,
              stockMovement: createdMovement._id,
            },
          },
        ],
        { session },
      )
      movement = createdMovement
    })
    return movement
  } finally {
    await session.endSession()
  }
}
