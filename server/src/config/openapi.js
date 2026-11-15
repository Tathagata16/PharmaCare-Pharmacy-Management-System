const auth = [{ bearerAuth: [] }]
const paging = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
]
const dateFilters = [
  { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
  { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
]
const idParameter = (name) => ({ name, in: 'path', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } })
const body = (schema) => ({
  required: true,
  content: { 'application/json': { schema: { $ref: `#/components/schemas/${schema}` } } },
})
const operation = (summary, tag, options = {}) => ({
  tags: [tag],
  summary,
  ...(options.description ? { description: options.description } : {}),
  ...(options.publicRoute ? {} : { security: auth }),
  ...(options.roles ? { description: `${options.description ? `${options.description}\n\n` : ''}Allowed roles: ${options.roles.join(', ')}.` } : {}),
  ...(options.parameters ? { parameters: options.parameters } : {}),
  ...(options.requestBody ? { requestBody: body(options.requestBody) } : {}),
  responses: {
    [options.noContent ? '204' : options.created ? '201' : '200']: {
      description: options.success ?? 'Request completed successfully.',
    },
    ...(options.noContent ? { 204: { description: 'Request completed; no response body.' } } : {}),
    400: { description: 'Invalid request data.' },
    401: { description: 'Authentication required or access token invalid.' },
    403: { description: 'The current role does not have permission.' },
    404: { description: 'Requested record was not found.' },
    409: { description: 'Business rule or concurrency conflict.' },
  },
})

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'PharmaCare Pharmacy Management API',
    version: '1.0.0',
    description: 'Authenticated APIs for pharmacy catalog, purchasing, batch inventory, sales, returns, audit history, and reports. All stock and monetary totals are computed and validated by the server.',
  },
  servers: [{ url: '/api', description: 'Current PharmaCare API origin' }],
  tags: [
    { name: 'Authentication' }, { name: 'Users' }, { name: 'Medicines' },
    { name: 'Categories' }, { name: 'Suppliers' }, { name: 'Purchases' },
    { name: 'Batches' }, { name: 'Inventory' }, { name: 'Sales' },
    { name: 'Returns' }, { name: 'Reports' },
  ],
  paths: {
    '/auth/register': { post: operation('Register a customer account', 'Authentication', { publicRoute: true, created: true, requestBody: 'RegisterRequest' }) },
    '/auth/login': { post: operation('Sign in with email and password', 'Authentication', { publicRoute: true, requestBody: 'LoginRequest' }) },
    '/auth/logout': { post: operation('Revoke the current user session version', 'Authentication', { noContent: true }) },
    '/auth/me': { get: operation('Get the current authenticated user', 'Authentication') },
    '/auth/users': { get: operation('List users', 'Users', { roles: ['admin'], parameters: paging }) },
    '/auth/users/{userId}/role': { patch: operation('Change a user role', 'Users', { roles: ['admin'], parameters: [idParameter('userId')], requestBody: 'UserRoleUpdate' }) },
    '/auth/users/{userId}/activation': { patch: operation('Activate or deactivate a user', 'Users', { roles: ['admin'], parameters: [idParameter('userId')], requestBody: 'UserActivation' }) },
    '/medicines': {
      get: operation('Search, filter, sort, and paginate medicines', 'Medicines', { parameters: [...paging, { name: 'search', in: 'query', schema: { type: 'string' } }, { name: 'category', in: 'query', schema: { type: 'string' } }, { name: 'manufacturer', in: 'query', schema: { type: 'string' } }, { name: 'sortBy', in: 'query', schema: { type: 'string' } }, { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } }] }),
      post: operation('Create a medicine', 'Medicines', { roles: ['admin', 'pharmacist'], created: true, requestBody: 'MedicineWrite' }),
    },
    '/medicines/{medicineId}': {
      get: operation('Get medicine details', 'Medicines', { parameters: [idParameter('medicineId')] }),
      patch: operation('Update or activate a medicine', 'Medicines', { roles: ['admin', 'pharmacist'], parameters: [idParameter('medicineId')], requestBody: 'MedicinePatch' }),
      delete: operation('Delete a medicine only when it has no historical references', 'Medicines', { roles: ['admin', 'pharmacist'], parameters: [idParameter('medicineId')], noContent: true }),
    },
    '/categories': {
      get: operation('List categories', 'Categories'),
      post: operation('Create a category', 'Categories', { roles: ['admin', 'pharmacist'], created: true, requestBody: 'CategoryWrite' }),
    },
    '/categories/{categoryId}': {
      patch: operation('Update a category', 'Categories', { roles: ['admin', 'pharmacist'], parameters: [idParameter('categoryId')], requestBody: 'CategoryPatch' }),
      delete: operation('Delete a category only when no medicine references it', 'Categories', { roles: ['admin', 'pharmacist'], parameters: [idParameter('categoryId')], noContent: true }),
    },
    '/suppliers': {
      get: operation('Search and paginate suppliers', 'Suppliers', { roles: ['admin', 'pharmacist'], parameters: [...paging, { name: 'search', in: 'query', schema: { type: 'string' } }, { name: 'isActive', in: 'query', schema: { type: 'boolean' } }] }),
      post: operation('Create a supplier', 'Suppliers', { roles: ['admin', 'pharmacist'], created: true, requestBody: 'SupplierWrite' }),
    },
    '/suppliers/{supplierId}': {
      get: operation('Get supplier details', 'Suppliers', { roles: ['admin', 'pharmacist'], parameters: [idParameter('supplierId')] }),
      patch: operation('Update supplier information', 'Suppliers', { roles: ['admin', 'pharmacist'], parameters: [idParameter('supplierId')], requestBody: 'SupplierPatch' }),
    },
    '/suppliers/{supplierId}/activation': { patch: operation('Activate or deactivate a supplier', 'Suppliers', { roles: ['admin', 'pharmacist'], parameters: [idParameter('supplierId')], requestBody: 'SupplierActivation' }) },
    '/suppliers/{supplierId}/purchases': { get: operation('View paginated supplier purchase history', 'Suppliers', { roles: ['admin', 'pharmacist'], parameters: [idParameter('supplierId'), ...paging] }) },
    '/purchases': {
      get: operation('List purchase invoices', 'Purchases', { roles: ['admin', 'pharmacist'], parameters: paging }),
      post: operation('Receive a purchase and atomically create batches and stock movements', 'Purchases', { roles: ['admin', 'pharmacist'], created: true, requestBody: 'PurchaseCreate' }),
    },
    '/purchases/{purchaseId}': { get: operation('Get purchase details', 'Purchases', { roles: ['admin', 'pharmacist'], parameters: [idParameter('purchaseId')] }) },
    '/batches': { get: operation('List batch-level inventory in FEFO order', 'Batches', { roles: ['admin', 'pharmacist'], parameters: paging }) },
    '/inventory/available/{medicineId}': { get: operation('Calculate available unexpired stock for a medicine', 'Inventory', { roles: ['admin', 'pharmacist', 'cashier'], parameters: [idParameter('medicineId')] }) },
    '/inventory/batch-wise/{medicineId}': { get: operation('View eligible stock by batch', 'Inventory', { roles: ['admin', 'pharmacist', 'cashier'], parameters: [idParameter('medicineId')] }) },
    '/inventory/low-stock': { get: operation('List medicines at or below reorder level', 'Inventory', { roles: ['admin', 'pharmacist'] }) },
    '/inventory/near-expiry': { get: operation('List batches inside the configurable expiry warning period', 'Inventory', { roles: ['admin', 'pharmacist'], parameters: [{ name: 'warningDays', in: 'query', schema: { type: 'integer', default: 30, minimum: 1, maximum: 365 } }] }) },
    '/inventory/expired': { get: operation('List expired batches', 'Inventory', { roles: ['admin', 'pharmacist'] }) },
    '/inventory/valuation': { get: operation('Calculate inventory cost and retail valuation', 'Inventory', { roles: ['admin', 'pharmacist'] }) },
    '/inventory/adjustments': { post: operation('Record a reasoned stock adjustment with movement and audit records', 'Inventory', { roles: ['admin', 'pharmacist'], created: true, requestBody: 'StockAdjustment' }) },
    '/sales': {
      get: operation('List permitted sales; cashiers are restricted to their own sales', 'Sales', { roles: ['admin', 'pharmacist', 'cashier'], parameters: paging }),
      post: operation('Process a sale with FEFO deductions and idempotency', 'Sales', { roles: ['admin', 'pharmacist', 'cashier'], created: true, requestBody: 'SaleCreate' }),
    },
    '/sales/{saleId}': { get: operation('Get a permitted sale', 'Sales', { roles: ['admin', 'pharmacist', 'cashier'], parameters: [idParameter('saleId')] }) },
    '/sales/{saleId}/invoice': { get: operation('Get printable invoice details', 'Sales', { roles: ['admin', 'pharmacist', 'cashier'], parameters: [idParameter('saleId')] }) },
    '/sales/{saleId}/invoice/print': { get: operation('Render an HTML invoice for printing', 'Sales', { roles: ['admin', 'pharmacist', 'cashier'], parameters: [idParameter('saleId')] }) },
    '/returns': {
      get: operation('List processed returns', 'Returns', { roles: ['admin', 'pharmacist'], parameters: paging }),
      post: operation('Record an idempotent return against an original sale', 'Returns', { roles: ['admin', 'pharmacist'], created: true, requestBody: 'ReturnCreate' }),
    },
    '/reports/dashboard': { get: operation('Get live dashboard metrics', 'Reports', { roles: ['admin', 'pharmacist'] }) },
    '/reports/sales': { get: operation('Aggregate daily, weekly, or monthly sales', 'Reports', { roles: ['admin', 'pharmacist', 'cashier'], parameters: [...dateFilters, ...paging, { name: 'period', in: 'query', schema: { type: 'string', enum: ['daily', 'weekly', 'monthly'] } }] }) },
    '/reports/stock': { get: operation('Reconcile movement-based stock over a date range', 'Reports', { roles: ['admin', 'pharmacist'] , parameters: [...dateFilters, ...paging] }) },
    '/reports/expiry': { get: operation('List expired batches and 30/60/90-day expiry groups', 'Reports', { roles: ['admin', 'pharmacist'] }) },
    '/reports/suppliers': { get: operation('Aggregate supplier purchase history and spend', 'Reports', { roles: ['admin', 'pharmacist'], parameters: [...dateFilters, ...paging] }) },
    '/reports/stock-movements': { get: operation('View paginated stock movement history', 'Reports', { roles: ['admin', 'pharmacist'], parameters: [...dateFilters, ...paging] }) },
    '/reports/audit': { get: operation('View append-only audit history', 'Reports', { roles: ['admin'], parameters: paging }) },
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      RegisterRequest: { type: 'object', additionalProperties: false, required: ['name', 'email', 'password'], properties: { name: { type: 'string', maxLength: 120 }, email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8, maxLength: 128 } } },
      LoginRequest: { type: 'object', additionalProperties: false, required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } } },
      UserRoleUpdate: { type: 'object', required: ['role'], properties: { role: { type: 'string', enum: ['admin', 'pharmacist', 'cashier', 'customer'] } } },
      UserActivation: { type: 'object', required: ['isActive'], properties: { isActive: { type: 'boolean' } } },
      MedicineWrite: { type: 'object', additionalProperties: false, required: ['name', 'genericName', 'category', 'manufacturer'], properties: { name: { type: 'string' }, genericName: { type: 'string' }, brand: { type: 'string' }, category: { type: 'string' }, manufacturer: { type: 'string' }, description: { type: 'string' }, reorderLevel: { type: 'integer', minimum: 0 }, isActive: { type: 'boolean' } } },
      MedicinePatch: { type: 'object', minProperties: 1, properties: { name: { type: 'string' }, genericName: { type: 'string' }, brand: { type: 'string' }, category: { type: 'string' }, manufacturer: { type: 'string' }, description: { type: 'string' }, reorderLevel: { type: 'integer', minimum: 0 }, isActive: { type: 'boolean' } } },
      CategoryWrite: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string' }, description: { type: 'string' } } },
      CategoryPatch: { type: 'object', additionalProperties: false, minProperties: 1, properties: { name: { type: 'string' }, description: { type: 'string' } } },
      SupplierWrite: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string' }, contactPerson: { type: 'string' }, email: { type: 'string', format: 'email' }, phone: { type: 'string' }, address: { type: 'string' } } },
      SupplierPatch: { type: 'object', additionalProperties: false, minProperties: 1, properties: { name: { type: 'string' }, contactPerson: { type: 'string' }, email: { type: 'string', format: 'email' }, phone: { type: 'string' }, address: { type: 'string' }, isActive: { type: 'boolean' } } },
      SupplierActivation: { type: 'object', required: ['isActive'], properties: { isActive: { type: 'boolean' } } },
      PurchaseCreate: { type: 'object', additionalProperties: false, required: ['supplier', 'items'], properties: { supplier: { type: 'string' }, items: { type: 'array', minItems: 1, items: { type: 'object', required: ['medicine', 'batchNumber', 'quantity', 'purchasePrice', 'sellingPrice', 'expiryDate'], properties: { medicine: { type: 'string' }, batchNumber: { type: 'string' }, quantity: { type: 'integer', minimum: 1 }, purchasePrice: { type: 'number', minimum: 0 }, sellingPrice: { type: 'number', minimum: 0 }, expiryDate: { type: 'string', format: 'date' } } } } } },
      SaleCreate: { type: 'object', additionalProperties: false, required: ['idempotencyKey', 'items', 'paymentMethod'], properties: { idempotencyKey: { type: 'string', minLength: 8 }, items: { type: 'array', minItems: 1, items: { type: 'object', required: ['medicine', 'quantity'], properties: { medicine: { type: 'string' }, quantity: { type: 'integer', minimum: 1 } } } }, discount: { type: 'number', minimum: 0, description: 'Fixed discount amount; limit is enforced by server configuration.' }, paymentMethod: { type: 'string', enum: ['cash', 'card', 'mobile_money', 'other'] } } },
      ReturnCreate: { type: 'object', additionalProperties: false, required: ['idempotencyKey', 'invoiceNumber', 'reason', 'items'], properties: { idempotencyKey: { type: 'string', minLength: 8 }, invoiceNumber: { type: 'string' }, reason: { type: 'string', maxLength: 500 }, items: { type: 'array', minItems: 1, items: { type: 'object', required: ['batch', 'quantity'], properties: { batch: { type: 'string' }, quantity: { type: 'integer', minimum: 1 } } } } } },
      StockAdjustment: { type: 'object', additionalProperties: false, required: ['batch', 'adjustmentType', 'quantityChange', 'reason'], properties: { batch: { type: 'string' }, adjustmentType: { type: 'string', enum: ['damaged', 'expired', 'missing', 'physical_correction', 'other'] }, quantityChange: { type: 'integer', description: 'Nonzero signed quantity delta.' }, reason: { type: 'string', minLength: 1, maxLength: 500 } } },
    },
  },
}
