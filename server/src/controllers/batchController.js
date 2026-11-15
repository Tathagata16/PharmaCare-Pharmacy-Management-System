import { listBatches } from '../services/batchService.js'

export async function getBatches(req, res) {
  res.json(await listBatches(req.validated.query))
}
