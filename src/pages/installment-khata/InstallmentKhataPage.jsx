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

export default function InstallmentKhataPage({ app }) {
  const { data, page, plan, khataSearch, setKhataSearch, setShowAddInstallmentModal, setActiveKhataPlan, setKhataPayAmount, dateText } = app;
  return (
              <>
                <div className="page-head">
                  <div>
                    <h1>Installment Khata</h1>
                  </div>
                </div>

                <div className="grid khata-kpis">
                  <section className="card khata-kpi">
                    <div className="khata-kpi-label">Active installment plans</div>
                    <div className="khata-kpi-value">
                      {data.installmentPlans.filter((p) => num(p.balance) > 0).length}
                    </div>
                    <div className="khata-kpi-foot">Customers currently paying in installments</div>
                  </section>
                  <section className="card khata-kpi">
                    <div className="khata-kpi-label">Total outstanding</div>
                    <div className="khata-kpi-value">
                      {money(data.installmentPlans.reduce((s, p) => s + num(p.balance), 0))}
                    </div>
                    <div className="khata-kpi-foot">Remaining balance across active plans</div>
                  </section>
                  <section className="card khata-kpi">
                    <div className="khata-kpi-label">Payments collected</div>
                    <div className="khata-kpi-value">
                      {money(data.installmentPlans.reduce((s, p) => s + num(p.paid), 0))}
                    </div>
                    <div className="khata-kpi-foot">Total advance and installment payments</div>
                  </section>
                </div>

                <section className="card">
                  <div className="khata-toolbar">
                    <div>
                      <h2 style={{ margin: 0, color: '#12303f', fontSize: 16 }}>
                        Customer installment accounts
                      </h2>
                      <div className="muted tiny" style={{ marginTop: 4 }}>
                        {data.installmentPlans.length} account
                        {data.installmentPlans.length === 1 ? '' : 's'} · Updated {dateText}
                      </div>
                    </div>
                    <label className="khata-search">
                      <span><Search size={14} /></span>
                      <input
                        placeholder="Search by customer, phone or plan"
                        value={khataSearch}
                        onChange={(e) => setKhataSearch(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setShowAddInstallmentModal(true)}
                    >
                      ＋ Add installment customer
                    </button>
                  </div>

                  {(() => {
                    const q = khataSearch.trim().toLowerCase();
                    const plans = data.installmentPlans.filter(
                      (p) =>
                        !q ||
                        String(p.customerName || '').toLowerCase().includes(q) ||
                        String(p.phone || '').toLowerCase().includes(q) ||
                        String(p.planNo || '').toLowerCase().includes(q)
                    );
                    if (plans.length === 0) {
                      return (
                        <div className="empty">
                          No installment accounts match your search.
                        </div>
                      );
                    }
                    return (
                      <div className="khata-grid">
                        {plans.map((p) => {
                          const progress = p.totalAmount
                            ? Math.min(100, Math.round((num(p.paid) / num(p.totalAmount)) * 100))
                            : 100;
                          const initials = (p.customerName || 'CU')
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((w) => w[0] || '')
                            .join('')
                            .toUpperCase();
                          const isPaid = num(p.balance) === 0;
                          return (
                            <article key={p.id} className="khata-account">
                              <div className="khata-account-head">
                                <div className="khata-avatar">{initials}</div>
                                <div className="khata-customer">
                                  <b>{p.customerName}</b>
                                  <small>
                                    {p.phone || 'No phone'} · {p.planNo || p.invoiceNo}
                                  </small>
                                </div>
                                <span className={`khata-status ${isPaid ? 'paid' : ''}`}>
                                  {isPaid ? 'Paid' : 'Active'}
                                </span>
                              </div>

                              <div className="khata-balance-row">
                                <div>
                                  <small>Outstanding balance</small>
                                  <strong>{money(p.balance)}</strong>
                                </div>
                                <div className="khata-progress-label">{progress}% paid</div>
                              </div>

                              <div className="khata-progress">
                                <span style={{ width: `${progress}%` }} />
                              </div>

                              <div className="khata-metrics">
                                <div className="khata-metric">
                                  <small>Plan amount</small>
                                  <b>{money(p.totalAmount)}</b>
                                </div>
                                <div className="khata-metric">
                                  <small>Paid so far</small>
                                  <b>{money(p.paid)}</b>
                                </div>
                                <div className="khata-metric">
                                  <small>Monthly installment</small>
                                  <b>{money(p.monthlyAmount)}</b>
                                </div>
                              </div>

                              <div className="khata-card-foot">
                                <span className="khata-due">
                                  Next due <b>{p.nextDueDate || 'Monthly'}</b> · {p.months} months
                                </span>
                                <button
                                  type="button"
                                  className="btn ghost small"
                                  onClick={() => {
                                    setActiveKhataPlan(p);
                                    setKhataPayAmount(
                                      String(Math.min(num(p.balance), num(p.monthlyAmount) || num(p.balance)))
                                    );
                                  }}
                                >
                                  View account & Pay
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    );
                  })()}
                </section>
              </>
  );
}
