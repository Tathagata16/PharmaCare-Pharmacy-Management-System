import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../services/categoryService.js'

export async function getCategories(req, res) {
  res.json({ categories: await listCategories() })
}

export async function postCategory(req, res) {
  const category = await createCategory(req.validated.body)
  res.status(201).json({ category })
}

export async function patchCategory(req, res) {
  const category = await updateCategory(req.validated.params.categoryId, req.validated.body)
  res.json({ category })
}

export async function removeCategory(req, res) {
  await deleteCategory(req.validated.params.categoryId)
  res.status(204).end()
}
