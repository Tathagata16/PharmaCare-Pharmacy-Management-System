import {
  createPurchase,
  getPurchaseById,
  listPurchases,
} from '../services/purchaseService.js'

export async function postPurchase(req, res) {
  const purchase = await createPurchase({
    ...req.validated.body,
    processedBy: req.user._id,
  })
  res.status(201).json({ purchase })
}

export async function getPurchases(req, res) {
  res.json(await listPurchases(req.validated.query))
}

export async function getPurchase(req, res) {
  res.json({ purchase: await getPurchaseById(req.validated.params.purchaseId) })
}
