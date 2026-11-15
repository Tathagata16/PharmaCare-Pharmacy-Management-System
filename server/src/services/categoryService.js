import { Category, Medicine } from '../models/index.js'

function httpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function normalizeError(error) {
  if (error.code === 11000) return httpError(409, 'A category with this name already exists')
  if (error.name === 'ValidationError') return httpError(400, error.message)
  return error
}

export async function listCategories() {
  return Category.find().sort({ name: 1 }).lean()
}

export async function createCategory(data) {
  try {
    return await Category.create(data)
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function updateCategory(categoryId, data) {
  let category
  try {
    category = await Category.findByIdAndUpdate(
      categoryId,
      { $set: data },
      { new: true, runValidators: true },
    )
  } catch (error) {
    throw normalizeError(error)
  }
  if (!category) throw httpError(404, 'Category not found')
  return category
}

export async function deleteCategory(categoryId) {
  const category = await Category.findById(categoryId)
  if (!category) throw httpError(404, 'Category not found')
  if (await Medicine.exists({ category: categoryId })) {
    throw httpError(409, 'Category cannot be deleted while referenced by medicines')
  }
  await Category.deleteOne({ _id: categoryId })
}
