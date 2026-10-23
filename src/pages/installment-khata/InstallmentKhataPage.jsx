import React from 'react';
import { Search } from 'lucide-react';
import { money, num } from '../../api.js';

function normalizedPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('0092') && digits.length === 14) return `0${digits.slice(4)}`;
  if (digits.startsWith('92') && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.startsWith('3') && digits.length === 10) return `0${digits}`;
  return digits;
}

function groupPlansByCustomer(plans = []) {
  const groups = new Map();
  plans.forEach((plan) => {
    const phone = normalizedPhone(plan.whatsapp || plan.phone);
    const cnic = String(plan.cnic || '').replace(/\D/g, '');
    const name = String(plan.customerName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const key = phone
      ? `phone:${phone}`
      : cnic
        ? `cnic:${cnic}`
        : plan.customerId && plan.customerId !== 'walkin'
          ? `customer:${plan.customerId}`
          : `name:${name}`;
    const group = groups.get(key) || {
      key,
      customerName: plan.customerName || 'Customer',
      phone: plan.whatsapp || plan.phone || '',
      plans: [],
    };
    group.plans.push(plan);
    if (!group.phone) group.phone = plan.whatsapp || plan.phone || '';
    groups.set(key, group);
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    plans: group.plans.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
  }));
}

export default function InstallmentKhataPage({ app }) {
  const {
    data,
    khataSearch,
    setKhataSearch,
    setShowAddInstallmentModal,
    setActiveKhataPlan,
    setKhataPayAmount,
    dateText,
  } = app;
  const accounts = groupPlansByCustomer(data.installmentPlans);
  const query = khataSearch.trim().toLowerCase();
  const filteredAccounts = accounts.filter((account) =>
    !query ||
    account.customerName.toLowerCase().includes(query) ||
    account.phone.toLowerCase().includes(query) ||
    account.plans.some((item) => String(item.planNo || item.invoiceNo || '').toLowerCase().includes(query))
  );

  return (
    <>
      <div className="page-head">
        <div><h1>Installment Khata</h1></div>
      </div>

      <div className="grid khata-kpis">
        <section className="card khata-kpi">
          <div className="khata-kpi-label">Active installment plans</div>
          <div className="khata-kpi-value">
            {data.installmentPlans.filter((item) => num(item.balance) > 0).length}
          </div>
          <div className="khata-kpi-foot">Customers currently paying in installments</div>
        </section>
        <section className="card khata-kpi">
          <div className="khata-kpi-label">Total outstanding</div>
          <div className="khata-kpi-value">
            {money(data.installmentPlans.reduce((sum, item) => sum + num(item.balance), 0))}
          </div>
          <div className="khata-kpi-foot">Remaining balance across active plans</div>
        </section>
        <section className="card khata-kpi">
          <div className="khata-kpi-label">Payments collected</div>
          <div className="khata-kpi-value">
            {money(data.installmentPlans.reduce((sum, item) => sum + num(item.paid), 0))}
          </div>
          <div className="khata-kpi-foot">Total advance and installment payments</div>
        </section>
      </div>

      <section className="card">
        <div className="khata-toolbar">
          <div>
            <h2 style={{ margin: 0, color: '#12303f', fontSize: 16 }}>Customer installment accounts</h2>
            <div className="muted tiny" style={{ marginTop: 4 }}>
              {accounts.length} customer account{accounts.length === 1 ? '' : 's'} · Updated {dateText}
            </div>
          </div>
          <label className="khata-search">
            <span><Search size={14} /></span>
            <input
              placeholder="Search by customer, phone or plan"
              value={khataSearch}
              onChange={(event) => setKhataSearch(event.target.value)}
            />
          </label>
          <button type="button" className="btn" onClick={() => setShowAddInstallmentModal(true)}>
            + Add installment customer
          </button>
        </div>

        {filteredAccounts.length === 0 ? (
          <div className="empty">No installment accounts match your search.</div>
        ) : (
          <div className="khata-grid">
            {filteredAccounts.map((account) => {
              const totalAmount = account.plans.reduce((sum, item) => sum + num(item.totalAmount), 0);
              const totalPaid = account.plans.reduce((sum, item) => sum + num(item.paid), 0);
              const balance = account.plans.reduce((sum, item) => sum + num(item.balance), 0);
              const activePlans = account.plans.filter((item) => num(item.balance) > 0);
              const monthlyAmount = activePlans.reduce((sum, item) => sum + num(item.monthlyAmount), 0);
              const progress = totalAmount ? Math.min(100, Math.round((totalPaid / totalAmount) * 100)) : 100;
              const initials = account.customerName
                .split(/\s+/)
                .slice(0, 2)
                .map((word) => word[0] || '')
                .join('')
                .toUpperCase();
              const isPaid = balance === 0;

              return (
                <article key={account.key} className="khata-account">
                  <div className="khata-account-head">
                    <div className="khata-avatar">{initials || 'CU'}</div>
                    <div className="khata-customer">
                      <b>{account.customerName}</b>
                      <small>{account.phone || 'No phone'} · {account.plans.length} purchase plan{account.plans.length === 1 ? '' : 's'}</small>
                    </div>
                    <span className={`khata-status ${isPaid ? 'paid' : ''}`}>{isPaid ? 'Paid' : 'Active'}</span>
                  </div>

                  <div className="khata-balance-row">
                    <div><small>Combined outstanding balance</small><strong>{money(balance)}</strong></div>
                    <div className="khata-progress-label">{progress}% paid</div>
                  </div>
                  <div className="khata-progress"><span style={{ width: `${progress}%` }} /></div>

                  <div className="khata-metrics">
                    <div className="khata-metric"><small>Combined plan amount</small><b>{money(totalAmount)}</b></div>
                    <div className="khata-metric"><small>Paid so far</small><b>{money(totalPaid)}</b></div>
                    <div className="khata-metric"><small>Monthly total</small><b>{money(monthlyAmount)}</b></div>
                  </div>

                  <div className="khata-customer-plans">
                    {account.plans.map((item) => (
                      <div className="khata-customer-plan" key={item.id}>
                        <div className="khata-customer-plan-info">
                          <b>{item.planNo || item.invoiceNo}</b>
                          <small>{item.productSummary || `${item.months || 0} month plan`}</small>
                        </div>
                        <div className="khata-customer-plan-balance">
                          <small>{num(item.balance) > 0 ? 'Balance' : 'Paid'}</small>
                          <b>{money(item.balance)}</b>
                        </div>
                        <button
                          type="button"
                          className="btn ghost small"
                          onClick={() => {
                            setActiveKhataPlan(item);
                            setKhataPayAmount(String(Math.min(num(item.balance), num(item.monthlyAmount) || num(item.balance))));
                          }}
                        >
                          {num(item.balance) > 0 ? 'View & Pay' : 'View'}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="khata-card-foot">
                    <span className="khata-due">
                      {activePlans.length
                        ? <>Next due <b>{activePlans.map((item) => item.nextDueDate).filter(Boolean).sort()[0] || 'Monthly'}</b></>
                        : 'All plans paid'}
                    </span>
                    <span className="khata-due">{activePlans.length} active plan{activePlans.length === 1 ? '' : 's'}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
