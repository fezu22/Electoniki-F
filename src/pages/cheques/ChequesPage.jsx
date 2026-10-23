import React, { useState } from 'react';
import { apiRequest, money, num } from '../../api.js';

export default function ChequesView({ cheques = [], onRefresh, notify, showAlert }) {
  const [showAdd, setShowAdd] = useState(false);
  const [historyCheque, setHistoryCheque] = useState(null);
  const [search, setSearch] = useState('');

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [chequeNo, setChequeNo] = useState('');
  const [direction, setDirection] = useState('received');
  const [bankName, setBankName] = useState('HBL');
  const [accountTitle, setAccountTitle] = useState('');
  const [partyName, setPartyName] = useState('');
  const [amount, setAmount] = useState('');
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(today);

  async function handleCreateCheque(e) {
    e.preventDefault();
    try {
      await apiRequest('/cheques', {
        method: 'POST',
        body: {
          chequeNo,
          direction,
          bankName,
          accountTitle,
          partyName,
          amount: num(amount),
          issueDate,
          dueDate,
        },
      });
      setShowAdd(false);
      setChequeNo('');
      setPartyName('');
      setAmount('');
      await onRefresh();
      notify('Cheque recorded in register.');
    } catch (err) {
      showAlert('Error', err.message, 'warning');
    }
  }

  async function handleStatusChange(cheque, status) {
    try {
      await apiRequest(`/cheques/${cheque.id}/status`, {
        method: 'PUT',
        body: { status },
      });
      await onRefresh();
      notify(`Cheque #${cheque.chequeNo} marked as ${status}.`);
    } catch (err) {
      showAlert('Error', err.message, 'warning');
    }
  }

  const filtered = cheques.filter((c) => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      String(c.chequeNo || '').toLowerCase().includes(q) ||
      String(c.partyName || '').toLowerCase().includes(q) ||
      String(c.bankName || '').toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Cheque Register</h1>
        </div>
        <div className="head-actions">
          <button type="button" className="btn" onClick={() => setShowAdd(true)}>
            + Record Cheque
          </button>
        </div>
      </div>

      <div className="mod-summary">
        <div>
          <small>Total Cheques</small>
          <b>{cheques.length}</b>
        </div>
        <div>
          <small>Pending Clearance</small>
          <b>{cheques.filter((c) => c.status === 'Pending').length}</b>
        </div>
        <div>
          <small>Total Pending Amount</small>
          <b>
            {money(
              cheques
                .filter((c) => c.status === 'Pending')
                .reduce((s, c) => s + num(c.amount), 0)
            )}
          </b>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Cheque Register</h2>
          <input
            className="table-input"
            placeholder="Filter cheque #, bank, party..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter cheques"
          />
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Cheque #</th>
                <th>Type</th>
                <th>Bank</th>
                <th>Party</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.chequeNo}</strong>
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{c.direction || 'received'}</td>
                  <td>{c.bankName}</td>
                  <td>{c.partyName}</td>
                  <td>
                    <strong>{money(c.amount)}</strong>
                  </td>
                  <td>{c.dueDate}</td>
                  <td>
                    <span
                      className={`status ${
                        c.status === 'Cleared'
                          ? ''
                          : c.status === 'Pending'
                          ? 'pending'
                          : 'overdue'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <div className="inline">
                      <select
                        className="table-input"
                        style={{ width: 120, height: 31, fontSize: 12 }}
                        value={c.status}
                        onChange={(e) => handleStatusChange(c, e.target.value)}
                        aria-label={`Change status for cheque ${c.chequeNo}`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Cleared">Cleared</option>
                        <option value="Bounced">Bounced</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => setHistoryCheque(c)}
                      >
                        History ({(c.history || []).length})
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showAdd && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>Record Cheque</h2>
                <p>Enter received customer cheque or issued supplier cheque details.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowAdd(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleCreateCheque}>
              <div className="modal-body">
                <div className="fields">
                  <label className="field">
                    Cheque Number
                    <input
                      required
                      value={chequeNo}
                      onChange={(e) => setChequeNo(e.target.value)}
                      placeholder="e.g. 004918"
                    />
                  </label>
                  <label className="field">
                    Direction
                    <select value={direction} onChange={(e) => setDirection(e.target.value)}>
                      <option value="received">Received from Customer</option>
                      <option value="issued">Issued to Supplier</option>
                    </select>
                  </label>
                  <label className="field">
                    Bank Name
                    <input
                      required
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="HBL / Meezan / UBL"
                    />
                  </label>
                  <label className="field">
                    Party Name
                    <input
                      required
                      value={partyName}
                      onChange={(e) => setPartyName(e.target.value)}
                      placeholder="Customer or Supplier name"
                    />
                  </label>
                  <label className="field">
                    Amount (Rs.)
                    <input
                      type="number"
                      min="1"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Account Title (optional)
                    <input
                      value={accountTitle}
                      onChange={(e) => setAccountTitle(e.target.value)}
                      placeholder="Account title"
                    />
                  </label>
                  <label className="field">
                    Issue Date
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Due / Clearing Date
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={() => setShowAdd(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn">
                  Save Cheque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyCheque && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setHistoryCheque(null)}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>Cheque Audit History · #{historyCheque.chequeNo}</h2>
                <p>
                  {historyCheque.bankName} · {historyCheque.partyName} · {money(historyCheque.amount)}
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setHistoryCheque(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="dash-list">
                {(historyCheque.history || []).map((h, i) => (
                  <div key={i} className="dash-list-row">
                    <div className="dash-list-copy">
                      <b>
                        Status: {h.status} · by {h.changedBy || 'User'}
                      </b>
                      <small>{h.note}</small>
                    </div>
                    <span className="muted tiny">
                      {h.changedAt ? new Date(h.changedAt).toLocaleString() : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setHistoryCheque(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
