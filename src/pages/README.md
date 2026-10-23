# Frontend pages

Each top-level screen has its own folder and a descriptively named `*Page.jsx` entry component (for example, `dashboard/DashboardPage.jsx`). `App.jsx` remains the workspace shell: it owns authentication, navigation, shared shop data and cross-page actions, then passes only the values each screen uses.

| Folder | Screen |
| --- | --- |
| `auth/` | Sign in and account recovery |
| `dashboard/` | Dashboard |
| `new-sale/` | New Sale |
| `bills/` | Bills & Receipts |
| `held-orders/` | Orders & Held Bills |
| `customer-returns/` | Customer Returns |
| `customers/` | Customers |
| `installment-khata/` | Installment Khata |
| `stock-products/` | Stock & Products |
| `receive-stock/` | Receive Stock workflow |
| `suppliers/` | Supplier Accounts |
| `finance/` | Finance & Banks |
| `cheques/` | Cheque Register |
| `expenses/` | Shop Expenses |
| `reports/` | Reports |
| `settings/` | Settings |
| `overview/` | Read-only store overview |

Invoice layouts stay in `../invoices/` because the sales and installment A5 documents share invoice-specific data and print utilities. Reusable controls and non-page widgets belong in `../components/`.
