import { createReturn, listReturns } from '../services/returnService.js'

export async function postReturn(req, res) {
  const { returnRecord, replayed } = await createReturn({
    ...req.validated.body,
    processedBy: req.user._id,
  })
  res.status(replayed ? 200 : 201).json({ return: returnRecord, replayed })
}

export async function getReturns(req, res) {
  res.json(await listReturns(req.validated.query))
}
