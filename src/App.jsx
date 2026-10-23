import NewSalePage from './pages/new-sale/NewSalePage.jsx';
import DashboardPage from './pages/dashboard/DashboardPage.jsx';
import InstallmentKhataPage from './pages/installment-khata/InstallmentKhataPage.jsx';
import StockProductsPage from './pages/stock-products/StockProductsPage.jsx';
import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Plus,
  FileText,
  Users,
  CalendarClock,
  Package,
  Landmark,
  TrendingDown,
  BarChart3,
  Settings,
  Search,
  Download,
} from 'lucide-react';
import { apiRequest, setSessionToken, money, num } from './api.js';
import { buildWhatsAppInvoiceShare } from './utils/pdfGenerator.js';
import SalesInvoiceA5 from './invoices/SalesInvoiceA5.jsx';
import InstallmentInvoiceA5 from './invoices/InstallmentInvoiceA5.jsx';
import { toInvoiceModel } from './invoices/invoiceData.js';
import AuthView from './pages/auth/AuthPage.jsx';
import StockReceivePage from './pages/receive-stock/ReceiveStockPage.jsx';
import BillsView from './pages/bills/BillsPage.jsx';
import CustomersView from './pages/customers/CustomersPage.jsx';
import ReturnsView from './pages/customer-returns/CustomerReturnsPage.jsx';
import OrdersView from './pages/held-orders/HeldOrdersPage.jsx';
import SuppliersView from './pages/suppliers/SuppliersPage.jsx';
import FinanceView from './pages/finance/FinancePage.jsx';
import ExpensesView from './pages/expenses/ExpensesPage.jsx';
import ReportsView from './pages/reports/ReportsPage.jsx';
import SettingsView from './pages/settings/SettingsPage.jsx';
import OverviewPage from './pages/overview/OverviewPage.jsx';

const BANK_CARDS = [
  ['Easypaisa', 'easypaisa'],
  ['Meezan Bank', 'meezan-bank'],
  ['Faysal Bank', 'faysal-bank'],
  ['Allied Bank', 'allied-bank'],
  ['UBL', 'ubl'],
  ['HBL', 'hbl'],
];

const LEGACY_WARRANTY_DEFAULTS = new Set(['12 months', '12 months official']);
const optionalWarrantyValue = (value) => {
  const warranty = String(value || '').trim();
  return LEGACY_WARRANTY_DEFAULTS.has(warranty.toLowerCase()) ? '' : warranty;
};

function compressInstallmentPhoto(file) {
  if (!file) return Promise.resolve('');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return Promise.reject(new Error('Choose a JPG, PNG, or WebP photo.'));
  }
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) return reject(new Error('Could not process this photo.'));
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read this photo. Choose another image.'));
    };
    image.src = objectUrl;
  });
}

function InstallmentPhotoField({ name, label, value = '' }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(value);
  const [cleared, setCleared] = useState(false);
  return (
    <div className="installment-photo-field">
      <label className="field">
        {label} (optional)
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : value);
            setCleared(false);
          }}
        />
      </label>
      <input type="hidden" name={`${name}Clear`} value={cleared ? 'true' : 'false'} />
      {preview && (
        <div className="installment-photo-preview">
          <img src={preview} alt={`${label} preview`} />
          <button
            type="button"
            className="btn ghost small"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = '';
              setPreview('');
              setCleared(true);
            }}
          >
            Remove photo
          </button>
        </div>
      )}
    </div>
  );
}

const PAGE_GROUPS = [
  { label: 'Customers & Khata', pages: [['customers', 'Customers'], ['khata', 'Installment Khata']] },
  { label: 'Stock & Suppliers', pages: [['stock', 'Stock & Products'], ['suppliers', 'Supplier Accounts']] },
  { label: 'Finance & Expenses', pages: [['finance', 'Finance & Banks'], ['expenses', 'Shop Expenses']] },
];

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  // Tenant Workspace Data
  const [data, setData] = useState({
    shop: { name: 'ElectroHub Electronics', whatsapp: '+923005552711', currency: 'PKR' },
    user: { name: 'Faraz · Admin', role: 'owner' },
    users: [],
    products: [],
    customers: [],
    suppliers: [],
    sales: [],
    installmentPlans: [],
    installmentPayments: [],
    stockReceipts: [],
    stockMovements: [],
    expenses: [],
    bankAccounts: [],
    financialTransactions: [],
    customerReturns: [],
    heldOrders: [],
    auditEvents: [],
    summary: {},
  });

  // Navigation & UI Shell State
  const [page, setPage] = useState('sale');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  useEffect(() => {
    if (!sidebarOpen) return;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [sidebarOpen]);
  const [sweetAlert, setSweetAlert] = useState(null); // { title, message, type, confirmLabel, onConfirm }

  // New Sale State (matching attached UI Redesign)
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState('walkin');
  const [salePhone, setSalePhone] = useState('');
  const [saleCnic, setSaleCnic] = useState('');
  const [saleAddress, setSaleAddress] = useState('');
  const [customerInfo, setCustomerInfo] = useState(null);
  const [billDiscount, setBillDiscount] = useState(0);
  const [saleType, setSaleType] = useState('cash');
  const [plan, setPlan] = useState({ months: 12, advance: 15000, percent: 10 });
  const [salePayment, setSalePayment] = useState({
    method: 'cash',
    cash: '0',
    bank: '0',
    bankName: 'HBL',
    bankAccount: '',
  });

  // Add-item form on New Sale
  const [productSearch, setProductSearch] = useState('');
  const [selectedSearchProductId, setSelectedSearchProductId] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newPrice, setNewPrice] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [savingSale, setSavingSale] = useState(false);

  // Dashboard date filter
  const [dashPeriod, setDashPeriod] = useState('all'); // 'all' | 'today' | 'month'

  // Installment Khata state
  const [khataSearch, setKhataSearch] = useState('');
  const [showAddInstallmentModal, setShowAddInstallmentModal] = useState(false);
  const [activeKhataPlan, setActiveKhataPlan] = useState(null);
  const [khataPayAmount, setKhataPayAmount] = useState('');
  const [khataPayMethod, setKhataPayMethod] = useState('cash');
  const [khataPayBank, setKhataPayBank] = useState('HBL');
  const [khataPayNote, setKhataPayNote] = useState('');

  // Stock & Products state
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryChip, setInventoryChip] = useState('all');
  const [stockTab, setStockTab] = useState('products'); // 'products' | 'movements' | 'invoices'
  const [editingProduct, setEditingProduct] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);

  // Modals on New Sale / Customers
  const [showInstallmentCustomerModal, setShowInstallmentCustomerModal] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [editingCustomerRecord, setEditingCustomerRecord] = useState(null);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [whatsAppShareInfo, setWhatsAppShareInfo] = useState(null);

  function notify(msg) {
    setToastMsg(msg);
  }

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(''), 3200);
    return () => clearTimeout(t);
  }, [toastMsg]);

  function showAlert(title, message, type = 'success', confirmLabel = null, onConfirm = null) {
    setSweetAlert({ title, message, type, confirmLabel, onConfirm });
  }

  async function refreshWorkspace(role = data.user?.role) {
    const boot = await apiRequest(role === 'overview_viewer' ? '/overview' : '/bootstrap');
    setData(boot);
  }

  useEffect(() => {
    async function initAuth() {
      try {
        const me = await apiRequest('/auth/me');
        if (me.authenticated) {
          setAuthenticated(true);
          setData((current) => ({ ...current, shop: me.shop, user: me.user }));
          await refreshWorkspace(me.user?.role);
        }
      } catch (err) {
        console.error('Auth check error:', err);
      } finally {
        setAuthLoading(false);
      }
    }
    initAuth();
  }, []);

  async function handleAuthenticated(session) {
    setAuthenticated(true);
    if (session?.user) setData((current) => ({ ...current, user: session.user, shop: session.shop || current.shop }));
    await refreshWorkspace(session?.user?.role);
  }

  async function handleLogout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setSessionToken(null);
    setAuthenticated(false);
  }

  // Current selected customer helper
  const selectedCustomerObj =
    customerId === 'walkin' || customerId === 'new'
      ? { name: 'Walk-in customer', phone: salePhone, cnic: saleCnic, address: saleAddress }
      : data.customers.find((c) => c.id === customerId) || {
          name: 'Walk-in customer',
          phone: salePhone,
          cnic: saleCnic,
          address: saleAddress,
        };

  // Calculate live sale totals
  const gross = cart.reduce((s, i) => s + num(i.price) * Math.max(1, num(i.qty)), 0);
  const appliedDiscount = Math.min(gross, num(billDiscount));
  const discounted = Math.max(0, gross - appliedDiscount);
  const add = saleType === 'installment' ? Math.round((discounted * num(plan.percent)) / 100) : 0;
  const finalTotal = discounted + add;

  function getCashReceived() {
    return num(salePayment[salePayment.method] || 0);
  }

  function resetSaleAmounts() {
    setBillDiscount(0);
    setSalePayment((current) => ({ ...current, method: 'cash', cash: '0', bank: '0' }));
  }

  const cashRec = getCashReceived();
  const advanceOrPaid =
    saleType === 'installment'
      ? Math.min(finalTotal, num(plan.advance))
      : Math.min(finalTotal, cashRec);
  const remainingBalance = Math.max(0, finalTotal - advanceOrPaid);
  const excessPayment = saleType === 'cash' ? Math.max(0, cashRec - finalTotal) : 0;
  const monthlyInstallment =
    saleType === 'installment' && num(plan.months) > 0
      ? Math.round(remainingBalance / num(plan.months))
      : 0;

  // Handle adding item to cart on New Sale
  function handleAddItemToCart(e) {
    e.preventDefault();
    const q = productSearch.trim().toLowerCase();
    const prod =
      data.products.find((p) => p.id === selectedSearchProductId) ||
      data.products.find(
        (p) =>
          p.name.toLowerCase() === q ||
          p.code.toLowerCase() === q ||
          (p.barcode && p.barcode.toLowerCase() === q)
      );

    if (!prod) {
      notify('Select an electronics product from the suggestions first.');
      return;
    }

    const reqQty = Math.max(1, Math.floor(num(newQty)));
    const existingInCart = cart
      .filter((c) => (c.productId || c.id) === prod.id)
      .reduce((s, c) => s + num(c.qty), 0);

    if (existingInCart + reqQty > num(prod.stock)) {
      showAlert(
        'Insufficient stock',
        `"${prod.name}" has only ${prod.stock} unit${prod.stock === 1 ? '' : 's'} available in stock.`,
        'warning'
      );
      return;
    }

    const unitPrice = num(newPrice) || num(prod.price);
    const nextCart = [
      ...cart,
      {
        id: prod.id,
        productId: prod.id,
        name: prod.name,
        code: prod.code,
        category: prod.category || 'Electronics',
        price: unitPrice,
        cost: num(prod.cost),
        stock: num(prod.stock),
        qty: reqQty,
      },
    ];
    setCart(nextCart);
    setProductSearch('');
    setSelectedSearchProductId('');
    setNewQty('1');
    setNewPrice('');
    setShowSuggestions(false);
    notify('Product added to cart.');
  }

  function updateCartItemField(idx, field, val) {
    const item = cart[idx];
    if (!item) return;
    const prod = data.products.find((p) => p.id === (item.productId || item.id));
    const maxStock = prod ? num(prod.stock) : 999;

    if (field === 'qty') {
      const nextQty = Math.max(1, Math.floor(num(val)));
      if (nextQty > maxStock) {
        showAlert(
          'Stock limit reached',
          `Only ${maxStock} unit${maxStock === 1 ? '' : 's'} of "${item.name}" available in inventory.`,
          'warning'
        );
        return;
      }
      const next = [...cart];
      next[idx] = { ...item, qty: nextQty };
      setCart(next);
    } else if (field === 'price') {
      const next = [...cart];
      next[idx] = { ...item, price: num(val) };
      setCart(next);
    }
  }

  async function handleHoldBill() {
    if (cart.length === 0) {
      showAlert('Cart is empty', 'Add an item before holding a bill.', 'warning');
      return;
    }
    try {
      const res = await apiRequest('/orders', {
        method: 'POST',
        body: {
          customerId,
          customerName: customerInfo?.name || selectedCustomerObj.name || 'Walk-in customer',
          phone: salePhone || selectedCustomerObj.phone || '',
          saleType,
          cartItems: cart,
          billDiscount,
          plan,
          total: finalTotal,
          status: 'Held',
        },
      });
      setCart([]);
      resetSaleAmounts();
      await refreshWorkspace();
      notify(`Bill held as ${res.order.orderNo}. Resume anytime from Orders & Held Bills.`);
    } catch (err) {
      showAlert('Error holding bill', err.message, 'warning');
    }
  }

  async function handleSaveSale() {
    if (cart.length === 0) {
      showAlert('Cart is empty', 'Add an item to the cart before saving this sale.', 'warning');
      return;
    }
    if (saleType === 'cash' && customerId === 'walkin' && remainingBalance > 0) {
      showAlert(
        'Walk-in sale must be paid in full',
        `Collect the remaining Rs. ${remainingBalance.toLocaleString()} before saving. Walk-in sales cannot be left on credit.`,
        'warning'
      );
      return;
    }
    if (saleType === 'installment' && !customerInfo) {
      setShowInstallmentCustomerModal(true);
      return;
    }

    setSavingSale(true);
    try {
      const res = await apiRequest('/sales', {
        method: 'POST',
        body: {
          idempotencyKey: `sale-${Date.now()}`,
          customerId,
          customerInfo: customerInfo || {
            name: selectedCustomerObj.name || 'Walk-in customer',
            phone: salePhone || selectedCustomerObj.phone || '',
            whatsapp: salePhone || selectedCustomerObj.whatsapp || '',
            cnic: saleCnic || selectedCustomerObj.cnic || '',
            address: saleAddress || selectedCustomerObj.address || '',
          },
          saleType,
          items: cart,
          billDiscount,
          plan,
          salePayment,
        },
      });
      await refreshWorkspace();
      setPreviewInvoice(res.sale);
      setCart([]);
      resetSaleAmounts();
      notify(`Sale ${res.sale.invoiceNo} saved!`);
    } catch (err) {
      showAlert('Cannot complete sale', err.message, 'warning');
    } finally {
      setSavingSale(false);
    }
  }

  function handleWhatsAppInvoice(bill) {
    const fileName = `${bill.invoiceNo || bill.id || 'invoice'}.pdf`;
    const share = buildWhatsAppInvoiceShare(bill, data.shop);
    window.print();
    setWhatsAppShareInfo({ bill, fileName, ...share });
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#12303f' }}>
        <div style={{ textAlign: 'center' }}>
          <strong style={{ fontSize: 16 }}>Loading ElectroHub Workspace...</strong>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <AuthView
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  if (data.user?.role === 'overview_viewer') {
    return <OverviewPage data={data} onLogout={handleLogout} />;
  }

  const dateText = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const shopName = data.shop?.name || 'ElectroHub Electronics';
  const invoiceModel = previewInvoice ? toInvoiceModel(previewInvoice, data.shop) : null;
  const userInitials = (data.user?.name || 'FA')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const matchingSearchProducts = productSearch.trim()
    ? data.products
        .filter((p) => {
          const q = productSearch.trim().toLowerCase();
          return (
            p.active !== false &&
            (p.name.toLowerCase().includes(q) ||
              p.code.toLowerCase().includes(q) ||
              (p.barcode && p.barcode.toLowerCase().includes(q)))
          );
        })
        .slice(0, 6)
    : [];
  const currentPageGroup = PAGE_GROUPS.find((group) =>
    group.pages.some(([pageKey]) => pageKey === page)
  );

  const newSalePageContext = { BANK_CARDS, data, page, cart, setCart, customerId, setCustomerId, salePhone, setSalePhone, saleCnic, setSaleCnic, saleAddress, setSaleAddress, customerInfo, setCustomerInfo, billDiscount, setBillDiscount, saleType, setSaleType, plan, setPlan, salePayment, setSalePayment, productSearch, setProductSearch, setSelectedSearchProductId, newQty, setNewQty, newPrice, setNewPrice, showSuggestions, setShowSuggestions, savingSale, setShowInstallmentCustomerModal, setShowNewCustomerModal, setEditingCustomerRecord, showAlert, gross, appliedDiscount, discounted, add, finalTotal, resetSaleAmounts, cashRec, advanceOrPaid, remainingBalance, excessPayment, monthlyInstallment, handleAddItemToCart, updateCartItemField, handleHoldBill, handleSaveSale, dateText, matchingSearchProducts };
  const dashboardPageContext = { data, page, setPage, dashPeriod, setDashPeriod };
  const installmentKhataPageContext = { data, page, plan, khataSearch, setKhataSearch, setShowAddInstallmentModal, setActiveKhataPlan, setKhataPayAmount, dateText };
  const stockProductsPageContext = { optionalWarrantyValue, data, page, setPage, inventorySearch, setInventorySearch, inventoryChip, setInventoryChip, stockTab, setStockTab, setEditingProduct, setShowProductModal };
  return (
    <>
      <div className="shell" id="shell">
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} id="sidebar">
          <div className="brand">
            <div className="brand-mark"><img src="/electroniki-assets/electroniki-logo.png" alt="" /></div>
            <div style={{ minWidth: 0 }}>
              <div className="brand-name">Electroniki</div>
              <div className="brand-sub">SHOP MANAGEMENT</div>
            </div>
          </div>

          <nav className="nav-list" aria-label="Main navigation">
            <div className="nav-label">OVERVIEW</div>
            <button
              type="button"
              className={`nav-link ${page === 'dashboard' ? 'active' : ''}`}
              onClick={() => {
                setPage('dashboard');
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon"><LayoutDashboard size={15} /></span>
              Dashboard
            </button>

            <div className="nav-label">SALES & RETURNS</div>
            <button
              type="button"
              className={`nav-link ${page === 'sale' ? 'active' : ''}`}
              onClick={() => {
                setPage('sale');
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon"><Plus size={15} /></span>
              New Sale
            </button>
            <button
              type="button"
              className={`nav-link ${page === 'bills' ? 'active' : ''}`}
              onClick={() => {
                setPage('bills');
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon"><FileText size={15} /></span>
              Bills & Receipts
            </button>
            <button
              type="button"
              className={`nav-link ${page === 'orders' ? 'active' : ''}`}
              onClick={() => {
                setPage('orders');
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon"><CalendarClock size={15} /></span>
              Orders & Held Bills
            </button>
            <button
              type="button"
              className={`nav-link ${page === 'returns' ? 'active' : ''}`}
              onClick={() => {
                setPage('returns');
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon"><TrendingDown size={15} /></span>
              Customer Returns
            </button>
            <button
              type="button"
              className={`nav-link ${currentPageGroup?.label === 'Customers & Khata' ? 'active' : ''}`}
              onClick={() => {
                setPage('customers');
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon"><Users size={15} /></span>
              Customers & Khata
            </button>

            <div className="nav-label">INVENTORY & SUPPLIERS</div>
            <button
              type="button"
              className={`nav-link ${currentPageGroup?.label === 'Stock & Suppliers' ? 'active' : ''}`}
              onClick={() => {
                setPage('stock');
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon"><Package size={15} /></span>
              Stock & Suppliers
            </button>

            <div className="nav-label">FINANCE & CONTROL</div>
            <button
              type="button"
              className={`nav-link ${currentPageGroup?.label === 'Finance & Expenses' ? 'active' : ''}`}
              onClick={() => {
                setPage('finance');
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon"><Landmark size={15} /></span>
              Finance & Expenses
            </button>
            <button
              type="button"
              className={`nav-link ${page === 'reports' ? 'active' : ''}`}
              onClick={() => {
                setPage('reports');
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon"><BarChart3 size={15} /></span>
              Reports
            </button>
            <button
              type="button"
              className={`nav-link ${page === 'settings' ? 'active' : ''}`}
              onClick={() => {
                setPage('settings');
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon"><Settings size={15} /></span>
              Settings
            </button>
          </nav>

          <div className="sidebar-foot">
            <div className="sidebar-user-info">
              <div className="avatar">{userInitials}</div>
              <div style={{ minWidth: 0 }}>
                <div className="user-name">{data.user?.name}</div>
                <div className="user-role">
                  {data.user?.role === 'owner' ? 'Owner Account' : 'Shop Account'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sign Out"
              aria-label="Sign Out"
              style={{
                background: '#ffffff14',
                border: '1px solid #ffffff28',
                color: '#fff',
                borderRadius: 8,
                padding: '6px 9px',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Exit
            </button>
          </div>
        </aside>

        <div
          className={`mobile-overlay ${sidebarOpen ? 'show' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        <main className="main">
          <header className="topbar">
            <div className="top-left">
              <button
                type="button"
                className="menu-btn"
                aria-label="Toggle navigation"
                aria-expanded={sidebarOpen}
                aria-controls="sidebar"
                onClick={() => setSidebarOpen((open) => !open)}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
              <div style={{ minWidth: 0 }}>
                <div className="store-title">{shopName}</div>
                <div className="store-caption">
                  Sales, Khata & Inventory · WhatsApp: {data.shop?.whatsapp || 'Not set'}
                </div>
              </div>
            </div>

            <div className="top-right">
              <span className="date-chip">{dateText}</span>
              <div className="top-profile">
                <div className="avatar">{userInitials[0] || 'F'}</div>
                <div className="profile-meta">
                  {data.user?.name}
                  <small>{data.user?.role === 'owner' ? 'Shop Owner' : 'Shop Account'}</small>
                </div>
              </div>
              <button
                type="button"
                className="btn ghost small"
                onClick={handleLogout}
              >
                Sign out
              </button>
            </div>
          </header>

          <div className="content" id="content" data-pg={page}>
            {currentPageGroup && (
              <nav className="page-section-tabs" aria-label={`${currentPageGroup.label} pages`}>
                {currentPageGroup.pages.map(([pageKey, label]) => (
                  <button
                    key={pageKey}
                    type="button"
                    className={page === pageKey ? 'active' : ''}
                    aria-current={page === pageKey ? 'page' : undefined}
                    onClick={() => setPage(pageKey)}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            )}
            {/* PAGE 1: NEW SALE */}
            {page === 'sale' && <NewSalePage app={newSalePageContext} />}

            {/* PAGE 2: DASHBOARD / OVERVIEW */}
            {page === 'dashboard' && <DashboardPage app={dashboardPageContext} />}

            {/* PAGE 3: INSTALLMENT KHATA */}
            {page === 'khata' && <InstallmentKhataPage app={installmentKhataPageContext} />}

            {/* PAGE 4: STOCK & PRODUCTS */}
            {page === 'stock' && <StockProductsPage app={stockProductsPageContext} />}

            {/* OTHER CORE PAGES (Rendered via ModuleViews) */}
            {page === 'bills' && (
              <BillsView
                sales={data.sales}
                shop={data.shop}
                onOpenInvoice={(b) => setPreviewInvoice(b)}
                onNewSale={() => setPage('sale')}
                onRefresh={refreshWorkspace}
                notify={notify}
                showAlert={showAlert}
              />
            )}

            {page === 'customers' && (
              <CustomersView
                customers={data.customers}
                sales={data.sales}
                installmentPlans={data.installmentPlans}
                onOpenNewCustomer={() => {
                  setEditingCustomerRecord(null);
                  setShowNewCustomerModal(true);
                }}
                onEditCustomer={(c) => {
                  setEditingCustomerRecord(c);
                  setShowNewCustomerModal(true);
                }}
              />
            )}

            {page === 'returns' && (
              <ReturnsView
                sales={data.sales}
                customerReturns={data.customerReturns}
                bankAccounts={data.bankAccounts}
                onRefresh={refreshWorkspace}
                notify={notify}
                showAlert={showAlert}
              />
            )}

            {page === 'orders' && (
              <OrdersView
                heldOrders={data.heldOrders}
                onResumeHeldOrder={async (order) => {
                  setCart(order.cartItems || []);
                  setCustomerId(order.customerId || 'walkin');
                  resetSaleAmounts();
                  setBillDiscount(num(order.billDiscount));
                  setSaleType(order.saleType || 'cash');
                  if (order.plan) setPlan(order.plan);
                  await apiRequest(`/orders/${order.id}`, { method: 'DELETE' });
                  await refreshWorkspace();
                  setPage('sale');
                  notify(`Resumed ${order.orderNo} into Current Cart.`);
                }}
                onRefresh={refreshWorkspace}
                notify={notify}
              />
            )}

            {page === 'suppliers' && (
              <SuppliersView
                suppliers={data.suppliers}
                stockReceipts={data.stockReceipts}
                financialTransactions={data.financialTransactions}
                bankAccounts={data.bankAccounts}
                onOpenAddStock={() => setPage('receive-stock')}
                onRefresh={refreshWorkspace}
                notify={notify}
                showAlert={showAlert}
              />
            )}

            {page === 'finance' && (
              <FinanceView
                summary={data.summary}
                bankAccounts={data.bankAccounts}
                financialTransactions={data.financialTransactions}
                onRefresh={refreshWorkspace}
                notify={notify}
                showAlert={showAlert}
              />
            )}

            {page === 'expenses' && (
              <ExpensesView
                expenses={data.expenses}
                bankAccounts={data.bankAccounts}
                onRefresh={refreshWorkspace}
                notify={notify}
                showAlert={showAlert}
              />
            )}

            {page === 'reports' && (
              <ReportsView
                summary={data.summary}
                sales={data.sales}
                products={data.products}
                customers={data.customers}
                suppliers={data.suppliers}
                installmentPlans={data.installmentPlans}
                expenses={data.expenses}
                customerReturns={data.customerReturns}
                notify={notify}
              />
            )}

            {page === 'settings' && (
              <SettingsView
                shop={data.shop}
                user={data.user}
                users={data.users}
                onRefresh={refreshWorkspace}
                notify={notify}
                showAlert={showAlert}
              />
            )}
      {page === 'receive-stock' && (
        <StockReceivePage
          products={data.products}
          stockReceipts={data.stockReceipts}
          suppliers={data.suppliers}
          bankAccounts={data.bankAccounts}
          onClose={() => setPage('stock')}
          onSuccess={async (supplierName) => {
            await refreshWorkspace();
            setPage('stock');
            showAlert(
              'Stock added successfully',
              `Inventory and ${supplierName} payable balance are now updated.`,
              'success'
            );
          }}
          showAlert={showAlert}
        />
      )}


          </div>
        </main>
      </div>

      {/* ====================================================================
          MODAL 2: INSTALLMENT CUSTOMER & GUARANTOR DETAILS (New Sale)
         ==================================================================== */}
      {showInstallmentCustomerModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (!customerInfo) setSaleType('cash');
              setShowInstallmentCustomerModal(false);
            }
          }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>Installment Customer Details</h2>
                <p>Confirm customer and guarantor information before saving the plan.</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  if (!customerInfo) setSaleType('cash');
                  setShowInstallmentCustomerModal(false);
                }}
              >
                ×
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                try {
                  const customerPhotoFile = fd.get('customerPhoto');
                  const guarantorPhotoFile = fd.get('guarantorPhoto');
                  const [customerPhoto, guarantorPhoto] = await Promise.all([
                    customerPhotoFile?.size
                      ? compressInstallmentPhoto(customerPhotoFile)
                      : fd.get('customerPhotoClear') === 'true' ? '' : customerInfo?.customerPhoto || '',
                    guarantorPhotoFile?.size
                      ? compressInstallmentPhoto(guarantorPhotoFile)
                      : fd.get('guarantorPhotoClear') === 'true' ? '' : customerInfo?.guarantorPhoto || '',
                  ]);
                  const info = {
                    id: customerId,
                    name: String(fd.get('name') || '').trim(),
                    cnic: String(fd.get('cnic') || '').trim(),
                    address: String(fd.get('address') || '').trim(),
                    phone: String(fd.get('phone') || '').trim(),
                    whatsapp: String(fd.get('whatsapp') || '').trim(),
                    customerPhoto,
                    guarantor: String(fd.get('guarantor') || '').trim(),
                    guarantorPhone: String(fd.get('guarantorPhone') || '').trim(),
                    guarantorAddress: String(fd.get('guarantorAddress') || '').trim(),
                    guarantorPhoto,
                  };
                  setCustomerInfo(info);
                  setSalePhone(info.phone);
                  setSaleCnic(info.cnic);
                  setSaleAddress(info.address);
                  setSaleType('installment');
                  setShowInstallmentCustomerModal(false);
                  notify('Installment details saved.');
                } catch (err) {
                  showAlert('Photo could not be added', err.message, 'warning');
                }
              }}
            >
              <div className="modal-body">
                <div className="modal-section">CUSTOMER INFORMATION</div>
                <div className="fields">
                  <label className="field">
                    Customer name
                    <input
                      name="name"
                      required
                      defaultValue={customerInfo?.name || selectedCustomerObj.name || ''}
                    />
                  </label>
                  <label className="field">
                    Customer ID / CNIC
                    <input
                      name="cnic"
                      required
                      defaultValue={customerInfo?.cnic || saleCnic || selectedCustomerObj.cnic || ''}
                    />
                  </label>
                  <label className="field full">
                    Customer address
                    <input
                      name="address"
                      required
                      defaultValue={
                        customerInfo?.address || saleAddress || selectedCustomerObj.address || ''
                      }
                    />
                  </label>
                  <label className="field">
                    Customer phone number
                    <input
                      name="phone"
                      defaultValue={
                        customerInfo?.phone || salePhone || selectedCustomerObj.phone || ''
                      }
                      placeholder="03XX XXXXXXX"
                    />
                  </label>
                  <label className="field">
                    Customer WhatsApp number
                    <input
                      name="whatsapp"
                      required
                      defaultValue={
                        customerInfo?.whatsapp ||
                        selectedCustomerObj.whatsapp ||
                        salePhone ||
                        selectedCustomerObj.phone ||
                        ''
                      }
                      placeholder="03XX XXXXXXX"
                    />
                  </label>
                  <InstallmentPhotoField
                    name="customerPhoto"
                    label="Customer photo"
                    value={customerInfo?.customerPhoto || ''}
                  />
                </div>

                <div className="modal-section" style={{ marginTop: 18 }}>
                  GUARANTOR INFORMATION
                </div>
                <div className="fields">
                  <label className="field">
                    Guarantor name (optional)
                    <input
                      name="guarantor"
                      defaultValue={
                        customerInfo?.guarantor || selectedCustomerObj.guarantor || ''
                      }
                    />
                  </label>
                  <label className="field">
                    Guarantor phone number
                    <input
                      name="guarantorPhone"
                      required
                      defaultValue={
                        customerInfo?.guarantorPhone || selectedCustomerObj.guarantorPhone || ''
                      }
                      placeholder="03XX XXXXXXX"
                    />
                  </label>
                  <label className="field full">
                    Guarantor address (optional)
                    <input
                      name="guarantorAddress"
                      defaultValue={
                        customerInfo?.guarantorAddress || selectedCustomerObj.guarantorAddress || ''
                      }
                    />
                  </label>
                  <InstallmentPhotoField
                    name="guarantorPhoto"
                    label="Guarantor photo"
                    value={customerInfo?.guarantorPhoto || ''}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    if (!customerInfo) setSaleType('cash');
                    setShowInstallmentCustomerModal(false);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn">
                  Save customer & plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: ADD / EDIT CUSTOMER
         ==================================================================== */}
      {showNewCustomerModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setShowNewCustomerModal(false)}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>{editingCustomerRecord ? 'Edit Customer' : 'Add a Customer'}</h2>
                <p>Save customer contact and CNIC details in your shop workspace.</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowNewCustomerModal(false)}
              >
                ×
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const payload = {
                  name: fd.get('name'),
                  phone: fd.get('phone'),
                  whatsapp: fd.get('whatsapp') || fd.get('phone'),
                  cnic: fd.get('cnic'),
                  address: fd.get('address'),
                };
                try {
                  if (editingCustomerRecord) {
                    await apiRequest(`/customers/${editingCustomerRecord.id}`, {
                      method: 'PUT',
                      body: payload,
                    });
                    notify('Customer updated.');
                  } else {
                    const res = await apiRequest('/customers', {
                      method: 'POST',
                      body: payload,
                    });
                    setCustomerId(res.customer.id);
                    setSalePhone(res.customer.phone || '');
                    setSaleCnic(res.customer.cnic || '');
                    setSaleAddress(res.customer.address || '');
                    notify('New customer added.');
                  }
                  setShowNewCustomerModal(false);
                  await refreshWorkspace();
                } catch (err) {
                  showAlert('Error', err.message, 'warning');
                }
              }}
            >
              <div className="modal-body">
                <div className="fields">
                  <label className="field">
                    Customer name
                    <input
                      name="name"
                      required
                      defaultValue={editingCustomerRecord?.name || ''}
                      placeholder="Full name"
                    />
                  </label>
                  <label className="field">
                    Customer phone
                    <input
                      name="phone"
                      defaultValue={editingCustomerRecord?.phone || ''}
                      placeholder="03XX XXXXXXX"
                    />
                  </label>
                  <label className="field">
                    Customer ID / CNIC
                    <input
                      name="cnic"
                      defaultValue={editingCustomerRecord?.cnic || ''}
                      placeholder="XXXXX-XXXXXXX-X"
                    />
                  </label>
                  <label className="field">
                    WhatsApp number
                    <input
                      name="whatsapp"
                      defaultValue={editingCustomerRecord?.whatsapp || ''}
                      placeholder="03XX XXXXXXX"
                    />
                  </label>
                  <label className="field full">
                    Address
                    <input
                      name="address"
                      defaultValue={editingCustomerRecord?.address || ''}
                      placeholder="Customer address"
                    />
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setShowNewCustomerModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn">
                  Save customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 4: ADD STANDALONE INSTALLMENT CUSTOMER (Khata Page)
         ==================================================================== */}
      {showAddInstallmentModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setShowAddInstallmentModal(false)}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>Add installment customer</h2>
                <p>Add customer details, guarantor info, and monthly installment plan.</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowAddInstallmentModal(false)}
              >
                ×
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                try {
                  await apiRequest('/installments/plans', {
                    method: 'POST',
                    body: Object.fromEntries(fd.entries()),
                  });
                  setShowAddInstallmentModal(false);
                  await refreshWorkspace();
                  showAlert(
                    'Installment customer added',
                    'The customer and monthly plan are now saved in Installment Khata.',
                    'success'
                  );
                } catch (err) {
                  showAlert('Check installment details', err.message, 'warning');
                }
              }}
            >
              <div className="modal-body">
                <div className="modal-section">CUSTOMER DETAILS</div>
                <div className="fields">
                  <label className="field">
                    Customer name
                    <input name="name" required placeholder="Full name" />
                  </label>
                  <label className="field">
                    Phone number
                    <input name="phone" required placeholder="03XX XXXXXXX" />
                  </label>
                  <label className="field">
                    WhatsApp number
                    <input name="whatsapp" placeholder="Defaults to phone" />
                  </label>
                  <label className="field">
                    CNIC / ID
                    <input name="cnic" placeholder="XXXXX-XXXXXXX-X" />
                  </label>
                  <label className="field full">
                    Address
                    <input name="address" placeholder="Customer address" />
                  </label>
                </div>

                <div className="modal-section" style={{ marginTop: 18 }}>
                  GUARANTOR (OPTIONAL)
                </div>
                <div className="fields">
                  <label className="field">
                    Guarantor name
                    <input name="guarantor" placeholder="Optional" />
                  </label>
                  <label className="field">
                    Guarantor phone
                    <input name="guarantorPhone" placeholder="Optional" />
                  </label>
                  <label className="field full">
                    Guarantor address
                    <input name="guarantorAddress" placeholder="Optional" />
                  </label>
                </div>

                <div className="modal-section" style={{ marginTop: 18 }}>
                  INSTALLMENT PLAN
                </div>
                <div className="fields">
                  <label className="field">
                    Item / plan description
                    <input name="product" placeholder="e.g. Samsung 55-inch TV" />
                  </label>
                  <label className="field">
                    Total plan amount (Rs.)
                    <input name="total" type="number" min="1" required placeholder="0" />
                  </label>
                  <label className="field">
                    Advance payment (Rs.)
                    <input name="advance" type="number" min="0" defaultValue="0" />
                  </label>
                  <label className="field">
                    Duration (months)
                    <input name="months" type="number" min="1" defaultValue="12" required />
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setShowAddInstallmentModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn">
                  Save installment customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 5: VIEW KHATA ACCOUNT & RECORD INSTALLMENT PAYMENT
         ==================================================================== */}
      {activeKhataPlan && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setActiveKhataPlan(null)}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>
                  Installment Account · {activeKhataPlan.customerName} ({activeKhataPlan.planNo})
                </h2>
                <p>
                  Product: {activeKhataPlan.productSummary || 'Installment Plan'} · Guarantor:{' '}
                  {activeKhataPlan.guarantor || 'None'}
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setActiveKhataPlan(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="payment-summary">
                <div>
                  <small>Total Plan Amount</small>
                  <b>{money(activeKhataPlan.totalAmount)}</b>
                </div>
                <div>
                  <small>Total Paid So Far</small>
                  <b>{money(activeKhataPlan.paid)}</b>
                </div>
                <div>
                  <small>Remaining Balance</small>
                  <b>{money(activeKhataPlan.balance)}</b>
                </div>
              </div>

              {num(activeKhataPlan.balance) > 0 && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const res = await apiRequest(`/installments/${activeKhataPlan.id}/pay`, {
                        method: 'POST',
                        body: {
                          idempotencyKey: `khpay-${activeKhataPlan.id}-${Date.now()}`,
                          amount: num(khataPayAmount),
                          method: khataPayMethod,
                          bankName: khataPayBank,
                          note: khataPayNote,
                        },
                      });
                      setActiveKhataPlan(res.plan);
                      setKhataPayNote('');
                      await refreshWorkspace();
                      notify(
                        `Recorded ${money(res.payment.amount)} installment receipt (${res.payment.receiptNo}).`
                      );
                    } catch (err) {
                      showAlert('Payment error', err.message, 'warning');
                    }
                  }}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: '1px solid #d9eaf0',
                    background: '#f4f9fb',
                    marginBottom: 16,
                  }}
                >
                  <div className="modal-section">RECORD PARTIAL OR FULL INSTALLMENT PAYMENT</div>
                  <div className="fields">
                    <label className="field">
                      Payment Amount (Rs.)
                      <input
                        type="number"
                        min="1"
                        max={activeKhataPlan.balance}
                        required
                        value={khataPayAmount}
                        onChange={(e) => setKhataPayAmount(e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Payment Method
                      <select
                        value={khataPayMethod}
                        onChange={(e) => setKhataPayMethod(e.target.value)}
                      >
                        <option value="cash">Cash</option>
                        <option value="bank">Bank Transfer</option>
                      </select>
                    </label>
                    {khataPayMethod === 'bank' && (
                      <label className="field">
                        Bank Account
                        <select
                          value={khataPayBank}
                          onChange={(e) => setKhataPayBank(e.target.value)}
                        >
                          {data.bankAccounts.map((b) => (
                            <option key={b.id} value={b.bankName}>
                              {b.bankName}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="field">
                      Note / Reference
                      <input
                        value={khataPayNote}
                        onChange={(e) => setKhataPayNote(e.target.value)}
                        placeholder="e.g. Monthly installment"
                      />
                    </label>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn">
                      Record Payment & Update Khata
                    </button>
                  </div>
                </form>
              )}

              <div className="modal-section">PAYMENT HISTORY</div>
              {(() => {
                const payments = data.installmentPayments.filter(
                  (p) => p.planId === activeKhataPlan.id
                );
                if (payments.length === 0) {
                  return (
                    <div className="empty">
                      Initial advance ({money(activeKhataPlan.advancePaid)}) recorded at plan start. No subsequent installment payments yet.
                    </div>
                  );
                }
                return (
                  <div className="table-wrap">
                    <table className="table" style={{ minWidth: 460 }}>
                      <thead>
                        <tr>
                          <th>Receipt #</th>
                          <th>Date</th>
                          <th>Method</th>
                          <th>Amount</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <strong>{p.receiptNo}</strong>
                            </td>
                            <td>
                              {p.createdAt
                                ? new Date(p.createdAt).toLocaleDateString('en-GB')
                                : 'Today'}
                            </td>
                            <td style={{ textTransform: 'capitalize' }}>{p.method}</td>
                            <td>
                              <strong>{money(p.amount)}</strong>
                            </td>
                            <td>{p.note || p.reference || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setActiveKhataPlan(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 6: ADD / EDIT PRODUCT MODEL
         ==================================================================== */}
      {showProductModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setShowProductModal(false)}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>
                  {editingProduct ? `Edit Product · ${editingProduct.name}` : 'Add Electronics Product'}
                </h2>
                <p>Manage SKU, barcode, serial number, warranty, cost, sale price, and stock.</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowProductModal(false)}
              >
                ×
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const payload = Object.fromEntries(fd.entries());
                try {
                  if (editingProduct) {
                    await apiRequest(`/products/${editingProduct.id}`, {
                      method: 'PUT',
                      body: payload,
                    });
                    notify('Product updated.');
                  } else {
                    await apiRequest('/products', {
                      method: 'POST',
                      body: payload,
                    });
                    notify('New product created.');
                  }
                  setShowProductModal(false);
                  await refreshWorkspace();
                } catch (err) {
                  showAlert('Error', err.message, 'warning');
                }
              }}
            >
              <div className="modal-body">
                <div className="fields">
                  <label className="field">
                    Product / Model Name
                    <input
                      name="name"
                      required
                      defaultValue={editingProduct?.name || ''}
                      placeholder="e.g. Samsung Galaxy S24"
                    />
                  </label>
                  <label className="field">
                    Category
                    <input
                      name="category"
                      defaultValue={editingProduct?.category || 'Mobile'}
                      placeholder="Mobile / Television / Laptop"
                    />
                  </label>
                  <label className="field">
                    SKU / Model Code
                    <input
                      name="code"
                      required
                      defaultValue={editingProduct?.code || ''}
                      placeholder="SAM-S24-256"
                    />
                  </label>
                  <label className="field">
                    Barcode (for USB/Bluetooth Scanner)
                    <input
                      name="barcode"
                      defaultValue={editingProduct?.barcode || ''}
                      placeholder="880609..."
                    />
                  </label>
                  <label className="field">
                    Serial Number (optional)
                    <input
                      name="serialNumber"
                      defaultValue={editingProduct?.serialNumber || ''}
                      placeholder="IMEI or Serial"
                    />
                  </label>
                  <label className="field">
                    Warranty
                    <input
                      name="warranty"
                      defaultValue={optionalWarrantyValue(editingProduct?.warranty)}
                    />
                  </label>
                  <label className="field">
                    Purchase Cost Price (Rs.)
                    <input
                      name="cost"
                      type="number"
                      min="0"
                      required
                      defaultValue={editingProduct?.cost ?? 0}
                    />
                  </label>
                  <label className="field">
                    Sale Price (Rs.)
                    <input
                      name="price"
                      type="number"
                      min="1"
                      required
                      defaultValue={editingProduct?.price ?? ''}
                    />
                  </label>
                  <label className="field">
                    Quantity in Stock
                    <input
                      name="stock"
                      type="number"
                      min="0"
                      required
                      defaultValue={editingProduct?.stock ?? 0}
                    />
                  </label>
                  <label className="field">
                    Low-Stock Reorder Threshold
                    <input
                      name="reorderThreshold"
                      type="number"
                      min="0"
                      defaultValue={editingProduct?.reorderThreshold ?? 5}
                    />
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setShowProductModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn">
                  {editingProduct ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 7: INVOICE PREVIEW, PDF DOWNLOAD & WHATSAPP SHARING
         ==================================================================== */}
      {previewInvoice && (
        <div
          className="modal-backdrop invoice-preview-backdrop"
          onClick={(e) => e.target === e.currentTarget && setPreviewInvoice(null)}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>{previewInvoice.type === 'installment' ? 'Installment Invoice' : 'Sales Invoice'} · {previewInvoice.invoiceNo || previewInvoice.id}</h2>
                <p>{previewInvoice.customer} · {shopName}</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setPreviewInvoice(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="ci-preview-host">
                {previewInvoice.type === 'installment'
                  ? <InstallmentInvoiceA5 invoice={invoiceModel} />
                  : <SalesInvoiceA5 invoice={invoiceModel} />}
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setPreviewInvoice(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => window.print()}
              >
                Print / Save A5 PDF
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => handleWhatsAppInvoice(previewInvoice)}
              >
                WhatsApp PDF Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 8: WHATSAPP PDF INVOICE SHARE INSTRUCTIONS & WA.ME LAUNCHER
         ==================================================================== */}
      {whatsAppShareInfo && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setWhatsAppShareInfo(null)}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>Share Invoice PDF on WhatsApp</h2>
                <p>
                  Shop WhatsApp: {whatsAppShareInfo.shopWhatsApp || 'Configured in Settings'}
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setWhatsAppShareInfo(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-note" style={{ marginTop: 0 }}>
                <b>Step 1:</b> In the print dialog, choose <b>Save as PDF</b> and save the A5 invoice as <b>{whatsAppShareInfo.fileName}</b>.
                <br />
                <b>Step 2:</b> Click <b>Open WhatsApp (wa.me)</b> below to open the chat with the prefilled invoice message, then attach the saved PDF manually. Browsers do not automatically attach local files into WhatsApp.
              </div>

              <label className="field" style={{ marginTop: 14 }}>
                Prefilled WhatsApp Message
                <textarea readOnly value={whatsAppShareInfo.text} style={{ minHeight: 110 }} />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setWhatsAppShareInfo(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => window.print()}
              >
                Print / Save A5 PDF Again
              </button>
              <a
                href={whatsAppShareInfo.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{ textDecoration: 'none' }}
              >
                Open WhatsApp (wa.me) ↗
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TOAST & SWEET DIALOG
         ==================================================================== */}
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}

      {sweetAlert && (
        <div
          className="sweet-backdrop"
          onClick={(e) => e.target === e.currentTarget && setSweetAlert(null)}
        >
          <section className="sweet-dialog" role="alertdialog" aria-modal="true">
            <div
              className={`sweet-icon ${
                sweetAlert.type === 'success' ? '' : sweetAlert.type
              }`}
            >
              {sweetAlert.type === 'warning' || sweetAlert.type === 'danger' ? '!' : '✓'}
            </div>
            <h2>{sweetAlert.title}</h2>
            <p>{sweetAlert.message}</p>
            <div className="sweet-actions">
              {sweetAlert.confirmLabel ? (
                <>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setSweetAlert(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn danger-solid"
                    onClick={() => {
                      const cb = sweetAlert.onConfirm;
                      setSweetAlert(null);
                      if (cb) cb();
                    }}
                  >
                    {sweetAlert.confirmLabel}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setSweetAlert(null)}
                >
                  Okay
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
