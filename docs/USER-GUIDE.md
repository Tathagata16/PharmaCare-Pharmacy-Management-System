# PharmaCare User Guide

This guide describes the current screens and workflows in the React client.
The available navigation depends on the signed-in role. Labels and fields
below follow the implemented UI; some actions are limited by backend
permissions as well as by the screen.

## 1. Introduction

PharmaCare is a pharmacy operations application for a medicine catalog,
suppliers, purchases, batch inventory, sales, returns, stock adjustments, and
reports. Inventory is tracked by batch and expiry date. The app does not
process a payment through a payment provider, provide medical advice, or
automatically return inspected goods to sellable stock.

Customer accounts can browse the medicine catalog and view their profile.
Online ordering, shopping-cart checkout, and customer purchase-history screens
are not implemented.

## 2. System Requirements

- A modern browser with JavaScript enabled.
- The PharmaCare client running in a supported browser.
- A running PharmaCare API and connected MongoDB database for data-backed
  actions.
- Staff accounts created by an administrator; public registration creates
  customer accounts only.

For local development prerequisites and startup commands, see
[`DEPLOYMENT-GUIDE.md`](./DEPLOYMENT-GUIDE.md).

## 3. Login Instructions

1. Open the client URL provided by the system operator. In local development,
   this is normally `http://localhost:5173`.
2. On the **Sign in to PharmaCare** screen, enter the account email and
   password.
3. Select **Sign in**. On success, the app opens the role-appropriate
   workspace.
4. If you are a new customer, choose **Create an account** and provide full
   name, email, and a password of at least eight characters. This public
   registration flow creates a customer role, not a staff account.
5. If you are staff, ask an administrator for an account. The first admin is
   provisioned with the private server CLI; there are no default demo login
   credentials in the repository.

[Insert screenshot: Login screen]

## 4. Admin Dashboard

After an admin signs in, **Dashboard** is the first workspace page. It shows
active medicine and supplier counts, available unexpired units, today's,
monthly, and lifetime revenue, a daily sales trend, low-stock/expiry alerts,
and recent completed sales. These values are loaded from the backend.

Use the sidebar to move to catalog, procurement, inventory, sales, returns,
stock movements, reports, user management, and profile. The admin role has
the broadest access, but business rules such as referenced-record deletion
restrictions still apply.

[Insert screenshot: Admin Dashboard]

## 5. Pharmacist Dashboard

The pharmacist dashboard shows the same manager operational summary as the
admin dashboard. Pharmacists can manage catalog categories, suppliers,
purchases, batch inventory and permitted stock adjustments, sales, returns,
movements, and reports. The **Users** page is not available to pharmacists.

[Insert screenshot: Pharmacist Dashboard]

## 6. Cashier Dashboard

Cashier navigation includes **Dashboard**, **Medicines**, **Batch inventory**,
**Sales & billing**, **Reports**, and **Profile**. The dashboard presents a
daily sales report/trend rather than admin/pharmacist-wide inventory KPIs.
Cashiers can process sales and view permitted sales and invoices; the server
limits their sales history to their own transactions.

Cashiers cannot manage medicines, categories, suppliers, purchases, returns,
user roles, or stock adjustments. The Inventory page lets a cashier inspect
batch stock, but manager-only alerts and adjustment actions are not available
to this role.

[Insert screenshot: Cashier Dashboard]

## 7. User Management

Only an admin sees **Users** in the workspace navigation.

1. Open **Users**.
2. Review the user list and current role/status.
3. Choose a role from the user's role selector to update it.
4. Select **Deactivate** or **Activate** to change account status.
5. Confirm the updated status in the refreshed table.

Changing a role or activation state revokes the affected user's existing
tokens. The UI does not permit the current admin to remove their own admin
role or deactivate their own account; the API enforces these restrictions.

[Insert screenshot: User Management]

## 8. Adding Medicines

Admin and pharmacist users can add medicines.

1. Open **Medicines**.
2. Select **Add medicine**.
3. Enter medicine name, generic name, manufacturer, and choose a category.
   Brand, reorder level, and description are also available.
4. Save the form. A medicine record is added to the catalog.
5. To make units available for sale, record a purchase batch separately;
   adding a medicine does not set stock or price.

Catalog users can search by a partial medicine or generic-name string. Staff
can also filter by category and manufacturer. A displayed price is derived
from the earliest eligible batch.

[Insert screenshot: Add Medicine]

## 9. Managing Categories

Admin and pharmacist users can manage categories.

1. Open **Categories**.
2. Select **Add category** and provide a category name; description is
   optional.
3. Save. Use the edit action to update category information.
4. Use the delete action to remove an unused category. A category referenced
   by a medicine cannot be deleted.

[Insert screenshot: Categories]

## 10. Managing Suppliers

Admin and pharmacist users can manage suppliers.

1. Open **Suppliers**.
2. Select **Add supplier**.
3. Enter the supplier name. Contact person, email, phone, and address are
   optional.
4. Save. Use search and the status filter to find active or inactive records.
5. Use **History** on a supplier row to view its purchase history.
6. Use **Edit** or the activation action to update details or deactivate/
   reactivate the supplier.

There is no supplier delete action in the current UI.

[Insert screenshot: Suppliers]

## 11. Recording Purchases

Admin and pharmacist users can receive purchases.

1. Ensure the supplier is active and the medicine already exists in the
   catalog. Create either record first if it does not.
2. Open **Purchases** and select **New purchase**.
3. Select a supplier.
4. Select a medicine and use **Add medicine** to add it as a purchase line.
5. Enter its batch number, whole-unit quantity, purchase price, selling
   price, and future expiry date.
6. Add additional distinct medicine/batch lines if needed.
7. Review the displayed calculated total and select **Receive purchase**.
8. The server creates a purchase invoice, batch stock, stock movements, and
   an audit record. The purchase appears in the purchase list.

The same medicine and batch number cannot be received twice. An already
expired batch cannot be received. The server calculates the persisted total
independently of the displayed estimate.

[Insert screenshot: Receive Purchase]

## 12. Managing Medicine Batches

Batch quantities are created by receiving purchases; there is no separate
manual batch-create form.

1. Open **Batch inventory** to review medicine, batch number, supplier,
   quantity, purchase cost, selling price, and expiry.
2. The table is ordered by expiry date. The inventory page requests records
   including expired batches so staff can inspect them.
3. Use **Refresh** to reload the displayed data.
4. Admin/pharmacist users may select **Adjust stock** for an eligible row.
5. Batch receipt details are retained in the purchase and batch records; no
   workflow edits batch expiry or prices independently after receipt.

[Insert screenshot: Batch Inventory]

## 13. Checking Stock Availability

1. Open **Batch inventory** to see quantities by batch.
2. Admin and pharmacist users can also view low-stock counts, near-expiry
   counts, and purchase-cost valuation on that screen.
3. In **Sales & billing**, searching and selecting a medicine checks its
   current sellable stock. Expired and empty batches do not count as available.
4. The medicine catalog displays the current eligible batch price, or
   indicates that a price is unavailable.

Available stock is calculated by the server from active-medicine batches
whose expiry dates have not passed. The application does not maintain a
separate editable stock number on the medicine.

[Insert screenshot: Stock Availability]

## 14. Processing Sales

Admin, pharmacist, and cashier accounts can process sales.

1. Open **Sales & billing**.
2. Search by a partial medicine or generic name.
3. Select a result to add it to the cart. The app checks available quantity.
4. Set the quantity for each cart line; it cannot exceed the displayed
   availability.
5. Enter a discount amount if permitted and select a payment method: cash,
   card, mobile money, or other.
6. Select **Complete sale**.
7. The server rechecks stock, allocates eligible batches FEFO, computes
   prices/tax/discount/total, and records the sale and stock movements.
8. On success, the page displays the invoice preview.

The selected payment method is recorded only; the app does not charge a card
or connect to a payment provider. If stock changed before checkout, the server
may reject the sale; refresh and review the cart before retrying.

[Insert screenshot: Sales & Billing]

## 15. Generating Invoices

After a successful checkout, the **Invoice preview** appears below the sales
workspace. It shows invoice number, pharmacy name, date, sale lines, batch,
quantity, unit price, totals, and payment method. Select **Print** to open the
printable HTML invoice and use the browser's print dialog.

The API also has invoice detail and HTML print endpoints. Cashiers may access
only invoices for their own sales. Customer invoice browsing is not exposed
in the current customer UI.

[Insert screenshot: Invoice Preview]

## 16. Processing Returns

Admin and pharmacist users can record a return.

1. Open **Returns**.
2. Under **Record return**, select the original completed sale invoice.
3. Select an eligible sold item/batch. The list shows the remaining eligible
   quantity after prior returns.
4. Enter a positive whole-number return quantity within the eligible
   quantity.
5. Enter the return reason and select **Record return**.
6. The return appears in **Recent returns** with `pending_inspection` status.

The current application does not provide an inspection/disposition action,
issue a payment refund, or add returned units back to sellable stock. Do not
represent a recorded return as restocked.

[Insert screenshot: Returns]

## 17. Making Stock Adjustments

Admin and pharmacist users can adjust a batch.

1. Open **Batch inventory** and select **Adjust stock** on the target batch.
2. Choose **Damaged**, **Expired**, **Missing**, **Physical stock
   correction**, or **Other**.
3. Enter the quantity and a reason.
4. For damaged, expired, or missing stock, enter a positive number of units
   to remove; the UI converts it to a negative quantity change.
5. For physical correction or other, enter a positive number to add or a
   negative number to remove.
6. Select **Record adjustment**. On success, the page refreshes and the
   movement and audit history are saved.

The resulting quantity cannot be negative. An expired adjustment requires the
batch expiry date to have passed.

[Insert screenshot: Stock Adjustment]

## 18. Viewing Reports

Navigation includes **Reports** for admin, pharmacist, and cashier users.
The screen renders **Sales**, **Stock**, **Expiry**, and **Suppliers** tabs.
The API currently permits cashiers to view only their own sales report;
stock, expiry, and supplier reports require the admin/pharmacist inventory
report permission and will return an authorization error for a cashier.

1. Open **Reports** and choose a tab.
2. For sales, stock, and suppliers, optionally set **From** and **To** dates.
   The page reloads the report after a date selection.
3. Use **Refresh** to reload the current report.
4. Sales shows revenue/transaction/tax/discount summaries and date-grouped
   rows. Cashier results are scoped to that cashier's own sales.
5. Admins and pharmacists can use **Stock** to see opening, purchases, sales,
   returns, adjustments, closing, and current stock.
6. Admins and pharmacists can use **Expiry** to see expired batches and
   30/60/90-day groups.
7. Admins and pharmacists can use **Suppliers** to see purchase counts and
   spend summaries.

Admin and pharmacist users also have a **Stock movements** page in the
sidebar. Admins can view audit history through the API; the current UI does
not expose an audit-log page.

[Insert screenshot: Reports]

## 19. Logging Out

1. Select **Sign out** in the top-right workspace header.
2. The client calls the logout endpoint to revoke the current session.
3. The client removes its saved access token and clears the signed-in user.

If the API is unreachable during logout, the client still clears its local
session; the server-side revocation may not be confirmed until a successful
request.

## 20. Common Errors and Troubleshooting

| Message/symptom | Likely cause | What to do |
| --- | --- | --- |
| Cannot reach the PharmaCare API | Server is stopped, API URL is incorrect, or database/API startup failed | Start/check the server and verify `VITE_API_URL`; inspect server logs and `/api/health` |
| Authentication required / session invalid | Missing, expired, revoked token, deactivated user, or role change | Sign in again; contact an admin if the account is inactive |
| Insufficient permissions | The current role cannot use that operation | Use an authorized staff account; do not rely on hidden UI links as a permission bypass |
| Invalid request with field details | Required field missing, invalid ID/date/number, empty patch, or extra field | Correct the highlighted values; use whole units and valid ISO/date inputs |
| Duplicate category or medicine batch | Name or medicine/batch number already exists | Choose a unique category name or batch number |
| Category/medicine cannot be deleted | A medicine, batch, sale, or purchase references the record | Retain/deactivate the record instead of deleting historical data |
| Purchase rejected for expiry | Batch expiry is today or earlier | Enter the correct future expiry or do not receive that batch |
| Insufficient stock / inventory changed | Requested quantity exceeds currently sellable stock or another operation changed it | Refresh availability, adjust the cart quantity, and retry once |
| Discount exceeds permitted limit | Discount exceeds configured sale threshold | Reduce the discount; an administrator/operator must update backend configuration if policy requires it |
| Adjustment would make stock negative | More units removed than the selected batch contains | Verify the physical count and enter the correct adjustment |
| Expired adjustment rejected | The selected batch expiry is still in the future | Use an appropriate adjustment type, or select the expired batch |
| Return quantity rejected | The quantity exceeds the unreturned quantity on that invoice | Recheck the selected invoice and remaining eligible quantity |
| Purchase/sale/return/adjustment fails on standalone MongoDB | MongoDB transaction support is unavailable | Use a MongoDB replica set or `mongos` connection |
| Empty report or inventory panel | No matching records, no opening movement history, or selected date range has no data | Clear or widen date filters; seeded stock may not have corresponding opening movements |
| Too many authentication attempts | Per-process login/register rate limit was reached | Wait for the 15-minute window to expire before trying again |

For support, provide the operation, error text, and non-sensitive context.
Never include passwords, access tokens, or database connection strings.
