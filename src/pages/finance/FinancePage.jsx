import React, { useState } from 'react';
import { apiRequest, money, num } from '../../api.js';

export default function FinanceView({
  summary = {},
  bankAccounts = [],
  financialTransactions = [],
  onRefresh,
  notify,
  showAlert,
}) {
  const [showAddBank, setShowAddBank] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountTitle, setAccountTitle] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [filterType, setFilterType] = useState('all');

  async function handleAddBank(e) {
    e.preventDefault();
    try {
      await apiRequest('/finance/banks', {
        method: 'POST',
        body: { bankName, accountTitle, accountNumber, openingBalance: num(openingBalance) },
      });
      setShowAddBank(false);
      setBankName('');
      setAccountTitle('');
      setAccountNumber('');
      setOpeningBalance('0');
      await onRefresh();
      notify('Bank account added.');
    } catch (err) {
      showAlert('Error', err.message, 'warning');
    }
  }

  const txFiltered = financialTransactions.filter(
    (t) => filterType === 'all' || t.type === filterType
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Finance & Bank Accounts</h1>
        </div>
        <div className="head-actions">
          <button type="button" className="btn" onClick={() => setShowAddBank(true)}>
            + Add Bank Account
          </button>
        </div>
      </div>

      <div className="mod-summary">
        <div>
          <small>Cash in Hand</small>
          <b style={{ color: '#168365' }}>{money(summary.cashInHand)}</b>
        </div>
        <div>
          <small>Total Bank Balances</small>
          <b style={{ color: '#12708f' }}>{money(summary.bankBalancesTotal)}</b>
        </div>
        <div>
          <small>Customer Receivables (Udhaar + Khata)</small>
          <b>{money(summary.totalCustomerOutstanding)}</b>
        </div>
        <div>
          <small>Supplier Payables</small>
          <b style={{ color: '#a2501d' }}>{money(summary.supplierPayablesTotal)}</b>
        </div>
      </div>

      {/* Bank Accounts Grid */}
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2>Connected Shop Bank & Wallet Accounts</h2>
          <span className="tag">{bankAccounts.length} accounts</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
            gap: 12,
          }}
        >
          {bankAccounts.map((b) => (
            <div
              key={b.id}
              style={{
                border: '1px solid var(--line)',
                borderRadius: 12,
                padding: 14,
                background: '#f9fbfc',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 14, color: '#12303f' }}>{b.bankName}</strong>
                <span className="status">Active</span>
              </div>
              <small style={{ display: 'block', color: '#667985', marginTop: 4, fontSize: 11.5 }}>
                {b.accountTitle || b.bankName}
              </small>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#12708f', marginTop: 10 }}>
                {money(b.balance)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Auditable Transaction Ledger */}
      <section className="card">
        <div className="card-head">
          <h2>Auditable Financial Transaction Ledger</h2>
          <select
            className="table-input"
            style={{ width: 200 }}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label="Filter transactions by type"
          >
            <option value="all">All Transaction Types</option>
            <option value="sale_receipt">Sale Receipts</option>
            <option value="installment_receipt">Installment Receipts</option>
            <option value="customer_receipt">Customer Udhaar Receipts</option>
            <option value="supplier_payment">Supplier Payments</option>
            <option value="expense">Shop Expenses</option>
            <option value="return_refund">Customer Return Refunds</option>
          </select>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Tx #</th>
                <th>Date</th>
                <th>Type</th>
                <th>Party / Description</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Direction</th>
                <th>Amount</th>
                <th>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {txFiltered.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.txNo}</strong>
                  </td>
                  <td>
                    {t.createdAt
                      ? new Date(t.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                        })
                      : 'Today'}
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>
                    {String(t.type || '').replace('_', ' ')}
                  </td>
                  <td>
                    <strong>{t.partyName || '—'}</strong>
                    {t.note ? <small className="muted" style={{ display: 'block' }}>{t.note}</small> : null}
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>
                    {t.method} {t.bankName ? `· ${t.bankName}` : ''}
                  </td>
                  <td>{t.reference || t.relatedId || '—'}</td>
                  <td>
                    <span className={`status ${t.direction === 'in' ? '' : 'pending'}`}>
                      {t.direction === 'in' ? 'Inflow (+)' : 'Outflow (−)'}
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: t.direction === 'in' ? '#168365' : '#b44e4b' }}>
                      {t.direction === 'in' ? '+ ' : '− '}
                      {money(t.amount)}
                    </strong>
                  </td>
                  <td>{t.createdBy || 'Admin'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showAddBank && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowAddBank(false)}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>Add Bank / Wallet Account</h2>
                <p>Add a bank account or mobile wallet for shop receipts and payments.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowAddBank(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleAddBank}>
              <div className="modal-body">
                <div className="fields">
                  <label className="field">
                    Bank / Wallet Name
                    <input
                      required
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. JazzCash / Bank Alfalah"
                    />
                  </label>
                  <label className="field">
                    Account Title
                    <input
                      value={accountTitle}
                      onChange={(e) => setAccountTitle(e.target.value)}
                      placeholder="Account holder title"
                    />
                  </label>
                  <label className="field">
                    Account / IBAN Number
                    <input
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="Account or IBAN"
                    />
                  </label>
                  <label className="field">
                    Opening Balance (Rs.)
                    <input
                      type="number"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                    />
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={() => setShowAddBank(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn">
                  Save Bank Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
