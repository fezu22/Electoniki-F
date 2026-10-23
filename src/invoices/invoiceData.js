export const money = (amount) =>
  `Rs. ${Math.round(Number(amount) || 0).toLocaleString('en-PK')}`;

export const lineTotal = (item = {}) =>
  Number(item.qty || 0) * Number(item.rate ?? item.price ?? 0);

export const subtotal = (items = []) =>
  items.reduce((sum, item) => sum + lineTotal(item), 0);

export function createInstallmentSchedule(balance, installmentCount, suggestedAmount = 0) {
  const total = Math.max(0, Math.round(Number(balance) || 0));
  const count = Math.max(1, Math.floor(Number(installmentCount) || 1));
  const savedAmount = Math.max(0, Math.round(Number(suggestedAmount) || 0));
  const regularAmount = savedAmount > 0 && savedAmount * (count - 1) <= total
    ? savedAmount
    : Math.floor(total / count);
  return {
    count,
    regularAmount,
    finalAmount: total - regularAmount * (count - 1),
  };
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Shape a persisted app sale and shop settings for the A5 invoice components. */
export function toInvoiceModel(sale = {}, shop = {}) {
  const items = Array.isArray(sale.items)
    ? sale.items.map((item) => ({
        name: item.name || item.productName || '',
        qty: Number(item.qty) || 0,
        rate: Number(item.price ?? item.rate) || 0,
      }))
    : [];
  const gross = Number(sale.gross) || subtotal(items);
  const total = Number(sale.total) || Math.max(0, gross - (Number(sale.billDiscount) || 0) + (Number(sale.add) || 0));
  const paid = Math.min(total, Number(sale.paid ?? sale.initialPaid) || 0);
  const paymentDetails = sale.paymentDetails || {};
  const methodValue = String(paymentDetails.method || sale.paymentMethod || 'cash').toLowerCase();
  const paymentMethod = methodValue.includes('bank') ? 'Bank' : 'Cash';

  return {
    invoiceNo: sale.invoiceNo || sale.id || '',
    date: formatDate(sale.createdAt || sale.date),
    customerName: sale.customer || sale.customerName || '',
    customerAddress: sale.address || '',
    customerPhone: sale.whatsapp || sale.phone || '',
    items,
    subtotal: gross,
    discount: Number(sale.billDiscount) || 0,
    markup: Number(sale.add) || 0,
    total,
    paid,
    balance: Math.max(0, Number(sale.balance ?? total - paid) || 0),
    months: Math.max(0, Math.floor(Number(sale.months) || 0)),
    monthly: Number(sale.monthly) || 0,
    paymentMethod,
    bankName: paymentDetails.bankName || paymentDetails.bank || '',
    terms: [],
    footerNote: shop.receiptFooter || '',
    shop: {
      name: shop.name || '',
      phone1: shop.phone || shop.whatsapp || '',
      phone2: shop.phone && shop.whatsapp && shop.phone !== shop.whatsapp ? shop.whatsapp : '',
      address: [shop.address, shop.city].filter(Boolean).join(', '),
    },
  };
}
