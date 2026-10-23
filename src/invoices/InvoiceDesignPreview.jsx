import React from 'react';
import SalesInvoiceA5 from './SalesInvoiceA5.jsx';
import InstallmentInvoiceA5 from './InstallmentInvoiceA5.jsx';

// Development-only fixture to compare both separate paper designs with the approved references.
const previewInvoice = {
  invoiceNo: 'INV-1087',
  date: '23 Oct 2026',
  customerName: 'Ahmed Khan',
  customerAddress: 'Saidu Sharif, Swat',
  items: [
    { name: 'Ceiling Fan', qty: 2, rate: 15000 },
    { name: 'LED Bulb', qty: 4, rate: 500 },
    { name: 'Extension Board', qty: 1, rate: 1500 },
  ],
  subtotal: 33500,
  discount: 0,
  markup: 0,
  total: 33500,
  paid: 33500,
  balance: 0,
  months: 10,
  monthly: 2000,
  paymentMethod: 'Cash',
  bankName: '',
  terms: [],
  shop: {
    name: 'Climax Electric Store',
    phone1: '0349 5358092',
    phone2: '0345-9523086',
    address: 'G.T. Road, Mingora, Swat',
  },
};

export default function InvoiceDesignPreview({ kind }) {
  const installment = kind === 'installment';
  const invoice = installment
    ? { ...previewInvoice, paid: 13500, balance: 20000 }
    : previewInvoice;
  return (
    <main className="ci-design-preview">
      <nav className="ci-design-preview-nav" aria-label="Separate invoice previews">
        <strong>Climax · A5 design check</strong>
        <div>
          <a className={!installment ? 'active' : ''} href="/dev-only/invoice-design-preview.html?kind=sales">Sales invoice</a>
          <a className={installment ? 'active' : ''} href="/dev-only/invoice-design-preview.html?kind=installment">Installment invoice</a>
          <button type="button" onClick={() => window.print()}>Print A5 preview</button>
        </div>
      </nav>
      <div className="ci-design-preview-sheet">
        {installment
          ? <InstallmentInvoiceA5 invoice={invoice} />
          : <SalesInvoiceA5 invoice={invoice} />}
      </div>
    </main>
  );
}
