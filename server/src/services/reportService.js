import { AuditLog, Batch, Medicine, Purchase, Return, Sale, StockMovement, Supplier } from '../models/index.js'
import { getExpiredBatches, getLowStockMedicines, getNearExpiryBatches } from './inventoryService.js'

function dateBounds({ from, to }) {
  const match = {}
  if (from || to) {
    match.$gte = from ? new Date(from) : new Date(0)
    if (to) {
      const end = new Date(to)
      end.setUTCHours(23, 59, 59, 999)
      match.$lte = end
    }
  }
  return Object.keys(match).length ? match : undefined
}

function movementRangeMatch(range) {
  const timestamp = dateBounds(range)
  return timestamp ? { timestamp } : {}
}

export async function getDashboardMetrics(now = new Date()) {
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)
  const tomorrow = new Date(todayStart)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const [
    totalMedicines,
    totalSuppliers,
    stockSummary,
    todaySales,
    monthlySales,
    revenueSummary,
    lowStockMedicines,
    nearExpiryBatches,
    expiredBatches,
    recentSales,
  ] = await Promise.all([
    Medicine.countDocuments({ isActive: true }),
    Supplier.countDocuments({ isActive: true }),
    Batch.aggregate([
      { $match: { quantity: { $gt: 0 }, expiryDate: { $gt: now } } },
      {
        $lookup: {
          from: Medicine.collection.name,
          localField: 'medicine',
          foreignField: '_id',
          as: 'medicine',
        },
      },
      { $unwind: '$medicine' },
      { $match: { 'medicine.isActive': true } },
      { $group: { _id: null, totalAvailableStock: { $sum: '$quantity' } } },
    ]),
    Sale.aggregate([
      { $match: { status: 'completed', saleDate: { $gte: todayStart, $lt: tomorrow } } },
      { $group: { _id: null, salesCount: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
    ]),
    Sale.aggregate([
      { $match: { status: 'completed', saleDate: { $gte: monthStart, $lt: tomorrow } } },
      { $group: { _id: null, salesCount: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
    ]),
    Sale.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, salesCount: { $sum: 1 } } },
    ]),
    getLowStockMedicines(),
    getNearExpiryBatches(30, now),
    getExpiredBatches(now),
    Sale.find({ status: 'completed' })
      .populate('soldBy', 'name')
      .sort({ saleDate: -1, _id: -1 })
      .limit(10)
      .lean(),
  ])

  return {
    totalMedicines,
    totalSuppliers,
    totalAvailableStock: stockSummary[0]?.totalAvailableStock ?? 0,
    todaySales: todaySales[0] ?? { salesCount: 0, revenue: 0 },
    monthlySales: monthlySales[0] ?? { salesCount: 0, revenue: 0 },
    totalRevenue: revenueSummary[0]?.revenue ?? 0,
    lowStockMedicines,
    nearExpiryBatches,
    expiredBatches,
    recentSales,
  }
}

export async function getSalesReport({ period, from, to, page, limit, soldBy }) {
  const saleFilter = { status: 'completed' }
  const bounds = dateBounds({ from, to })
  if (bounds) saleFilter.saleDate = bounds
  if (soldBy) saleFilter.soldBy = soldBy

  const unit = { daily: 'day', weekly: 'week', monthly: 'month' }[period]
  const [results, totals] = await Promise.all([
    Sale.aggregate([
      { $match: saleFilter },
      {
        $group: {
          _id: { $dateTrunc: { date: '$saleDate', unit, startOfWeek: 'monday' } },
          salesCount: { $sum: 1 },
          subtotal: { $sum: '$subtotal' },
          tax: { $sum: '$tax' },
          discount: { $sum: '$discount' },
          revenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { _id: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ]),
    Sale.aggregate([
      { $match: saleFilter },
      {
        $group: {
          _id: null,
          salesCount: { $sum: 1 },
          subtotal: { $sum: '$subtotal' },
          tax: { $sum: '$tax' },
          discount: { $sum: '$discount' },
          revenue: { $sum: '$totalAmount' },
        },
      },
    ]),
  ])
  return {
    period,
    results,
    summary: totals[0] ?? { salesCount: 0, subtotal: 0, tax: 0, discount: 0, revenue: 0 },
    page,
    limit,
  }
}

async function getMovementTotals(filter) {
  const summary = await StockMovement.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$medicine',
        netQuantity: { $sum: '$quantityChanged' },
        purchases: {
          $sum: { $cond: [{ $eq: ['$movementType', 'purchase'] }, '$quantityChanged', 0] },
        },
        sales: {
          $sum: { $cond: [{ $eq: ['$movementType', 'sale'] }, { $abs: '$quantityChanged' }, 0] },
        },
        returns: {
          $sum: { $cond: [{ $eq: ['$movementType', 'return'] }, '$quantityChanged', 0] },
        },
        adjustments: {
          $sum: { $cond: [{ $eq: ['$movementType', 'adjustment'] }, '$quantityChanged', 0] },
        },
      },
    },
  ])
  return summary
}

export async function getStockReport({ from, to, medicine, page, limit }) {
  const medicineMatch = { isActive: true }
  if (medicine) medicineMatch._id = medicine
  const rangeFilter = movementRangeMatch({ from, to })
  const toDate = to ? new Date(to) : new Date()
  toDate.setUTCHours(23, 59, 59, 999)
  const afterEndFilter = { timestamp: { $gt: toDate } }
  const withinRange = await getMovementTotals({ ...rangeFilter, ...(medicine ? { medicine } : {}) })
  const afterEnd = to ? await getMovementTotals({ ...afterEndFilter, ...(medicine ? { medicine } : {}) }) : {}

  const [medicines, total] = await Promise.all([
    Medicine.aggregate([
      { $match: medicineMatch },
      {
        $lookup: {
          from: Batch.collection.name,
          let: { medicineId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$medicine', '$$medicineId'] } } },
            { $group: { _id: null, quantity: { $sum: '$quantity' }, costValue: { $sum: { $multiply: ['$quantity', '$purchasePrice'] } }, retailValue: { $sum: { $multiply: ['$quantity', '$sellingPrice'] } } } },
          ],
          as: 'current',
        },
      },
      {
        $lookup: {
          from: StockMovement.collection.name,
          let: { medicineId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$medicine', '$$medicineId'] } } },
            { $group: { _id: null, quantity: { $sum: '$quantityChanged' } } },
          ],
          as: 'lifetimeMovement',
        },
      },
      {
        $project: {
          name: 1,
          genericName: 1,
          reorderLevel: 1,
          currentStock: { $ifNull: [{ $arrayElemAt: ['$current.quantity', 0] }, 0] },
          valuation: {
            cost: { $ifNull: [{ $arrayElemAt: ['$current.costValue', 0] }, 0] },
            retail: { $ifNull: [{ $arrayElemAt: ['$current.retailValue', 0] }, 0] },
          },
          lifetimeMovement: { $ifNull: [{ $arrayElemAt: ['$lifetimeMovement.quantity', 0] }, 0] },
        },
      },
      { $sort: { name: 1, _id: 1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ]),
    Medicine.countDocuments(medicineMatch),
  ])

  const movementByMedicine = (summary, id) =>
    summary?.find(({ _id }) => _id?.toString() === id.toString()) ?? {}
  const report = medicines.map((record) => {
    const rangeMovement = movementByMedicine(withinRange, record._id)
    const afterMovement = movementByMedicine(afterEnd, record._id)
    const currentStock = record.currentStock
    const openingStock = currentStock - rangeMovement.netQuantity - afterMovement.netQuantity
    const closingStock = openingStock + rangeMovement.netQuantity
    return {
      medicine: { _id: record._id, name: record.name, genericName: record.genericName },
      openingStock,
      purchases: rangeMovement.purchases ?? 0,
      sales: rangeMovement.sales ?? 0,
      returns: rangeMovement.returns ?? 0,
      adjustments: rangeMovement.adjustments ?? 0,
      closingStock,
      currentStock,
      stockReconciliationDifference: currentStock - record.lifetimeMovement,
      valuation: record.valuation,
    }
  })

  return { medicines: report, total, page, limit, from: from ?? null, to: to ?? null }
}

export async function getExpiryReport(now = new Date()) {
  const [expired, within30Days, within60Days, within90Days] = await Promise.all([
    getExpiredBatches(now),
    getNearExpiryBatches(30, now),
    getNearExpiryBatches(60, now),
    getNearExpiryBatches(90, now),
  ])
  return { expired, within30Days, within60Days, within90Days }
}

export async function getSupplierReport({ from, to, supplier, page, limit }) {
  const filter = {}
  const bounds = dateBounds({ from, to })
  if (bounds) filter.purchaseDate = bounds
  if (supplier) filter.supplier = supplier
  const [supplierPurchases, [totals = { purchaseCount: 0, totalPurchases: 0 }]] = await Promise.all([
    Purchase.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$supplier',
          purchaseCount: { $sum: 1 },
          totalPurchases: { $sum: '$totalAmount' },
          lastPurchaseDate: { $max: '$purchaseDate' },
          invoices: {
            $push: {
              _id: '$_id',
              invoiceNumber: '$invoiceNumber',
              purchaseDate: '$purchaseDate',
              totalAmount: '$totalAmount',
              status: '$status',
            },
          },
        },
      },
      { $lookup: { from: Supplier.collection.name, localField: '_id', foreignField: '_id', as: 'supplier' } },
      { $unwind: '$supplier' },
      { $sort: { totalPurchases: -1, 'supplier.name': 1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $project: { supplier: { _id: '$supplier._id', name: '$supplier.name', contactPerson: '$supplier.contactPerson' }, purchaseCount: 1, totalPurchases: 1, lastPurchaseDate: 1, invoices: 1 } },
    ]),
    Purchase.aggregate([
      { $match: filter },
      { $group: { _id: null, purchaseCount: { $sum: 1 }, totalPurchases: { $sum: '$totalAmount' } } },
    ]),
  ])
  const [supplierCount] = await Purchase.aggregate([
    { $match: filter },
    { $group: { _id: '$supplier' } },
    { $count: 'total' },
  ])
  return {
    suppliers: supplierPurchases,
    summary: totals,
    total: supplierCount?.total ?? 0,
    page,
    limit,
  }
}

export async function getStockMovementHistory({ medicine, batch, movementType, from, to, page, limit }) {
  const filter = {}
  if (medicine) filter.medicine = medicine
  if (batch) filter.batch = batch
  if (movementType) filter.movementType = movementType
  const timestamp = dateBounds({ from, to })
  if (timestamp) filter.timestamp = timestamp
  const [movements, total] = await Promise.all([
    StockMovement.find(filter)
      .populate('medicine', 'name genericName')
      .populate('batch', 'batchNumber')
      .populate('performedBy', 'name email')
      .sort({ timestamp: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    StockMovement.countDocuments(filter),
  ])
  return { movements, total, page, limit }
}

export async function getAuditHistory({ page, limit }) {
  const [entries, total] = await Promise.all([
    AuditLog.find()
      .populate('performedBy', 'name email')
      .sort({ timestamp: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(),
  ])
  return { entries, total, page, limit }
}
