import React, { useState } from 'react';
import { apiRequest, money, num } from '../../api.js';

export default function BillsView({ sales = [], shop, onOpenInvoice, onNewSale, onRefresh, notify, showAlert }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [receiveBill, setReceiveBill] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');

  const filtered = sales.filter((b) => {
    const q = search.trim().toLowerCase();
    const matchText =
      !q ||
      String(b.invoiceNo || b.id).toLowerCase().includes(q) ||
      String(b.customer || '').toLowerCase().includes(q) ||
      String(b.phone || '').toLowerCase().includes(q);
    const matchType = typeFilter === 'all' || b.type === typeFilter;
    const isPaid = num(b.balance) === 0;
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'paid' && isPaid) ||
      (statusFilter === 'unpaid' && !isPaid);
    const matchDate = !dateFilter || String(b.createdAt || '').startsWith(dateFilter);
    return matchText && matchType && matchStatus && matchDate;
  });

  const totalAmount = filtered.reduce((s, b) => s + num(b.total), 0);
  const totalPaid = filtered.reduce((s, b) => s + num(b.paid), 0);
  const totalBalance = filtered.reduce((s, b) => s + num(b.balance), 0);

  async function handleRecordBalancePayment(e) {
    e.preventDefault();
    if (!receiveBill) return;
    const amt = num(payAmount);
    if (amt <= 0 || amt > num(receiveBill.balance)) {
      showAlert('Check amount', `Enter an amount up to ${money(receiveBill.balance)}.`, 'warning');
      return;
    }
    try {
      await apiRequest('/finance/transactions', {
        method: 'POST',
        body: {
          type: 'customer_receipt',
          direction: 'in',
          amount: amt,
          method: payMethod,
          partyName: receiveBill.customer,
          relatedId: receiveBill.invoiceNo,
          note: `Balance received on ${receiveBill.invoiceNo}`,
        },
      });
      setReceiveBill(null);
      await onRefresh();
      notify(`Received ${money(amt)} on ${receiveBill.invoiceNo}.`);
    } catch (err) {
      showAlert('Error', err.message, 'warning');
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Bills & Receipts</h1>
        </div>
        <div className="head-actions">
          <button type="button" className="btn" onClick={onNewSale}>
            + New Sale
          </button>
        </div>
      </div>

      <div className="mod-summary">
        <div>
          <small>Matching Bills</small>
          <b>{filtered.length}</b>
        </div>
        <div>
          <small>Total Billed</small>
          <b>{money(totalAmount)}</b>
        </div>
        <div>
          <small>Collected</small>
          <b style={{ color: '#168365' }}>{money(totalPaid)}</b>
        </div>
        <div>
          <small>Remaining Balance</small>
          <b style={{ color: totalBalance > 0 ? '#a2501d' : '#12303f' }}>{money(totalBalance)}</b>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Customer Invoices</h2>
          <div className="inline">
            <input
              className="table-input"
              placeholder="Search invoice # or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search invoices"
            />
            <select
              className="table-input"
              style={{ width: 150 }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by sale type"
            >
              <option value="all">All Sale Types</option>
              <option value="cash">Cash / Udhaar</option>
              <option value="installment">Installment</option>
            </select>
            <select
              className="table-input"
              style={{ width: 150 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by payment status"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Fully Paid</option>
              <option value="unpaid">Has Balance</option>
            </select>
            <input
              type="date"
              className="table-input"
              style={{ width: 155 }}
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter by date"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty">No bills match your current filters.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Sale Type</th>
                  <th>Payment Method</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.invoiceNo || b.id}</strong>
                    </td>
                    <td>
                      {b.customer}
                      {b.phone ? <small className="muted" style={{ display: 'block' }}>{b.phone}</small> : null}
                    </td>
                    <td>
                      {b.createdAt
                        ? new Date(b.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Today'}
                    </td>
                    <td>{b.type === 'installment' ? 'Installment' : 'Cash'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{b.paymentMethod || 'Cash'}</td>
                    <td>
                      <strong>{money(b.total)}</strong>
                    </td>
                    <td>{money(b.paid)}</td>
                    <td>
                      <strong style={{ color: num(b.balance) > 0 ? '#a2501d' : '#168365' }}>
                        {money(b.balance)}
                      </strong>
                    </td>
                    <td>
                      <span
                        className={`status ${
                          num(b.balance) === 0 ? '' : b.type === 'installment' ? 'pending' : 'overdue'
                        }`}
                      >
                        {num(b.balance) === 0
                          ? 'Paid'
                          : b.type === 'installment'
                          ? 'Active plan'
                          : 'Balance due'}
                      </span>
                    </td>
                    <td>
                      <div className="inline">
                        <button
                          type="button"
                          className="btn ghost small"
                          onClick={() => onOpenInvoice(b)}
                        >
                          {b.type === 'installment' ? 'Installment Invoice' : 'Sales Invoice'}
                        </button>
                        <button
                          type="button"
                          className="btn secondary small"
                          onClick={() => onOpenInvoice(b)}
                        >
                          A5 PDF / Print
                        </button>
                        {b.type !== 'installment' && num(b.balance) > 0 && (
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => {
                              setReceiveBill(b);
                              setPayAmount(String(b.balance));
                            }}
                          >
                            Receive Due
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {receiveBill && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setReceiveBill(null)}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>Receive Customer Balance · {receiveBill.invoiceNo}</h2>
                <p>
                  {receiveBill.customer} · Remaining Due: {money(receiveBill.balance)}
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setReceiveBill(null)}>
                ×
              </button>
            </div>
            <form onSubmit={handleRecordBalancePayment}>
              <div className="modal-body">
                <div className="fields">
                  <label className="field">
                    Amount Received (Rs.)
                    <input
                      type="number"
                      min="1"
                      max={receiveBill.balance}
                      required
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Payment Method
                    <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                      <option value="cash">Cash</option>
                      <option value="bank">Bank Transfer</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={() => setReceiveBill(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn">
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
