import React from 'react';
import {
  LayoutDashboard,
  Plus,
  FileText,
  Users,
  CalendarClock,
  Package,
  Landmark,
  TrendingDown,
  BarChart3,
  Settings,
  Search,
  Download,
} from 'lucide-react';
import { apiRequest, money, num } from '../../api.js';

export default function StockProductsPage({ app }) {
  const { optionalWarrantyValue, data, page, setPage, inventorySearch, setInventorySearch, inventoryChip, setInventoryChip, stockTab, setStockTab, setEditingProduct, setShowProductModal } = app;
  return (
              <>
                <div className="page-head">
                  <div>
                    <h1>Stock & Products</h1>
                  </div>
                  <div className="head-actions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setPage('receive-stock')}
                    >
                      + Add Stock (Supplier Invoice)
                    </button>
                  </div>
                </div>

                <div className="inventory-top-grid">
                  <div className="inventory-kpis">
                    <section className="inventory-kpi">
                      <div className="inventory-kpi-label">Product models</div>
                      <div className="inventory-kpi-value">{data.products.length}</div>
                      <div className="inventory-kpi-foot">Unique items in catalogue</div>
                    </section>
                    <section className="inventory-kpi">
                      <div className="inventory-kpi-label">Units available</div>
                      <div className="inventory-kpi-value">
                        {num(data.summary.stockUnits).toLocaleString('en-PK')}
                      </div>
                      <div className="inventory-kpi-foot">Across all product models</div>
                    </section>
                    <section className="inventory-kpi">
                      <div className="inventory-kpi-label">Stock at cost</div>
                      <div className="inventory-kpi-value">
                        {money(data.summary.stockCostValuation)}
                      </div>
                      <div className="inventory-kpi-foot">
                        Retail value: {money(data.summary.stockRetailValuation)}
                      </div>
                    </section>
                  </div>

                  <aside className="inventory-reorder">
                    <div className="inventory-reorder-head">
                      <h3>Reorder watch</h3>
                      <span className="inventory-reorder-count">
                        {data.summary.lowStockCount || 0} items
                      </span>
                    </div>
                    {(() => {
                      const low = data.products
                        .filter((p) => num(p.stock) <= num(p.reorderThreshold || 5))
                        .sort((a, b) => num(a.stock) - num(b.stock));
                      if (low.length === 0) {
                        return (
                          <div className="inventory-reorder-empty">
                            All products are above their reorder threshold.
                          </div>
                        );
                      }
                      return (
                        <div className="inventory-reorder-list">
                          {low.slice(0, 4).map((p) => (
                            <div key={p.id} className="inventory-reorder-item">
                              <span>{p.name}</span>
                              <b>{p.stock} left</b>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </aside>
                </div>

                {/* Sub-navigation for Catalogue vs Stock Movements vs Supplier Invoices */}
                <section className="card">
                  <div className="inventory-section-head">
                    <div>
                      <h2>
                        {stockTab === 'products'
                          ? 'Product inventory'
                          : stockTab === 'movements'
                          ? 'Stock movement history'
                          : 'Supplier invoice history'}
                      </h2>
                    </div>
                    <div className="stock-chips" role="tablist">
                      <button
                        type="button"
                        className={stockTab === 'products' ? 'on' : ''}
                        onClick={() => setStockTab('products')}
                      >
                        Products ({data.products.length})
                      </button>
                      <button
                        type="button"
                        className={stockTab === 'movements' ? 'on' : ''}
                        onClick={() => setStockTab('movements')}
                      >
                        Stock Movements ({data.stockMovements.length})
                      </button>
                      <button
                        type="button"
                        className={stockTab === 'invoices' ? 'on' : ''}
                        onClick={() => setStockTab('invoices')}
                      >
                        Supplier Invoices ({data.stockReceipts.length})
                      </button>
                    </div>
                  </div>

                  {stockTab === 'products' && (
                    <>
                      <div className="inventory-toolbar">
                        <div className="inventory-toolbar-left">
                          <label className="inventory-search">
                            <span><Search size={14} /></span>
                            <input
                              placeholder="Search product, SKU, barcode or category"
                              value={inventorySearch}
                              onChange={(e) => setInventorySearch(e.target.value)}
                            />
                          </label>
                          <div className="stock-chips" role="group" aria-label="Stock level">
                            {[
                              ['all', 'All'],
                              ['healthy', 'Healthy'],
                              ['reorder', 'Reorder soon'],
                              ['critical', 'Critical'],
                            ].map(([chip, label]) => (
                              <button
                                key={chip}
                                type="button"
                                className={inventoryChip === chip ? 'on' : ''}
                                onClick={() => setInventoryChip(chip)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {(() => {
                        const q = inventorySearch.trim().toLowerCase();
                        const maxStock = Math.max(10, ...data.products.map((x) => num(x.stock)));
                        const filtered = data.products.filter((p) => {
                          const s = num(p.stock);
                          const thresh = num(p.reorderThreshold || 5);
                          const matchText =
                            !q ||
                            p.name.toLowerCase().includes(q) ||
                            p.code.toLowerCase().includes(q) ||
                            (p.barcode && p.barcode.toLowerCase().includes(q)) ||
                            (p.category || '').toLowerCase().includes(q);
                          const matchLevel =
                            inventoryChip === 'all' ||
                            (inventoryChip === 'healthy' && s > thresh) ||
                            (inventoryChip === 'reorder' && s > 2 && s <= thresh) ||
                            (inventoryChip === 'critical' && s <= 2);
                          return matchText && matchLevel;
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="empty">
                              No products match these filters. Try another search.
                            </div>
                          );
                        }

                        return (
                          <div className="table-wrap">
                            <table className="table">
                              <thead>
                                <tr>
                                  <th>Product / model</th>
                                  <th>Category</th>
                                  <th>Warranty</th>
                                  <th>Available units</th>
                                  <th>Unit cost</th>
                                  <th>Sale price</th>
                                  <th>Stock health</th>
                                  <th>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filtered.map((p) => {
                                  const stock = num(p.stock);
                                  const pct = Math.max(4, Math.min(100, (stock / maxStock) * 100));
                                  const color =
                                    stock <= 2 ? '#c85a57' : stock <= 5 ? '#d19a35' : '#2c9a78';
                                  return (
                                    <tr key={p.id}>
                                      <td>
                                        <strong>{p.name}</strong>
                                        <small className="muted" style={{ display: 'block' }}>
                                          SKU: {p.code}
                                          {p.serialNumber ? ` · SN: ${p.serialNumber}` : ''}
                                        </small>
                                      </td>
                                      <td>{p.category || 'Electronics'}</td>
                                      <td>{optionalWarrantyValue(p.warranty) || '—'}</td>
                                      <td>
                                        <div
                                          className="inventory-stock-meter"
                                          style={{
                                            '--stock-width': `${pct}%`,
                                            '--stock-color': color,
                                          }}
                                        >
                                          <b>{stock}</b>
                                          <i />
                                        </div>
                                      </td>
                                      <td>{p.cost ? money(p.cost) : '—'}</td>
                                      <td>
                                        <strong>{money(p.price)}</strong>
                                      </td>
                                      <td>
                                        {stock <= 2 ? (
                                          <span className="status overdue">Critical · {stock}</span>
                                        ) : stock <= num(p.reorderThreshold || 5) ? (
                                          <span className="status pending">Reorder · {stock}</span>
                                        ) : (
                                          <span className="status">Healthy</span>
                                        )}
                                      </td>
                                      <td>
                                        <button
                                          type="button"
                                          className="btn ghost small"
                                          onClick={() => {
                                            setEditingProduct(p);
                                            setShowProductModal(true);
                                          }}
                                        >
                                          Edit / Adjust
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </>
                  )}

                  {stockTab === 'movements' && (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Product</th>
                            <th>Type</th>
                            <th>Qty Change</th>
                            <th>Stock After</th>
                            <th>Reference</th>
                            <th>Note</th>
                            <th>User</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.stockMovements.map((m) => (
                            <tr key={m.id}>
                              <td>
                                {m.createdAt
                                  ? new Date(m.createdAt).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                    })
                                  : 'Today'}
                              </td>
                              <td>
                                <strong>{m.productName}</strong>
                              </td>
                              <td style={{ textTransform: 'capitalize' }}>{m.type}</td>
                              <td>
                                <strong
                                  style={{ color: m.qtyChange >= 0 ? '#168365' : '#b44e4b' }}
                                >
                                  {m.qtyChange >= 0 ? `+${m.qtyChange}` : m.qtyChange}
                                </strong>
                              </td>
                              <td>{m.stockAfter}</td>
                              <td>{m.referenceId || '—'}</td>
                              <td>{m.note || '—'}</td>
                              <td>{m.createdBy || 'Admin'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {stockTab === 'invoices' && (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Invoice Reference</th>
                            <th>Supplier</th>
                            <th>Received Date</th>
                            <th>Items</th>
                            <th>Invoice Total</th>
                            <th>Paid</th>
                            <th>Payable Added</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.stockReceipts.map((r) => (
                            <tr key={r.id}>
                              <td>
                                <strong>{r.invoiceNo}</strong>
                              </td>
                              <td>{r.supplier}</td>
                              <td>{r.date}</td>
                              <td>
                                {(r.items || []).length} line
                                {(r.items || []).length === 1 ? '' : 's'}
                              </td>
                              <td>
                                <strong>{money(r.total)}</strong>
                              </td>
                              <td>{money(r.payment?.paid || 0)}</td>
                              <td>{money(r.payment?.balance || 0)}</td>
                              <td>
                                <span className="status">Posted</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
  );
}
