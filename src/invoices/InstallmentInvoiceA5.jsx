import React from 'react';
import { CalendarDays } from 'lucide-react';
import './invoice.css';
import { createInstallmentSchedule, money } from './invoiceData.js';
import { CustomerBlock, ItemsTable, SummaryTable, Terms, Signature, InvoicePage, invoicePageCount } from './InvoiceShared.jsx';

/** A5 installment invoice using the advance, balance, and plan saved with the sale. */
export default function InstallmentInvoiceA5({ invoice }) {
  if (!invoice) return null;
  const pageCount = invoicePageCount(invoice.items);
  const balance = Math.max(0, Number(invoice.balance) || 0);
  const schedule = createInstallmentSchedule(balance, invoice.months, invoice.monthly);
  const plan = schedule.regularAmount === schedule.finalAmount
    ? `${money(schedule.regularAmount)} × ${schedule.count} Installments`
    : `${schedule.count - 1} × ${money(schedule.regularAmount)} + final ${money(schedule.finalAmount)}`;
  const rows = [
    ['Subtotal', money(invoice.subtotal)],
    ...(invoice.discount ? [['Discount', `- ${money(invoice.discount)}`]] : []),
    ...(invoice.markup ? [['Installment markup', `+ ${money(invoice.markup)}`]] : []),
    ['Total Amount', money(invoice.total), true],
    ['Advance Paid', money(invoice.paid)],
    ['Remaining Balance', money(balance), true],
    ['Payment Method', invoice.paymentMethod, true],
    ...(invoice.paymentMethod === 'Bank' && invoice.bankName ? [['Bank', invoice.bankName]] : []),
  ];
  const tableHeight = Math.max(48, 77 - Math.max(0, rows.length - 5) * 7);
  return Array.from({ length: pageCount }, (_, pageIndex) => {
    const lastPage = pageIndex === pageCount - 1;
    return (
      <InvoicePage key={pageIndex} title="INSTALLMENT INVOICE" invoice={invoice} lastPage={lastPage} variant="installment" tableHeight={tableHeight}>
        <CustomerBlock data={invoice} />
        <ItemsTable items={invoice.items.slice(pageIndex * 10, (pageIndex + 1) * 10)} startIndex={pageIndex * 10} />
        {lastPage ? <>
          <div className="ci-bottom ci-installment-bottom">
            <SummaryTable rows={rows} />
            <div className="ci-right-stack">
              <section className="ci-plan"><h3><CalendarDays />INSTALLMENT PLAN</h3><div>{plan}</div></section>
              <Terms terms={invoice.terms} />
            </div>
          </div>
          <Signature shopName={invoice.shop.name} />
        </> : <div className="ci-continuation">Continued on next page</div>}
      </InvoicePage>
    );
  });
}
