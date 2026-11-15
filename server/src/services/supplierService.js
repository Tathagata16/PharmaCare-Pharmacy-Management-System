import { Purchase, Supplier } from '../models/index.js'

function httpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeError(error) {
  if (error.code === 11000) return httpError(409, 'A supplier with these details already exists')
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return httpError(400, error.message)
  }
  return error
}

export async function createSupplier(data) {
  try {
    return await Supplier.create(data)
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function listSuppliers({ search, isActive, page, limit, sortBy, sortOrder }) {
  const filter = {}
  if (isActive !== undefined) filter.isActive = isActive === 'true'
  if (search) {
    const expression = new RegExp(escapeRegex(search), 'i')
    filter.$or = [
      { name: expression },
      { contactPerson: expression },
      { email: expression },
      { phone: expression },
    ]
  }

  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: 1 }
  const [suppliers, total] = await Promise.all([
    Supplier.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Supplier.countDocuments(filter),
  ])
  return { suppliers, total, page, limit }
}

export async function getSupplierById(supplierId) {
  const supplier = await Supplier.findById(supplierId).lean()
  if (!supplier) throw httpError(404, 'Supplier not found')
  return supplier
}

export async function updateSupplier(supplierId, data) {
  let supplier
  try {
    supplier = await Supplier.findByIdAndUpdate(
      supplierId,
      { $set: data },
      { new: true, runValidators: true },
    )
  } catch (error) {
    throw normalizeError(error)
  }
  if (!supplier) throw httpError(404, 'Supplier not found')
  return supplier
}

export async function listSupplierPurchases(supplierId, { page, limit }) {
  if (!(await Supplier.exists({ _id: supplierId }))) {
    throw httpError(404, 'Supplier not found')
  }
  const filter = { supplier: supplierId }
  const [purchases, total] = await Promise.all([
    Purchase.find(filter)
      .populate('supplier', 'name contactPerson email phone')
      .populate('items.medicine', 'name genericName brand')
      .sort({ purchaseDate: -1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Purchase.countDocuments(filter),
  ])
  return { purchases, total, page, limit }
}
