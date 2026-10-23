import React from 'react';
import { Banknote, Calculator, CalendarDays, Clock3, CreditCard, Home, MapPin, Phone, ShoppingCart, Wallet, Zap } from 'lucide-react';
import { lineTotal, money } from './invoiceData.js';

export function InvoiceHeader({ title, shop = {} }) {
  const name = String(shop.name || 'CLIMAX').trim();
  const [brand, ...rest] = name.split(/\s+/);
  const subtitle = rest.join(' ') || 'ELECTRIC STORE';
  return (
    <>
      <header className="ci-header">
        <img className="ci-appliance-art" src="/invoices/washer.jpg" alt="" />
        <img className="ci-fan-art" src="/invoices/fan.jpg" alt="" />
        <div className="ci-brand-copy">
          <div className="ci-shop-name">{brand.toUpperCase()}</div>
          <div className="ci-shop-subtitle">{subtitle.toUpperCase()}</div>
          <div className="ci-contact-row">
            {shop.phone1 && <span><Phone />{shop.phone1}</span>}
            {shop.phone2 && <><i /><span><Phone />{shop.phone2}</span></>}
          </div>
        </div>
        <div className="ci-invoice-kind"><strong>{title.split(' ')[0]}</strong><span>INVOICE</span></div>
      </header>
      <div className="ci-categories">
        <span><Home />HOME APPLIANCES</span><b>|</b>
        <span><Zap />ELECTRICAL ITEMS</span><b>|</b>
        <span className="ci-fan-symbol">&#10047;</span><span>FANS &amp; MORE</span>
      </div>
      {shop.address && <div className="ci-shop-address"><MapPin />{shop.address}</div>}
    </>
  );
}

export function CustomerBlock({ data }) {
  return (
    <section className="ci-customer">
      <div className="ci-customer-row">
        <b>Invoice No.</b><strong className="ci-invoice-number">{data.invoiceNo}</strong>
        <b className="ci-date-label">Date</b><strong className="ci-date-value"><CalendarDays />{data.date}</strong>
      </div>
      <div className="ci-customer-row"><b>Customer Name</b><strong className="ci-customer-value">{data.customerName}</strong></div>
      <div className="ci-customer-row"><b>Address</b><strong className="ci-customer-value">{data.customerAddress}</strong></div>
    </section>
  );
}

export function ItemsTable({ items = [], startIndex = 0 }) {
  const rows = [...items, ...Array(Math.max(0, 10 - items.length)).fill(null)];
  return (
    <table className="ci-items">
      <thead><tr><th>#</th><th>Item Description</th><th>Qty</th><th>Rate (Rs.)</th><th>Amount (Rs.)</th></tr></thead>
      <tbody>{rows.map((item, i) => (
        <tr key={item ? `${item.name}-${i}` : `empty-${i}`}>
          <td>{startIndex + i + 1}</td><td>{item?.name || ''}</td><td>{item?.qty ?? ''}</td>
          <td>{item ? Number(item.rate).toLocaleString('en-PK') : ''}</td>
          <td>{item ? Number(lineTotal(item)).toLocaleString('en-PK') : ''}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

function SummaryIcon({ label }) {
  if (/subtotal/i.test(label)) return <ShoppingCart />;
  if (/total amount/i.test(label)) return <Wallet />;
  if (/payment method/i.test(label)) return <CreditCard />;
  if (/advance/i.test(label)) return <Banknote />;
  if (/balance/i.test(label)) return <Clock3 />;
  if (/discount|markup/i.test(label)) return <span className="ci-percent-icon">%</span>;
  return <Calculator />;
}

export function SummaryTable({ rows, title = 'BILL SUMMARY' }) {
  return (
    <section className="ci-summary">
      <h3><span className="ci-summary-title-icon"><Calculator /></span>{title}</h3>
      {rows.map(([label, value, strong], i) => (
        <div className={`ci-summary-row ${strong ? 'is-strong' : ''}`} key={`${label}-${i}`}>
          <span className="ci-summary-label"><SummaryIcon label={label} />{label}</span>
          <span className="ci-summary-value">{value}</span>
        </div>
      ))}
    </section>
  );
}

export function Terms({ terms = [] }) {
  if (!terms.length) return null;
  return <section className="ci-terms"><h3>Terms &amp; Conditions</h3><ol>{terms.map((term, i) => <li key={i}>{term}</li>)}</ol></section>;
}

export function Signature({ shopName = '' }) {
  return <div className="ci-signature"><div className="ci-sign-line" /><span>Authorized Signature</span><small>({shopName})</small></div>;
}

export function InvoicePage({ title, invoice, children, lastPage = true, variant = 'sales', tableHeight }) {
  return <article className={`ci-page ci-${variant}${lastPage ? ' ci-last-page' : ''}`} style={{ '--ci-items-height': `${tableHeight}mm` }}><InvoiceHeader title={title} shop={invoice.shop} />{children}</article>;
}

export function invoicePageCount(items = []) {
  return Math.max(1, Math.ceil(items.length / 10));
}

export { money };
