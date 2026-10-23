import React, { useState, useRef, useEffect } from 'react';
import { FileUp, ScanBarcode, FileText, PackagePlus, ListChecks, Wallet, ScanLine, Sparkles } from 'lucide-react';
import { apiRequest, money, num } from '../../api.js';
import { matchProduct } from '../../../../shared/productMatching.js';

const WARRANTY_MONTHS = Array.from({ length: 16 }, (_, index) => `${(index + 1) * 3} Months`);

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
  const [limitationNote, setLimitationNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  // Payment fields
  const [paymentMethod, setPaymentMethod] = useState('credit');
  const [paidNow, setPaidNow] = useState('0');
  const [bankName, setBankName] = useState('HBL');
  const [paymentReference, setPaymentReference] = useState('');

  const uploadInputRef = useRef(null);
  const productInputRef = useRef(null);
  const qtyInputRef = useRef(null);
  const costInputRef = useRef(null);
  const postingRef = useRef(false);
  useEffect(() => () => { if (docInfo?.url) URL.revokeObjectURL(docInfo.url); }, [docInfo?.url]);

  function handleFileChange(e, mode) {
    const file = e.target.files?.[0];
    e.target.value = ''; // Allow selecting the same invoice after Back or an error.
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      showAlert('Unsupported document', 'Choose a JPEG, PNG, WebP image or PDF.', 'warning');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showAlert('File too large', 'Please upload an image or PDF smaller than 10 MB.', 'warning');
      return;
    }

    const url = URL.createObjectURL(file);
    setStockDraft([]);
    setSupplier(''); setInvoiceNo(''); setInvoiceDate(''); setInvoiceTotal('');
    setSiProduct(''); setSiCode(''); setSiQty(''); setSiCost(''); setSiPrice(''); setSiWarranty('');
    setSelectedProductId(null); setEditingDraftIndex(null); setComposerErr('');
    setPaymentMethod('credit'); setPaidNow('0'); setPaymentReference('');
    setStep('processing');

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      try {
        const res = await apiRequest('/ocr/invoice', {
          method: 'POST',
          signal: AbortSignal.timeout(75000),
          body: {
            dataUrl,
            fileName: file.name,
            mimeType: file.type || 'image/jpeg',
          },
        });
        const draft = res.draft || {};
        setDocInfo({
          name: file.name,
          type: file.type,
          url,
          dataUrl,
          mode,
        });
        setLimitationNote(res.limitationNote || '');
        setSupplier(draft.supplier || '');
        setInvoiceNo(draft.invoiceNo || '');
        setInvoiceDate(draft.date || '');
        setInvoiceTotal(String(draft.invoiceTotal ?? ''));
        setStockDraft(
          (Array.isArray(draft.items) ? draft.items : []).filter((x) => x && typeof x === 'object').map((x) => {
            const extractedCode = String(x.code || '').trim();
            return {
              name: String(x.name || ''),
              // Short numeric OCR fragments are usually row/HSN values, not barcodes.
              code: /^\d{1,6}$/.test(extractedCode) ? '' : extractedCode,
              qty: x.qty ?? '',
              cost: x.cost ?? '',
              price: x.price ?? '',
              warranty: WARRANTY_MONTHS.includes(String(x.warranty || '').trim()) ? String(x.warranty).trim() : '',
              reviewNote: String(x.reviewNote || ''),
            };
          })
        );
        setStep('review');
      } catch (err) {
        setDocInfo({ name: file.name, type: file.type, url, dataUrl, mode });
        setStockDraft([]);
        setSupplier('');
        setInvoiceNo('');
        setInvoiceTotal('');
        setLimitationNote(err.name === 'TimeoutError' || err.name === 'AbortError'
          ? 'Invoice reading took too long. Upload the invoice again to retry, or enter its items manually. No stock was saved.'
          : `Invoice reading failed: ${err.message}. Upload again to retry, or enter its items manually. No stock was saved.`);
        setStep('review');
      }
    };
    reader.onerror = () => {
      setDocInfo({ name: file.name, type: file.type, url, mode });
      setLimitationNote('File could not be read. Enter the supplier invoice manually beside the preview.');
      setStep('review');
    };
    reader.readAsDataURL(file);
  }

  function startManualMode() {
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
          return (
            String(p.name || '').toLowerCase().includes(q) ||
            String(p.code || '').toLowerCase().includes(q) ||
            String(p.barcode || '').toLowerCase().includes(q)
          );
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

  async function handleConfirmSubmit(e) {
    e.preventDefault();
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

    postingRef.current = true;
    setSubmitting(true);
    try {
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
          documentDataUrl: docInfo?.dataUrl || '',
          ocrDraftUsed: Boolean(docInfo),
        },
      });
      await onSuccess(supplier.trim());
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
                  <b>Upload Invoice</b>
                  <small>Choose an invoice image or PDF.</small>
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
                hidden
                onChange={(e) => handleFileChange(e, 'upload')}
              />

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
                <p>We’re scanning the image and preparing an editable draft for you to review.</p>
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
              <div className="modal-body" style={{ flex: 1 }}>
                {limitationNote && (
                  <div className="modal-note" style={{ marginTop: 0, marginBottom: 14 }}>
                    {limitationNote}
                    {docInfo && stockDraft.length === 0 && (
                      <button type="button" className="btn secondary small" style={{ marginLeft: 12 }}
                        onClick={async () => {
                          try {
                            const blob = await (await fetch(docInfo.url)).blob();
                            const file = new File([blob], docInfo.name, { type: docInfo.type });
                            handleFileChange({ target: { files: [file], value: '' } }, docInfo.mode);
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
                          <input
                            type="number"
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
                        <input
                          ref={qtyInputRef}
                          type="number"
                          min="1"
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
                        <input
                          ref={costInputRef}
                          type="number"
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
                        <input
                          id="stock-sale-price"
                          type="number"
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
                          <div className="stock-extracted-toolbar">
                            <span>Review item details</span>
                            <button type="button" className="btn secondary small" onClick={() => setStockDraft((items) => [...items, { name: '', code: '', qty: 1, cost: '', price: '', warranty: '' }])}>+ Add missing item</button>
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
                                    <td><input type="number" min="1" step="1" aria-label={`Quantity, row ${index + 1}`} value={item.qty} onChange={(e) => update('qty', e.target.value)} /></td>
                                    <td><input type="number" min="0.01" step="0.01" aria-label={`Purchase cost, row ${index + 1}`} value={item.cost} onChange={(e) => update('cost', e.target.value)} /></td>
                                    <td className="sale-column"><input type="number" min="0.01" step="0.01" aria-label={`Sale price, row ${index + 1}`} placeholder="Enter price" value={item.price ?? ''} onChange={(e) => update('price', e.target.value)} /></td>
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
                                  <input
                                    type="number"
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
                          </select>
                        </label>
                        <label className="field">
                          Paid now (Rs.)
                          <input
                            type="number"
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
                              {bankAccounts.map((b) => (
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

              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={onClose}>
                  Cancel
                </button>
                <button type="button" className="btn secondary" onClick={() => setStep('choose')}>
                  Back
                </button>
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? 'Posting Stock...' : 'Confirm & Add Stock'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
