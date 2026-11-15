import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Medicine, Purchase, Sale, StockMovement, Supplier } from '../src/models/index.js'
import {
  getDashboardMetrics,
  getSalesReport,
  getStockReport,
  getSupplierReport,
} from '../src/services/reportService.js'

const medicineId = '507f1f77bcf86cd799439011'

test('sales report applies date period and calculates revenue summaries on the server', async () => {
  const originalAggregate = Sale.aggregate
  const pipelines = []
  Sale.aggregate = async (pipeline) => {
    pipelines.push(pipeline)
    if (pipeline.some((stage) => stage.$dateTrunc)) {
      return [{ _id: new Date('2026-04-03T00:00:00.000Z'), salesCount: 2, subtotal: 100, tax: 10, discount: 5, revenue: 105 }]
    }
    return [{ _id: null, salesCount: 2, subtotal: 100, tax: 10, discount: 5, revenue: 105 }]
  }
  try {
    const report = await getSalesReport({
      period: 'daily',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-30T00:00:00.000Z',
      page: 1,
      limit: 25,
    })
    assert.equal(report.summary.revenue, 105)
    assert.equal(report.summary.salesCount, 2)
    assert.equal(report.results[0].tax, 10)
    assert.equal(pipelines[0][0].$match.status, 'completed')
    assert.equal(
      pipelines[0][0].$match.saleDate.$gte.toISOString(),
      '2026-04-01T00:00:00.000Z',
    )
    assert.equal(pipelines[0][1].$group._id.$dateTrunc.unit, 'day')
    assert.deepEqual(pipelines[0].slice(-2), [{ $skip: 0 }, { $limit: 25 }])
  } finally {
    Sale.aggregate = originalAggregate
  }
})

test('stock report reconciles opening, movement types and closing stock', async () => {
  const originals = {
    medicineAggregate: Medicine.aggregate,
    medicineCount: Medicine.countDocuments,
    movementAggregate: StockMovement.aggregate,
  }
  let movementCalls = 0
  Medicine.aggregate = async (pipeline) => {
    assert.equal(pipeline[0].$match.isActive, true)
    return [{
      _id: medicineId,
      name: 'Report Medicine',
      genericName: 'Report Generic',
      currentStock: 10,
      lifetimeMovement: 1,
      valuation: { cost: 20, retail: 35 },
    }]
  }
  Medicine.countDocuments = async () => 1
  StockMovement.aggregate = async (pipeline) => {
    movementCalls += 1
    assert.ok(pipeline[0].$match.timestamp)
    if (pipeline[0].$match.timestamp.$gt) {
      return [{ _id: medicineId, netQuantity: 3, purchases: 3, sales: 0, returns: 0, adjustments: 0 }]
    }
    return [{
      _id: medicineId,
      netQuantity: -2,
      purchases: 4,
      sales: 6,
      returns: 0,
      adjustments: 0,
    }]
  }
  try {
    const report = await getStockReport({
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-30T00:00:00.000Z',
      page: 1,
      limit: 25,
    })
    assert.equal(movementCalls, 2)
    assert.equal(report.medicines[0].openingStock, 9)
    assert.equal(report.medicines[0].purchases, 4)
    assert.equal(report.medicines[0].sales, 6)
    assert.equal(report.medicines[0].closingStock, 7)
    assert.equal(
      report.medicines[0].openingStock + report.medicines[0].purchases -
        report.medicines[0].sales + report.medicines[0].returns +
        report.medicines[0].adjustments,
      report.medicines[0].closingStock,
    )
    assert.equal(report.medicines[0].currentStock, 10)
    assert.equal(report.medicines[0].stockReconciliationDifference, 9)
    assert.equal(report.medicines[0].valuation.retail, 35)
  } finally {
    Medicine.aggregate = originals.medicineAggregate
    Medicine.countDocuments = originals.medicineCount
    StockMovement.aggregate = originals.movementAggregate
  }
})

test('supplier report aggregates purchase counts and spend by supplier', async () => {
  const originals = { purchaseAggregate: Purchase.aggregate }
  const pipelines = []
  Purchase.aggregate = async (pipeline) => {
    pipelines.push(pipeline)
    if (pipeline.some((stage) => stage.$count)) return [{ total: 1 }]
    if (pipeline.some((stage) => stage.$group?._id === '$supplier')) {
      return [{ supplier: { name: 'Supplier A' }, purchaseCount: 2, totalPurchases: 75, invoices: [] }]
    }
    return [{ purchaseCount: 2, totalPurchases: 75 }]
  }
  try {
    const report = await getSupplierReport({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T00:00:00.000Z',
      page: 1,
      limit: 10,
    })
    assert.equal(report.summary.totalPurchases, 75)
    assert.equal(report.suppliers[0].purchaseCount, 2)
    assert.equal(report.total, 1)
    assert.equal(pipelines[0][0].$match.purchaseDate.$gte.toISOString(), '2026-01-01T00:00:00.000Z')
  } finally {
    Purchase.aggregate = originals.purchaseAggregate
  }
})

test('dashboard computes metrics using database queries, not seeded constants', async () => {
  const originals = {
    medicineCount: Medicine.countDocuments,
    medicineAggregate: Medicine.aggregate,
    supplierCount: Supplier.countDocuments,
    batchAggregate: (await import('../src/models/index.js')).Batch.aggregate,
    saleAggregate: Sale.aggregate,
    saleFind: Sale.find,
  }
  const { Batch } = await import('../src/models/index.js')
  let salesAggregateCalls = 0
  Medicine.countDocuments = async () => 8
  Medicine.aggregate = async () => []
  Supplier.countDocuments = async () => 3
  Batch.aggregate = async () => [{ totalAvailableStock: 21 }]
  Sale.aggregate = async () => {
    salesAggregateCalls += 1
    return [{ salesCount: 2, revenue: 50 }]
  }
  Sale.find = () => ({
    populate() { return this },
    sort() { return this },
    limit() { return this },
    lean: async () => [{ invoiceNumber: 'SALE-1' }],
  })
  try {
    const dashboard = await getDashboardMetrics(new Date('2026-04-15T12:00:00.000Z'))
    assert.equal(dashboard.totalMedicines, 8)
    assert.equal(dashboard.totalSuppliers, 3)
    assert.equal(dashboard.totalAvailableStock, 21)
    assert.equal(dashboard.todaySales.revenue, 50)
    assert.equal(dashboard.monthlySales.salesCount, 2)
    assert.equal(dashboard.totalRevenue, 50)
    assert.equal(dashboard.recentSales[0].invoiceNumber, 'SALE-1')
    assert.equal(salesAggregateCalls, 3)
  } finally {
    Medicine.countDocuments = originals.medicineCount
    Medicine.aggregate = originals.medicineAggregate
    Supplier.countDocuments = originals.supplierCount
    Batch.aggregate = originals.batchAggregate
    Sale.aggregate = originals.saleAggregate
    Sale.find = originals.saleFind
  }
})
