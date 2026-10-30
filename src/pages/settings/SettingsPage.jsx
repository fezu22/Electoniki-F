import React, { useState } from 'react';
import { apiRequest, money, num } from '../../api.js';

export default function SettingsView({ shop = {}, user = {}, users = [], onRefresh, notify, showAlert }) {
  const isOwner = user?.role === 'owner';

  const [name, setName] = useState(shop.name || '');
  const [whatsapp, setWhatsapp] = useState(shop.whatsapp || '');
  const [phone, setPhone] = useState(shop.phone || '');
  const [address, setAddress] = useState(shop.address || '');
  const [city, setCity] = useState(shop.city || '');
  const [invoicePrefix, setInvoicePrefix] = useState(shop.invoicePrefix || 'INV');
  const [openingCash, setOpeningCash] = useState(String(shop.openingCash ?? 45000));
  const [receiptFooter, setReceiptFooter] = useState(shop.receiptFooter || '');
  const [installmentRemindersEnabled, setInstallmentRemindersEnabled] = useState(
    Boolean(shop.automation?.installmentRemindersEnabled)
  );
  const [lowStockAlertsEnabled, setLowStockAlertsEnabled] = useState(
    Boolean(shop.automation?.lowStockAlertsEnabled)
  );
  const [lowStockRecipientOne, setLowStockRecipientOne] = useState(
    shop.automation?.lowStockRecipients?.[0] ? `+${shop.automation.lowStockRecipients[0]}` : ''
  );
  const [lowStockRecipientTwo, setLowStockRecipientTwo] = useState(
    shop.automation?.lowStockRecipients?.[1] ? `+${shop.automation.lowStockRecipients[1]}` : ''
  );
  const [savingShop, setSavingShop] = useState(false);

  // User modal state
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [uName, setUName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uRole, setURole] = useState('shop_account');
  const overviewSeatsUsed = users.filter((u) => u.role === 'overview_viewer' && u.active !== false).length;

  async function handleSaveSettings(e) {
    e.preventDefault();
    if (!isOwner) {
      showAlert('Owner only', 'Only the Shop Owner can modify shop settings.', 'warning');
      return;
    }
    setSavingShop(true);
    try {
      await apiRequest('/settings', {
        method: 'PUT',
        body: {
          name,
          whatsapp,
          phone,
          address,
          city,
          invoicePrefix,
          openingCash: num(openingCash),
          receiptFooter,
          automation: {
            installmentRemindersEnabled,
            lowStockAlertsEnabled,
            lowStockRecipients: [lowStockRecipientOne, lowStockRecipientTwo],
          },
        },
      });
      await onRefresh();
      notify('Shop settings saved.');
    } catch (err) {
      showAlert('Error saving settings', err.message, 'warning');
    } finally {
      setSavingShop(false);
    }
  }

  function openNewUser() {
    setEditingUser(null);
    setUName('');
    setUEmail('');
    setUPassword('');
    setURole('shop_account');
    setShowUserModal(true);
  }

  function openEditUser(u) {
    setEditingUser(u);
    setUName(u.name);
    setUEmail(u.email);
    setUPassword('');
    setShowUserModal(true);
  }

  async function handleSaveUser(e) {
    e.preventDefault();
    try {
      if (editingUser) {
        await apiRequest(`/users/${editingUser.id}`, {
          method: 'PUT',
          body: {
            name: uName,
            email: uEmail,
            newPassword: uPassword || undefined,
          },
        });
        notify(`Updated user ${uName}.`);
      } else {
        await apiRequest('/users', {
          method: 'POST',
          body: {
            name: uName,
            email: uEmail,
            password: uPassword,
            role: uRole,
          },
        });
        notify(`Created ${uRole === 'overview_viewer' ? 'Overview-only access' : 'Shop Account'} for ${uName}.`);
      }
      setShowUserModal(false);
      await onRefresh();
    } catch (err) {
      showAlert('User management error', err.message, 'warning');
    }
  }

  async function toggleUserActive(u) {
    try {
      await apiRequest(`/users/${u.id}`, {
        method: 'PUT',
        body: { active: !u.active },
      });
      await onRefresh();
      notify(`${u.name} is now ${!u.active ? 'Active' : 'Deactivated'}.`);
    } catch (err) {
      showAlert('Cannot update status', err.message, 'warning');
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings & Shop Accounts</h1>
        </div>
        {isOwner && (
          <div className="head-actions">
            <button type="button" className="btn" onClick={openNewUser}>
              + Add User
            </button>
          </div>
        )}
      </div>

      {!isOwner && (
        <div className="modal-note" style={{ marginTop: 0, marginBottom: 16 }}>
          <b>Shop Account Role Notice:</b> You are signed in as a Shop Account user (<b>{user.name}</b>).
          You can view shop settings below, but only the <b>Owner</b> can edit shop ownership details or manage users.
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)', alignItems: 'start' }}>
        <section className="card">
          <div className="card-head">
            <h2>Shop Profile & Receipt Details</h2>
            <span className="tag">{shop.currency || 'PKR'}</span>
          </div>

          <form onSubmit={handleSaveSettings} className="stack">
            <div className="fields">
              <label className="field">
                Shop Name (Displayed in App & Invoices)
                <input
                  required
                  disabled={!isOwner}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ElectroHub Electronics"
                />
              </label>
              <label className="field">
                Shop WhatsApp Number (with country code)
                <input
                  required
                  disabled={!isOwner}
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+923005552711"
                />
              </label>
              <label className="field">
                Shop Phone Number
                <input
                  disabled={!isOwner}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0300-5552711"
                />
              </label>
              <label className="field">
                City
                <input
                  disabled={!isOwner}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Mingora, Swat"
                />
              </label>
              <label className="field full">
                Shop Address (Printed on PDF Invoices)
                <input
                  disabled={!isOwner}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Main Electronics Market, Mingora, Swat"
                />
              </label>
              {/* Invoice design is managed by Super Admin. */}
              {/*
              <div className="field full" style={{ padding: 16, border: '1px solid #dbe7ed', borderRadius: 12, background: '#f7fbfd' }}>
                <b style={{ color: '#12303f' }}>Invoice Design · This Store Only</b>
                <p className="muted tiny" style={{ margin: '5px 0 12px' }}>
                  Each store saves its own invoice colors and logo. All accounts in this store use the same invoice design.
                </p>
                <div className="fields">
                  <label className="field">
                    Invoice theme
                    <select disabled={!isOwner} value={invoiceTheme} onChange={(e) => { setInvoiceTheme(e.target.value); setInvoiceAccent(INVOICE_THEMES[e.target.value] || INVOICE_THEMES.blue); }}>
                      <option value="blue">Classic Blue</option>
                      <option value="teal">Teal</option>
                      <option value="violet">Violet</option>
                      <option value="graphite">Graphite</option>
                    </select>
                  </label>
                  <label className="field">
                    Accent color
                    <input type="color" disabled={!isOwner} value={invoiceAccent} onChange={(e) => setInvoiceAccent(e.target.value)} style={{ width: 76, height: 40, padding: 3 }} />
                  </label>
                  <label className="field full">
                    Shop logo (printed on Sales and Installment invoices, max 240 KB)
                    <input type="file" accept="image/png,image/jpeg,image/webp" disabled={!isOwner} onChange={handleInvoiceLogoChange} />
                  </label>
                  {invoiceLogo && <div className="field full" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src={invoiceLogo} alt="Invoice logo preview" style={{ maxWidth: 160, maxHeight: 64, objectFit: 'contain', background: '#fff', border: '1px solid #dbe7ed', borderRadius: 8, padding: 5 }} />
                    {isOwner && <button type="button" className="btn ghost small" onClick={() => setInvoiceLogo('')}>Remove logo</button>}
                  </div>}
                </div>
              </div>
              */}
              <label className="field">
                Invoice Number Prefix
                <input
                  disabled={!isOwner}
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value)}
                  placeholder="INV"
                />
              </label>
              <label className="field">
                Opening Cash Balance (Rs.)
                <input
                  type="number"
                  min="0"
                  disabled={!isOwner}
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                />
              </label>
              <label className="field full">
                Invoice / Receipt Footer Note
                <textarea
                  disabled={!isOwner}
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                />
              </label>
              <div className="field full" style={{ padding: 16, border: '1px solid #dbe7ed', borderRadius: 12, background: '#f7fbfd' }}>
                <b style={{ color: '#12303f' }}>WhatsApp Automations</b>
                <p className="muted tiny" style={{ margin: '5px 0 12px' }}>
                  Connection: <b>{shop.whatsappAutomationConfigured ? 'Ready' : 'Needs WhatsApp Cloud API setup'}</b>. Messages use approved WhatsApp templates.
                </p>
                <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 12 }}>
                  <input
                    type="checkbox"
                    disabled={!isOwner}
                    checked={installmentRemindersEnabled}
                    onChange={(e) => setInstallmentRemindersEnabled(e.target.checked)}
                  />
                  <span><b>Monthly installment reminders</b><small className="muted" style={{ display: 'block' }}>Send once each due month to opted-in customers with an unpaid plan. Paid plans stop automatically.</small></span>
                </label>
                <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 12 }}>
                  <input
                    type="checkbox"
                    disabled={!isOwner}
                    checked={lowStockAlertsEnabled}
                    onChange={(e) => setLowStockAlertsEnabled(e.target.checked)}
                  />
                  <span><b>Low-stock WhatsApp alerts</b><small className="muted" style={{ display: 'block' }}>Send an alert to both numbers when stock reaches its reorder threshold. It rearms after restocking.</small></span>
                </label>
                <div className="fields">
                  <label className="field">
                    Alert WhatsApp number 1
                    <input type="tel" disabled={!isOwner} value={lowStockRecipientOne} onChange={(e) => setLowStockRecipientOne(e.target.value)} placeholder="+923001234567" />
                  </label>
                  <label className="field">
                    Alert WhatsApp number 2
                    <input type="tel" disabled={!isOwner} value={lowStockRecipientTwo} onChange={(e) => setLowStockRecipientTwo(e.target.value)} placeholder="+923009876543" />
                  </label>
                </div>
              </div>
            </div>

            {isOwner && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn" disabled={savingShop}>
                  {savingShop ? 'Saving...' : 'Save Shop Settings'}
                </button>
              </div>
            )}
          </form>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Shop Users & Access</h2>
              <p className="muted tiny" style={{ marginTop: 4 }}>
                Manage accounts for this store. Overview-only access is limited to two active emails.
              </p>
            </div>
            <span className="tag">{users.length} users</span>
          </div>

          <div className="dash-list">
            {users.map((u) => (
              <div key={u.id} className="dash-list-row">
                <div className="dash-list-copy">
                  <b>
                    {u.name}{' '}
                    <span className="muted tiny">
                      ({u.role === 'owner' ? 'Owner' : u.role === 'overview_viewer' ? 'Overview only' : 'Shop Account'})
                    </span>
                  </b>
                  <small>{u.email}</small>
                </div>
                <span className={`status ${u.active ? '' : 'overdue'}`}>
                  {u.active ? 'Active' : 'Deactivated'}
                </span>
                {isOwner && (
                  <div className="inline">
                    <button
                      type="button"
                      className="btn ghost small"
                      onClick={() => openEditUser(u)}
                    >
                      Edit / Reset
                    </button>
                    {u.role !== 'owner' && (
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => toggleUserActive(u)}
                      >
                        {u.active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {showUserModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setShowUserModal(false)}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>
                  {editingUser ? `Edit / Reset Access · ${editingUser.name}` : 'Create Store User'}
                </h2>
                <p>
                  {editingUser ? 'Update this account for your store.' : 'Choose full shop access or read-only Overview access for this store.'}
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowUserModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSaveUser}>
              <div className="modal-body">
                <div className="fields">
                  {!editingUser && <label className="field full">
                    Access level
                    <select value={uRole} onChange={(e) => setURole(e.target.value)}>
                      <option value="shop_account">Shop Account · daily shop work</option>
                      <option value="overview_viewer" disabled={overviewSeatsUsed >= 2}>Overview only · read-only ({overviewSeatsUsed}/2 active)</option>
                    </select>
                  </label>}
                  <label className="field">
                    Full Name
                    <input
                      required
                      value={uName}
                      onChange={(e) => setUName(e.target.value)}
                      placeholder="e.g. Bilal · Cashier"
                    />
                  </label>
                  <label className="field">
                    Email Address
                    <input
                      type="email"
                      required
                      value={uEmail}
                      onChange={(e) => setUEmail(e.target.value)}
                      placeholder="cashier@yourshop.pk"
                    />
                  </label>
                  <label className="field full">
                    {editingUser ? 'Reset Password (leave blank to keep current)' : 'Password (min 8 chars)'}
                    <input
                      type="password"
                      required={!editingUser}
                      minLength={8}
                      value={uPassword}
                      onChange={(e) => setUPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setShowUserModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn">
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
