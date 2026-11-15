import { createHash, randomUUID } from 'node:crypto'
import mongoose from 'mongoose'
import { AuditLog, Return, Sale } from '../models/index.js'

function httpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function money(value) {
  return Number(value.toFixed(2))
}

function hashRequest({ invoiceNumber, reason, items }) {
  return createHash('sha256')
    .update(JSON.stringify({ invoiceNumber, reason, items }))
    .digest('hex')
}

function assertSameRequest(existing, requestHash) {
  if (existing.requestHash !== requestHash) {
    throw httpError(409, 'Idempotency key was already used for a different return')
  }
}

async function findByKey(idempotencyKey, processedBy) {
  return Return.findOne({ idempotencyKey, processedBy }).select('+requestHash').lean()
}

export async function createReturn({
  idempotencyKey,
  invoiceNumber,
  reason,
  items,
  processedBy,
}) {
  const requestHash = hashRequest({ invoiceNumber, reason, items })
  const existing = await findByKey(idempotencyKey, processedBy)
  if (existing) {
    assertSameRequest(existing, requestHash)
    return { returnRecord: existing, replayed: true }
  }

  const quantitiesByBatch = new Map()
  for (const item of items) {
    quantitiesByBatch.set(
      item.batch,
      (quantitiesByBatch.get(item.batch) ?? 0) + item.quantity,
    )
  }

  const session = await mongoose.startSession()
  let result
  try {
    await session.withTransaction(async () => {
      const prior = await Return.findOne({ idempotencyKey, processedBy })
        .select('+requestHash')
        .session(session)
        .lean()
      if (prior) {
        assertSameRequest(prior, requestHash)
        result = { returnRecord: prior, replayed: true }
        return
      }

      const sale = await Sale.findOne({ invoiceNumber }).session(session)
      if (!sale || sale.status !== 'completed') {
        throw httpError(404, 'Completed sale invoice not found')
      }

      const returnItems = []
      for (const [batchId, quantity] of quantitiesByBatch) {
        const saleItem = sale.items.find((item) => item.batch.toString() === batchId)
        if (!saleItem) throw httpError(400, 'Batch is not part of the original sale')
        const returnedQuantity = saleItem.returnedQuantity ?? 0
        if (quantity > saleItem.quantity - returnedQuantity) {
          throw httpError(409, 'Return quantity exceeds the remaining eligible quantity')
        }
        const maximumPriorReturn = saleItem.quantity - quantity
        const eligibleReturnCount = {
          $or: [
            { returnedQuantity: { $lte: maximumPriorReturn } },
            { returnedQuantity: { $exists: false } },
          ],
        }

        const update = await Sale.updateOne(
          {
            _id: sale._id,
            items: {
              $elemMatch: {
                batch: saleItem.batch,
                ...eligibleReturnCount,
              },
            },
          },
          { $inc: { 'items.$.returnedQuantity': quantity } },
          { session },
        )
        if (update.modifiedCount !== 1) {
          throw httpError(409, 'Return quantity changed concurrently; retry the request')
        }

        returnItems.push({
          medicine: saleItem.medicine,
          batch: saleItem.batch,
          batchNumber: saleItem.batchNumber,
          quantity,
          unitPrice: saleItem.unitPrice,
          refundAmount: money(quantity * saleItem.unitPrice),
        })
      }

      const totalAmount = money(
        returnItems.reduce((sum, item) => sum + item.refundAmount, 0),
      )
      const returnRecord = new Return({
        returnReference: `RET-${randomUUID()}`,
        idempotencyKey,
        requestHash,
        sale: sale._id,
        invoiceNumber: sale.invoiceNumber,
        processedBy,
        reason,
        items: returnItems,
        totalAmount,
        status: 'pending_inspection',
      })
      await returnRecord.save({ session })
      await AuditLog.create(
        [
          {
            performedBy: processedBy,
            action: 'sale.returned',
            entityType: 'Sale',
            entityId: sale._id,
            details: {
              returnReference: returnRecord.returnReference,
              totalAmount,
              reason,
              status: 'pending_inspection',
            },
          },
        ],
        { session, ordered: true },
      )
      result = { returnRecord, replayed: false }
    })
    return result
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await findByKey(idempotencyKey, processedBy)
      if (duplicate) {
        assertSameRequest(duplicate, requestHash)
        return { returnRecord: duplicate, replayed: true }
      }
    }
    throw error
  } finally {
    await session.endSession()
  }
}

export async function listReturns({ page, limit }) {
  const [returns, total] = await Promise.all([
    Return.find()
      .populate('sale', 'invoiceNumber saleDate')
      .populate('processedBy', 'name email')
      .sort({ createdAt: -1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Return.countDocuments(),
  ])
  return { returns, total, page, limit }
}
