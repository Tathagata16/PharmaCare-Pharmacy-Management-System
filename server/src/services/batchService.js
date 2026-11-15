import { Batch } from '../models/index.js'

function httpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

export async function createReceivedBatch(data, session) {
  if (!(data.expiryDate instanceof Date) || !Number.isFinite(data.expiryDate.getTime())) {
    throw httpError(400, 'Batch expiry date is invalid')
  }
  if (data.expiryDate <= new Date()) {
    throw httpError(400, 'Cannot receive an expired batch')
  }
  const existingBatch = await Batch.exists({
    medicine: data.medicine,
    batchNumber: data.batchNumber,
  }).session(session)
  if (existingBatch) {
    throw httpError(409, 'Batch number already exists for this medicine')
  }

  const [batch] = await Batch.create([data], { session, ordered: true })
  return batch
}

export async function listBatches({
  medicine,
  supplier,
  includeExpired,
  page,
  limit,
  sortOrder,
}) {
  const filter = { quantity: { $gt: 0 } }
  if (medicine) filter.medicine = medicine
  if (supplier) filter.supplier = supplier
  if (!includeExpired) filter.expiryDate = { $gt: new Date() }

  const sort = { expiryDate: sortOrder === 'asc' ? 1 : -1, _id: 1 }
  const activeMedicineStages = [
    { $lookup: { from: 'medicines', localField: 'medicine', foreignField: '_id', as: 'medicine' } },
    { $unwind: '$medicine' },
    { $match: { 'medicine.isActive': true } },
  ]
  const [batches, [count]] = await Promise.all([
    Batch.aggregate([
      { $match: filter },
      ...activeMedicineStages,
      { $lookup: { from: 'suppliers', localField: 'supplier', foreignField: '_id', as: 'supplier' } },
      { $unwind: { path: '$supplier', preserveNullAndEmptyArrays: true } },
      { $sort: sort },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $project: {
          medicine: { _id: '$medicine._id', name: '$medicine.name', genericName: '$medicine.genericName', brand: '$medicine.brand' },
          supplier: { _id: '$supplier._id', name: '$supplier.name' },
          batchNumber: 1,
          quantity: 1,
          purchasePrice: 1,
          sellingPrice: 1,
          expiryDate: 1,
          receivedDate: 1,
        },
      },
    ]),
    Batch.aggregate([
      { $match: filter },
      ...activeMedicineStages,
      { $count: 'total' },
    ]),
  ])
  return { batches, total: count?.total ?? 0, page, limit }
}

export async function listSellableBatches(medicineId, { session } = {}) {
  const query = Batch.find({
    medicine: medicineId,
    quantity: { $gt: 0 },
    expiryDate: { $gt: new Date() },
  }).sort({ expiryDate: 1, _id: 1 })

  if (session) query.session(session)
  return query.lean()
}
