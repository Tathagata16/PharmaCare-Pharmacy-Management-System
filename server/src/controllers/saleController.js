import {
  createInvoiceDetails,
  createSale,
  getSaleById,
  listSales,
} from '../services/saleService.js'

export async function postSale(req, res) {
  const { sale, replayed } = await createSale({
    ...req.validated.body,
    soldBy: req.user._id,
  })
  res.status(replayed ? 200 : 201).json({ sale, replayed })
}

export async function getSales(req, res) {
  const soldBy = req.user.role === 'cashier' ? req.user._id : undefined
  res.json(await listSales({ ...req.validated.query, soldBy }))
}

export async function getSale(req, res) {
  const sale = await getSaleById(req.validated.params.saleId)
  if (req.user.role === 'cashier' && sale.soldBy._id.toString() !== req.user.id) {
    return res.status(403).json({ error: 'Insufficient permissions' })
  }
  return res.json({ sale })
}

export async function getSaleInvoice(req, res) {
  const sale = await getSaleById(req.validated.params.saleId)
  if (req.user.role === 'cashier' && sale.soldBy._id.toString() !== req.user.id) {
    return res.status(403).json({ error: 'Insufficient permissions' })
  }
  return res.json({ invoice: createInvoiceDetails(sale) })
}

export async function getPrintableSaleInvoice(req, res) {
  const sale = await getSaleById(req.validated.params.saleId)
  if (req.user.role === 'cashier' && sale.soldBy._id.toString() !== req.user.id) {
    return res.status(403).json({ error: 'Insufficient permissions' })
  }
  const invoice = createInvoiceDetails(sale)
  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character])
  const rows = invoice.items
    .map(
      (item) => `<tr><td>${escapeHtml(item.medicineName)}</td><td>${escapeHtml(item.batchNumber)}</td><td>${item.quantity}</td><td>${item.unitPrice.toFixed(2)}</td><td>${item.lineTotal.toFixed(2)}</td></tr>`,
    )
    .join('')
  const dateTime = new Date(invoice.dateTime).toLocaleString()

  res.type('html').send(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(invoice.invoiceNumber)}</title>
<style>body{font:16px sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ccc;padding:.6rem;text-align:left}.totals{text-align:right;margin-top:1rem}@media print{button{display:none}}</style></head>
<body><button onclick="window.print()">Print invoice</button>
<h1>${escapeHtml(invoice.pharmacyName)}</h1>
<p>Invoice: ${escapeHtml(invoice.invoiceNumber)}<br>Date: ${escapeHtml(dateTime)}<br>Cashier: ${escapeHtml(invoice.cashierName)}</p>
<table><thead><tr><th>Medicine</th><th>Batch</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
<div class="totals"><p>Subtotal: ${invoice.subtotal.toFixed(2)}</p><p>Tax: ${invoice.tax.toFixed(2)}</p><p>Discount: ${invoice.discount.toFixed(2)}</p><h2>Grand total: ${invoice.grandTotal.toFixed(2)}</h2><p>Payment: ${escapeHtml(invoice.paymentMethod)}</p></div>
</body></html>`)
}
