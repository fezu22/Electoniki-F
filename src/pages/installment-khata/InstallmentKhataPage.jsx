import React, { useState } from 'react';
import { ChevronDown, Search, UserRound, UsersRound } from 'lucide-react';
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
  const [expandedAccounts, setExpandedAccounts] = useState(() => new Set());
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
  const queryDigits = query.replace(/\D/g, '');
  const filteredAccounts = accounts.filter((account) =>
    !query ||
    account.customerName.toLowerCase().includes(query) ||
    account.plans.some((item) => {
      const details = item.installmentDetails || {};
      const customer = details.customer || {};
      const values = [item.phone, item.whatsapp, item.cnic, item.customerId, item.planNo, item.invoiceNo,
        customer.phone, customer.whatsapp, customer.cnic, customer.id];
      return values.some((value) => {
        const text = String(value || '').toLowerCase();
        return text.includes(query) || (queryDigits.length >= 3 && text.replace(/\D/g, '').includes(queryDigits));
      });
    })
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
              const latestPlan = account.plans[0] || {};
              const details = latestPlan.installmentDetails || {};
              const customer = details.customer || {};
              const guarantor = details.guarantor || {};
              const customerPhoto = customer.photoDataUrl || latestPlan.customerPhoto || '';
              const guarantorPhoto = guarantor.photoDataUrl || latestPlan.guarantorPhoto || '';
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
                  <div className="khata-account-topline"><span>INSTALLMENT ACCOUNT</span><span>{account.plans.length} plan{account.plans.length === 1 ? '' : 's'}</span></div>
                  <div className="khata-account-head">
                    {customerPhoto ? <img className="khata-avatar khata-avatar-photo" src={customerPhoto} alt={`${account.customerName} photo`} /> : <div className="khata-avatar">{initials || 'CU'}</div>}
                    <div className="khata-customer">
                      <b>{account.customerName}</b>
                      <small>{customer.phone || account.phone || 'No phone'} · {account.plans.length} purchase plan{account.plans.length === 1 ? '' : 's'}</small>
                    </div>
                    <span className={`khata-status ${isPaid ? 'paid' : ''}`}>{isPaid ? 'Paid' : 'Active'}</span>
                  </div>

                  <div className="khata-balance-row">
                    <div><small>Combined outstanding balance</small><strong>{money(balance)}</strong></div>
                    <div className="khata-progress-label">{progress}% paid</div>
                  </div>
                  <div className="khata-progress"><span style={{ width: `${progress}%` }} /></div>

                  <button type="button" className="khata-details-toggle" aria-expanded={expandedAccounts.has(account.key)} onClick={() => setExpandedAccounts((previous) => { const next = new Set(previous); next.has(account.key) ? next.delete(account.key) : next.add(account.key); return next; })}>
                    <UsersRound size={15} /> Customer & guarantor details <ChevronDown size={15} className={expandedAccounts.has(account.key) ? 'is-expanded' : ''} />
                  </button>
                  {expandedAccounts.has(account.key) && <div className="khata-people-details">
                    <section className="khata-person-card">
                      <div className="khata-person-heading"><UserRound size={15} /><b>Customer</b></div>
                      <div className="khata-person-content">{customerPhoto ? <img src={customerPhoto} alt="Customer" /> : <div className="khata-person-placeholder"><UserRound size={20} /></div>}<div><strong>{customer.name || account.customerName}</strong><small>Phone: {customer.phone || latestPlan.phone || account.phone || '—'}</small><small>WhatsApp: {customer.whatsapp || latestPlan.whatsapp || '—'}</small><small>CNIC: {customer.cnic || latestPlan.cnic || '—'}</small><small>Address: {customer.address || latestPlan.address || '—'}</small></div></div>
                    </section>
                    <section className="khata-person-card">
                      <div className="khata-person-heading"><UsersRound size={15} /><b>Guarantor</b></div>
                      <div className="khata-person-content">{guarantorPhoto ? <img src={guarantorPhoto} alt="Guarantor" /> : <div className="khata-person-placeholder"><UserRound size={20} /></div>}<div><strong>{guarantor.name || latestPlan.guarantor || 'Not provided'}</strong><small>Phone: {guarantor.phone || latestPlan.guarantorPhone || '—'}</small><small>Address: {guarantor.address || latestPlan.guarantorAddress || '—'}</small></div></div>
                    </section>
                  </div>}

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
                          aria-label={`${num(item.balance) > 0 ? 'View and record payment for' : 'View details for'} installment plan ${item.planNo || item.invoiceNo}`}
                          title={num(item.balance) > 0 ? 'Open plan details and record a payment' : 'Open completed plan details'}
                          onClick={() => {
                            setActiveKhataPlan(item);
                            setKhataPayAmount(String(Math.min(num(item.balance), num(item.monthlyAmount) || num(item.balance))));
                          }}
                        >
                          {num(item.balance) > 0 ? 'View & Pay' : 'View Details'}
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
