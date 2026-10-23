import React, { useState } from 'react';
import { apiRequest, money, num } from '../../api.js';

export default function ExpensesView({ expenses = [], bankAccounts = [], onRefresh, notify, showAlert }) {
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [auditModalExpense, setAuditModalExpense] = useState(null);
  const [search, setSearch] = useState('');

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Utilities');
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [bankName, setBankName] = useState('HBL');
  const [description, setDescription] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  function openNewExpense() {
    setEditingExpense(null);
    setTitle('');
    setCategory('Utilities');
    setDate(today);
    setAmount('');
    setPaymentMethod('Cash');
    setDescription('');
    setAttachmentName('');
    setShowModal(true);
  }

  function openEditExpense(exp) {
    setEditingExpense(exp);
    setTitle(exp.title);
    setCategory(exp.category || 'Utilities');
    setDate(exp.date || today);
    setAmount(String(exp.amount));
    setPaymentMethod(exp.paymentMethod || 'Cash');
    setBankName(exp.bankName || 'HBL');
    setDescription(exp.description || '');
    setAttachmentName(exp.attachmentName || '');
    setShowModal(true);
  }

  async function handleSaveExpense(e) {
    e.preventDefault();
    try {
      if (editingExpense) {
        await apiRequest(`/expenses/${editingExpense.id}`, {
          method: 'PUT',
          body: {
            title,
            category,
            date,
            amount: num(amount),
            paymentMethod,
            bankName,
            description,
          },
        });
        notify('Expense updated with audit history.');
      } else {
        await apiRequest('/expenses', {
          method: 'POST',
          body: {
            title,
            category,
            date,
            amount: num(amount),
            paymentMethod,
            bankName,
            description,
            attachmentName,
          },
        });
        notify('Shop expense recorded.');
      }
      setShowModal(false);
      await onRefresh();
    } catch (err) {
      showAlert('Error', err.message, 'warning');
    }
  }

  const filtered = expenses.filter((e) => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      String(e.title || '').toLowerCase().includes(q) ||
      String(e.category || '').toLowerCase().includes(q) ||
      String(e.paymentMethod || '').toLowerCase().includes(q)
    );
  });

  const totalSpent = filtered.reduce((s, e) => s + num(e.amount), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Shop Expenses</h1>
        </div>
        <div className="head-actions">
          <button type="button" className="btn" onClick={openNewExpense}>
            + Add Expense
          </button>
        </div>
      </div>

      <div className="mod-summary">
        <div>
          <small>Expense Entries</small>
          <b>{filtered.length}</b>
        </div>
        <div>
          <small>Total Expenses</small>
          <b>{money(totalSpent)}</b>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Expense Ledger</h2>
          <input
            className="table-input"
            placeholder="Filter expense, category, method..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter expenses"
          />
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Expense</th>
                <th>Category</th>
                <th>Date</th>
                <th>Payment Source</th>
                <th>Added By</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((exp) => (
                <tr key={exp.id}>
                  <td>
                    <strong>{exp.title}</strong>
                    {exp.description ? (
                      <small className="muted" style={{ display: 'block' }}>
                        {exp.description}
                      </small>
                    ) : null}
                  </td>
                  <td>{exp.category}</td>
                  <td>{exp.date || 'Today'}</td>
                  <td>
                    {exp.paymentMethod} {exp.bankName ? `(${exp.bankName})` : ''}
                  </td>
                  <td>{exp.addedBy || 'Admin'}</td>
                  <td>
                    <strong>{money(exp.amount)}</strong>
                  </td>
                  <td>
                    <div className="inline">
                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => openEditExpense(exp)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => setAuditModalExpense(exp)}
                      >
                        Audit ({(exp.auditHistory || []).length})
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>{editingExpense ? 'Edit Shop Expense' : 'Add Shop Expense'}</h2>
                <p>Updates cash in hand or selected bank account balance.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSaveExpense}>
              <div className="modal-body">
                <div className="fields">
                  <label className="field">
                    Expense Title
                    <input
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Shop Electricity Bill"
                    />
                  </label>
                  <label className="field">
                    Category
                    <select value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="Utilities">Utilities</option>
                      <option value="Rent">Rent</option>
                      <option value="Delivery">Delivery & Freight</option>
                      <option value="Salaries">Staff Salaries</option>
                      <option value="Maintenance">Shop Maintenance</option>
                      <option value="General">General</option>
                    </select>
                  </label>
                  <label className="field">
                    Date
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
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
                      placeholder="0"
                    />
                  </label>
                  <label className="field">
                    Payment Source
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="Cash">Cash Drawer</option>
                      <option value="Bank">Bank Account</option>
                    </select>
                  </label>
                  {paymentMethod === 'Bank' && (
                    <label className="field">
                      Bank Account
                      <select value={bankName} onChange={(e) => setBankName(e.target.value)}>
                        {bankAccounts.map((b) => (
                          <option key={b.id} value={b.bankName}>
                            {b.bankName} ({money(b.balance)})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="field full">
                    Description / Note
                    <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional note or bill reference"
                    />
                  </label>
                  <label className="field full">
                    Optional Receipt Image Attachment
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setAttachmentName(e.target.files?.[0]?.name || '')}
                    />
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn">
                  {editingExpense ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {auditModalExpense && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setAuditModalExpense(null)}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>Expense Audit Trail · {auditModalExpense.title}</h2>
                <p>Edits retain full historical logs for financial accountability.</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setAuditModalExpense(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="dash-list">
                {(auditModalExpense.auditHistory || []).map((a, i) => (
                  <div key={i} className="dash-list-row">
                    <div className="dash-list-copy">
                      <b>{a.summary}</b>
                      <small>By {a.updatedBy || 'Admin'}</small>
                    </div>
                    <span className="muted tiny">
                      {a.updatedAt ? new Date(a.updatedAt).toLocaleString() : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setAuditModalExpense(null)}
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
