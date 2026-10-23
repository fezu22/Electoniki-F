import React, { useState } from 'react';
import { apiRequest, money, num } from '../../api.js';

export default function CustomersView({
  customers = [],
  sales = [],
  installmentPlans = [],
  onOpenNewCustomer,
  onEditCustomer,
}) {
  const [search, setSearch] = useState('');
  const [selectedLedgerCustomer, setSelectedLedgerCustomer] = useState(null);

  const filtered = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      String(c.name || '').toLowerCase().includes(q) ||
      String(c.phone || '').toLowerCase().includes(q) ||
      String(c.cnic || '').toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Customers</h1>
        </div>
        <div className="head-actions">
          <button type="button" className="btn" onClick={onOpenNewCustomer}>
            + Add Customer
          </button>
        </div>
      </div>

      <div className="mod-summary">
        <div>
          <small>Total Customers</small>
          <b>{customers.length}</b>
        </div>
        <div>
          <small>Active Installment Plans</small>
          <b>{installmentPlans.filter((p) => num(p.balance) > 0).length}</b>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Customer Directory</h2>
          <input
            className="table-input"
            placeholder="Search customer, phone, CNIC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search customers"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="empty">No customers match your search.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>WhatsApp</th>
                  <th>CNIC</th>
                  <th>Address</th>
                  <th>Total Outstanding</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const custBills = sales.filter(
                    (b) => b.customerId === c.id || b.customer === c.name
                  );
                  const outstanding = custBills.reduce((s, b) => s + num(b.balance), 0);
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>{c.phone || '—'}</td>
                      <td>{c.whatsapp || c.phone || '—'}</td>
                      <td>{c.cnic || '—'}</td>
                      <td>{c.address || '—'}</td>
                      <td>
                        <strong style={{ color: outstanding > 0 ? '#a2501d' : '#168365' }}>
                          {money(outstanding)}
                        </strong>
                      </td>
                      <td>
                        <div className="inline">
                          <button
                            type="button"
                            className="btn ghost small"
                            onClick={() => setSelectedLedgerCustomer(c)}
                          >
                            Statement
                          </button>
                          <button
                            type="button"
                            className="btn secondary small"
                            onClick={() => onEditCustomer(c)}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedLedgerCustomer && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setSelectedLedgerCustomer(null)}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>Customer Statement · {selectedLedgerCustomer.name}</h2>
                <p>
                  Phone: {selectedLedgerCustomer.phone || 'N/A'} · CNIC:{' '}
                  {selectedLedgerCustomer.cnic || 'N/A'}
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSelectedLedgerCustomer(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {(() => {
                const cSales = sales.filter(
                  (b) =>
                    b.customerId === selectedLedgerCustomer.id ||
                    b.customer === selectedLedgerCustomer.name
                );
                if (cSales.length === 0) {
                  return <div className="empty">No invoices recorded for this customer yet.</div>;
                }
                return (
                  <div className="table-wrap">
                    <table className="table" style={{ minWidth: 480 }}>
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Type</th>
                          <th>Total</th>
                          <th>Paid</th>
                          <th>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cSales.map((b) => (
                          <tr key={b.id}>
                            <td>
                              <strong>{b.invoiceNo}</strong>
                            </td>
                            <td>{b.type === 'installment' ? 'Installment' : 'Cash'}</td>
                            <td>{money(b.total)}</td>
                            <td>{money(b.paid)}</td>
                            <td>
                              <strong>{money(b.balance)}</strong>
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
                onClick={() => setSelectedLedgerCustomer(null)}
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
