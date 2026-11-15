import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowUpRight, BadgeDollarSign, Boxes, CalendarDays,
  Check, CircleUserRound, LoaderCircle, Package,
  PackageSearch, Pencil, Plus, Printer, RefreshCw, Search, ShieldCheck,
  ShoppingCart, Trash2, Truck, X,
} from 'lucide-react'
import { authApi } from '../features/auth/api.js'
import { useAuth } from '../features/auth/AuthProvider.jsx'
import { catalogApi } from '../features/catalog/api.js'
import { operationsApi } from '../features/operations/api.js'
import { api, getApiError } from '../lib/api.js'

const SalesTrendChart = lazy(() => import('./SalesTrendChart.jsx'))
const currency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: import.meta.env.VITE_CURRENCY || 'USD',
})
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function useNotice() {
  const [notice, setNotice] = useState('')
  const notify = useCallback((message) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3500)
  }, [])
  return { notice, notify, clear: () => setNotice('') }
}

function useDebouncedValue(value, delay = 200) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay)
    return () => window.clearTimeout(timeout)
  }, [value, delay])
  return debouncedValue
}

function useLoad(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const loaderRef = useRef(loader)
  useEffect(() => { loaderRef.current = loader }, [loader])
  const dependencyKey = JSON.stringify(deps)
  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }))
    try {
      const { data } = await loaderRef.current()
      setState({ data, loading: false, error: '' })
      return data
    } catch (error) {
      setState({ data: null, loading: false, error: getApiError(error) })
      return null
    }
  }, [])
  useEffect(() => {
    let active = true
    loaderRef.current()
      .then(({ data }) => {
        if (active) setState({ data, loading: false, error: '' })
      })
      .catch((error) => {
        if (active) setState({ data: null, loading: false, error: getApiError(error) })
      })
    return () => { active = false }
  }, [dependencyKey])
  return { ...state, refresh }
}

function StatePanel({ loading, error, empty = false, emptyMessage = 'No records found.', children }) {
  if (loading) return <div className="state-panel"><LoaderCircle className="spin" size={20} /> Loading data…</div>
  if (error) return <div className="state-panel error-state" role="alert"><AlertTriangle size={18} />{error}</div>
  if (empty) return <div className="state-panel">{emptyMessage}</div>
  return children
}

function PageHeader({ eyebrow, title, description, action }) {
  return (
    <header className="page-heading">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted">{description}</p></div>
      {action}
    </header>
  )
}

function MetricCard({ title, value, note, icon: Icon, tone = 'violet' }) {
  return <article className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={19} /></div><p>{title}</p><strong>{value}</strong><small>{note}</small></article>
}

export function DashboardPage() {
  const { user } = useAuth()
  const manager = user.role === 'admin' || user.role === 'pharmacist'
  const dashboard = useLoad(
    () => manager
      ? operationsApi.dashboard()
      : user.role === 'customer'
        ? catalogApi.medicines({ page: 1, limit: 6 })
        : operationsApi.salesReport({ period: 'daily', page: 1, limit: 7 }),
    [manager, user.role],
  )
  const chart = useLoad(
    () => user.role === 'customer'
      ? Promise.resolve({ data: { results: [] } })
      : operationsApi.salesReport({ period: 'daily', page: 1, limit: 7 }),
    [user.role],
  )
  const metrics = dashboard.data
  const chartData = [...(chart.data?.results ?? [])].reverse().map((entry) => ({
    day: dateFormat.format(new Date(entry._id)),
    revenue: entry.revenue,
  }))

  return (
    <>
      <PageHeader eyebrow="OVERVIEW" title={`Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${user.name.split(' ')[0]}`} description="A live view of pharmacy operations." />
      <StatePanel loading={dashboard.loading} error={dashboard.error}>
        {manager && metrics ? (
          <>
            <section className="metric-grid">
              <MetricCard title="Medicines" value={metrics.totalMedicines.toLocaleString()} note="Active catalog" icon={Package} />
              <MetricCard title="Suppliers" value={metrics.totalSuppliers.toLocaleString()} note="Active partners" icon={Truck} tone="blue" />
              <MetricCard title="Available units" value={metrics.totalAvailableStock.toLocaleString()} note="Unexpired batch stock" icon={Boxes} tone="teal" />
              <MetricCard title="Today's revenue" value={currency.format(metrics.todaySales.revenue)} note={`${metrics.todaySales.salesCount} completed sales`} icon={BadgeDollarSign} tone="amber" />
              <MetricCard title="Monthly revenue" value={currency.format(metrics.monthlySales.revenue)} note={`${metrics.monthlySales.salesCount} completed sales`} icon={Activity} tone="blue" />
              <MetricCard title="Lifetime revenue" value={currency.format(metrics.totalRevenue)} note="Completed sales" icon={ArrowUpRight} tone="teal" />
            </section>
            <div className="dashboard-columns">
              <section className="surface chart-panel">
                <div className="panel-heading"><div><h2>Sales trend</h2><p>Daily revenue from completed sales</p></div><span className="soft-tag">Last 7 days</span></div>
                <StatePanel loading={chart.loading} error={chart.error} empty={chartData.length === 0} emptyMessage="No sales in this period.">
                  <Suspense fallback={<div className="state-panel">Loading chart…</div>}><SalesTrendChart data={chartData} /></Suspense>
                </StatePanel>
              </section>
              <section className="surface alerts-panel">
                <div className="panel-heading"><div><h2>Inventory alerts</h2><p>Items requiring attention</p></div><AlertTriangle size={18} className="muted-icon" /></div>
                <div className="alert-count-grid">
                  <div className="alert-number warning"><strong>{metrics.lowStockMedicines.length}</strong><span>Low stock medicines</span></div>
                  <div className="alert-number danger"><strong>{metrics.expiredBatches.length}</strong><span>Expired batches</span></div>
                  <div className="alert-number amber"><strong>{metrics.nearExpiryBatches.length}</strong><span>Near expiry (30 days)</span></div>
                </div>
                <div className="alert-list">{metrics.lowStockMedicines.slice(0, 4).map((item) => <div className="alert-row" key={item._id}><span className="alert-dot" /><span><b>{item.name}</b><small>{item.availableStock} available · reorder at {item.reorderLevel}</small></span></div>)}{!metrics.lowStockMedicines.length && <p className="empty-copy">No low-stock alerts right now.</p>}</div>
              </section>
            </div>
            <section className="surface data-panel">
              <div className="panel-heading"><div><h2>Recent sales</h2><p>Latest completed invoices</p></div><ShoppingCart size={18} className="muted-icon" /></div>
              <RecordTable rows={metrics.recentSales} columns={[
                ['invoiceNumber', 'Invoice'],
                ['saleDate', 'Date', (value) => dateTimeFormat.format(new Date(value))],
                ['soldBy.name', 'Cashier'],
                ['totalAmount', 'Total', (value) => currency.format(value)],
                ['paymentMethod', 'Payment'],
              ]} />
            </section>
          </>
        ) : user.role === 'customer' && dashboard.data ? (
          <section className="surface data-panel customer-catalog">
            <div className="panel-heading"><div><h2>Available medicines</h2><p>Browse active medicines in the catalog.</p></div><Package size={18} className="muted-icon" /></div>
            <RecordTable rows={dashboard.data.medicines ?? []} columns={[
              ['name', 'Medicine'],
              ['genericName', 'Generic name'],
              ['brand', 'Brand'],
              ['category.name', 'Category'],
              ['price', 'Price', (value) => value == null ? 'Currently unavailable' : currency.format(value)],
            ]} empty="There are no medicines available right now." />
          </section>
        ) : !manager && dashboard.data ? (
          <div className="metric-grid">
            <MetricCard title="Today's sales" value={dashboard.data.summary.salesCount} note="Completed invoices" icon={ShoppingCart} />
            <MetricCard title="Today's revenue" value={currency.format(dashboard.data.summary.revenue)} note="Your sales today" icon={BadgeDollarSign} tone="teal" />
          </div>
        ) : null}
      </StatePanel>
    </>
  )
}

function RecordTable({ rows = [], columns, empty = 'No records found.' }) {
  if (!rows.length) return <div className="empty-copy">{empty}</div>
  const get = (record, path) => path.split('.').reduce((value, part) => value?.[part], record)
  return <div className="table-scroll"><table><thead><tr>{columns.map(([, title]) => <th key={title}>{title}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row._id || row.id || index}>{columns.map(([key, title, format]) => <td key={title}>{format ? format(get(row, key), row) : (get(row, key) ?? '—')}</td>)}</tr>)}</tbody></table></div>
}

function FormModal({ title, fields, initial, onClose, onSubmit, saving }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((field) => [
    field.name,
    initial?.[field.name] ?? field.default ?? '',
  ])))
  return <div className="modal-backdrop" role="presentation"><form className="form-modal" onSubmit={(event) => { event.preventDefault(); onSubmit(values) }}><div className="modal-header"><h2>{title}</h2><button className="icon-btn" type="button" aria-label="Close form" onClick={onClose}><X size={18} /></button></div><div className="form-grid">{fields.map((field) => <label key={field.name} className={field.wide ? 'wide-field' : ''}>{field.label}{field.type === 'select' ? <select required={field.required} value={values[field.name] ?? ''} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}><option value="">Select…</option>{field.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select> : field.type === 'textarea' ? <textarea required={field.required} maxLength={field.maxLength} rows={3} value={values[field.name] ?? ''} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} /> : <input required={field.required} type={field.type || 'text'} min={field.min} max={field.max} step={field.step} maxLength={field.maxLength} value={values[field.name] ?? ''} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} />}</label>)}</div><div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div></form></div>
}

function CatalogPage({ kind }) {
  const { user } = useAuth()
  const { notice, notify, clear } = useNotice()
  const canEdit = ['admin', 'pharmacist'].includes(user.role)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [manufacturerFilter, setManufacturerFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState([])
  const [purchaseHistory, setPurchaseHistory] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedMedicine, setSelectedMedicine] = useState(null)
  const isMedicine = kind === 'medicines'
  const loader = isMedicine
    ? () => catalogApi.medicines({
      search: debouncedSearch, category: categoryFilter || undefined, manufacturer: manufacturerFilter || undefined,
      page, limit: 10, sortBy: 'name', sortOrder: 'asc',
    })
    : kind === 'suppliers'
      ? () => catalogApi.suppliers({
        search: debouncedSearch, isActive: activeFilter || undefined, page, limit: 10, sortBy: 'name', sortOrder: 'asc',
      })
      : () => catalogApi.categories()
  const state = useLoad(loader, [kind, debouncedSearch, categoryFilter, manufacturerFilter, activeFilter, page])

  useEffect(() => {
    if (isMedicine) catalogApi.categories().then(({ data }) => setCategories(data.categories)).catch(() => setCategories([]))
  }, [isMedicine])

  const rows = isMedicine ? state.data?.medicines ?? [] : kind === 'suppliers' ? state.data?.suppliers ?? [] : state.data?.categories ?? []
  const title = isMedicine ? 'Medicines' : kind === 'suppliers' ? 'Suppliers' : 'Categories'
  const columns = isMedicine && user.role === 'customer' ? [
    ['name', 'Medicine'],
    ['genericName', 'Generic name'],
    ['description', 'Usage'],
    ['brand', 'Brand'],
    ['category.name', 'Category'],
    ['price', 'Price', (value) => value == null ? 'Currently unavailable' : currency.format(value)],
  ] : isMedicine ? [
    ['name', 'Medicine', (value, row) => <span className="row-primary">{value}<small>{row.genericName} · {row.brand || 'No brand'}</small></span>],
    ['description', 'Usage'],
    ['category.name', 'Category'],
    ['manufacturer', 'Manufacturer'],
    ['price', 'Price', (value) => value == null ? 'Unavailable' : currency.format(value)],
    ['reorderLevel', 'Reorder'],
    ['isActive', 'Status', (value) => <StatusPill active={value} />],
  ] : kind === 'suppliers' ? [
    ['name', 'Supplier'],
    ['contactPerson', 'Contact'],
    ['email', 'Email'],
    ['phone', 'Phone'],
    ['isActive', 'Status', (value) => <StatusPill active={value} />],
  ] : [
    ['name', 'Category'],
    ['description', 'Description'],
    ['createdAt', 'Created', (value) => value ? dateFormat.format(new Date(value)) : '—'],
  ]
  const medicineFields = [
    { name: 'name', label: 'Medicine name', required: true, maxLength: 160 },
    { name: 'genericName', label: 'Generic name', required: true, maxLength: 160 },
    { name: 'brand', label: 'Brand', maxLength: 120 },
    { name: 'category', label: 'Category', type: 'select', required: true, options: categories.map((item) => ({ value: item._id, label: item.name })) },
    { name: 'manufacturer', label: 'Manufacturer', required: true, maxLength: 160 },
    { name: 'reorderLevel', label: 'Reorder level', type: 'number', min: 0, step: 1, default: 10 },
    { name: 'description', label: 'Description', type: 'textarea', wide: true, maxLength: 2000 },
  ]
  const fields = isMedicine ? medicineFields : kind === 'suppliers' ? [
    { name: 'name', label: 'Supplier name', required: true, maxLength: 160 },
    { name: 'contactPerson', label: 'Contact person', maxLength: 120 },
    { name: 'email', label: 'Email', type: 'email', maxLength: 254 },
    { name: 'phone', label: 'Phone', maxLength: 40 },
    { name: 'address', label: 'Address', type: 'textarea', wide: true, maxLength: 500 },
  ] : [
    { name: 'name', label: 'Category name', required: true, maxLength: 100 },
    { name: 'description', label: 'Description', type: 'textarea', wide: true, maxLength: 1000 },
  ]
  async function save(values) {
    setSaving(true)
    try {
      const data = isMedicine ? {
        ...values,
        reorderLevel: Number(values.reorderLevel),
      } : values
      if (modal.row) {
        if (kind === 'medicines') await catalogApi.updateMedicine(modal.row._id, data)
        else if (kind === 'suppliers') await catalogApi.updateSupplier(modal.row._id, data)
        else await catalogApi.updateCategory(modal.row._id, data)
      } else if (kind === 'medicines') await catalogApi.createMedicine(data)
      else if (kind === 'suppliers') await catalogApi.createSupplier(data)
      else await catalogApi.createCategory(data)
      notify(`${title.slice(0, -1)} saved.`)
      setModal(null)
      state.refresh()
    } catch (error) { notify(getApiError(error)) } finally { setSaving(false) }
  }
  async function toggleActive(row) {
    try {
      if (isMedicine) await catalogApi.updateMedicine(row._id, { isActive: !row.isActive })
      else await catalogApi.setSupplierActive(row._id, !row.isActive)
      notify(`Record ${row.isActive ? 'deactivated' : 'activated'}.`)
      state.refresh()
    } catch (error) { notify(getApiError(error)) }
  }
  async function removeCategory(row) {
    if (!window.confirm(`Delete category “${row.name}”?`)) return
    try { await catalogApi.deleteCategory(row._id); notify('Category deleted.'); state.refresh() } catch (error) { notify(getApiError(error)) }
  }
  async function removeMedicine(row) {
    if (!window.confirm(`Delete ${row.name}? Historical purchases, sales, or batches may prevent deletion.`)) return
    try { await catalogApi.deleteMedicine(row._id); notify('Medicine deleted.'); state.refresh() } catch (error) { notify(getApiError(error)) }
  }
  async function viewSupplierHistory(supplier) {
    setHistoryLoading(true)
    setPurchaseHistory({ supplier, purchases: null })
    try {
      const { data } = await catalogApi.supplierPurchases(supplier._id, { page: 1, limit: 50 })
      setPurchaseHistory({ supplier, ...data })
    } catch (error) { notify(getApiError(error)) } finally { setHistoryLoading(false) }
  }

  return <>
    <PageHeader eyebrow="CATALOG" title={title} description={`Manage the ${title.toLowerCase()} available to your pharmacy.`} action={canEdit ? <button className="button primary" onClick={() => setModal({})}><Plus size={16} /> Add {isMedicine ? 'medicine' : kind === 'suppliers' ? 'supplier' : 'category'}</button> : null} />
    {notice && <Toast message={notice} clear={clear} />}
    <section className="surface data-panel">
      <div className="table-toolbar filter-toolbar">
        <label className="search-control"><Search size={17} /><input aria-label={`Search ${title}`} placeholder={isMedicine ? 'Search by name or generic name…' : `Search ${title.toLowerCase()}…`} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label>
        {isMedicine && user.role !== 'customer' && <>
          <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1) }}><option value="">All categories</option>{categories.map((category) => <option value={category._id} key={category._id}>{category.name}</option>)}</select>
          <input aria-label="Filter by manufacturer" placeholder="Manufacturer" value={manufacturerFilter} onChange={(event) => { setManufacturerFilter(event.target.value); setPage(1) }} />
        </>}
        {kind === 'suppliers' && <select aria-label="Filter suppliers by status" value={activeFilter} onChange={(event) => { setActiveFilter(event.target.value); setPage(1) }}><option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></select>}
        <button className="button secondary" onClick={state.refresh}><RefreshCw size={15} /> Refresh</button>
      </div>
      <StatePanel loading={state.loading} error={state.error} empty={rows.length === 0} emptyMessage={`No ${title.toLowerCase()} found.`}>
        <RecordTable rows={rows} columns={[...columns, ...(canEdit || user.role === 'customer' ? [['actions', 'Actions', (_, row) => user.role === 'customer' ? <button className="button tiny" onClick={() => setSelectedMedicine(row)}>Details</button> : <span className="row-actions">{kind === 'suppliers' && <button className="button tiny" onClick={() => viewSupplierHistory(row)}>History</button>}<button className="icon-btn" aria-label={`Edit ${row.name}`} onClick={() => setModal({ row })}><Pencil size={15} /></button>{kind === 'categories' ? <button className="icon-btn danger-text" aria-label={`Delete ${row.name}`} onClick={() => removeCategory(row)}><Trash2 size={15} /></button> : <><button className="button tiny" onClick={() => toggleActive(row)}>{row.isActive ? 'Deactivate' : 'Activate'}</button>{isMedicine && <button className="icon-btn danger-text" aria-label={`Delete ${row.name}`} onClick={() => removeMedicine(row)}><Trash2 size={15} /></button>}</>}</span>]] : [])]} />
      </StatePanel>
      {isMedicine || kind === 'suppliers' ? <Pagination page={page} total={state.data?.total ?? 0} limit={10} onPage={setPage} /> : null}
    </section>
    {modal && <FormModal title={`${modal.row ? 'Edit' : 'Add'} ${isMedicine ? 'medicine' : kind === 'suppliers' ? 'supplier' : 'category'}`} fields={fields} initial={modal.row} onClose={() => setModal(null)} onSubmit={save} saving={saving} />}
    {selectedMedicine && <div className="modal-backdrop" role="presentation"><section className="form-modal"><div className="modal-header"><h2>{selectedMedicine.name}</h2><button className="icon-btn" aria-label="Close medicine details" onClick={() => setSelectedMedicine(null)}><X size={18} /></button></div><dl className="medicine-details"><dt>Generic name</dt><dd>{selectedMedicine.genericName}</dd><dt>Brand</dt><dd>{selectedMedicine.brand || '—'}</dd><dt>Category</dt><dd>{selectedMedicine.category?.name || '—'}</dd><dt>Manufacturer</dt><dd>{selectedMedicine.manufacturer || '—'}</dd><dt>Current price</dt><dd>{selectedMedicine.price == null ? 'Currently unavailable' : currency.format(selectedMedicine.price)}</dd><dt>Description</dt><dd>{selectedMedicine.description || 'No description available.'}</dd></dl></section></div>}
    {purchaseHistory && <div className="modal-backdrop" role="presentation"><section className="form-modal wide-modal"><div className="modal-header"><h2>Purchase history · {purchaseHistory.supplier.name}</h2><button className="icon-btn" aria-label="Close purchase history" onClick={() => setPurchaseHistory(null)}><X size={18} /></button></div>{historyLoading ? <StatePanel loading /> : <RecordTable rows={purchaseHistory.purchases ?? []} columns={[[ 'invoiceNumber', 'Invoice'], ['purchaseDate', 'Date', (value) => dateTimeFormat.format(new Date(value))], ['totalAmount', 'Amount', (value) => currency.format(value)], ['status', 'Status']]} empty="No purchases for this supplier." />}</section></div>}
  </>
}

function StatusPill({ active }) { return <span className={`status-pill ${active ? 'active' : 'inactive'}`}>{active ? 'Active' : 'Inactive'}</span> }
function Pagination({ page, total, limit, onPage }) { const pages = Math.max(1, Math.ceil(total / limit)); return <div className="pagination"><span>{total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}` : '0 records'}</span><div><button disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><span>Page {page} / {pages}</span><button disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button></div></div> }
function Toast({ message, clear }) { return <div className="toast" role="status"><Check size={16} />{message}<button className="icon-btn" onClick={clear} aria-label="Dismiss"><X size={15} /></button></div> }

export function InventoryPage() {
  const { user } = useAuth()
  const canAdjust = ['admin', 'pharmacist'].includes(user.role)
  const state = useLoad(() => operationsApi.batches({ page: 1, limit: 100, includeExpired: 'true' }), [])
  const alerts = useLoad(async () => {
    if (!canAdjust) return { data: { low: [], near: [], valuation: {} } }
    const [low, near, valuation] = await Promise.all([operationsApi.lowStock(), operationsApi.nearExpiry(30), operationsApi.valuation()])
    return { data: { low: low.data.medicines, near: near.data.batches, valuation: valuation.data } }
  }, [canAdjust])
  const [adjustment, setAdjustment] = useState(null)
  const [adjustmentType, setAdjustmentType] = useState('damaged')
  const [notice, setNotice] = useState('')
  async function submitAdjustment(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const enteredQuantity = Number(form.get('quantityChange'))
    if (!Number.isInteger(enteredQuantity) || enteredQuantity === 0) {
      setNotice('Enter a non-zero whole number of units.')
      return
    }
    const type = form.get('adjustmentType')
    const quantityChange = ['damaged', 'expired', 'missing'].includes(type)
      ? -Math.abs(enteredQuantity)
      : enteredQuantity
    try {
      await operationsApi.adjustStock({
        batch: adjustment._id,
        adjustmentType: type,
        quantityChange,
        reason: form.get('reason'),
      })
      setNotice('Stock adjustment recorded with movement and audit history.')
      setAdjustment(null)
      state.refresh()
    } catch (error) { setNotice(getApiError(error)) }
  }
  return <>
    <PageHeader eyebrow="INVENTORY" title="Batch inventory" description="Stock is calculated from active medicine batches; expired and empty batches are excluded from available totals." action={<button className="button secondary" onClick={state.refresh}><RefreshCw size={15} /> Refresh</button>} />
    {notice && <Toast message={notice} clear={() => setNotice('')} />}
    <section className="metric-grid compact-grid">
      <MetricCard title="Stock valuation" value={currency.format(alerts.data?.valuation?.totalCostValue ?? 0)} note="Purchase-cost valuation" icon={BadgeDollarSign} />
      <MetricCard title="Low stock" value={alerts.data?.low?.length ?? '—'} note="At or below reorder level" icon={AlertTriangle} tone="amber" />
      <MetricCard title="Near expiry" value={alerts.data?.near?.length ?? '—'} note="Next 30 days" icon={CalendarDays} tone="blue" />
    </section>
    <section className="surface data-panel">
      <div className="panel-heading"><div><h2>Batch stock</h2><p>Ordered by expiry date (FEFO)</p></div><PackageSearch size={19} className="muted-icon" /></div>
      <StatePanel loading={state.loading} error={state.error} empty={(state.data?.batches?.length ?? 0) === 0} emptyMessage="No batch records found.">
        <RecordTable rows={state.data?.batches ?? []} columns={[
          ['medicine.name', 'Medicine'],
          ['batchNumber', 'Batch'],
          ['supplier.name', 'Supplier'],
          ['quantity', 'Quantity'],
          ['purchasePrice', 'Cost', (value) => currency.format(value)],
          ['sellingPrice', 'Price', (value) => currency.format(value)],
          ['expiryDate', 'Expiry', (value) => dateFormat.format(new Date(value))],
          ...(canAdjust ? [['actions', 'Action', (_, row) => <button className="button tiny" onClick={() => { setAdjustmentType('damaged'); setAdjustment(row) }}>Adjust stock</button>]] : []),
        ]} />
      </StatePanel>
    </section>
    {adjustment && <div className="modal-backdrop"><form className="form-modal" onSubmit={submitAdjustment}><div className="modal-header"><h2>Adjust {adjustment.batchNumber}</h2><button className="icon-btn" type="button" onClick={() => setAdjustment(null)} aria-label="Close"><X size={18} /></button></div><p className="muted">Current quantity: {adjustment.quantity}. Damaged, expired, and missing units are subtracted automatically. For a physical correction or other adjustment, enter a positive number to add stock or a negative number to remove it.</p><label>Adjustment type<select name="adjustmentType" value={adjustmentType} onChange={(event) => setAdjustmentType(event.target.value)} required><option value="damaged">Damaged</option><option value="expired">Expired</option><option value="missing">Missing</option><option value="physical_correction">Physical stock correction</option><option value="other">Other</option></select></label><label>Quantity {['damaged', 'expired', 'missing'].includes(adjustmentType) ? 'to remove' : 'change'}<input name="quantityChange" type="number" min={['damaged', 'expired', 'missing'].includes(adjustmentType) ? 1 : undefined} step="1" required /></label><label>Reason<textarea name="reason" minLength="1" maxLength="500" required /></label><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setAdjustment(null)}>Cancel</button><button className="button primary">Record adjustment</button></div></form></div>}
  </>
}

export function PurchasesPage() {
  const { user } = useAuth()
  const canManage = ['admin', 'pharmacist'].includes(user.role)
  const state = useLoad(() => operationsApi.purchases({ page: 1, limit: 25 }), [])
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [medicines, setMedicines] = useState([])
  const [lines, setLines] = useState([])
  useEffect(() => {
    catalogApi.suppliers({ page: 1, limit: 100, isActive: 'true' }).then(({ data }) => setSuppliers(data.suppliers)).catch(() => {})
    catalogApi.medicines({ page: 1, limit: 100 }).then(({ data }) => setMedicines(data.medicines)).catch(() => {})
  }, [])
  const total = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.purchasePrice || 0), 0)
  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await operationsApi.createPurchase({
        supplier: form.get('supplier'),
        items: lines.map((line) => ({
          medicine: line.medicine,
          batchNumber: line.batchNumber,
          quantity: Number(line.quantity),
          purchasePrice: Number(line.purchasePrice),
          sellingPrice: Number(line.sellingPrice),
          expiryDate: line.expiryDate,
        })),
      })
      setNotice('Purchase received. Batch stock and movements were recorded.')
      setModal(false); setLines([]); state.refresh()
    } catch (error) { setNotice(getApiError(error)) }
  }
  return <>
    <PageHeader eyebrow="PROCUREMENT" title="Purchases" description="Receive supplier purchases into new, traceable batches." action={canManage && <button className="button primary" onClick={() => setModal(true)}><Plus size={16} /> New purchase</button>} />
    {notice && <Toast message={notice} clear={() => setNotice('')} />}
    <section className="surface data-panel"><StatePanel loading={state.loading} error={state.error} empty={(state.data?.purchases?.length ?? 0) === 0} emptyMessage="No purchase invoices yet."><RecordTable rows={state.data?.purchases ?? []} columns={[
      ['invoiceNumber', 'Invoice'], ['supplier.name', 'Supplier'],
      ['purchaseDate', 'Date', (value) => dateTimeFormat.format(new Date(value))],
      ['processedBy.name', 'Processed by'], ['totalAmount', 'Total', (value) => currency.format(value)],
      ['status', 'Status'],
    ]} /></StatePanel></section>
    {modal && <div className="modal-backdrop"><form className="form-modal wide-modal" onSubmit={submit}><div className="modal-header"><h2>Receive purchase</h2><button className="icon-btn" type="button" onClick={() => setModal(false)} aria-label="Close"><X size={18} /></button></div><label>Supplier<select name="supplier" required><option value="">Select supplier</option>{suppliers.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label><div className="inline-add"><select id="purchase-medicine"><option value="">Select medicine</option>{medicines.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select><button className="button secondary" type="button" onClick={() => { const selected = medicines.find((item) => item._id === document.getElementById('purchase-medicine').value); if (selected) setLines([...lines, { medicine: selected._id, medicineName: selected.name, batchNumber: '', quantity: 1, purchasePrice: 0, sellingPrice: 0, expiryDate: '' }]) }}>Add medicine</button></div>{lines.map((line, index) => <div className="purchase-line" key={`${line.medicine}-${index}`}><strong>{line.medicineName}</strong><input aria-label="Batch number" placeholder="Batch number" required value={line.batchNumber} onChange={(event) => setLines(lines.map((item, i) => i === index ? { ...item, batchNumber: event.target.value } : item))} /><input aria-label="Quantity" type="number" min="1" step="1" required value={line.quantity} onChange={(event) => setLines(lines.map((item, i) => i === index ? { ...item, quantity: event.target.value } : item))} /><input aria-label="Purchase price" type="number" min="0" step=".01" required value={line.purchasePrice} onChange={(event) => setLines(lines.map((item, i) => i === index ? { ...item, purchasePrice: event.target.value } : item))} /><input aria-label="Selling price" type="number" min="0" step=".01" required value={line.sellingPrice} onChange={(event) => setLines(lines.map((item, i) => i === index ? { ...item, sellingPrice: event.target.value } : item))} /><input aria-label="Expiry date" type="date" required value={line.expiryDate} onChange={(event) => setLines(lines.map((item, i) => i === index ? { ...item, expiryDate: event.target.value } : item))} /><button className="icon-btn danger-text" type="button" aria-label="Remove item" onClick={() => setLines(lines.filter((_, i) => i !== index))}><Trash2 size={15} /></button></div>)}<div className="purchase-total">Calculated total <strong>{currency.format(total)}</strong><small>Server independently calculates the invoice total.</small></div><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setModal(false)}>Cancel</button><button className="button primary" disabled={!lines.length}>Receive purchase</button></div></form></div>}
  </>
}

export function SalesPage() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const state = useLoad(() => catalogApi.medicines({ search: debouncedSearch, page: 1, limit: 20 }), [debouncedSearch])
  const [cart, setCart] = useState([])
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [notice, setNotice] = useState('')
  const [invoice, setInvoice] = useState(null)
  const [busy, setBusy] = useState(false)
  const saleKey = useRef(crypto.randomUUID())
  useEffect(() => { saleKey.current = crypto.randomUUID() }, [cart, discount, paymentMethod])
  async function add(item) {
    try {
      const { data } = await operationsApi.available(item._id)
      const availableStock = data.availableStock
      if (!availableStock) {
        setNotice(`${item.name} currently has no sellable stock.`)
        return
      }
    setCart((current) => {
      const found = current.find((line) => line._id === item._id)
      if (found) return current.map((line) => line._id === item._id ? { ...line, quantity: Math.min(line.quantity + 1, availableStock), availableStock } : line)
      return [...current, { ...item, quantity: 1, availableStock }]
    })
    } catch (error) { setNotice(getApiError(error)) }
  }
  async function checkout() {
    setBusy(true); setNotice('')
    try {
      const { data } = await operationsApi.createSale({
        idempotencyKey: saleKey.current,
        items: cart.map(({ _id, quantity }) => ({ medicine: _id, quantity })),
        discount: Number(discount),
        paymentMethod,
      })
      const invoiceResponse = await operationsApi.saleInvoice(data.sale._id)
      setInvoice({ ...invoiceResponse.data.invoice, saleId: data.sale._id })
      setCart([])
      setNotice('Sale completed and invoice generated.')
    } catch (error) { setNotice(getApiError(error)) } finally { setBusy(false) }
  }
  return <>
    <PageHeader eyebrow="POINT OF SALE" title="Sales & billing" description="Add medicines to the cart. Batch allocation, pricing, tax and totals are verified by the server." />
    {notice && <Toast message={notice} clear={() => setNotice('')} />}
    <div className="pos-layout"><section className="surface pos-products"><label className="search-control"><Search size={17} /><input aria-label="Search medicines for a sale" placeholder="Search by medicine or generic name…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><StatePanel loading={state.loading} error={state.error} empty={(state.data?.medicines?.length ?? 0) === 0} emptyMessage="No available medicines match your search."><div className="product-list">{(state.data?.medicines ?? []).map((item) => <button className="product-option" key={item._id} onClick={() => add(item)}><span className="product-symbol"><Package size={18} /></span><span><b>{item.name}</b><small>{item.genericName} · {item.description}</small></span><span>{item.price == null ? 'Unavailable' : currency.format(item.price)}</span><Plus size={17} /></button>)}</div></StatePanel></section><section className="surface cart-panel"><div className="panel-heading"><div><h2>Current sale</h2><p>{cart.length} distinct medicines</p></div><ShoppingCart size={18} /></div>{!cart.length ? <div className="cart-empty">Select a medicine to begin billing.</div> : cart.map((line) => <div className="cart-line" key={line._id}><div><b>{line.name}</b><small>{line.genericName} · {line.availableStock} available</small></div><input aria-label={`Quantity for ${line.name}`} type="number" min="1" max={line.availableStock} step="1" value={line.quantity} onChange={(event) => setCart(cart.map((item) => item._id === line._id ? { ...item, quantity: Math.min(Number(event.target.value), item.availableStock) } : item))} /><button className="icon-btn" aria-label={`Remove ${line.name}`} onClick={() => setCart(cart.filter((item) => item._id !== line._id))}><X size={15} /></button></div>)}<div className="checkout-fields"><label>Discount amount<input type="number" min="0" step=".01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label><label>Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="cash">Cash</option><option value="card">Card</option><option value="mobile_money">Mobile money</option><option value="other">Other</option></select></label></div><button className="button primary wide" disabled={!cart.length || busy} onClick={checkout}>{busy ? 'Processing…' : 'Complete sale'}</button><p className="hint-copy">Invoice totals use server pricing, configured tax, and server-side discount limits.</p></section></div>
    {invoice && <section className="surface invoice-preview"><div className="panel-heading"><div><h2>Invoice preview · {invoice.invoiceNumber}</h2><p>{invoice.pharmacyName} · {dateTimeFormat.format(new Date(invoice.dateTime))}</p></div><button className="button secondary" onClick={async () => { const response = await api.get(`/sales/${invoice.saleId}/invoice/print`); const windowRef = window.open('', '_blank'); if (windowRef) { windowRef.document.write(response.data); windowRef.document.close() } }}><Printer size={15} /> Print</button></div><RecordTable rows={invoice.items} columns={[[ 'medicineName', 'Medicine'], ['batchNumber', 'Batch'], ['quantity', 'Qty'], ['unitPrice', 'Unit price', (value) => currency.format(value)], ['lineTotal', 'Line total', (value) => currency.format(value)]]} /><p className="invoice-total">Grand total: {currency.format(invoice.grandTotal)} · {invoice.paymentMethod}</p></section>}
  </>
}

export function ReturnsPage() {
  const state = useLoad(() => operationsApi.returns({ page: 1, limit: 25 }), [])
  const sales = useLoad(() => operationsApi.sales({ page: 1, limit: 100, sortOrder: 'desc' }), [])
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [saleId, setSaleId] = useState('')
  const [batchId, setBatchId] = useState('')
  const selectedSale = sales.data?.sales?.find((sale) => sale._id === saleId)
  const eligibleItems = selectedSale?.items.filter((item) => item.quantity > (item.returnedQuantity ?? 0)) ?? []
  const selectedItem = eligibleItems.find((item) => item.batch === batchId)
  const maxReturnQuantity = selectedItem ? selectedItem.quantity - (selectedItem.returnedQuantity ?? 0) : undefined
  async function submit(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(true)
    try {
      await operationsApi.createReturn({
        idempotencyKey: crypto.randomUUID(),
        invoiceNumber: selectedSale.invoiceNumber,
        reason: data.get('reason'),
        items: [{ batch: data.get('batch'), quantity: Number(data.get('quantity')) }],
      })
      setNotice('Return recorded and marked pending inspection. Stock was not returned to sellable inventory.')
      event.currentTarget.reset(); setSaleId(''); setBatchId(''); state.refresh(); sales.refresh()
    } catch (error) { setNotice(getApiError(error)) } finally { setBusy(false) }
  }
  return <>
    <PageHeader eyebrow="RETURNS" title="Returns & inspection" description="Returns must reference the original sale. Returned items remain quarantined pending inspection." />
    {notice && <Toast message={notice} clear={() => setNotice('')} />}
    <div className="dashboard-columns">
      <section className="surface form-panel">
        <h2>Record return</h2>
        <StatePanel loading={sales.loading} error={sales.error}>
          <form onSubmit={submit}>
            <label>Original sale invoice
              <select required value={saleId} onChange={(event) => { setSaleId(event.target.value); setBatchId('') }}>
                <option value="">Select a completed sale</option>
                {(sales.data?.sales ?? []).map((sale) => <option key={sale._id} value={sale._id}>{sale.invoiceNumber} · {dateTimeFormat.format(new Date(sale.saleDate))}</option>)}
              </select>
            </label>
            <label>Sale item / batch
              <select name="batch" required value={batchId} disabled={!eligibleItems.length} onChange={(event) => setBatchId(event.target.value)}>
                <option value="">Select an eligible item</option>
                {eligibleItems.map((item) => <option key={item.batch} value={item.batch}>{item.medicineName} · {item.batchNumber} · {item.quantity - (item.returnedQuantity ?? 0)} eligible</option>)}
              </select>
            </label>
            <label>Return quantity<input name="quantity" type="number" min="1" max={maxReturnQuantity} step="1" required disabled={!maxReturnQuantity} /></label>
            <label>Return reason<textarea name="reason" required minLength={1} maxLength={500} /></label>
            <button className="button primary" disabled={busy || !eligibleItems.length}>{busy ? 'Recording…' : 'Record return'}</button>
          </form>
        </StatePanel>
      </section>
      <section className="surface data-panel"><div className="panel-heading"><div><h2>Recent returns</h2><p>Inspection queue</p></div></div><StatePanel loading={state.loading} error={state.error} empty={(state.data?.returns?.length ?? 0) === 0} emptyMessage="No returns recorded."><RecordTable rows={state.data?.returns ?? []} columns={[[ 'returnReference', 'Reference'], ['invoiceNumber', 'Invoice'], ['reason', 'Reason'], ['totalAmount', 'Amount', (value) => currency.format(value)], ['status', 'Status']]}/></StatePanel></section>
    </div>
  </>
}

export function ReportsPage() {
  const [range, setRange] = useState({ from: '', to: '' })
  const [tab, setTab] = useState('sales')
  const state = useLoad(async () => {
    const params = { page: 1, limit: 100, ...(range.from ? { from: new Date(`${range.from}T00:00:00`).toISOString() } : {}), ...(range.to ? { to: new Date(`${range.to}T23:59:59`).toISOString() } : {}) }
    const request = tab === 'sales'
      ? operationsApi.salesReport({ ...params, period: 'daily' })
      : tab === 'stock'
        ? operationsApi.stockReport(params)
        : tab === 'suppliers'
          ? operationsApi.supplierReport(params)
          : operationsApi.expiryReport()
    return request
  }, [tab, range.from, range.to])
  const { data } = state
  const rows = tab === 'sales' ? data?.results : tab === 'stock' ? data?.medicines : tab === 'suppliers' ? data?.suppliers : data?.within30Days
  const hasReportRows = tab === 'expiry'
    ? Boolean(data && [data.expired, data.within30Days, data.within60Days, data.within90Days].some((records) => records?.length))
    : Boolean(rows?.length)
  return <>
    <PageHeader eyebrow="ANALYTICS" title="Reports" description="Filter backend-calculated sales, stock, expiry and supplier summaries." action={<button className="button secondary" onClick={state.refresh}><RefreshCw size={15} /> Refresh</button>} />
    <section className="surface report-toolbar"><div className="tabs" role="tablist">{['sales', 'stock', 'expiry', 'suppliers'].map((item) => <button role="tab" aria-selected={tab === item} className={tab === item ? 'selected' : ''} key={item} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>{tab !== 'expiry' && <div className="date-filters"><label>From<input type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} /></label><label>To<input type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} /></label></div>}</section>
    <section className="surface data-panel">
      <StatePanel loading={state.loading} error={state.error} empty={!hasReportRows} emptyMessage="No report data for this period.">
        {tab === 'sales' ? <>
          <div className="summary-strip">
            <span>Revenue <b>{currency.format(data?.summary?.revenue ?? 0)}</b></span>
            <span>Transactions <b>{data?.summary?.salesCount ?? 0}</b></span>
            <span>Tax <b>{currency.format(data?.summary?.tax ?? 0)}</b></span>
            <span>Discount <b>{currency.format(data?.summary?.discount ?? 0)}</b></span>
          </div>
          <RecordTable rows={rows ?? []} columns={[
            ['_id', 'Period', (value) => dateFormat.format(new Date(value))],
            ['salesCount', 'Sales'],
            ['subtotal', 'Subtotal', (value) => currency.format(value)],
            ['tax', 'Tax', (value) => currency.format(value)],
            ['revenue', 'Revenue', (value) => currency.format(value)],
          ]} />
        </> : tab === 'stock' ? <RecordTable rows={rows ?? []} columns={[
          ['medicine.name', 'Medicine'], ['openingStock', 'Opening'], ['purchases', 'Purchases'],
          ['sales', 'Sales'], ['returns', 'Returns'], ['adjustments', 'Adjustments'],
          ['closingStock', 'Closing'], ['currentStock', 'Current'],
        ]} /> : tab === 'suppliers' ? <RecordTable rows={rows ?? []} columns={[
          ['supplier.name', 'Supplier'], ['purchaseCount', 'Purchases'],
          ['totalPurchases', 'Total spend', (value) => currency.format(value)],
          ['lastPurchaseDate', 'Last purchase', (value) => value ? dateFormat.format(new Date(value)) : '—'],
        ]} /> : <div className="expiry-report">
          <ExpiryGroup title="Expired batches" records={data?.expired ?? []} />
          <ExpiryGroup title="Expiring within 30 days" records={data?.within30Days ?? []} />
          <ExpiryGroup title="Expiring within 60 days" records={data?.within60Days ?? []} />
          <ExpiryGroup title="Expiring within 90 days" records={data?.within90Days ?? []} />
        </div>}
      </StatePanel>
    </section>
  </>
}
function ExpiryGroup({ title, records }) { return <div className="expiry-group"><h3>{title} <span className="soft-count">{records.length}</span></h3><RecordTable rows={records} columns={[[ 'medicine.name', 'Medicine'], ['batchNumber', 'Batch'], ['quantity', 'Quantity'], ['expiryDate', 'Expiry', (value) => dateFormat.format(new Date(value))]]} empty="None" /></div> }

export function MovementsPage() {
  const state = useLoad(() => operationsApi.movements({ page: 1, limit: 100 }), [])
  return <><PageHeader eyebrow="AUDIT TRAIL" title="Stock movements" description="Append-only movement history for purchases, sales, returns and adjustments."/><section className="surface data-panel"><StatePanel loading={state.loading} error={state.error} empty={(state.data?.movements?.length ?? 0) === 0} emptyMessage="No stock movements found."><RecordTable rows={state.data?.movements ?? []} columns={[[ 'timestamp', 'Timestamp', (value) => dateTimeFormat.format(new Date(value))], ['medicine.name', 'Medicine'], ['batch.batchNumber', 'Batch'], ['movementType', 'Type'], ['previousQuantity', 'Previous'], ['quantityChanged', 'Change'], ['newQuantity', 'New'], ['reason', 'Reason'], ['performedBy.name', 'User']]}/></StatePanel></section></>
}

export function UsersPage() {
  const state = useLoad(() => authApi.listUsers({ page: 1, limit: 50 }), [])
  const [notice, setNotice] = useState('')
  async function updateRole(user, role) {
    try { await authApi.updateRole(user.id, role); setNotice('User role updated.'); state.refresh() } catch (error) { setNotice(getApiError(error)) }
  }
  async function toggle(user) {
    try { await authApi.setActive(user.id, !user.isActive); setNotice('User activation updated.'); state.refresh() } catch (error) { setNotice(getApiError(error)) }
  }
  return <><PageHeader eyebrow="ADMINISTRATION" title="User management" description="Manage account roles and access status."/>{notice && <Toast message={notice} clear={() => setNotice('')}/>}<section className="surface data-panel"><StatePanel loading={state.loading} error={state.error} empty={(state.data?.users?.length ?? 0) === 0} emptyMessage="No users found."><div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{(state.data?.users ?? []).map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td><select aria-label={`Role for ${user.name}`} value={user.role} onChange={(event) => updateRole(user, event.target.value)}><option value="admin">Admin</option><option value="pharmacist">Pharmacist</option><option value="cashier">Cashier</option><option value="customer">Customer</option></select></td><td><StatusPill active={user.isActive}/></td><td><button className="button tiny" onClick={() => toggle(user)}>{user.isActive ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div></StatePanel></section></>
}

export function ProfilePage() {
  const { user } = useAuth()
  return <><PageHeader eyebrow="ACCOUNT" title="Profile" description="Your signed-in PharmaCare account."/><section className="surface profile-card"><CircleUserRound size={36}/><div><h2>{user.name}</h2><p>{user.email}</p><span className="status-pill active">{user.role}</span></div><ShieldCheck size={20} className="muted-icon"/></section></>
}

export function CategoriesPage() { return <CatalogPage kind="categories" /> }
export function MedicinesPage() { return <CatalogPage kind="medicines" /> }
export function SuppliersPage() { return <CatalogPage kind="suppliers" /> }
