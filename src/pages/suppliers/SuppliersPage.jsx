import React, { useState } from 'react';
import { apiRequest, money, num } from '../../api.js';

export default function SuppliersView({
  suppliers = [],
  stockReceipts = [],
  financialTransactions = [],
  bankAccounts = [],
  onOpenAddStock,
  onRefresh,
  notify,
  showAlert,
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [paySupplier, setPaySupplier] = useState(null);
  const [statementSupplier, setStatementSupplier] = useState(null);

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');

  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payBank, setPayBank] = useState('HBL');
  const [payRef, setPayRef] = useState('');

  async function handleAddSupplier(e) {
    e.preventDefault();
    try {
      await apiRequest('/suppliers', {
        method: 'POST',
        body: { name, contactPerson, phone, address, openingBalance: num(openingBalance) },
      });
      setShowAddModal(false);
      setName('');
      setContactPerson('');
      setPhone('');
      setAddress('');
      setOpeningBalance('0');
      await onRefresh();
      notify('Supplier added.');
    } catch (err) {
      showAlert('Error', err.message, 'warning');
    }
  }

  async function handlePaySupplier(e) {
    e.preventDefault();
    if (!paySupplier) return;
    try {
      await apiRequest(`/suppliers/${paySupplier.id}/pay`, {
        method: 'POST',
        body: {
          amount: num(payAmount),
          method: payMethod,
          bankName: payBank,
          reference: payRef,
        },
      });
      setPaySupplier(null);
      await onRefresh();
      notify(`Recorded payment to ${paySupplier.name}.`);
    } catch (err) {
      showAlert('Payment error', err.message, 'warning');
    }
  }

  const totalPayable = suppliers.reduce((s, x) => s + num(x.balancePayable), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Suppliers</h1>
        </div>
        <div className="head-actions">
          <button type="button" className="btn secondary" onClick={onOpenAddStock}>
            + Receive Supplier Invoice
          </button>
          <button type="button" className="btn" onClick={() => setShowAddModal(true)}>
            + Add Supplier
          </button>
        </div>
      </div>

      <div className="mod-summary">
        <div>
          <small>Active Suppliers</small>
          <b>{suppliers.length}</b>
        </div>
        <div>
          <small>Total Payable Balance</small>
          <b style={{ color: totalPayable > 0 ? '#a2501d' : '#168365' }}>{money(totalPayable)}</b>
        </div>
        <div>
          <small>Supplier Invoices Posted</small>
          <b>{stockReceipts.length}</b>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Supplier Accounts & Balances</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Contact Person</th>
                <th>Phone</th>
                <th>Balance Payable</th>
                <th>Last Purchase</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                  </td>
                  <td>{s.contactPerson || '—'}</td>
                  <td>{s.phone || '—'}</td>
                  <td>
                    <strong style={{ color: num(s.balancePayable) > 0 ? '#a2501d' : '#168365' }}>
                      {money(s.balancePayable)}
                    </strong>
                  </td>
                  <td>{s.lastPurchaseDate || '—'}</td>
                  <td>
                    <span className="status">{s.status || 'Active'}</span>
                  </td>
                  <td>
                    <div className="inline">
                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => setStatementSupplier(s)}
                      >
                        Statement
                      </button>
                      {num(s.balancePayable) > 0 && (
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => {
                            setPaySupplier(s);
                            setPayAmount(String(s.balancePayable));
                          }}
                        >
                          Pay Supplier
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showAddModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>Add Supplier</h2>
                <p>Create a supplier profile for stock receiving and payable tracking.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowAddModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleAddSupplier}>
              <div className="modal-body">
                <div className="fields">
                  <label className="field">
                    Supplier name
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Samsung Official Distributor"
                    />
                  </label>
                  <label className="field">
                    Contact person
                    <input
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder="Contact name"
                    />
                  </label>
                  <label className="field">
                    Phone number
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="03XX XXXXXXX"
                    />
                  </label>
                  <label className="field">
                    Opening payable balance (Rs.)
                    <input
                      type="number"
                      min="0"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                    />
                  </label>
                  <label className="field full">
                    Address
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Wholesale market / city"
                    />
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn">
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {paySupplier && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setPaySupplier(null)}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>Pay Supplier · {paySupplier.name}</h2>
                <p>Current Payable Balance: {money(paySupplier.balancePayable)}</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setPaySupplier(null)}>
                ×
              </button>
            </div>
            <form onSubmit={handlePaySupplier}>
              <div className="modal-body">
                <div className="fields">
                  <label className="field">
                    Payment Amount (Rs.)
                    <input
                      type="number"
                      min="1"
                      max={paySupplier.balancePayable}
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
                  {payMethod === 'bank' && (
                    <label className="field">
                      Bank Account
                      <select value={payBank} onChange={(e) => setPayBank(e.target.value)}>
                        {bankAccounts.map((b) => (
                          <option key={b.id} value={b.bankName}>
                            {b.bankName} ({money(b.balance)})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="field">
                    Payment Reference
                    <input
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={() => setPaySupplier(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn">
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {statementSupplier && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setStatementSupplier(null)}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>Supplier Statement · {statementSupplier.name}</h2>
                <p>Remaining Payable: {money(statementSupplier.balancePayable)}</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setStatementSupplier(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-section">PURCHASE INVOICES</div>
              {(() => {
                const recs = stockReceipts.filter(
                  (r) => String(r.supplier).toLowerCase() === statementSupplier.name.toLowerCase()
                );
                if (recs.length === 0) {
                  return <div className="empty">No purchase invoices recorded for this supplier.</div>;
                }
                return (
                  <div className="table-wrap" style={{ marginBottom: 16 }}>
                    <table className="table" style={{ minWidth: 460 }}>
                      <thead>
                        <tr>
                          <th>Invoice #</th>
                          <th>Date</th>
                          <th>Total</th>
                          <th>Paid</th>
                          <th>Credit Added</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recs.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <strong>{r.invoiceNo}</strong>
                            </td>
                            <td>{r.date}</td>
                            <td>{money(r.total)}</td>
                            <td>{money(r.payment?.paid || 0)}</td>
                            <td>
                              <strong>{money(r.payment?.balance || 0)}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              <div className="modal-section">PAYMENT HISTORY</div>
              {(() => {
                const pays = financialTransactions.filter(
                  (t) =>
                    t.type === 'supplier_payment' &&
                    String(t.partyName).toLowerCase() === statementSupplier.name.toLowerCase()
                );
                if (pays.length === 0) {
                  return <div className="empty">No direct payments recorded yet.</div>;
                }
                return (
                  <div className="table-wrap">
                    <table className="table" style={{ minWidth: 460 }}>
                      <thead>
                        <tr>
                          <th>Tx #</th>
                          <th>Method</th>
                          <th>Reference</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pays.map((p) => (
                          <tr key={p.id}>
                            <td>{p.txNo}</td>
                            <td style={{ textTransform: 'capitalize' }}>
                              {p.method} {p.bankName ? `(${p.bankName})` : ''}
                            </td>
                            <td>{p.reference || '—'}</td>
                            <td>
                              <strong>{money(p.amount)}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setStatementSupplier(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
