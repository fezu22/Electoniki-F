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

export default function DashboardPage({ app }) {
  const { data, page, setPage, dashPeriod, setDashPeriod } = app;
  return (
              <>
                <div className="page-head">
                  <div>
                    <h1>Dashboard</h1>
                  </div>
                  <div className="head-actions">
                    <div className="stock-chips" role="group" aria-label="Dashboard period">
                      {[
                        ['all', 'All Time'],
                        ['month', 'This Month'],
                        ['today', 'Today'],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          className={dashPeriod === key ? 'on' : ''}
                          onClick={() => setDashPeriod(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 8 Comprehensive Database-Calculated KPIs */}
                <div className="grid dash-kpis">
                  <section className="card dash-kpi">
                    <div className="dash-kpi-head">Sales today</div>
                    <div className="dash-kpi-value">{money(data.summary.todaySales)}</div>
                    <div className="dash-kpi-note">
                      {data.summary.todayBillsCount || 0} bill
                      {data.summary.todayBillsCount === 1 ? '' : 's'} recorded today
                    </div>
                  </section>
                  <section className="card dash-kpi">
                    <div className="dash-kpi-head">Gross & Net Sales</div>
                    <div className="dash-kpi-value">{money(data.summary.netSales)}</div>
                    <div className="dash-kpi-note">
                      Gross: {money(data.summary.grossSales)} · {data.summary.periodBillsCount || 0} bills
                    </div>
                  </section>
                  <section className="card dash-kpi">
                    <div className="dash-kpi-head">Collected payments</div>
                    <div className="dash-kpi-value" style={{ color: '#168365' }}>
                      {money(data.summary.collectedPayments)}
                    </div>
                    <div className="dash-kpi-note">
                      Cash, bank & installment receipts
                    </div>
                  </section>
                  <section className="card dash-kpi">
                    <div className="dash-kpi-head">Installment & Customer Due</div>
                    <div className="dash-kpi-value" style={{ color: '#12708f' }}>
                      {money(data.summary.totalCustomerOutstanding)}
                    </div>
                    <div className="dash-kpi-note">
                      Khata: {money(data.summary.installmentBalance)} ({data.summary.activeInstallmentPlansCount || 0} plans)
                    </div>
                  </section>
                  <section className="card dash-kpi">
                    <div className="dash-kpi-head">Cash in hand</div>
                    <div className="dash-kpi-value">{money(data.summary.cashInHand)}</div>
                    <div className="dash-kpi-note">
                      Opening + cash inflows − cash expenses
                    </div>
                  </section>
                  <section className="card dash-kpi">
                    <div className="dash-kpi-head">Bank balances</div>
                    <div className="dash-kpi-value">{money(data.summary.bankBalancesTotal)}</div>
                    <div className="dash-kpi-note">
                      Across {data.bankAccounts.length} shop bank accounts
                    </div>
                  </section>
                  <section className="card dash-kpi">
                    <div className="dash-kpi-head">Shop expenses</div>
                    <div className="dash-kpi-value" style={{ color: '#b44e4b' }}>
                      {money(data.summary.expensesTotal)}
                    </div>
                    <div className="dash-kpi-note">
                      {data.summary.expensesCount || 0} recorded expense entries
                    </div>
                  </section>
                  <section className="card dash-kpi">
                    <div className="dash-kpi-head">Net profit</div>
                    <div
                      className="dash-kpi-value"
                      style={{ color: num(data.summary.netProfit) >= 0 ? '#168365' : '#c14f52' }}
                    >
                      {money(data.summary.netProfit)}
                    </div>
                    <div className="dash-kpi-note">
                      (Net Sales − COGS − Returns) − Expenses
                    </div>
                  </section>
                </div>

                {/* Sales Trend Chart & Quick Actions */}
                <div className="grid dashboard-main">
                  <section className="card">
                    <div className="card-head">
                      <div>
                        <h2>Sales trend</h2>
                        <div className="muted tiny" style={{ marginTop: 4 }}>
                          Recorded bill totals · last 7 days
                        </div>
                      </div>
                      <span className="tag">This week</span>
                    </div>
                    <div className="dash-chart">
                      {(() => {
                        const today = new Date();
                        const days = [];
                        for (let i = 6; i >= 0; i--) {
                          const d = new Date(today);
                          d.setDate(today.getDate() - i);
                          const from = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                          const to = new Date(from);
                          to.setDate(to.getDate() + 1);
                          const dayTotal = data.sales
                            .filter((b) => {
                              const dt = new Date(b.createdAt || Date.now());
                              return dt >= from && dt < to;
                            })
                            .reduce((s, b) => s + num(b.total), 0);
                          days.push({
                            label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
                            total: dayTotal,
                          });
                        }
                        const max = Math.max(...days.map((x) => x.total), 1);
                        return days.map((x, idx) => (
                          <div key={idx} className="bar-wrap">
                            <div
                              className="bar"
                              style={{
                                height: `${Math.max(
                                  x.total ? 10 : 3,
                                  Math.round((x.total / max) * 100)
                                )}%`,
                              }}
                            >
                              <span className="bar-total">
                                {x.total ? money(x.total).replace('Rs. ', '') : ''}
                              </span>
                            </div>
                            <span className="bar-label">{x.label}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </section>

                  <section className="card">
                    <div className="card-head">
                      <div>
                        <h2>Quick actions</h2>
                        <div className="muted tiny" style={{ marginTop: 4 }}>
                          Go straight to a shop workflow
                        </div>
                      </div>
                    </div>
                    <div className="dash-actions">
                      <button type="button" className="dash-action" onClick={() => setPage('sale')}>
                        <span><Plus size={15} /></span>New Sale
                      </button>
                      <button
                        type="button"
                        className="dash-action"
                        onClick={() => setPage('receive-stock')}
                      >
                        <span><Download size={15} /></span>Add Stock
                      </button>
                      <button type="button" className="dash-action" onClick={() => setPage('khata')}>
                        <span><CalendarClock size={15} /></span>Installment Khata
                      </button>
                      <button type="button" className="dash-action" onClick={() => setPage('bills')}>
                        <span><FileText size={15} /></span>Bills & Receipts
                      </button>
                      <button
                        type="button"
                        className="dash-action"
                        onClick={() => setPage('expenses')}
                      >
                        <span><TrendingDown size={15} /></span>Shop Expenses
                      </button>
                      <button
                        type="button"
                        className="dash-action"
                        onClick={() => setPage('finance')}
                      >
                        <span><Landmark size={15} /></span>Finance & Banks
                      </button>
                    </div>
                  </section>
                </div>

                {/* Low Stock Alerts & Active Installment Accounts */}
                <div className="grid dashboard-lower">
                  <section className="card">
                    <div className="card-head">
                      <div>
                        <h2>Low stock alerts</h2>
                        <div className="muted tiny" style={{ marginTop: 4 }}>
                          Products at or below reorder threshold
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => setPage('stock')}
                      >
                        View stock
                      </button>
                    </div>
                    <div className="dash-list">
                      {(() => {
                        const low = data.products.filter(
                          (p) => num(p.stock) <= num(p.reorderThreshold || 5)
                        );
                        if (low.length === 0) {
                          return (
                            <div className="dash-empty">
                              All products are above the low-stock alert level.
                            </div>
                          );
                        }
                        return low.slice(0, 5).map((p) => (
                          <div key={p.id} className="dash-list-row">
                            <div className="dash-list-copy">
                              <b>{p.name}</b>
                              <small>
                                {p.code} · {p.category || 'Electronics'}
                              </small>
                            </div>
                            <span
                              className={`status ${num(p.stock) <= 2 ? 'overdue' : 'pending'}`}
                            >
                              {p.stock} left
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  </section>

                  <section className="card">
                    <div className="card-head">
                      <div>
                        <h2>Installment accounts</h2>
                        <div className="muted tiny" style={{ marginTop: 4 }}>
                          Outstanding balances to follow up
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => setPage('khata')}
                      >
                        Open Khata
                      </button>
                    </div>
                    <div className="dash-list">
                      {(() => {
                        const openPlans = data.installmentPlans.filter((p) => num(p.balance) > 0);
                        if (openPlans.length === 0) {
                          return (
                            <div className="dash-empty">
                              No active installment balances yet.
                            </div>
                          );
                        }
                        return openPlans.slice(0, 4).map((p) => (
                          <div key={p.id} className="dash-list-row">
                            <div className="dash-list-copy">
                              <b>{p.customerName}</b>
                              <small>
                                {p.phone || p.planNo} · {p.months} months
                              </small>
                            </div>
                            <span className="dash-list-value">{money(p.balance)}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </section>
                </div>

                {/* Supplier Payable Card */}
                <section className="card dash-supplier">
                  <div className="dash-supplier-main">
                    <div className="dash-supplier-top">
                      <span className="dash-kpi-head">Supplier payable</span>
                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => setPage('suppliers')}
                      >
                        View suppliers
                      </button>
                    </div>
                    <div className="dash-supplier-total">
                      <div className="dash-kpi-value">
                        {money(data.summary.supplierPayablesTotal)}
                      </div>
                      <div className="dash-kpi-note">
                        Total payable across {data.suppliers.length} supplier
                        {data.suppliers.length === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                  <div className="dash-supplier-rows">
                    {data.suppliers.map((s) => {
                      const tot = Math.max(1, num(data.summary.supplierPayablesTotal));
                      const pct = Math.round((num(s.balancePayable) / tot) * 100);
                      const initials = s.name
                        .split(/\s+/)
                        .map((w) => w[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();
                      return (
                        <div key={s.id} className="sup-row">
                          <span className="sup-avatar">{initials}</span>
                          <div className="sup-info">
                            <div className="sup-line">
                              <b>{s.name}</b>
                              <strong>{money(s.balancePayable)}</strong>
                            </div>
                            <div className="sup-bar">
                              <i style={{ width: `${Math.max(4, pct)}%` }} />
                            </div>
                            <small>{pct}% of total payable</small>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </>
  );
}
