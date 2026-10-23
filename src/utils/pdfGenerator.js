import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { money, num } from '../api.js';

/** Capture the actual A5 invoice component and download it as a one-page PDF. */
export async function downloadInvoiceElementPdf(element, fileName) {
  if (!element) throw new Error('Invoice preview is not available. Open the invoice and try again.');

  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2.5,
    useCORS: true,
    logging: false,
  });
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [148, 210], compress: true });
  doc.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', 0, 0, 148, 210, undefined, 'FAST');
  doc.save(fileName);
  return fileName;
}

/**
 * Generates and downloads a real PDF Invoice / Receipt for a saved sale or installment payment.
 * Uses the active shop's saved name, WhatsApp number, address, and footer.
 */
export function generateInvoicePdf(sale, shop, { download = true } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const shopName = shop?.name || 'Electronics Shop';
  const shopPhone = shop?.phone || shop?.whatsapp || '';
  const shopWhatsapp = shop?.whatsapp || '';
  const shopAddress = shop?.address || '';
  const footerNote =
    shop?.receiptFooter ||
    'Thank you for shopping with us! Warranty claims require original invoice.';

  const invoiceNo = sale.invoiceNo || sale.id || 'INV-0000';
  const saleDate = sale.createdAt
    ? new Date(sale.createdAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-GB');

  // Header Banner
  doc.setFillColor(16, 43, 63);
  doc.rect(0, 0, 595, 92, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(shopName, 40, 38);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (shopAddress) doc.text(shopAddress, 40, 56);
  doc.text(
    `Phone: ${shopPhone}   ${shopWhatsapp ? '|   WhatsApp: ' + shopWhatsapp : ''}`,
    40,
    72
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SALES INVOICE', 555, 38, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Invoice #: ${invoiceNo}`, 555, 56, { align: 'right' });
  doc.text(`Date: ${saleDate}`, 555, 72, { align: 'right' });

  // Customer Info Box
  doc.setTextColor(18, 48, 63);
  doc.setFillColor(244, 248, 250);
  doc.rect(40, 110, 515, 68, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('BILL TO CUSTOMER:', 52, 128);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${sale.customer || 'Walk-in customer'}`, 52, 144);
  doc.text(`Phone / WhatsApp: ${sale.whatsapp || sale.phone || 'N/A'}`, 52, 160);

  doc.setFont('helvetica', 'bold');
  doc.text('SALE DETAILS:', 320, 128);
  doc.setFont('helvetica', 'normal');
  doc.text(`Sale Type: ${sale.type === 'installment' ? 'Installment Sale' : 'Cash Sale'}`, 320, 144);
  doc.text(`Payment Method: ${sale.paymentMethod || 'Cash'}`, 320, 160);

  // Items Table Header
  let y = 200;
  doc.setFillColor(230, 238, 242);
  doc.rect(40, y, 515, 24, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('#', 50, y + 16);
  doc.text('Product / Model', 75, y + 16);
  doc.text('Qty', 340, y + 16, { align: 'right' });
  doc.text('Unit Price', 440, y + 16, { align: 'right' });
  doc.text('Line Total', 545, y + 16, { align: 'right' });

  y += 24;
  doc.setFont('helvetica', 'normal');
  const items = sale.items || [];
  items.forEach((item, idx) => {
    y += 22;
    const lineTotal = num(item.total) || num(item.qty) * num(item.price);
    doc.text(String(idx + 1), 50, y);
    doc.text(String(item.name || 'Item').slice(0, 42), 75, y);
    doc.text(String(item.qty || 1), 340, y, { align: 'right' });
    doc.text(money(item.price || lineTotal), 440, y, { align: 'right' });
    doc.text(money(lineTotal), 545, y, { align: 'right' });
    doc.setDrawColor(230, 236, 240);
    doc.line(40, y + 7, 555, y + 7);
  });

  // Totals Section
  y += 28;
  const rightLabelX = 360;
  const rightValX = 545;

  if (num(sale.billDiscount) > 0) {
    doc.text('Gross Subtotal:', rightLabelX, y);
    doc.text(money(sale.gross || sale.total), rightValX, y, { align: 'right' });
    y += 18;
    doc.text('Discount:', rightLabelX, y);
    doc.text('- ' + money(sale.billDiscount), rightValX, y, { align: 'right' });
    y += 18;
  }

  if (sale.type === 'installment' && num(sale.add) > 0) {
    doc.text('Installment Markup:', rightLabelX, y);
    doc.text('+ ' + money(sale.add), rightValX, y, { align: 'right' });
    y += 18;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Final Invoice Total:', rightLabelX, y);
  doc.text(money(sale.total), rightValX, y, { align: 'right' });

  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Paid / Advance Received:', rightLabelX, y);
  doc.text(money(sale.paid), rightValX, y, { align: 'right' });

  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.text('Remaining Balance:', rightLabelX, y);
  doc.text(money(sale.balance), rightValX, y, { align: 'right' });

  if (sale.type === 'installment') {
    y += 28;
    doc.setFillColor(240, 250, 247);
    doc.rect(40, y, 515, 56, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(33, 118, 94);
    doc.text('INSTALLMENT KHATA SCHEDULE', 52, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(18, 48, 63);
    doc.text(
      `Duration: ${sale.months || 12} Months   |   Monthly Installment: ${money(sale.monthly)}   |   Remaining: ${money(sale.balance)}`,
      52,
      y + 38
    );
    y += 66;
  } else {
    y += 32;
  }

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(102, 121, 133);
  doc.text(footerNote, 40, y + 20);
  doc.text(
    `Generated by ${shopName} (${shopWhatsapp || shopPhone || 'Official Invoice'})`,
    40,
    y + 36
  );

  const fileName = `${invoiceNo}-${shopName.replace(/[^a-zA-Z0-9]+/g, '-')}.pdf`;
  if (download) {
    doc.save(fileName);
  }
  return { fileName, doc };
}

/**
 * Normalizes a Pakistani or international phone number for wa.me links.
 */
export function normalizeWhatsAppPhone(rawPhone) {
  const digits = String(rawPhone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('03') && digits.length === 11) {
    return '92' + digits.slice(1);
  }
  return digits;
}

/**
 * Builds the wa.me URL and message text for sharing an invoice PDF on WhatsApp.
 * Uses the shop's saved WhatsApp number in Settings as the sender contact reference
 * and targets the customer's WhatsApp number (or opens WhatsApp contact picker if blank).
 */
export function buildWhatsAppInvoiceShare(sale, shop) {
  const shopName = shop?.name || 'Electronics Shop';
  const shopWa = shop?.whatsapp || shop?.phone || '';
  const invoiceNo = sale.invoiceNo || sale.id;
  const customerPhone = normalizeWhatsAppPhone(sale.whatsapp || sale.phone || '');

  const lines = [
    `*${shopName}*`,
    `Invoice: *${invoiceNo}*`,
    `Customer: ${sale.customer || 'Walk-in customer'}`,
    `Total Amount: *${money(sale.total)}*`,
    `Paid: ${money(sale.paid)}`,
    `Remaining Balance: *${money(sale.balance)}*`,
  ];
  if (sale.type === 'installment') {
    lines.push(`Installment Plan: ${sale.months || 12} months × ${money(sale.monthly)}/month`);
  }
  if (shopWa) {
    lines.push(`Shop WhatsApp / Contact: ${shopWa}`);
  }
  lines.push(`Please find your attached PDF invoice (${invoiceNo}). Thank you for your business!`);

  const text = lines.join('\n');
  const targetPhone = customerPhone || normalizeWhatsAppPhone(shopWa);
  const waUrl = targetPhone
    ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;

  return {
    waUrl,
    text,
    targetPhone,
    shopWhatsApp: shopWa,
  };
}
