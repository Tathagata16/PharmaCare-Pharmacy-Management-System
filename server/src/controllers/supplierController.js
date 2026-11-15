import {
  createSupplier,
  getSupplierById,
  listSupplierPurchases,
  listSuppliers,
  updateSupplier,
} from '../services/supplierService.js'

export async function postSupplier(req, res) {
  const supplier = await createSupplier(req.validated.body)
  res.status(201).json({ supplier })
}

export async function getSuppliers(req, res) {
  res.json(await listSuppliers(req.validated.query))
}

export async function getSupplier(req, res) {
  res.json({ supplier: await getSupplierById(req.validated.params.supplierId) })
}

export async function patchSupplier(req, res) {
  const supplier = await updateSupplier(req.validated.params.supplierId, req.validated.body)
  res.json({ supplier })
}

export async function patchSupplierActivation(req, res) {
  const supplier = await updateSupplier(req.validated.params.supplierId, req.validated.body)
  res.json({ supplier })
}

export async function getSupplierPurchases(req, res) {
  const { supplierId } = req.validated.params
  const history = await listSupplierPurchases(supplierId, req.validated.query)
  res.json(history)
}
