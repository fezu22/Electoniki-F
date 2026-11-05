import React, { useState } from 'react';
import { apiRequest, money, num } from '../../api.js';

export default function ReportsView({
  summary = {},
  sales = [],
  products = [],
  customers = [],
  suppliers = [],
  installmentPlans = [],
  expenses = [],
  customerReturns = [],
  notify,
}) {
  const [activeReport, setActiveReport] = useState('sales');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const inRange = (dateStr) => {
    if (!fromDate && !toDate) return true;
    if (!dateStr) return false;
    const value = String(dateStr);
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return false;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(parsed);
    return (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
  };

  const filteredSales = sales.filter((s) => inRange(s.createdAt));
  const filteredExpenses = expenses.filter((e) => inRange(e.date || e.createdAt));
  const filteredReturns = customerReturns.filter((r) => inRange(r.createdAt));
  const reportCogs = filteredSales.reduce((sum, bill) => sum + (bill.totalCost !== undefined
    ? num(bill.totalCost) : (bill.items || []).reduce((total, item) => total + num(item.cost) * num(item.qty), 0)), 0);
  const reportNetSales = filteredSales.reduce((sum, bill) => sum + num(bill.total), 0) - filteredReturns.reduce((sum, item) => sum + num(item.totalReturnAmount), 0);
  const reportRestoredCost = filteredReturns.reduce((sum, item) => sum + num(item.totalCostRestored), 0);
  const reportExpenses = filteredExpenses.reduce((sum, item) => sum + num(item.amount), 0);
  const reportGrossProfit = reportNetSales - Math.max(0, reportCogs - reportRestoredCost);
  const reportNetProfit = reportGrossProfit - reportExpenses;

  function exportReportCsv() {
    let headers = [];
    let rows = [];

    if (activeReport === 'sales' || activeReport === 'profit') {
      headers = ['Invoice', 'Customer', 'Date', 'Type', 'Gross', 'Discount', 'Net Total', 'COGS', 'Paid', 'Balance'];
      rows = filteredSales.map((b) => [
        b.invoiceNo,
        b.customer,
        b.createdAt ? b.createdAt.slice(0, 10) : '',
        b.type,
        num(b.gross || b.total),
        num(b.billDiscount),
        num(b.total),
        num(b.totalCost),
        num(b.paid),
        num(b.balance),
      ]);
    } else if (activeReport === 'stock' || activeReport === 'low_stock') {
      const list =
        activeReport === 'low_stock'
          ? products.filter((p) => num(p.stock) <= num(p.reorderThreshold ?? 5))
          : products;
      headers = ['Product', 'SKU', 'Category', 'Stock', 'Unit Cost', 'Sale Price', 'Stock Cost Value'];
      rows = list.map((p) => [
        p.name,
        p.code,
        p.category,
        num(p.stock),
        num(p.cost),
        num(p.price),
        num(p.stock) * num(p.cost),
      ]);
    } else if (activeReport === 'installments') {
      headers = ['Plan #', 'Customer', 'Phone', 'Total', 'Paid', 'Balance', 'Monthly', 'Next Due', 'Status'];
      rows = installmentPlans.map((p) => [
        p.planNo,
        p.customerName,
        p.phone,
        num(p.totalAmount),
        num(p.paid),
        num(p.balance),
        num(p.monthlyAmount),
        p.nextDueDate,
        p.status,
      ]);
    } else if (activeReport === 'customers') {
      headers = ['Customer', 'Phone', 'Invoices Count', 'Total Billed', 'Total Paid', 'Outstanding Balance'];
      rows = customers.map((customer) => {
        const bills = sales.filter((bill) => bill.customerId && bill.customerId !== 'walkin' ? bill.customerId === customer.id : bill.customer === customer.name);
        return [customer.name, customer.phone, bills.length, bills.reduce((sum, bill) => sum + num(bill.total), 0),
          bills.reduce((sum, bill) => sum + num(bill.paid), 0), bills.reduce((sum, bill) => sum + num(bill.balance), 0)];
      });
    } else if (activeReport === 'suppliers') {
      headers = ['Supplier', 'Contact', 'Phone', 'Balance Payable', 'Last Purchase'];
      rows = suppliers.map((s) => [s.name, s.contactPerson, s.phone, num(s.balancePayable), s.lastPurchaseDate]);
    } else if (activeReport === 'expenses') {
      headers = ['Expense', 'Category', 'Date', 'Method', 'Amount', 'Added By'];
      rows = filteredExpenses.map((e) => [e.title, e.category, e.date, e.paymentMethod, num(e.amount), e.addedBy]);
    } else {
      headers = ['Return #', 'Invoice', 'Customer', 'Reason', 'Method', 'Amount'];
      rows = filteredReturns.map((r) => [
        r.returnNo,
        r.invoiceNo,
        r.customerName,
        r.reason,
        r.refundMethod,
        num(r.totalReturnAmount),
      ]);
    }

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => {
        const value = String(cell ?? '');
        const safe = typeof cell === 'string' && /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
        return `"${safe.replace(/"/g, '""')}"`;
      }).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `electrohub-${activeReport}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify(`Exported ${activeReport} report to CSV.`);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports & Analytics</h1>
        </div>
        <div className="head-actions">
          <button type="button" className="btn secondary" onClick={() => window.print()}>
            Print Report
          </button>
          <button type="button" className="btn" onClick={exportReportCsv}>
            Download CSV
          </button>
        </div>
      </div>

      {/* Profit & Financial Summary Strip */}
      <div className="mod-summary">
        <div>
          <small>Net Sales Revenue</small>
          <b>{money(reportNetSales)}</b>
        </div>
        <div>
          <small>Cost of Goods Sold (COGS)</small>
          <b>{money(reportCogs)}</b>
        </div>
        <div>
          <small>Gross Profit (After Returns)</small>
          <b style={{ color: '#12708f' }}>{money(reportGrossProfit)}</b>
        </div>
        <div>
          <small>Recorded Shop Expenses</small>
          <b style={{ color: '#b44e4b' }}>{money(reportExpenses)}</b>
        </div>
        <div>
          <small>Net Shop Profit</small>
          <b style={{ color: reportNetProfit >= 0 ? '#168365' : '#c14f52' }}>
            {money(reportNetProfit)}
          </b>
        </div>
      </div>

      <section className="card">
        <div className="inventory-toolbar">
          <div className="stock-chips" role="tablist" aria-label="Report type">
            {[
              ['sales', 'Sales & Collections'],
              ['profit', 'Profit Breakdown'],
              ['installments', 'Installment Recovery'],
              ['customers', 'Customer Balances'],
              ['suppliers', 'Supplier Balances'],
              ['stock', 'Stock Valuation'],
              ['low_stock', 'Low Stock'],
              ['expenses', 'Expenses'],
              ['returns', 'Returns'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={activeReport === key ? 'on' : ''}
                onClick={() => setActiveReport(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="inline">
            <input
              type="date"
              className="table-input"
              style={{ width: 145 }}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label="From date"
            />
            <input
              type="date"
              className="table-input"
              style={{ width: 145 }}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              aria-label="To date"
            />
          </div>
        </div>

        {(activeReport === 'sales' || activeReport === 'profit') && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Sale Type</th>
                  <th>Gross</th>
                  <th>Discount</th>
                  <th>Net Sale</th>
                  <th>Product Cost</th>
                  <th>Gross Margin</th>
                  <th>Collected</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((b) => {
                  const cost =
                    b.totalCost !== undefined
                      ? num(b.totalCost)
                      : (b.items || []).reduce((s, i) => s + num(i.cost) * num(i.qty), 0);
                  const margin = num(b.total) - cost;
                  return (
                    <tr key={b.id}>
                      <td>
                        <strong>{b.invoiceNo}</strong>
                      </td>
                      <td>{b.customer}</td>
                      <td>{b.type === 'installment' ? 'Installment' : 'Cash'}</td>
                      <td>{money(b.gross || b.total)}</td>
                      <td>{money(b.billDiscount)}</td>
                      <td>
                        <strong>{money(b.total)}</strong>
                      </td>
                      <td>{money(cost)}</td>
                      <td>
                        <strong style={{ color: '#168365' }}>{money(margin)}</strong>
                      </td>
                      <td>{money(b.paid)}</td>
                      <td>{money(b.balance)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === 'installments' && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Plan #</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Guarantor</th>
                  <th>Plan Total</th>
                  <th>Collected</th>
                  <th>Remaining</th>
                  <th>Monthly</th>
                  <th>Next Due</th>
                </tr>
              </thead>
              <tbody>
                {installmentPlans.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.planNo}</strong>
                    </td>
                    <td>{p.customerName}</td>
                    <td>{p.phone || '—'}</td>
                    <td>{p.guarantor || '—'}</td>
                    <td>{money(p.totalAmount)}</td>
                    <td>{money(p.paid)}</td>
                    <td>
                      <strong>{money(p.balance)}</strong>
                    </td>
                    <td>{money(p.monthlyAmount)}</td>
                    <td>{p.nextDueDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === 'customers' && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Invoices Count</th>
                  <th>Total Billed</th>
                  <th>Total Paid</th>
                  <th>Outstanding Balance</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const cBills = sales.filter(
                    (b) => b.customerId && b.customerId !== 'walkin' ? b.customerId === c.id : b.customer === c.name
                  );
                  const billed = cBills.reduce((s, b) => s + num(b.total), 0);
                  const paid = cBills.reduce((s, b) => s + num(b.paid), 0);
                  const bal = cBills.reduce((s, b) => s + num(b.balance), 0);
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>{c.phone}</td>
                      <td>{cBills.length}</td>
                      <td>{money(billed)}</td>
                      <td>{money(paid)}</td>
                      <td>
                        <strong style={{ color: bal > 0 ? '#a2501d' : '#168365' }}>
                          {money(bal)}
                        </strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === 'suppliers' && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Contact</th>
                  <th>Phone</th>
                  <th>Last Purchase</th>
                  <th>Payable Balance</th>
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
                    <td>{s.lastPurchaseDate || '—'}</td>
                    <td>
                      <strong>{money(s.balancePayable)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(activeReport === 'stock' || activeReport === 'low_stock') && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product / Model</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Units in Stock</th>
                  <th>Unit Cost</th>
                  <th>Sale Price</th>
                  <th>Cost Valuation</th>
                  <th>Retail Valuation</th>
                </tr>
              </thead>
              <tbody>
                {(activeReport === 'low_stock'
                  ? products.filter((p) => num(p.stock) <= num(p.reorderThreshold ?? 5))
                  : products
                ).map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    <td>{p.code}</td>
                    <td>{p.category}</td>
                    <td>
                      <b>{p.stock}</b>
                    </td>
                    <td>{money(p.cost)}</td>
                    <td>{money(p.price)}</td>
                    <td>{money(num(p.stock) * num(p.cost))}</td>
                    <td>
                      <strong>{money(num(p.stock) * num(p.price))}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === 'expenses' && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Expense</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Added By</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.title}</strong>
                    </td>
                    <td>{e.category}</td>
                    <td>{e.date}</td>
                    <td>{e.paymentMethod}</td>
                    <td>{e.addedBy}</td>
                    <td>
                      <strong>{money(e.amount)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === 'returns' && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Return #</th>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Reason</th>
                  <th>Refund Method</th>
                  <th>Amount</th>
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
                    <td>{r.reason}</td>
                    <td>{r.refundMethod}</td>
                    <td>
                      <strong>{money(r.totalReturnAmount)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
