import React from 'react';
import './invoice.css';
import { money } from './invoiceData.js';
import { CustomerBlock, ItemsTable, SummaryTable, Terms, Signature, InvoicePage, invoicePageCount } from './InvoiceShared.jsx';

/** A5 sales invoice. The caller supplies the saved sale and shop settings. */
export default function SalesInvoiceA5({ invoice }) {
  if (!invoice) return null;
  const pageCount = invoicePageCount(invoice.items);
  const rows = [
    ['Subtotal', money(invoice.subtotal)],
    ...(invoice.discount ? [['Discount', `- ${money(invoice.discount)}`]] : []),
    ['Total Amount', money(invoice.total), true],
    ['Payment Method', invoice.paymentMethod, true],
    ...(invoice.paymentMethod === 'Bank' && invoice.bankName ? [['Bank', invoice.bankName]] : []),
  ];
  const tableHeight = Math.max(55, 77 - Math.max(0, rows.length - 3) * 7);
  return Array.from({ length: pageCount }, (_, pageIndex) => {
    const lastPage = pageIndex === pageCount - 1;
    return (
      <InvoicePage key={pageIndex} title="SALES INVOICE" invoice={invoice} lastPage={lastPage} variant="sales" tableHeight={tableHeight} pageNumber={pageIndex + 1} pageCount={pageCount} showPaidStamp={lastPage && invoice.balance <= 0}>
        <CustomerBlock data={invoice} />
        <ItemsTable items={invoice.items.slice(pageIndex * 10, (pageIndex + 1) * 10)} startIndex={pageIndex * 10} />
        {lastPage ? <>
          <div className="ci-bottom ci-sales-bottom">
            <SummaryTable rows={rows} />
            <div className="ci-right-stack ci-sales-right-stack">
              <Terms terms={invoice.terms} />
            </div>
          </div>
          <Signature shopName={invoice.shop.name} />
        </> : <div className="ci-continuation">Continued on next page</div>}
      </InvoicePage>
    );
  });
}
