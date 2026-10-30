import NumericInput from '../../components/NumericInput.jsx';
import React, { useRef, useState } from 'react';
import { apiRequest, money, num } from '../../api.js';

export default function ReturnsView({
  sales = [],
  customerReturns = [],
  bankAccounts = [],
  onRefresh,
  notify,
  showAlert,
}) {
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState('');
  const [returnQuantities, setReturnQuantities] = useState({});
  const [reason, setReason] = useState('Defective / Customer exchange');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [bankName, setBankName] = useState('HBL');
  const [search, setSearch] = useState('');
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [invoiceListOpen, setInvoiceListOpen] = useState(false);
  const [activeInvoiceIndex, setActiveInvoiceIndex] = useState(0);
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnRequestKey, setReturnRequestKey] = useState('');
  const invoiceInputRef = useRef(null);

  const selectedBill = sales.find((b) => b.invoiceNo === selectedInvoiceNo);
  const priorForBill = customerReturns.filter((r) => r.invoiceNo === selectedInvoiceNo);
  const matchingInvoices = sales.filter((bill) => {
    const query = invoiceQuery.trim().toLowerCase();
    const hasEligible = (bill.items || []).some((item) => {
      const already = customerReturns.filter((r) => r.invoiceNo === bill.invoiceNo)
        .flatMap((r) => r.items || [])
        .filter((returned) => (item.productId && String(returned.productId) === String(item.productId)) || String(returned.name).toLowerCase() === String(item.name).toLowerCase())
        .reduce((sum, returned) => sum + num(returned.qty), 0);
      return num(item.qty) > already;
    });
    return hasEligible && (!query || String(bill.invoiceNo || '').toLowerCase().includes(query) || String(bill.customer || '').toLowerCase().includes(query));
  });

  function chooseInvoice(bill) {
    setSelectedInvoiceNo(bill.invoiceNo);
    setInvoiceQuery(`${bill.invoiceNo} — ${bill.customer || 'Walk-in customer'}`);
    setReturnQuantities({});
    setInvoiceListOpen(false);
    setActiveInvoiceIndex(0);
  }

  function getAlreadyReturned(productId, name) {
    let sum = 0;
    for (const r of priorForBill) {
      for (const it of r.items || []) {
        if (
          (productId && String(it.productId) === String(productId)) ||
          String(it.name).toLowerCase() === String(name).toLowerCase()
        ) {
          sum += num(it.qty);
        }
      }
    }
    return sum;
  }

  async function handleSubmitReturn(e) {
    e.preventDefault();
    if (submittingReturn) return;
    if (!selectedBill) {
      showAlert('Select invoice', 'Choose an original sale invoice first.', 'warning');
      return;
    }

    const itemsToReturn = [];
    for (const item of selectedBill.items || []) {
      const key = item.productId || item.name;
      const qty = Math.floor(num(returnQuantities[key]));
      if (qty > 0) {
        itemsToReturn.push({
          productId: item.productId,
          name: item.name,
          qty,
        });
      }
    }

    if (itemsToReturn.length === 0) {
      showAlert('No items selected', 'Enter a return quantity >= 1 for at least one sold item.', 'warning');
      return;
    }

    setSubmittingReturn(true);
    const idempotencyKey = returnRequestKey || `return-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
    setReturnRequestKey(idempotencyKey);
    try {
      await apiRequest('/returns', {
        method: 'POST',
        body: {
          idempotencyKey,
          invoiceNo: selectedBill.invoiceNo,
          saleId: selectedBill.id,
          items: itemsToReturn,
          reason,
          refundMethod,
          bankName,
        },
      });
      setShowModal(false);
      setSelectedInvoiceNo('');
      setInvoiceQuery('');
      setReturnQuantities({});
      setReturnRequestKey('');
      await onRefresh();
      notify('Customer return processed and inventory restored.');
    } catch (err) {
      showAlert('Cannot process return', err.message, 'warning');
    } finally {
      setSubmittingReturn(false);
    }
  }

  const filteredReturns = customerReturns.filter((r) => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      String(r.returnNo || '').toLowerCase().includes(q) ||
      String(r.invoiceNo || '').toLowerCase().includes(q) ||
      String(r.customerName || '').toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Customer Returns</h1>
        </div>
        <div className="head-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setInvoiceQuery('');
              setSelectedInvoiceNo('');
              setReturnQuantities({});
              setReturnRequestKey(`return-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`);
              setInvoiceListOpen(false);
              setShowModal(true);
            }}
          >
            + Record Customer Return
          </button>
        </div>
      </div>

      <div className="mod-summary">
        <div>
          <small>Processed Returns</small>
          <b>{customerReturns.length}</b>
        </div>
        <div>
          <small>Total Refunded / Credited</small>
          <b>
            {money(customerReturns.reduce((s, r) => s + num(r.totalReturnAmount), 0))}
          </b>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Return Audit Trail</h2>
          <input
            className="table-input"
            placeholder="Filter by return #, invoice, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter returns"
          />
        </div>

        {filteredReturns.length === 0 ? (
          <div className="empty">
            No returns recorded yet.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Return ID</th>
                  <th>Original Invoice</th>
                  <th>Customer</th>
                  <th>Returned Items</th>
                  <th>Reason</th>
                  <th>Refund Method</th>
                  <th>Amount</th>
                  <th>Processed By</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredReturns.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.returnNo}</strong>
                    </td>
                    <td>{r.invoiceNo}</td>
                    <td>{r.customerName}</td>
                    <td>
                      {(r.items || []).map((i) => `${i.name} × ${i.qty}`).join(', ')}
                    </td>
                    <td>{r.reason || '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {String(r.refundMethod || 'cash').replace('_', ' ')}
                    </td>
                    <td>
                      <strong>{money(r.totalReturnAmount)}</strong>
                    </td>
                    <td>{r.createdBy || 'Admin'}</td>
                    <td>
                      <span className="status">{r.status || 'Processed'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>Record Customer Return</h2>
                <p>Select original invoice and enter return quantities (cannot exceed sold quantity).</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmitReturn}>
              <div className="modal-body">
                <div className="fields">
                  <label className="field full">
                    Original Sale Invoice
                                        <div className="invoice-search-select">
                      <input
                        ref={invoiceInputRef}
                        role="combobox"
                        aria-expanded={invoiceListOpen}
                        aria-controls="return-invoice-results"
                        aria-autocomplete="list"
                        placeholder="Search invoice number or customer"
                        value={invoiceQuery}
                        onFocus={() => setInvoiceListOpen(true)}
                        onChange={(event) => {
                          setInvoiceQuery(event.target.value);
                          setSelectedInvoiceNo('');
                          setReturnQuantities({});
                          setInvoiceListOpen(true);
                          setActiveInvoiceIndex(0);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'ArrowDown') { event.preventDefault(); setInvoiceListOpen(true); setActiveInvoiceIndex((index) => Math.min(index + 1, Math.max(0, matchingInvoices.length - 1))); }
                          if (event.key === 'ArrowUp') { event.preventDefault(); setActiveInvoiceIndex((index) => Math.max(0, index - 1)); }
                          if (event.key === 'Enter' && invoiceListOpen && matchingInvoices[activeInvoiceIndex]) { event.preventDefault(); chooseInvoice(matchingInvoices[activeInvoiceIndex]); }
                          if (event.key === 'Escape') setInvoiceListOpen(false);
                        }}
                      />
                      {invoiceListOpen && <div className="invoice-search-results" id="return-invoice-results" role="listbox">
                        {matchingInvoices.length ? matchingInvoices.map((bill, index) => (
                          <button key={bill.id} type="button" role="option" aria-selected={index === activeInvoiceIndex} className={index === activeInvoiceIndex ? 'active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseInvoice(bill)}>
                            <span><b>{bill.invoiceNo}</b><small>{bill.customer || 'Walk-in customer'}</small></span><strong>{money(bill.total)}</strong>
                          </button>
                        )) : <div className="invoice-search-empty">No matching invoices</div>}
                      </div>}
                    </div>
                  </label>
                </div>

                {selectedBill && (
                  <div style={{ marginTop: 14 }}>
                    <div className="modal-section">ELIGIBLE ITEMS ON {selectedBill.invoiceNo}</div>
                    <div className="table-wrap">
                      <table className="table" style={{ minWidth: 460 }}>
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Sold</th>
                            <th>Already Returned</th>
                            <th>Eligible</th>
                            <th>Return Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedBill.items || []).map((item, idx) => {
                            const key = item.productId || item.name;
                            const already = getAlreadyReturned(item.productId, item.name);
                            const eligible = Math.max(0, num(item.qty) - already);
                            return (
                              <tr key={idx}>
                                <td>
                                  <strong>{item.name}</strong>
                                </td>
                                <td>{item.qty}</td>
                                <td>{already}</td>
                                <td>
                                  <b>{eligible}</b>
                                </td>
                                <td>
                                  <NumericInput
                                    type="text"
                                    min="0"
                                    step="1"
                                    max={eligible}
                                    disabled={eligible === 0}
                                    value={returnQuantities[key] ?? ''}
                                    onChange={(e) =>
                                      setReturnQuantities({
                                        ...returnQuantities,
                                        [key]: e.target.value,
                                      })
                                    }
                                    style={{
                                      width: 75,
                                      height: 32,
                                      border: '1px solid #cfdbe2',
                                      borderRadius: 7,
                                      padding: '0 8px',
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="fields" style={{ marginTop: 14 }}>
                  <label className="field">
                    Refund / Credit Method
                    <select
                      value={refundMethod}
                      onChange={(e) => setRefundMethod(e.target.value)}
                    >
                      <option value="cash">Cash Refund</option>
                      <option value="bank">Bank Refund</option>
                      <option value="credit_adjustment">Adjust Customer Balance / Khata</option>
                    </select>
                  </label>
                  {refundMethod === 'bank' && (
                    <label className="field">
                      Bank Account
                      <select value={bankName} onChange={(e) => setBankName(e.target.value)}>
                        {bankAccounts.map((b) => (
                          <option key={b.id} value={b.bankName}>
                            {b.bankName}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="field full">
                    Return Reason
                    <input
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason for return or exchange"
                    />
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={submittingReturn}>
                  {submittingReturn ? 'Processing…' : 'Confirm Return & Update Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
