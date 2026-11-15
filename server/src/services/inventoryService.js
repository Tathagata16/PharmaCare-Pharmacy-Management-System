import { Batch, Medicine } from '../models/index.js'

function httpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

async function getActiveMedicine(medicineId, session) {
  let query = Medicine.findOne({ _id: medicineId, isActive: true })
  if (session) query = query.session(session)
  const medicine = await query.lean()
  if (!medicine) throw httpError(404, 'Active medicine not found')
  return medicine
}

export async function getAvailableStock(medicineId, { session } = {}) {
  await getActiveMedicine(medicineId, session)
  const aggregate = Batch.aggregate([
    {
      $match: {
        medicine: medicineId,
        quantity: { $gt: 0 },
        expiryDate: { $gt: new Date() },
      },
    },
    { $group: { _id: null, quantity: { $sum: '$quantity' } } },
  ])
  if (session) aggregate.session(session)
  const [result] = await aggregate
  return result?.quantity ?? 0
}

export async function getBatchWiseStock(medicineId, { session } = {}) {
  const medicine = await getActiveMedicine(medicineId, session)
  let query = Batch.find({
    medicine: medicineId,
    quantity: { $gt: 0 },
    expiryDate: { $gt: new Date() },
  }).sort({ expiryDate: 1, _id: 1 })
  if (session) query = query.session(session)
  const batches = await query.lean()
  return {
    medicine,
    batches,
    availableStock: batches.reduce((total, batch) => total + batch.quantity, 0),
  }
}

export async function allocateStockFEFO(medicineId, quantity, session) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw httpError(400, 'Requested quantity must be a positive whole number')
  }
  const medicine = await getActiveMedicine(medicineId, session)
  const now = new Date()
  const batches = await Batch.find({
    medicine: medicineId,
    quantity: { $gt: 0 },
    expiryDate: { $gt: now },
  })
    .sort({ expiryDate: 1, _id: 1 })
    .session(session)
    .lean()

  const totalAvailable = batches.reduce((total, batch) => total + batch.quantity, 0)
  if (totalAvailable < quantity) {
    throw httpError(409, `Insufficient stock for ${medicine.name}`)
  }

  let remaining = quantity
  const allocations = []
  for (const batch of batches) {
    if (remaining === 0) break
    const deducted = Math.min(batch.quantity, remaining)
    const update = await Batch.updateOne(
      {
        _id: batch._id,
        medicine: medicineId,
        quantity: { $gte: deducted },
        expiryDate: { $gt: now },
      },
      { $inc: { quantity: -deducted } },
      { session },
    )
    if (update.modifiedCount !== 1) {
      throw httpError(409, 'Inventory changed during allocation; retry the request')
    }

    allocations.push({
      medicine,
      batch,
      quantity: deducted,
      previousQuantity: batch.quantity,
      newQuantity: batch.quantity - deducted,
    })
    remaining -= deducted
  }

  if (remaining !== 0) {
    throw httpError(409, `Insufficient stock for ${medicine.name}`)
  }
  return allocations
}

async function getBatchAlertResults(match, { warningDays, now } = {}) {
  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: Medicine.collection.name,
        localField: 'medicine',
        foreignField: '_id',
        as: 'medicine',
      },
    },
    { $unwind: '$medicine' },
    { $match: { 'medicine.isActive': true } },
    {
      $project: {
        medicine: { _id: '$medicine._id', name: '$medicine.name', reorderLevel: '$medicine.reorderLevel' },
        supplier: 1,
        batchNumber: 1,
        quantity: 1,
        purchasePrice: 1,
        sellingPrice: 1,
        expiryDate: 1,
        receivedDate: 1,
      },
    },
  ]
  if (warningDays !== undefined) {
    pipeline[0].$match.expiryDate = {
      $gt: now,
      $lte: new Date(now.getTime() + warningDays * 24 * 60 * 60 * 1000),
    }
  }
  return Batch.aggregate(pipeline)
}

export async function getLowStockMedicines() {
  return Medicine.aggregate([
    { $match: { isActive: true } },
    {
      $lookup: {
        from: Batch.collection.name,
        let: { medicineId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$medicine', '$$medicineId'] },
                  { $gt: ['$expiryDate', new Date()] },
                  { $gt: ['$quantity', 0] },
                ],
              },
            },
          },
          { $group: { _id: null, quantity: { $sum: '$quantity' } } },
        ],
        as: 'stock',
      },
    },
    {
      $addFields: {
        availableStock: { $ifNull: [{ $arrayElemAt: ['$stock.quantity', 0] }, 0] },
      },
    },
    { $match: { $expr: { $lte: ['$availableStock', '$reorderLevel'] } } },
    { $project: { stock: 0 } },
    { $sort: { availableStock: 1, name: 1 } },
  ])
}

export async function getNearExpiryBatches(warningDays = 30, now = new Date()) {
  if (!Number.isInteger(warningDays) || warningDays < 1 || warningDays > 365) {
    throw httpError(400, 'warningDays must be a whole number between 1 and 365')
  }
  return getBatchAlertResults(
    { quantity: { $gt: 0 } },
    { warningDays, now },
  )
}

export async function getExpiredBatches(now = new Date()) {
  return getBatchAlertResults({
    quantity: { $gt: 0 },
    expiryDate: { $lte: now },
  })
}

export async function getStockValuation() {
  const [result] = await Batch.aggregate([
    { $match: { quantity: { $gt: 0 } } },
    {
      $lookup: {
        from: Medicine.collection.name,
        localField: 'medicine',
        foreignField: '_id',
        as: 'medicine',
      },
    },
    { $unwind: '$medicine' },
    { $match: { 'medicine.isActive': true } },
    {
      $group: {
        _id: null,
        totalUnits: { $sum: '$quantity' },
        totalCostValue: { $sum: { $multiply: ['$quantity', '$purchasePrice'] } },
        totalRetailValue: { $sum: { $multiply: ['$quantity', '$sellingPrice'] } },
      },
    },
    { $project: { _id: 0, totalUnits: 1, totalCostValue: 1, totalRetailValue: 1 } },
  ])
  return result ?? { totalUnits: 0, totalCostValue: 0, totalRetailValue: 0 }
}
