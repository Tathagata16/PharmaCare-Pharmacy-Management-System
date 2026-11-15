import { Batch, Category, Medicine, Purchase, Sale } from '../models/index.js'

function httpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function assertCategoryExists(categoryId) {
  if (!(await Category.exists({ _id: categoryId }))) {
    throw httpError(400, 'Category does not exist')
  }
}

export async function listMedicines({
  search,
  name,
  genericName,
  category,
  manufacturer,
  page,
  limit,
  sortBy,
  sortOrder,
  includeInactive,
}) {
  const filter = {}
  if (!includeInactive) filter.isActive = true
  if (category) filter.category = category
  if (manufacturer) filter.manufacturer = new RegExp(escapeRegex(manufacturer), 'i')
  if (name) filter.name = new RegExp(escapeRegex(name), 'i')
  if (genericName) filter.genericName = new RegExp(escapeRegex(genericName), 'i')
  if (search) {
    const expression = new RegExp(escapeRegex(search), 'i')
    filter.$or = [{ name: expression }, { genericName: expression }]
  }

  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: 1 }
  const [medicines, total] = await Promise.all([
    Medicine.find(filter)
      .populate('category', 'name description')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Medicine.countDocuments(filter),
  ])
  return { medicines, total, page, limit }
}

export async function getCurrentMedicinePrices(medicineIds, now = new Date()) {
  if (!medicineIds.length) return new Map()
  const prices = await Batch.aggregate([
    {
      $match: {
        medicine: { $in: medicineIds },
        quantity: { $gt: 0 },
        expiryDate: { $gt: now },
      },
    },
    { $sort: { expiryDate: 1, _id: 1 } },
    {
      $group: {
        _id: '$medicine',
        price: { $first: '$sellingPrice' },
      },
    },
  ])
  return new Map(prices.map(({ _id, price }) => [_id.toString(), price]))
}

export async function getMedicineById(medicineId, { includeInactive }) {
  const filter = { _id: medicineId }
  if (!includeInactive) filter.isActive = true
  const medicine = await Medicine.findOne(filter).populate('category', 'name description').lean()
  if (!medicine) throw httpError(404, 'Medicine not found')
  return medicine
}

export async function createMedicine(data) {
  await assertCategoryExists(data.category)
  try {
    return await Medicine.create(data)
  } catch (error) {
    if (error.name === 'ValidationError') throw httpError(400, error.message)
    throw error
  }
}

export async function updateMedicine(medicineId, data) {
  if (data.category) await assertCategoryExists(data.category)
  let medicine
  try {
    medicine = await Medicine.findByIdAndUpdate(
      medicineId,
      { $set: data },
      { new: true, runValidators: true },
    ).populate('category', 'name description')
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      throw httpError(400, error.message)
    }
    throw error
  }
  if (!medicine) throw httpError(404, 'Medicine not found')
  return medicine
}

export async function deleteMedicine(medicineId) {
  const medicine = await Medicine.findById(medicineId)
  if (!medicine) throw httpError(404, 'Medicine not found')

  const [batchExists, saleExists, purchaseExists] = await Promise.all([
    Batch.exists({ medicine: medicineId }),
    Sale.exists({ 'items.medicine': medicineId }),
    Purchase.exists({ 'items.medicine': medicineId }),
  ])
  if (batchExists || saleExists || purchaseExists) {
    throw httpError(409, 'Medicine cannot be deleted while referenced by batches, sales, or purchases')
  }

  await Medicine.deleteOne({ _id: medicineId })
}
