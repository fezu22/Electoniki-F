import NumericInput from '../../components/NumericInput.jsx';
import React, { useState, useRef, useEffect } from 'react';
import { FileUp, ScanBarcode, FileText, PackagePlus, ListChecks, Wallet, ScanLine, Sparkles, X } from 'lucide-react';
import { apiRequest, money, num } from '../../api.js';
import { matchProduct } from '../../lib/productMatching.js';

const WARRANTY_MONTHS = Array.from({ length: 16 }, (_, index) => `${(index + 1) * 3} Months`);

async function invoiceDocumentDataUrl(document) {
  if (!document) return '';
  if (!document.url) throw new Error('The original invoice photo is unavailable. Select it again before posting.');
  const response = await fetch(document.url);
  if (!response.ok) throw new Error('The original invoice photo could not be read.');
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('The original invoice photo could not be read.'));
    reader.readAsDataURL(blob);
  });
}

async function fingerprintInvoiceFile(file) {
  if (!globalThis.crypto?.subtle || typeof file?.arrayBuffer !== 'function') return '';
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function buildBatchProductGroups(documents) {
  const groups = new Map();
  documents.forEach((document, documentIndex) => {
    (document.draft?.items || []).forEach((item, itemIndex) => {
      const code = String(item.code || '').trim().toLocaleLowerCase();
      const model = String(item.model || '').trim().toLocaleLowerCase();
      const name = String(item.name || '').trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      const key = code
        ? `code:${String(item.codeType || '')}:${code}|name:${name}|model:${model}`
        : name || model ? `name:${name}|model:${model}` : `row:${documentIndex}:${itemIndex}`;
      let group = groups.get(key);
      if (!group) {
        group = { key, name: item.name || '', qty: 0, costAmount: 0, costQty: 0, writtenAmount: 0, pricedQty: 0, saleAmount: 0, warranties: new Set(), sources: [] };
        groups.set(key, group);
      }
      if (WARRANTY_MONTHS.includes(String(item.warranty || '').trim())) group.warranties.add(String(item.warranty).trim());
      const qty = Number(item.qty);
      const cost = Number(item.cost);
      const lineTotal = Number(item.lineTotal);
      const price = Number(item.price);
      if (Number.isFinite(qty) && qty > 0) {
        group.qty += qty;
        if (Number.isFinite(cost) && cost > 0) { group.costAmount += qty * cost; group.costQty += qty; }
        if (Number.isFinite(price) && price > 0) {
          group.saleAmount += qty * price;
          group.pricedQty += qty;
        }
      }
      group.writtenAmount += Number.isFinite(lineTotal) && lineTotal >= 0
        ? lineTotal
        : Number.isFinite(qty) && qty > 0 && Number.isFinite(cost) && cost > 0 ? qty * cost : 0;
      group.sources.push({
        documentIndex, itemIndex,
        invoice: document.draft?.invoiceNo || document.name,
        qty: item.qty ?? '', cost: item.cost ?? '', lineTotal: item.lineTotal ?? '', price: item.price ?? '',
      });
    });
  });
  return [...groups.values()].map((group) => ({
    ...group,
    warranty: group.warranties.size === 1 ? [...group.warranties][0] : group.warranties.size > 1 ? '__mixed__' : '',
    mixedWarranty: group.warranties.size > 1,
    averageCost: group.costQty ? group.costAmount / group.costQty : 0,
    averageSalePrice: group.pricedQty ? group.saleAmount / group.pricedQty : '',
  }));
}

export default function StockReceivePage({
  products = [],
  stockReceipts = [],
  suppliers = [],
  bankAccounts = [],
  onClose,
  onSuccess,
  showAlert,
}) {
  const [step, setStep] = useState('choose'); // 'choose' | 'processing' | 'review'
  const [docInfo, setDocInfo] = useState(null); // { name, type, url, dataUrl, mode }
  const [documentBatch, setDocumentBatch] = useState([]);
  const [documentBatchIndex, setDocumentBatchIndex] = useState(0);
  const [selectedBatchInvoiceIndex, setSelectedBatchInvoiceIndex] = useState(0);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [limitationNote, setLimitationNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [retryingBatchIndex, setRetryingBatchIndex] = useState(null);

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [supplier, setSupplier] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [invoiceTotal, setInvoiceTotal] = useState('');

  // Composer fields
  const [siProduct, setSiProduct] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [editingDraftIndex, setEditingDraftIndex] = useState(null);
  const [siCode, setSiCode] = useState('');
  const [siQty, setSiQty] = useState('');
  const [siCost, setSiCost] = useState('');
  const [siPrice, setSiPrice] = useState('');
  const [siWarranty, setSiWarranty] = useState('');
  const [composerErr, setComposerErr] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);

  // Draft items
  const [stockDraft, setStockDraft] = useState([]);
  const [bulkProfit, setBulkProfit] = useState('');

  // Payment fields
  const [paymentMethod, setPaymentMethod] = useState('credit');
  const [paidNow, setPaidNow] = useState('0');
  const [bankName, setBankName] = useState('');
  const [paymentReference, setPaymentReference] = useState('');

  const uploadInputRef = useRef(null);
  const pendingFilesRef = useRef([]);
  const productInputRef = useRef(null);
  const qtyInputRef = useRef(null);
  const costInputRef = useRef(null);
  const postingRef = useRef(false);
  const documentUrlsRef = useRef([]);
  useEffect(() => () => { documentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

  function loadDraftIntoForm(draft = {}) {
    setSupplier(draft.supplier || '');
    setInvoiceNo(draft.invoiceNo || '');
    setInvoiceDate(draft.date || '');
    setInvoiceTotal(String(draft.invoiceTotal ?? ''));
    setStockDraft((Array.isArray(draft.items) ? draft.items : []).filter((x) => x && typeof x === 'object').map((x) => ({
      name: String(x.name || ''), originalName: String(x.originalName || ''), code: String(x.code || '').trim(), model: String(x.model || ''),
      codeType: String(x.codeType || ''), qty: x.qty ?? '', cost: x.cost ?? '', price: x.price ?? '',
      warranty: WARRANTY_MONTHS.includes(String(x.warranty || '').trim()) ? String(x.warranty).trim() : '',
      reviewNote: String(x.reviewNote || ''),
    })));
  }

  async function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // Allow selecting the same invoice after Back or an error.
    if (!files.length) return;
    const invalid = files.find((file) => !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) || file.size > 10 * 1024 * 1024);
    if (invalid) {
      showAlert('Check selected files', `${invalid.name}: choose a JPEG, PNG, WebP image or PDF smaller than 10 MB.`, 'warning');
      return;
    }
    if (pendingFiles.length + files.length > 10) {
      showAlert('Too many invoices', 'Choose up to 10 invoices in one batch.', 'warning');
      return;
    }
    if ([...pendingFiles, ...files].reduce((total, file) => total + file.size, 0) > 30 * 1024 * 1024) {
      showAlert('Batch too large', 'The selected files must total 30 MB or less. Split them into smaller batches.', 'warning');
      return;
    }
    setPendingFiles((current) => {
      const updated = [...current, ...files];
      pendingFilesRef.current = updated;
      return updated;
    });
  }

  function confirmRemovePendingFile(index) {
    const file = pendingFiles[index];
    if (!file) return;
    showAlert(
      'Remove invoice photo?',
      `Remove “${file.name}” from this scan batch?`,
      'warning',
      'Remove photo',
      () => setPendingFiles((current) => {
        const updated = current.filter((_, fileIndex) => fileIndex !== index);
        pendingFilesRef.current = updated;
        return updated;
      })
    );
  }

  function confirmClearPendingFiles() {
    if (!pendingFiles.length) return;
    showAlert(
      'Clear selected invoices?',
      `Remove all ${pendingFiles.length} selected ${pendingFiles.length === 1 ? 'file' : 'files'} from this batch?`,
      'warning',
      'Clear all',
      () => { pendingFilesRef.current = []; setPendingFiles([]); }
    );
  }

  function clearInvoiceEntryFields() {
    setSiProduct(''); setSiCode(''); setSiQty(''); setSiCost(''); setSiPrice(''); setSiWarranty('');
    setSelectedProductId(null); setEditingDraftIndex(null); setComposerErr('');
    setPaymentMethod('credit'); setPaidNow('0'); setPaymentReference('');
  }

  function switchBatchInvoice(nextIndex) {
    if (nextIndex < 0 || nextIndex >= documentBatch.length || nextIndex === documentBatchIndex) return;
    const currentDraft = {
      supplier, invoiceNo, date: invoiceDate, invoiceTotal, items: stockDraft,
    };
    const updatedBatch = documentBatch.map((doc, index) => index === documentBatchIndex
      ? { ...doc, draft: currentDraft }
      : doc);
    const nextDoc = updatedBatch[nextIndex];
    setDocumentBatch(updatedBatch);
    setDocumentBatchIndex(nextIndex);
    setDocInfo(nextDoc);
    setLimitationNote(`Invoice ${nextIndex + 1} of ${updatedBatch.length}. ${nextDoc.note || ''}`.trim());
    loadDraftIntoForm(nextDoc.draft);
    clearInvoiceEntryFields();
  }

  function updateBatchDraft(documentIndex, update) {
    setDocumentBatch((current) => current.map((document, index) => {
      if (index !== documentIndex) return document;
      const draft = document.draft || {};
      return { ...document, draft: typeof update === 'function' ? update(draft) : { ...draft, ...update } };
    }));
  }

  function confirmRemoveBatchInvoice(index) {
    const document = documentBatch[index];
    if (!document) return;
    showAlert('Remove invoice from batch?', `Remove ${document.draft?.invoiceNo || document.name} (${document.name}) from this batch? No stock has been saved yet.`, 'warning', 'Remove invoice', () => {
      const remaining = documentBatch.filter((_, documentIndex) => documentIndex !== index);
      if (!remaining.length) {
        setDocumentBatch([]);
        setDocumentBatchIndex(0);
        setSelectedBatchInvoiceIndex(0);
        setDocInfo(null);
        setLimitationNote('');
        setStep('choose');
        return;
      }
      const nextIndex = index < selectedBatchInvoiceIndex ? selectedBatchInvoiceIndex - 1 : Math.min(selectedBatchInvoiceIndex, remaining.length - 1);
      setDocumentBatch(remaining);
      setSelectedBatchInvoiceIndex(nextIndex);
      if (index === documentBatchIndex) {
        setDocumentBatchIndex(nextIndex);
        setDocInfo(remaining[nextIndex]);
        loadDraftIntoForm(remaining[nextIndex].draft);
      } else if (index < documentBatchIndex) {
        setDocumentBatchIndex(documentBatchIndex - 1);
      }
      setLimitationNote(`${remaining.length} invoices in this batch. Review each before posting.`);
    });
  }

  async function prepareInvoiceData(file) {
    if (file.type === 'application/pdf') return { dataUrl: await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      reader.readAsDataURL(file);
    }), detailDataUrl: '', textDataUrl: '', headerDataUrl: '', mimeType: 'application/pdf' };

    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error(`Could not read ${file.name}.`));
        element.src = objectUrl;
      });
      const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not prepare invoice photo for reading.');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      // Header crop keeps invoice number/date/supplier legible without asking
      // the model to infer them from the smaller full-page view.
      const headerScale = 2;
      const headerTop = Math.round(canvas.height * 0.09);
      const headerHeight = Math.max(1, Math.round(canvas.height * 0.25));
      const headerCanvas = document.createElement('canvas');
      headerCanvas.width = canvas.width * headerScale;
      headerCanvas.height = headerHeight * headerScale;
      const headerContext = headerCanvas.getContext('2d');
      if (!headerContext) throw new Error('Could not prepare invoice header photo.');
      headerContext.fillStyle = '#fff';
      headerContext.fillRect(0, 0, headerCanvas.width, headerCanvas.height);
      headerContext.imageSmoothingEnabled = true;
      headerContext.imageSmoothingQuality = 'high';
      headerContext.drawImage(canvas, 0, headerTop, canvas.width, headerHeight, 0, 0, headerCanvas.width, headerCanvas.height);
      // A table-only view helps the vision model read handwriting at a larger
      // scale while the full page retains invoice/date/total context.
      const cropTop = Math.round(canvas.height * 0.25);
      const cropHeight = Math.max(1, Math.round(canvas.height * 0.68));
      const detailScale = 1.5;
      const detailCanvas = document.createElement('canvas');
      detailCanvas.width = Math.round(canvas.width * detailScale);
      detailCanvas.height = Math.round(cropHeight * detailScale);
      const detailContext = detailCanvas.getContext('2d');
      if (!detailContext) throw new Error('Could not prepare invoice detail photo for reading.');
      detailContext.fillStyle = '#fff';
      detailContext.fillRect(0, 0, detailCanvas.width, detailCanvas.height);
      detailContext.imageSmoothingEnabled = true;
      detailContext.imageSmoothingQuality = 'high';
      detailContext.drawImage(canvas, 0, cropTop, canvas.width, cropHeight, 0, 0, detailCanvas.width, detailCanvas.height);
      const textScale = 2;
      const textCropX = Math.round(canvas.width * 0.29);
      const textCropWidth = Math.max(1, Math.round(canvas.width * 0.48));
      const textCanvas = document.createElement('canvas');
      textCanvas.width = textCropWidth * textScale;
      textCanvas.height = cropHeight * textScale;
      const textContext = textCanvas.getContext('2d');
      if (!textContext) throw new Error('Could not prepare invoice text detail photo.');
      textContext.fillStyle = '#fff';
      textContext.fillRect(0, 0, textCanvas.width, textCanvas.height);
      textContext.imageSmoothingEnabled = true;
      textContext.imageSmoothingQuality = 'high';
      textContext.drawImage(canvas, textCropX, cropTop, textCropWidth, cropHeight, 0, 0, textCanvas.width, textCanvas.height);
      return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), detailDataUrl: detailCanvas.toDataURL('image/jpeg', 0.92), textDataUrl: textCanvas.toDataURL('image/jpeg', 0.94), headerDataUrl: headerCanvas.toDataURL('image/jpeg', 0.94), mimeType: 'image/jpeg' };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function retryBatchInvoice(documentIndex) {
    const document = documentBatch[documentIndex];
    if (!document || retryingBatchIndex !== null) return;
    setRetryingBatchIndex(documentIndex);
    try {
      const response = await fetch(document.url);
      const blob = await response.blob();
      const file = new File([blob], document.name, { type: document.type });
      const { dataUrl, detailDataUrl, textDataUrl, headerDataUrl, mimeType } = await prepareInvoiceData(file);
      const result = await apiRequest('/ocr/invoice', {
        method: 'POST', signal: AbortSignal.timeout(120000),
        body: { dataUrl, detailDataUrl, textDataUrl, headerDataUrl, fileName: file.name, mimeType },
      });
      setDocumentBatch((current) => current.map((entry, index) => {
        if (index !== documentIndex) return entry;
        const previous = entry.draft || {};
        const extracted = result.draft || {};
        return {
          ...entry,
          note: result.limitationNote || '',
          draft: {
            ...extracted,
            supplier: previous.supplier || extracted.supplier || '',
            invoiceNo: previous.invoiceNo || extracted.invoiceNo || '',
            date: previous.date || extracted.date || '',
            invoiceTotal: previous.invoiceTotal || extracted.invoiceTotal || '',
            items: (Array.isArray(extracted.items) ? extracted.items : []).map((item) => ({
              ...item, qty: item.qty ?? '', cost: item.cost ?? '', lineTotal: item.lineTotal ?? '',
              price: item.price ?? '', warranty: item.warranty ?? '',
            })),
            paymentMethod: previous.paymentMethod || 'credit',
            paidNow: previous.paidNow || '0',
            bankName: previous.bankName || '',
            paymentReference: previous.paymentReference || '',
          },
        };
      }));
    } catch (error) {
      showAlert('Could not retry invoice', error.message || 'Check the connection and try again.', 'warning');
    } finally {
      setRetryingBatchIndex(null);
    }
  }

  async function processPendingFiles(filesOverride = null) {
    const files = filesOverride || pendingFilesRef.current;
    if (!files.length) return;
    setStockDraft([]);
    setSupplier(''); setInvoiceNo(''); setInvoiceDate(''); setInvoiceTotal('');
    setSiProduct(''); setSiCode(''); setSiQty(''); setSiCost(''); setSiPrice(''); setSiWarranty('');
    setSelectedProductId(null); setEditingDraftIndex(null); setComposerErr('');
    setPaymentMethod('credit'); setPaidNow('0'); setPaymentReference('');
    setStep('processing');
    try {
      const scanOne = async (file) => {
        let fingerprint = '';
        try {
          fingerprint = await fingerprintInvoiceFile(file);
        } catch {
          // Continue scanning if browser hashing is unavailable.
        }
        let draft = {};
        let note = '';
        let url = '';
        try {
          url = URL.createObjectURL(file);
          documentUrlsRef.current.push(url);
          const { dataUrl, detailDataUrl, textDataUrl, headerDataUrl, mimeType } = await prepareInvoiceData(file);
          const res = await apiRequest('/ocr/invoice', {
            method: 'POST',
            signal: AbortSignal.timeout(120000),
            body: { dataUrl, detailDataUrl, textDataUrl, headerDataUrl, fileName: file.name, mimeType },
          });
          const extracted = res.draft || {};
          draft = {
            ...extracted,
            items: (Array.isArray(extracted.items) ? extracted.items : []).map((item) => ({
              ...item,
              qty: item.qty ?? '',
              cost: item.cost ?? '',
              lineTotal: item.lineTotal ?? '',
              price: item.price ?? '',
              warranty: item.warranty ?? '',
            })),
            paymentMethod: 'credit',
            paidNow: '0',
            bankName: '',
            paymentReference: '',
          };
          note = res.limitationNote || '';
        } catch (err) {
          note = err.name === 'TimeoutError' || err.name === 'AbortError'
            ? 'Invoice reading took too long. Retry or enter its items manually. No stock was saved.'
            : `Invoice reading failed: ${err.message}. Retry or enter its items manually. No stock was saved.`;
        }
        return { name: file.name, type: file.type, url, mode: 'upload', fingerprint, draft, note };
      };
      const queue = [];
      for (let index = 0; index < files.length; index += 2) {
        queue.push(...await Promise.all(files.slice(index, index + 2).map(scanOne)));
      }
      setDocumentBatch(queue);
      setPendingFiles([]);
      pendingFilesRef.current = [];
      setDocumentBatchIndex(0);
      setSelectedBatchInvoiceIndex(0);
      setDocInfo(queue[0]);
      setLimitationNote(queue.length > 1
        ? `${queue.length} invoices were read. Review all of them together; each will remain a separate stock receipt. ${queue[0].note}`.trim()
        : queue[0].note);
      loadDraftIntoForm(queue[0].draft);
      setStep('review');
    } catch (err) {
      showAlert('Could not read selected files', err.message, 'warning');
      setStep('choose');
    }
  }

  function startManualMode() {
    pendingFilesRef.current = [];
    setPendingFiles([]);
    setDocInfo(null);
    setLimitationNote('');
    setSupplier('');
    setInvoiceNo('');
    setInvoiceDate(today);
    setInvoiceTotal('');
    setStockDraft([]);
    setSiProduct(''); setSiCode(''); setSiQty(''); setSiCost(''); setSiPrice(''); setSiWarranty('');
    setSelectedProductId(null); setEditingDraftIndex(null); setComposerErr('');
    setStep('review');
  }

  // Matches product by name, SKU code, or USB/Bluetooth barcode
  const matchingProducts = siProduct.trim()
    ? products
        .filter((p) => {
          const q = siProduct.trim().toLowerCase();
          const searchable = [p.name, p.code, p.barcode, p.model].filter(Boolean).join(' ').toLowerCase();
          return q.split(/\s+/).every((word) => searchable.includes(word));
        })
        .slice(0, 6)
    : [];

  function pickSuggestion(prod) {
    setSelectedProductId(prod.id);
    setSiProduct(prod.name);
    setSiCode(prod.code || prod.barcode || '');
    if (num(prod.cost)) setSiCost(String(num(prod.cost)));
    if (num(prod.price)) setSiPrice(String(num(prod.price)));
    setSiWarranty('');
    setShowSuggest(false);
    setTimeout(() => qtyInputRef.current?.focus(), 20);
  }

  function handleAddDraftItem() {
    const last = stockDraft[stockDraft.length - 1] || {};
    const pick = (v, k) => (String(v).trim() === '//' ? String(last[k] ?? '') : String(v).trim());

    const nameVal = pick(siProduct, 'name');
    const codeVal = pick(siCode, 'code');
    const qtyVal = Number(pick(siQty, 'qty'));
    const costVal = num(pick(siCost, 'cost'));
    const matchedProduct = products.find((product) => product.id === selectedProductId);
    const priceInput = pick(siPrice, 'price');
    const priceVal = priceInput ? num(priceInput) : matchedProduct ? num(matchedProduct.price) : 0;

    if (!nameVal || !Number.isSafeInteger(qtyVal) || qtyVal < 1 || costVal <= 0 || priceVal <= 0) {
      setComposerErr('Enter product name, quantity (>= 1), purchase cost, and sale price.');
      return;
    }

    setComposerErr('');
    const previousPrice = editingDraftIndex === null ? undefined : stockDraft[editingDraftIndex]?.price;
    const item = {
      productId: selectedProductId,
      name: nameVal,
      code: codeVal,
      qty: qtyVal,
      cost: costVal,
      price: priceVal,
      ...(siWarranty ? { warranty: siWarranty } : {}),
    };
    const nextDraft = editingDraftIndex === null ? [...stockDraft, item] : stockDraft.map((line, i) => i === editingDraftIndex ? item : line);
    setStockDraft(nextDraft);

    // Auto-update invoice total if empty or matched previous sum
    const prevSum = stockDraft.reduce((s, x) => s + x.qty * x.cost, 0);
    const nextSum = nextDraft.reduce((s, x) => s + x.qty * x.cost, 0);
    if (!invoiceTotal || Math.abs(num(invoiceTotal) - prevSum) < 1) {
      setInvoiceTotal(String(nextSum));
    }

    setSiProduct('');
    setSelectedProductId(null);
    setEditingDraftIndex(null);
    setSiCode('');
    setSiQty('');
    setSiCost('');
    setSiPrice('');
    setSiWarranty('');
    setShowSuggest(false);
    productInputRef.current?.focus();
  }

  function handleEditDraftItem(idx) {
    const target = stockDraft[idx];
    if (!target) return;
    setEditingDraftIndex(idx);
    setSelectedProductId(target.productId || null);
    setSiProduct(target.name);
    setSiCode(target.code || '');
    setSiQty(String(target.qty));
    setSiCost(String(target.cost));
    setSiPrice(String(target.price ?? ''));
    setSiWarranty(target.warranty || '');
    productInputRef.current?.focus();
  }

  function handleRemoveDraftItem(idx) {
    setStockDraft(stockDraft.filter((_, i) => i !== idx));
    if (editingDraftIndex !== null) {
      if (editingDraftIndex === idx) {
        setEditingDraftIndex(null);
        setSelectedProductId(null);
        setSiProduct(''); setSiCode(''); setSiQty(''); setSiCost(''); setSiPrice(''); setSiWarranty('');
      } else if (editingDraftIndex > idx) setEditingDraftIndex(editingDraftIndex - 1);
    }
  }

  function applyProfitToAllSalePrices() {
    const profit = Number(bulkProfit);
    if (bulkProfit === '' || !Number.isFinite(profit) || profit < 0) {
      showAlert('Enter a valid profit', 'Enter a per-unit profit amount of zero or more. Sale price will be purchase cost plus this amount.', 'warning');
      return;
    }
    if (docInfo && documentBatch.length > 1) {
      const allItems = documentBatch.flatMap((document) => document.draft?.items || []);
      const validCostCount = allItems.filter((item) => Number.isFinite(Number(item.cost)) && Number(item.cost) > 0).length;
      if (!validCostCount) {
        showAlert('Purchase costs required', 'Add or correct purchase costs before applying profit to sale prices.', 'warning');
        return;
      }
      setDocumentBatch((documents) => documents.map((document) => ({
        ...document,
        draft: {
          ...document.draft,
          items: (document.draft?.items || []).map((item) => {
            const cost = Number(item.cost);
            return Number.isFinite(cost) && cost > 0 ? { ...item, price: String(cost + profit) } : item;
          }),
        },
      })));
      const skipped = allItems.length - validCostCount;
      showAlert('Sale prices updated', `Added Rs. ${profit.toLocaleString('en-PK')} profit per unit to ${validCostCount} sale prices across all invoices.${skipped ? ` ${skipped} rows with missing purchase cost were skipped.` : ''}`, skipped ? 'warning' : 'success');
      return;
    }
    const validCostCount = stockDraft.filter((item) => Number.isFinite(Number(item.cost)) && Number(item.cost) > 0).length;
    if (!validCostCount) {
      showAlert('Purchase costs required', 'Add or correct purchase costs before applying profit to sale prices.', 'warning');
      return;
    }
    setStockDraft((items) => items.map((item) => {
      const cost = Number(item.cost);
      return Number.isFinite(cost) && cost > 0 ? { ...item, price: String(cost + profit) } : item;
    }));
    const skipped = stockDraft.length - validCostCount;
    showAlert(
      'Sale prices updated',
      `Added Rs. ${profit.toLocaleString('en-PK')} profit per unit to ${validCostCount} sale ${validCostCount === 1 ? 'price' : 'prices'}.${skipped ? ` ${skipped} item${skipped === 1 ? ' was' : 's were'} skipped because its purchase cost is missing.` : ''}`,
      skipped ? 'warning' : 'success'
    );
  }

  // Barcode scanner & Enter key navigation inside composer
  function handleProductKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = siProduct.trim().toLowerCase();
      // Check exact barcode or SKU match first (USB/Bluetooth scanner behavior)
      const exactMatch = matchProduct(products, { name: q, code: q, barcode: q });
      if (exactMatch) {
        pickSuggestion(exactMatch);
      } else {
        setShowSuggest(false);
        qtyInputRef.current?.focus();
      }
    }
  }

  const itemsTotal = stockDraft.reduce((sum, x) => sum + x.qty * x.cost, 0);
  const statedTotal = invoiceTotal !== '' ? num(invoiceTotal) : itemsTotal;
  const totalMatches = invoiceTotal !== '' && Math.abs(itemsTotal - statedTotal) < 0.005;
  const isDuplicate =
    invoiceNo.trim() !== '' &&
    supplier.trim() !== '' &&
    stockReceipts.some(
      (r) =>
        String(r.invoiceNo || '').toLowerCase() === invoiceNo.trim().toLowerCase() &&
        String(r.supplier || '').toLowerCase() === supplier.trim().toLowerCase()
    );
  const supplierPayableImpact = Math.max(0, statedTotal - num(paidNow));
  const batchProductGroups = buildBatchProductGroups(documentBatch);
  const batchInvoiceNumberCounts = new Map();
  const batchImageCounts = new Map();
  documentBatch.forEach(({ draft = {}, fingerprint = '' }) => {
    const invoiceKey = String(draft.invoiceNo || '').trim().toLocaleLowerCase();
    if (invoiceKey) batchInvoiceNumberCounts.set(invoiceKey, (batchInvoiceNumberCounts.get(invoiceKey) || 0) + 1);
    if (fingerprint) batchImageCounts.set(fingerprint, (batchImageCounts.get(fingerprint) || 0) + 1);
  });
  const duplicateBatchInvoices = [...batchInvoiceNumberCounts.entries()].filter(([, count]) => count > 1).map(([invoiceKey]) => invoiceKey);
  const duplicateBatchImages = [...batchImageCounts.entries()].filter(([, count]) => count > 1).map(([fingerprint]) => fingerprint);
  const activeBatchIndex = Math.min(selectedBatchInvoiceIndex, Math.max(0, documentBatch.length - 1));
  const activeBatchInvoice = documentBatch[activeBatchIndex];
  const activeBatchDraft = activeBatchInvoice?.draft || {};

  function updateBatchProductGroup(group, updates) {
    setDocumentBatch((current) => current.map((document, documentIndex) => ({
      ...document,
      draft: {
        ...document.draft,
        items: (document.draft?.items || []).map((item, itemIndex) =>
          group.sources.some((source) => source.documentIndex === documentIndex && source.itemIndex === itemIndex)
            ? { ...item, ...updates }
            : item
        ),
      },
    })));
  }

  async function handleBatchSubmit() {
    const invalid = documentBatch.findIndex((document) => {
      const draft = document.draft || {};
      const items = Array.isArray(draft.items) ? draft.items : [];
      const itemsTotal = items.reduce((sum, item) => sum + num(item.qty) * num(item.cost), 0);
      const statedTotal = draft.invoiceTotal !== '' && draft.invoiceTotal !== undefined ? num(draft.invoiceTotal) : NaN;
      const duplicate = stockReceipts.some((receipt) =>
        String(receipt.invoiceNo || '').trim().toLowerCase() === String(draft.invoiceNo || '').trim().toLowerCase() &&
        String(receipt.supplier || '').trim().toLowerCase() === String(draft.supplier || '').trim().toLowerCase()
      );
      return !String(draft.supplier || '').trim() || !String(draft.invoiceNo || '').trim() || !draft.date ||
        items.length === 0 || duplicate || !Number.isFinite(statedTotal) || Math.abs(itemsTotal - statedTotal) >= 0.005 ||
        num(draft.paidNow) > statedTotal || (draft.paymentMethod === 'bank' && num(draft.paidNow) > 0 &&
          !bankAccounts.some((bank) => bank.active !== false && bank.bankName === draft.bankName)) || items.some((item) => !String(item.name || '').trim() ||
          !Number.isSafeInteger(Number(item.qty)) || Number(item.qty) < 1 || num(item.cost) <= 0 || num(item.price) <= 0);
    });
    if (invalid !== -1) {
      setSelectedBatchInvoiceIndex(invalid);
      showAlert('Review invoice details', `Invoice ${invalid + 1} has missing or incomplete information, a total mismatch, or an invoice number that was already posted. Check the highlighted invoice and try again.`, 'warning');
      return;
    }
    postingRef.current = true;
    setSubmitting(true);
    const posted = [];
    try {
      for (const document of documentBatch) {
        const draft = document.draft;
        const invoiceTotal = num(draft.invoiceTotal);
        const documentDataUrl = await invoiceDocumentDataUrl(document);
        await apiRequest('/stock-receipts', {
          method: 'POST',
          body: {
            idempotencyKey: `rec-${String(draft.supplier).trim()}-${String(draft.invoiceNo).trim()}`,
            supplier: String(draft.supplier).trim(),
            invoiceNo: String(draft.invoiceNo).trim(),
            invoiceDate: draft.date,
            invoiceTotal,
            items: draft.items,
            paymentMethod: draft.paymentMethod || 'credit',
            paidNow: num(draft.paidNow),
            bankName: draft.bankName || '',
            paymentReference: draft.paymentReference || '',
            documentName: document.name,
            documentType: document.type,
            documentDataUrl,
            ocrDraftUsed: true,
          },
        });
        posted.push(document);
      }
      await onSuccess(documentBatch[0]?.draft?.supplier || '');
    } catch (error) {
      const remaining = documentBatch.slice(posted.length);
      setDocumentBatch(remaining);
      setDocumentBatchIndex(0);
      setSelectedBatchInvoiceIndex(0);
      setDocInfo(remaining[0] || null);
      if (remaining[0]) loadDraftIntoForm(remaining[0].draft);
      showAlert(
        posted.length ? `${posted.length} invoice${posted.length === 1 ? '' : 's'} saved` : 'Could not post invoices',
        posted.length
          ? `${posted.length} invoice${posted.length === 1 ? '' : 's'} posted successfully. The remaining invoices are still on this page. Error: ${error.message}`
          : error.message,
        'warning'
      );
    } finally {
      setSubmitting(false);
      postingRef.current = false;
    }
  }

  async function handleConfirmSubmit(e) {
    e.preventDefault();
    if (docInfo && documentBatch.length > 1) {
      await handleBatchSubmit();
      return;
    }
    if (postingRef.current) return;
    if (siProduct.trim() || editingDraftIndex !== null) {
      showAlert('Item not added', 'Press "+ Add item" to include the product you typed in the composer.', 'warning');
      return;
    }
    if (!supplier.trim() || !invoiceNo.trim() || stockDraft.length === 0) {
      showAlert(
        'Check invoice details',
        'Supplier name, invoice number, and at least one item are required.',
        'warning'
      );
      return;
    }
    if (isDuplicate) {
      showAlert(
        'Duplicate invoice blocked',
        'This supplier invoice number has already been posted. Inventory was not changed.',
        'warning'
      );
      return;
    }
    if (!totalMatches) {
      showAlert(
        'Invoice total mismatch',
        `Invoice total (${money(statedTotal)}) does not match item lines (${money(itemsTotal)}).`,
        'warning'
      );
      return;
    }
    if (stockDraft.some((x) => !x.name.trim() || !Number.isSafeInteger(Number(x.qty)) || Number(x.qty) < 1 ||
        !Number.isFinite(Number(x.cost)) || Number(x.cost) <= 0 || !Number.isFinite(Number(x.price)) || Number(x.price) <= 0)) {
      showAlert('Review invoice items', 'Each item needs a whole quantity, purchase cost, and sale price. Edit incomplete invoice drafts before confirming.', 'warning');
      return;
    }
    if (num(paidNow) > statedTotal) {
      showAlert('Payment is too high', 'Paid amount cannot exceed the invoice total.', 'warning');
      return;
    }
    if (paymentMethod === 'bank' && num(paidNow) > 0 && !bankAccounts.some((bank) => bank.active !== false && bank.bankName === bankName)) {
      showAlert('Choose a bank account', 'Select an active bank account for this payment.', 'warning');
      return;
    }

    postingRef.current = true;
    setSubmitting(true);
    try {
      const documentDataUrl = await invoiceDocumentDataUrl(docInfo);
      await apiRequest('/stock-receipts', {
        method: 'POST',
        body: {
          idempotencyKey: `rec-${supplier.trim()}-${invoiceNo.trim()}`,
          supplier: supplier.trim(),
          invoiceNo: invoiceNo.trim(),
          invoiceDate,
          invoiceTotal: statedTotal,
          items: stockDraft,
          paymentMethod,
          paidNow: num(paidNow),
          bankName,
          paymentReference,
          documentName: docInfo?.name || '',
          documentType: docInfo?.type || '',
          documentDataUrl,
          ocrDraftUsed: Boolean(docInfo),
        },
      });
      const remainingBatch = documentBatch.filter((_, index) => index !== documentBatchIndex);
      if (remainingBatch.length) {
        const nextDoc = remainingBatch[0];
        setDocumentBatch(remainingBatch);
        setDocumentBatchIndex(0);
        setSelectedBatchInvoiceIndex(0);
        setDocInfo(nextDoc);
        setLimitationNote(`Invoice 1 of ${remainingBatch.length}. ${nextDoc.note || ''}`.trim());
        loadDraftIntoForm(nextDoc.draft);
        clearInvoiceEntryFields();
        showAlert('Invoice saved', `${supplier.trim()} was posted. Review the next invoice in the batch.`, 'success');
      } else {
        await onSuccess(supplier.trim());
      }
    } catch (err) {
      showAlert('Could not post stock receipt', err.message, 'warning');
    } finally {
      setSubmitting(false);
      postingRef.current = false;
    }
  }

  return (
    <div className="stock-receive-page">
      <div
        className={`stock-entry-surface ${step === 'review' ? 'stock-review-modal' : ''} ${
          step === 'review' ? (docInfo ? 'stock-upload' : 'stock-manual') : ''
        }`}
        aria-label="Add stock and product"
      >
        {step === 'choose' && (
          <>
            <div className="modal-head">
              <div>
                <h2>Add Stock</h2>
              </div>
              <button type="button" className="btn ghost small" onClick={onClose}>
                ×
              </button>
            </div>
            <div className="modal-body stock-start-body">
              <div className="stock-choice-grid">
                <button
                  type="button"
                  className="stock-choice stock-start-choice"
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <span className="stock-choice-icon"><FileUp size={20} /></span>
                  <b>{pendingFiles.length ? 'Add More Invoice Photos' : 'Add Invoice Photos'}</b>
                    <small>Add several invoice photos; all extracted details will appear together on one review page.</small>
                </button>
                <button type="button" className="stock-choice stock-start-choice" onClick={startManualMode}>
                  <span className="stock-choice-icon"><ScanBarcode size={20} /></span>
                  <b>Manual / Barcode Entry</b>
                  <small>Search or scan a product, then enter quantity and prices.</small>
                </button>
              </div>

              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                hidden
                onChange={handleFileChange}
              />

              {pendingFiles.length > 0 && (
                <section className="stock-entry-card" style={{ marginTop: 18 }}>
                  <div className="stock-entry-card-head">
                    <span className="stock-entry-icon"><FileText size={19} /></span>
                    <div><h3>{pendingFiles.length} invoice {pendingFiles.length === 1 ? 'photo' : 'photos'} selected</h3><p>Scan them together to review every invoice on one page.</p></div>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 16px' }}>
                    {pendingFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '7px 0' }}>
                        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{file.name}</span>
                        <button type="button" className="btn ghost small" aria-label={`Remove ${file.name}`} title="Remove this invoice photo" onClick={() => confirmRemovePendingFile(index)}>
                          <X size={15} /> Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn ghost small" onClick={confirmClearPendingFiles}>Clear selection</button>
                    <button type="button" className="btn" onClick={() => processPendingFiles()}>Scan {pendingFiles.length} {pendingFiles.length === 1 ? 'invoice' : 'invoices'}</button>
                  </div>
                </section>
              )}

            </div>
          </>
        )}

        {step === 'processing' && (
          <>
            <div className="modal-head">
              <div>
                <h2>Reading supplier invoice</h2>
              </div>
            </div>
            <div className="modal-body ocr-loading-body" role="status" aria-live="polite">
              <div className="ocr-loading-card">
                <div className="ocr-loading-art" aria-hidden="true">
                  <div className="ocr-loading-orbit ocr-loading-orbit-one" />
                  <div className="ocr-loading-orbit ocr-loading-orbit-two" />
                  <div className="ocr-loading-paper">
                    <FileText size={39} strokeWidth={1.7} />
                    <span className="ocr-loading-paper-line line-one" />
                    <span className="ocr-loading-paper-line line-two" />
                    <span className="ocr-loading-paper-line line-three" />
                    <span className="ocr-loading-beam" />
                  </div>
                  <span className="ocr-loading-scan-icon"><ScanLine size={20} /></span>
                  <span className="ocr-loading-spark spark-one"><Sparkles size={16} /></span>
                  <span className="ocr-loading-spark spark-two"><Sparkles size={12} /></span>
                </div>
                <h3>Reading your invoice</h3>
                <p>We're reading each selected invoice separately and preparing editable drafts for review.</p>
                <div className="ocr-loading-progress" aria-hidden="true"><span /></div>
                <div className="ocr-loading-steps" aria-hidden="true">
                  <span className="done"><i />Image received</span>
                  <span className="active"><i />Reading details</span>
                  <span><i />Preparing review</span>
                </div>
                <small>Nothing is added to stock until you confirm the invoice.</small>
              </div>
            </div>
          </>
        )}

        {step === 'review' && (
          <>
            <div className="modal-head">
              <div>
                <h2>{docInfo ? 'Review Supplier Invoice' : 'Manual & Barcode Stock Entry'}</h2>
                <p>
                  {docInfo
                    ? 'Compare the original document with editable details before posting.'
                    : 'Enter supplier invoice details, scan barcodes or type products, then confirm.'}
                </p>
              </div>
              <button type="button" className="btn ghost small" onClick={onClose}>
                ×
              </button>
            </div>

            <form onSubmit={handleConfirmSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              {docInfo && documentBatch.length > 1 ? (
                <div className="modal-body batch-review-body" style={{ flex: 1 }}>
                  <div className="modal-note" style={{ marginTop: 0 }}>
                    All {documentBatch.length} invoices are on this page. Matching products are grouped and quantities combined; each invoice is still posted as its own receipt.
                  </div>
                  {duplicateBatchImages.length > 0 && <div className="batch-duplicate-warning"><strong>The same invoice photo appears more than once.</strong> Remove the duplicate image from the list before posting; repeated copies would inflate the grouped quantities.</div>}
                  {duplicateBatchInvoices.length > 0 && <div className="batch-duplicate-warning"><strong>Invoice number {duplicateBatchInvoices.join(', ')} appears more than once.</strong> Check whether these are duplicate bills and remove repeated invoices from the list before posting.</div>}
                  <div className="batch-review-layout">
                    <aside className="batch-image-rail" aria-label="Selected invoice images">
                      <h3>Invoices <span>{documentBatch.length}</span></h3>
                      {documentBatch.map((document, documentIndex) => {
                        const draft = document.draft || {};
                        const count = draft.items?.length || 0;
                        return <div key={`${document.name}-${documentIndex}`} className={`batch-image-entry ${activeBatchIndex === documentIndex ? 'active' : ''}`}>
                          <button type="button" className="batch-image-button" onClick={() => setSelectedBatchInvoiceIndex(documentIndex)}>
                            {document.type === 'application/pdf' ? <span className="batch-image-pdf"><FileText size={25} /></span> : <img src={document.url} alt={`Invoice ${documentIndex + 1}`} />}
                            <span className="batch-image-caption"><b>{draft.invoiceNo || `Invoice ${documentIndex + 1}`}</b><small>{count} {count === 1 ? 'row' : 'rows'} · {document.name}</small></span>
                          </button>
                          <button type="button" className="batch-image-remove" aria-label={`Remove ${document.name} from batch`} title="Remove invoice from batch" onClick={() => confirmRemoveBatchInvoice(documentIndex)}><X size={14} /> Remove</button>
                        </div>;
                      })}
                    </aside>
                    <div className="batch-main-column">
                      <div className="batch-profit-toolbar">
                        <label className="field">Profit per unit (Rs.)<NumericInput type="text" min="0" step="0.01" value={bulkProfit} onChange={(event) => setBulkProfit(event.target.value)} placeholder="e.g. 2,000" /></label>
                        <button type="button" className="btn secondary small" onClick={applyProfitToAllSalePrices}>Apply to all sale prices</button>
                        <button type="button" className="btn secondary small" onClick={() => updateBatchDraft(activeBatchIndex, (current) => ({ ...current, items: [...(current.items || []), { name: '', qty: 1, cost: '', lineTotal: '', price: '', warranty: '' }] }))}>+ Add item to selected invoice</button>
                      </div>
                      <section className="batch-invoice-card">
                        <header className="batch-invoice-title"><div><span className="stock-entry-step">Invoice {activeBatchIndex + 1} of {documentBatch.length}</span><h3>{activeBatchInvoice?.name}</h3></div><a href={activeBatchInvoice?.url} target="_blank" rel="noopener noreferrer">View full invoice ↗</a></header>
                        <div className="fields batch-invoice-fields">
                          <label className="field">Supplier name<input required value={activeBatchDraft.supplier || ''} onChange={(event) => updateBatchDraft(activeBatchIndex, { supplier: event.target.value })} placeholder="Supplier" /></label>
                          <label className="field">Supplier invoice number<input required value={activeBatchDraft.invoiceNo || ''} onChange={(event) => updateBatchDraft(activeBatchIndex, { invoiceNo: event.target.value })} placeholder="Invoice number" /></label>
                          <label className="field">Invoice date<input required type="date" value={activeBatchDraft.date || ''} onChange={(event) => updateBatchDraft(activeBatchIndex, { date: event.target.value })} /></label>
                          <label className="field">Invoice total (Rs.)<NumericInput required type="text" min="0" value={activeBatchDraft.invoiceTotal ?? ''} onChange={(event) => updateBatchDraft(activeBatchIndex, { invoiceTotal: event.target.value })} placeholder="Enter written invoice total" /></label>
                        </div>
                        {activeBatchInvoice?.note && <div className="batch-invoice-note">{activeBatchInvoice.note}</div>}
                        <div className="batch-invoice-totals">
                          <span>Invoice item total: <b>{money((activeBatchDraft.items || []).reduce((sum, item) => sum + num(item.qty) * num(item.cost), 0))}</b></span>
                          <span>Written invoice total: <b>{activeBatchDraft.invoiceTotal === '' || activeBatchDraft.invoiceTotal === undefined ? 'Enter total' : money(num(activeBatchDraft.invoiceTotal))}</b></span>
                          {(activeBatchDraft.invoiceTotal !== '' && activeBatchDraft.invoiceTotal !== undefined) && Math.abs((activeBatchDraft.items || []).reduce((sum, item) => sum + num(item.qty) * num(item.cost), 0) - num(activeBatchDraft.invoiceTotal)) > 0.005 && <strong className="batch-total-warning">Invoice totals differ by {money(Math.abs((activeBatchDraft.items || []).reduce((sum, item) => sum + num(item.qty) * num(item.cost), 0) - num(activeBatchDraft.invoiceTotal)))}.</strong>}
                          <label>Payment<select value={activeBatchDraft.paymentMethod || 'credit'} onChange={(event) => updateBatchDraft(activeBatchIndex, { paymentMethod: event.target.value, ...(event.target.value === 'credit' ? { paidNow: '0' } : {}) })}><option value="credit">Supplier credit</option><option value="cash">Cash</option><option value="bank">Bank transfer</option><option value="other">Other funds</option></select></label>
                          <label>Paid now (Rs.)<NumericInput type="text" min="0" value={activeBatchDraft.paidNow ?? '0'} disabled={(activeBatchDraft.paymentMethod || 'credit') === 'credit'} onChange={(event) => updateBatchDraft(activeBatchIndex, { paidNow: event.target.value })} /></label>
                          {activeBatchDraft.paymentMethod === 'bank' && <label>Bank account<select value={activeBatchDraft.bankName || ''} onChange={(event) => updateBatchDraft(activeBatchIndex, { bankName: event.target.value })}><option value="">Select an account</option>{bankAccounts.filter((account) => account.active !== false).map((account) => <option key={account.id} value={account.bankName}>{account.bankName}</option>)}</select></label>}
                        </div>
                      </section>
                      <section className="batch-invoice-card batch-products-card">
                        <header className="batch-invoice-title"><div><h3>Combined products</h3><small>Across all {documentBatch.length} selected invoices; matching product/model rows appear once with quantities added together.</small></div><span className="tag">{batchProductGroups.length} products · {batchProductGroups.reduce((sum, group) => sum + group.qty, 0)} units</span></header>
                        <div className="table-wrap batch-group-table"><table className="table">
                          <thead><tr><th>Product</th><th>Total qty</th><th>Avg. cost</th><th>Written amount</th><th>Sale price</th><th>Warranty</th><th>Invoice rows</th></tr></thead>
                          <tbody>{batchProductGroups.map((group) => <React.Fragment key={group.key}><tr>
                            <td><input aria-label="Combined product name" value={group.name} onChange={(event) => updateBatchProductGroup(group, { name: event.target.value })} placeholder="Product name" /></td>
                            <td><b>{group.qty}</b></td><td>{group.averageCost ? money(group.averageCost) : '—'}</td><td>{money(group.writtenAmount)}</td>
                            <td><NumericInput type="text" min="0.01" aria-label={`Sale price for ${group.name}`} placeholder="Sale price" value={group.averageSalePrice} onChange={(event) => updateBatchProductGroup(group, { price: event.target.value })} /></td>
                            <td><select className="batch-warranty-select" aria-label={`Warranty for ${group.name}`} value={group.warranty} onChange={(event) => updateBatchProductGroup(group, { warranty: event.target.value })}><option value="">No warranty</option><option value="__mixed__" disabled>Mixed — edit rows</option>{WARRANTY_MONTHS.map((warranty) => <option key={warranty} value={warranty}>{warranty}</option>)}</select>{group.mixedWarranty && <small className="batch-warranty-note">Different by invoice row</small>}</td>
                            <td><details className="batch-source-details"><summary>{group.sources.length} {group.sources.length === 1 ? 'row' : 'rows'} · edit</summary>{group.sources.map((source) => {
                              const item = documentBatch[source.documentIndex]?.draft?.items?.[source.itemIndex] || {};
                              const setSourceItem = (key, value) => updateBatchDraft(source.documentIndex, (current) => ({ ...current, items: (current.items || []).map((entry, index) => index === source.itemIndex ? { ...entry, [key]: value } : entry) }));
                              return <div className="batch-source-row" key={`${source.documentIndex}-${source.itemIndex}`}><button type="button" className="batch-source-link" onClick={() => setSelectedBatchInvoiceIndex(source.documentIndex)}>{documentBatch[source.documentIndex]?.draft?.invoiceNo || `Invoice ${source.documentIndex + 1}`}</button><label>Qty<NumericInput type="text" min="1" step="1" value={item.qty ?? ''} onChange={(event) => setSourceItem('qty', event.target.value)} /></label><label>Cost<NumericInput type="text" min="0.01" value={item.cost ?? ''} onChange={(event) => setSourceItem('cost', event.target.value)} /></label><label>Amount<NumericInput type="text" min="0" value={item.lineTotal ?? ''} onChange={(event) => setSourceItem('lineTotal', event.target.value)} /></label><label>Warranty<select value={item.warranty || ''} onChange={(event) => setSourceItem('warranty', event.target.value)}><option value="">None</option>{WARRANTY_MONTHS.map((warranty) => <option key={warranty} value={warranty}>{warranty}</option>)}</select></label><button type="button" className="icon-btn" aria-label="Remove this invoice product row" onClick={() => updateBatchDraft(source.documentIndex, (current) => ({ ...current, items: (current.items || []).filter((_, index) => index !== source.itemIndex) }))}>×</button></div>;
                            })}</details></td>
                          </tr>{group.sources.some((source) => documentBatch[source.documentIndex]?.draft?.items?.[source.itemIndex]?.reviewNote) && <tr><td colSpan="7"><small className="stock-review-warning">{Array.from(new Set(group.sources.map((source) => documentBatch[source.documentIndex]?.draft?.items?.[source.itemIndex]?.reviewNote).filter(Boolean))).join(' · ')}</small></td></tr>}</React.Fragment>)}</tbody>
                        </table>{batchProductGroups.length === 0 && <div className="empty batch-empty">No product rows read yet. Add rows to the selected invoice or retry its scan.<button type="button" className="btn secondary small" disabled={retryingBatchIndex !== null} onClick={() => retryBatchInvoice(activeBatchIndex)}>{retryingBatchIndex === activeBatchIndex ? 'Retrying…' : 'Retry selected invoice'}</button></div>}</div>
                      </section>
                    </div>
                  </div>
                </div>
              ) : (
              <div className="modal-body" style={{ flex: 1 }}>
                {docInfo && documentBatch.length > 1 && (
                  <div className="stock-batch-nav" aria-label="Invoice batch navigation">
                    <button type="button" className="btn secondary small" onClick={() => switchBatchInvoice(documentBatchIndex - 1)} disabled={documentBatchIndex === 0}>Previous</button>
                    <strong>Invoice {documentBatchIndex + 1} of {documentBatch.length}<span>{docInfo.name}</span></strong>
                    <button type="button" className="btn secondary small" onClick={() => switchBatchInvoice(documentBatchIndex + 1)} disabled={documentBatchIndex === documentBatch.length - 1}>Next</button>
                  </div>
                )}
                {limitationNote && (
                  <div className="modal-note" style={{ marginTop: 0, marginBottom: 14 }}>
                    {limitationNote}
                    {docInfo && stockDraft.length === 0 && (
                      <button type="button" className="btn secondary small" style={{ marginLeft: 12 }}
                        onClick={async () => {
                          try {
                            const response = await fetch(docInfo.url);
                            const blob = await response.blob();
                            const file = new File([blob], docInfo.name, { type: docInfo.type });
                            const { dataUrl, detailDataUrl, textDataUrl, headerDataUrl, mimeType } = await prepareInvoiceData(file);
                            const res = await apiRequest('/ocr/invoice', {
                              method: 'POST', signal: AbortSignal.timeout(120000),
                              body: { dataUrl, detailDataUrl, textDataUrl, headerDataUrl, fileName: file.name, mimeType },
                            });
                            const updated = documentBatch.map((doc, index) => index === documentBatchIndex
                              ? { ...doc, draft: res.draft || {}, note: res.limitationNote || '' }
                              : doc);
                            setDocumentBatch(updated);
                            setDocInfo(updated[documentBatchIndex]);
                            setLimitationNote(`Invoice ${documentBatchIndex + 1} of ${updated.length}. ${res.limitationNote || ''}`.trim());
                            loadDraftIntoForm(res.draft || {});
                          } catch {
                            showAlert('Could not retry', 'Go Back and select the invoice again.', 'warning');
                          }
                        }}>
                        Retry reading invoice
                      </button>
                    )}
                  </div>
                )}

                <div className={docInfo ? 'stock-review-layout' : ''}>
                  {docInfo && (
                    <aside className="invoice-source">
                      <div className="invoice-source-head">
                        <span>INVOICE PREVIEW</span>
                        <span>{docInfo.name}</span>
                        <a href={docInfo.url} target="_blank" rel="noopener noreferrer">View full invoice ↗</a>
                      </div>
                      <div className="invoice-source-view">
                        {docInfo.type === 'application/pdf' ? (
                          <embed src={docInfo.url} type="application/pdf" />
                        ) : (
                          <img src={docInfo.url} alt="Original supplier invoice" />
                        )}
                      </div>
                    </aside>
                  )}

                  <div className="stack stock-entry-sections">
                    {/* 1. Supplier & Invoice Header */}
                    <section className="stock-entry-card stock-entry-supplier">
                      <div className="stock-entry-card-head">
                        <span className="stock-entry-icon"><FileText size={19} /></span>
                        <div><h3>Supplier & Invoice</h3><p>Who supplied the stock and invoice details.</p></div>
                        <span className="stock-entry-step">01</span>
                      </div>
                      <div className="fields">
                        <label className="field">
                          Supplier name
                          <input
                            list="supplier-datalist"
                            required
                            value={supplier}
                            onChange={(e) => setSupplier(e.target.value)}
                            placeholder="Supplier / سپلائر"
                          />
                          <datalist id="supplier-datalist">
                            {suppliers.map((s) => (
                              <option key={s.id} value={s.name} />
                            ))}
                          </datalist>
                        </label>
                        <label className="field">
                          Supplier invoice number
                          <input
                            required
                            value={invoiceNo}
                            onChange={(e) => setInvoiceNo(e.target.value)}
                            placeholder="e.g. SUP-1022"
                          />
                        </label>
                        <label className="field">
                          Invoice date
                          <input
                            type="date"
                            required
                            value={invoiceDate}
                            onChange={(e) => setInvoiceDate(e.target.value)}
                          />
                        </label>
                        <label className="field">
                          Invoice total (Rs.)
                          <NumericInput
                            type="text"
                            min="0"
                            required
                            value={invoiceTotal}
                            onChange={(e) => setInvoiceTotal(e.target.value)}
                            placeholder="0"
                          />
                        </label>
                      </div>
                    </section>

                    {/* 2. Item Composer with Barcode Scanner Support */}
                    {!docInfo && <section className="stock-entry-card stock-entry-product">
                      <div className="stock-entry-card-head">
                        <span className="stock-entry-icon"><PackagePlus size={19} /></span>
                        <div><h3>Product Entry</h3><p>Scan an existing item or enter a new product.</p></div>
                        <span className="stock-entry-step">02</span>
                      </div>
                    <div className="stock-composer">
                      <label className="si-product">
                        Product / Model or Scan Barcode (Press Enter)
                        <input
                          ref={productInputRef}
                          value={siProduct}
                          onChange={(e) => {
                            setSiProduct(e.target.value);
                            setSelectedProductId(null);
                            setShowSuggest(true);
                          }}
                          onFocus={() => setShowSuggest(true)}
                          onBlur={() => setTimeout(() => setShowSuggest(false), 180)}
                          onKeyDown={handleProductKeyDown}
                          placeholder="Scan USB/Bluetooth barcode or type product name..."
                          autoComplete="off"
                        />
                        {showSuggest && siProduct.trim() && (
                          <div
                            className="suggestions show"
                            style={{ top: '100%', marginTop: 4 }}
                          >
                            {matchingProducts.length > 0 ? (
                              matchingProducts.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  className="suggestion"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    pickSuggestion(p);
                                  }}
                                >
                                  <b>{p.name}</b>
                                  <small>
                                    SKU: {p.code} · In stock: {p.stock} · Cost: {money(p.cost)}
                                  </small>
                                </button>
                              ))
                            ) : (
                              <div className="suggestion">
                                New product — “{siProduct.trim()}” will be created automatically
                              </div>
                            )}
                          </div>
                        )}
                      </label>

                      <label>
                        Barcode / SKU (optional)
                        <input
                          value={siCode}
                          onChange={(e) => setSiCode(e.target.value)}
                          placeholder="Auto or scan"
                        />
                      </label>

                      <label>
                        Qty
                        <NumericInput
                          ref={qtyInputRef}
                          type="text"
                          min="1"
                          step="1"
                          value={siQty}
                          onChange={(e) => setSiQty(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              costInputRef.current?.focus();
                            }
                          }}
                          placeholder="1"
                        />
                      </label>

                      <label>
                        Purchase Cost (Rs.)
                        <NumericInput
                          ref={costInputRef}
                          type="text"
                          min="1"
                          value={siCost}
                          onChange={(e) => setSiCost(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              document.getElementById('stock-sale-price')?.focus();
                            }
                          }}
                          placeholder="0"
                        />
                      </label>

                      <label>
                        Sale Price (Rs.)
                        <NumericInput
                          id="stock-sale-price"
                          type="text"
                          min="0.01"
                          step="0.01"
                          value={siPrice}
                          onChange={(e) => setSiPrice(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddDraftItem();
                            }
                          }}
                          placeholder="Enter sale price"
                        />
                      </label>

                      <label>
                        Warranty (optional)
                        <select value={siWarranty} onChange={(e) => setSiWarranty(e.target.value)}>
                          <option value="">No warranty selected</option>
                          {WARRANTY_MONTHS.map((warranty) => <option key={warranty} value={warranty}>{warranty}</option>)}
                        </select>
                      </label>

                      <div style={{ display: 'flex', alignItems: 'flex-end', gridColumn: 'span 2' }}>
                        <button
                          type="button"
                          className="btn"
                          style={{ width: '100%' }}
                          onClick={handleAddDraftItem}
                        >
                          + Add item to invoice
                        </button>
                      </div>

                      {composerErr && (
                        <p style={{ gridColumn: '1 / -1', margin: 0, color: '#b4372d', fontSize: 12, fontWeight: 700 }}>
                          {composerErr}
                        </p>
                      )}
                      <p className="muted tiny" style={{ gridColumn: '1 / -1', margin: 0 }}>
                        Tip: USB/Bluetooth barcode scanners automatically match by SKU/barcode on Enter. Type <b>//</b> to copy from the last item.
                      </p>
                    </div>
                    </section>}

                    {/* 3. Added Items List & Validation */}
                    <section className="stock-entry-card stock-entry-items">
                      <div className="stock-entry-card-head">
                        <span className="stock-entry-icon"><ListChecks size={19} /></span>
                        <div><h3>{docInfo ? 'Extracted Products' : 'Added Products'}</h3><p>{docInfo ? 'Review each extracted row and enter its sale price.' : 'Products you add manually appear here.'}</p></div>
                        <span className="tag">{stockDraft.length} items</span>
                      </div>

                      {docInfo ? (
                        <>
                          <div className="stock-extracted-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <span>Review item details</span>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                              <label className="field" style={{ margin: 0, minWidth: 180 }}>
                                Profit per unit (Rs.)
                                <NumericInput type="text" min="0" step="0.01" value={bulkProfit} onChange={(event) => setBulkProfit(event.target.value)} placeholder="e.g. 2,000" />
                              </label>
                              <button type="button" className="btn secondary small" onClick={applyProfitToAllSalePrices}>Apply to all sale prices</button>
                              <button type="button" className="btn secondary small" onClick={() => setStockDraft((items) => [...items, { name: '', code: '', qty: 1, cost: '', price: '', warranty: '' }])}>+ Add missing item</button>
                            </div>
                          </div>
                          <div className="table-wrap stock-extracted-table">
                            <table className="table">
                              <thead><tr><th>Product</th><th>Qty</th><th>Purchase cost</th><th className="sale-column">Sale price</th><th>Amount</th><th /></tr></thead>
                              <tbody>
                                {stockDraft.map((item, index) => {
                                  const update = (key, value) => setStockDraft((items) => items.map((row, i) => i === index ? { ...row, [key]: value } : row));
                                  return <tr key={index}>
                                    <td><input aria-label={`Product name, row ${index + 1}`} placeholder="Product name" value={item.name} onChange={(e) => update('name', e.target.value)} />
                                      <select className="stock-row-warranty" aria-label={`Warranty for row ${index + 1}`} value={item.warranty || ''} onChange={(e) => update('warranty', e.target.value)}>
                                        <option value="">Warranty (optional)</option>
                                        {WARRANTY_MONTHS.map((warranty) => <option key={warranty} value={warranty}>{warranty}</option>)}
                                      </select>
                                      {item.reviewNote && <small className="stock-review-warning">{item.reviewNote}</small>}
                                    </td>
                                    <td><NumericInput type="text" min="1" step="1" aria-label={`Quantity, row ${index + 1}`} value={item.qty} onChange={(e) => update('qty', e.target.value)} /></td>
                                    <td><NumericInput type="text" min="0.01" step="0.01" aria-label={`Purchase cost, row ${index + 1}`} value={item.cost} onChange={(e) => update('cost', e.target.value)} /></td>
                                    <td className="sale-column"><NumericInput type="text" min="0.01" step="0.01" aria-label={`Sale price, row ${index + 1}`} placeholder="Enter price" value={item.price ?? ''} onChange={(e) => update('price', e.target.value)} /></td>
                                    <td><strong>{money(num(item.qty) * num(item.cost))}</strong></td>
                                    <td><button type="button" className="icon-btn" aria-label={`Remove item ${index + 1}`} onClick={() => handleRemoveDraftItem(index)}>×</button></td>
                                  </tr>;
                                })}
                              </tbody>
                            </table>
                            {stockDraft.length === 0 && <div className="empty">No products were read. Retry invoice reading or add a missing item above.</div>}
                          </div>
                        </>
                      ) : stockDraft.length === 0 ? (
                        <div className="empty">
                          No items added yet. Fill in the product above and press <b>+ Add item to invoice</b>.
                        </div>
                      ) : (
                        <div className="stock-cards">
                          {stockDraft.map((it, idx) => (
                            <div key={idx} className="stock-card">
                              <div>
                                <b style={{ display: 'block', fontSize: 13, color: '#12303f' }}>
                                  {it.name || 'Product name needs review'}
                                </b>
                                <span style={{ fontSize: 11.5, color: '#667985' }}>
                                  {it.qty} × {money(it.cost)}
                                </span>
                                {it.reviewNote && <p className="tiny" style={{ color: '#98651a', margin: '5px 0 0' }}>{it.reviewNote}</p>}
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <strong style={{ display: 'block', fontSize: 13, color: '#12303f' }}>
                                  {money(it.qty * it.cost)}
                                </strong>
                                <label className="stock-item-sale-price">
                                  Sale Price (Rs.)
                                  <NumericInput
                                    type="text"
                                    min="0.01"
                                    step="0.01"
                                    aria-label={`Sale price for ${it.name || `item ${idx + 1}`}`}
                                    placeholder="Enter sale price"
                                    value={it.price ?? ''}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      setStockDraft((items) => items.map((item, index) => index === idx ? { ...item, price: value } : item));
                                    }}
                                  />
                                </label>
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 4 }}>
                                  <button
                                    type="button"
                                    className="icon-btn"
                                    onClick={() => handleEditDraftItem(idx)}
                                    aria-label={`Edit ${it.name}`}
                                  >
                                    ✎
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-btn"
                                    onClick={() => handleRemoveDraftItem(idx)}
                                    aria-label={`Remove ${it.name}`}
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: 12,
                          paddingTop: 10,
                          borderTop: '1px solid var(--line)',
                          fontSize: 13,
                        }}
                      >
                        <span>Calculated Items Total</span>
                        <b style={{ fontSize: 16, color: '#12708f' }}>{money(itemsTotal)}</b>
                      </div>

                      <div className="stock-validation">
                        <div className={`check-box ${totalMatches ? '' : 'warning'}`}>
                          {totalMatches
                            ? '✓ Invoice total matches item lines'
                            : `! Difference: ${money(Math.abs(itemsTotal - statedTotal))}`}
                        </div>
                        <div className={`check-box ${isDuplicate ? 'danger' : ''}`}>
                          {isDuplicate
                            ? '! Duplicate supplier invoice detected'
                            : '✓ No duplicate invoice found'}
                        </div>
                      </div>
                    </section>

                    {/* 4. Supplier Payment Details */}
                    <section className="stock-entry-card stock-entry-payment">
                      <div className="stock-entry-card-head">
                        <span className="stock-entry-icon"><Wallet size={19} /></span>
                        <div><h3>Payment & Supplier Credit</h3><p>Choose how much to pay and how to pay it.</p></div>
                        <span className="stock-entry-step">04</span>
                      </div>
                      <div className="fields">
                        <label className="field">
                          Payment method
                          <select
                            value={paymentMethod}
                            onChange={(e) => {
                              setPaymentMethod(e.target.value);
                              if (e.target.value === 'credit') setPaidNow('0');
                            }}
                          >
                            <option value="credit">Supplier Credit (Pay Later)</option>
                            <option value="cash">Cash</option>
                            <option value="bank">Bank Transfer</option>
                            <option value="other">Other funds (outside drawer)</option>
                          </select>
                        </label>
                        <label className="field">
                          Paid now (Rs.)
                          <NumericInput
                            type="text"
                            min="0"
                            value={paidNow}
                            disabled={paymentMethod === 'credit'}
                            onChange={(e) => setPaidNow(e.target.value)}
                          />
                        </label>
                        {paymentMethod === 'bank' && (
                          <label className="field">
                            Bank account
                            <select value={bankName} onChange={(e) => setBankName(e.target.value)}>
                              <option value="">Select an account</option>
                              {bankAccounts.filter((b) => b.active !== false).map((b) => (
                                <option key={b.id} value={b.bankName}>
                                  {b.bankName} ({money(b.balance)})
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <label className="field">
                          Payment reference (optional)
                          <input
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="Optional reference"
                          />
                        </label>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginTop: 10,
                          padding: '10px 12px',
                          borderRadius: 9,
                          background: '#eef7fa',
                          fontSize: 12,
                          color: '#35586c',
                        }}
                      >
                        <span>Supplier account payable added after confirmation</span>
                        <b style={{ color: '#12708f' }}>{money(supplierPayableImpact)} payable</b>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={onClose}>
                  Cancel
                </button>
                <button type="button" className="btn secondary" onClick={() => setStep('choose')}>
                  Back
                </button>
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? 'Posting Stock...' : docInfo && documentBatch.length > 1 ? `Confirm & Add All ${documentBatch.length} Invoices` : 'Confirm & Add Stock'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

