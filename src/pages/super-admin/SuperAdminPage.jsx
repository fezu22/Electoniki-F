import React, { useEffect, useMemo, useState } from 'react';
import { Building2, FileText, KeyRound, LogOut, Plus, Search, ShieldCheck, Store, UserRound, Users } from 'lucide-react';
import { apiRequest } from '../../api.js';
import './super-admin.css';

const emptyShopForm = { shopName: '', ownerName: '', email: '', password: '', phone: '', whatsapp: '', city: '', address: '' };
const emptyUserForm = { shopId: '', name: '', email: '', password: '', role: 'shop_account' };
const invoiceThemeColors = { blue: '#0757a6', teal: '#0f766e', violet: '#6d3fb3', graphite: '#3f4b5b' };

export default function SuperAdminPage({ user, onLogout }) {
  const [summary, setSummary] = useState({ shops: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [shopFilter, setShopFilter] = useState('all');
  const [modal, setModal] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [shopForm, setShopForm] = useState(emptyShopForm);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [designForm, setDesignForm] = useState({ shopId: '', theme: 'blue', accentColor: invoiceThemeColors.blue, logo: '', removeLogo: false });

  async function loadSummary() {
    setError('');
    try {
      const result = await apiRequest('/admin/summary');
      setSummary({ shops: result.shops || [], users: result.users || [] });
    } catch (err) {
      setError(err.message || 'Could not load platform accounts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSummary(); }, []);

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return summary.users.filter((account) => {
      const matchesShop = shopFilter === 'all' || String(account.shopId) === shopFilter;
      const matchesQuery = !query || [account.name, account.email, account.shopName, account.role]
        .some((value) => String(value || '').toLowerCase().includes(query));
      return matchesShop && matchesQuery;
    });
  }, [summary.users, search, shopFilter]);

  function openAddShop() {
    setError(''); setNotice(''); setShopForm(emptyShopForm); setModal('shop');
  }

  function openAddUser() {
    setError(''); setNotice(''); setUserForm({ ...emptyUserForm, shopId: shopFilter === 'all' ? summary.shops[0]?.id || '' : shopFilter }); setEditingUser(null); setModal('user');
  }

  function openInvoiceDesign() {
    const shop = summary.shops.find((item) => String(item.id) === String(shopFilter)) || summary.shops[0];
    if (!shop) return;
    const design = shop.invoiceDesign || {};
    setError(''); setNotice('');
    setDesignForm({ shopId: String(shop.id), theme: design.theme || 'blue', accentColor: design.accentColor || invoiceThemeColors[design.theme] || invoiceThemeColors.blue, logo: '', removeLogo: false });
    setModal('design');
  }

  function changeDesignShop(shopId) {
    const shop = summary.shops.find((item) => String(item.id) === String(shopId));
    const design = shop?.invoiceDesign || {};
    setDesignForm({ shopId: String(shopId), theme: design.theme || 'blue', accentColor: design.accentColor || invoiceThemeColors[design.theme] || invoiceThemeColors.blue, logo: '', removeLogo: false });
  }

  function chooseInvoiceLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 240 * 1024) {
      setError('Choose a PNG, JPEG, or WebP logo smaller than 240 KB.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setDesignForm((current) => ({ ...current, logo: String(reader.result || ''), removeLogo: false }));
    reader.onerror = () => setError('The logo could not be read. Please choose it again.');
    reader.readAsDataURL(file);
  }

  async function saveInvoiceDesign(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      await apiRequest(`/admin/shops/${designForm.shopId}/invoice-design`, {
        method: 'PUT',
        body: { invoiceDesign: { theme: designForm.theme, accentColor: designForm.accentColor, ...(designForm.logo ? { logo: designForm.logo } : {}), removeLogo: designForm.removeLogo } },
      });
      const shopName = summary.shops.find((shop) => String(shop.id) === designForm.shopId)?.name || 'shop';
      setModal(''); setNotice(`Invoice design saved for ${shopName}.`); await loadSummary();
    } catch (err) { setError(err.message || 'Could not save invoice design.'); }
    finally { setSaving(false); }
  }

  function openEditUser(account) {
    setError(''); setNotice(''); setEditingUser(account);
    setUserForm({ shopId: account.shopId, name: account.name, email: account.email, password: '', role: account.role });
    setModal('edit');
  }

  async function submitShop(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      await apiRequest('/admin/shops', { method: 'POST', body: shopForm });
      setModal(''); setNotice(`Created ${shopForm.shopName} and its owner account.`); await loadSummary();
    } catch (err) { setError(err.message || 'Could not create the shop.'); }
    finally { setSaving(false); }
  }

  async function submitUser(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      await apiRequest('/admin/users', { method: 'POST', body: userForm });
      setModal(''); setNotice(`Created ${userForm.role.replace('_', ' ')} access for ${userForm.name}.`); await loadSummary();
    } catch (err) { setError(err.message || 'Could not create the account.'); }
    finally { setSaving(false); }
  }

  async function saveUser(event) {
    event.preventDefault(); if (!editingUser) return; setSaving(true); setError(''); setNotice('');
    try {
      await apiRequest(`/admin/users/${editingUser.id}`, {
        method: 'PUT',
        body: { name: userForm.name, email: userForm.email, role: userForm.role, newPassword: userForm.password || undefined },
      });
      setModal(''); setNotice(`Updated access for ${userForm.name}.`); await loadSummary();
    } catch (err) { setError(err.message || 'Could not update the account.'); }
    finally { setSaving(false); }
  }

  async function toggleAccount(account) {
    const action = account.active ? 'deactivate' : 'reactivate';
    if (!window.confirm(`${action === 'deactivate' ? 'Deactivate' : 'Reactivate'} ${account.email}? ${account.active ? 'Their current sessions will stop working on the next request.' : 'They will be able to sign in again.'}`)) return;
    setError(''); setNotice('');
    try {
      await apiRequest(`/admin/users/${account.id}`, { method: 'PUT', body: { active: !account.active } });
      setNotice(`${account.name} is now ${account.active ? 'deactivated' : 'active'}.`); await loadSummary();
    } catch (err) { setError(err.message || 'Could not update account status.'); }
  }

  const activeUsers = summary.users.filter((account) => account.active).length;

  return (
    <main className="platform-admin-page">
      <header className="platform-admin-header">
        <div className="platform-admin-brand"><span><ShieldCheck size={23} /></span><div><small>ELECTRONIKI · PLATFORM CONTROL</small><h1>Super Admin</h1></div></div>
        <div className="platform-admin-profile"><div><b>{user?.name || 'Platform Admin'}</b><small>{user?.email}</small></div><button type="button" className="btn ghost" onClick={onLogout}><LogOut size={15} /> Sign out</button></div>
      </header>

      <section className="platform-admin-intro">
        <div><p className="platform-admin-kicker">ACCOUNT CONTROL</p><h2>Manage every shop and its access</h2><p>Create store owners, add staff or overview users, update access, and disable accounts when needed.</p></div>
        <div className="platform-admin-actions"><button type="button" className="btn ghost" onClick={openInvoiceDesign} disabled={!summary.shops.length}><FileText size={16} /> Invoice design</button><button type="button" className="btn ghost" onClick={openAddUser} disabled={!summary.shops.length}><Plus size={16} /> Add account</button><button type="button" className="btn" onClick={openAddShop}><Store size={16} /> Add new shop</button></div>
      </section>

      {error && !modal && <div className="platform-admin-alert error" role="alert">{error}</div>}
      {notice && !modal && <div className="platform-admin-alert success" role="status">{notice}</div>}

      <section className="platform-admin-stats">
        <article><span><Store size={18} /></span><small>Total shops</small><strong>{summary.shops.length}</strong></article>
        <article><span><Users size={18} /></span><small>Active accounts</small><strong>{activeUsers}</strong></article>
        <article><span><UserRound size={18} /></span><small>Disabled accounts</small><strong>{summary.users.length - activeUsers}</strong></article>
      </section>

      <section className="platform-admin-card">
        <div className="platform-admin-card-head"><div><h3>Shop accounts</h3><p>Accounts are always tied to one selected shop.</p></div><label className="platform-admin-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or shop" /></label></div>
        <div className="platform-admin-shop-list">
          <button type="button" className={shopFilter === 'all' ? 'active' : ''} onClick={() => setShopFilter('all')}><Building2 size={15} /><span>All shops</span><b>{summary.users.length}</b></button>
          {summary.shops.map((shop) => <button type="button" className={shopFilter === String(shop.id) ? 'active' : ''} key={shop.id} onClick={() => setShopFilter(String(shop.id))}><Store size={15} /><span>{shop.name}<small>{shop.city || shop.phone || 'Shop workspace'}</small></span><b>{shop.usersCount}</b></button>)}
        </div>
        <div className="platform-admin-table-wrap">
          <table className="platform-admin-table"><thead><tr><th>Account</th><th>Shop</th><th>Access role</th><th>Status</th><th>Last sign in</th><th>Actions</th></tr></thead>
            <tbody>{loading ? <tr><td colSpan="6" className="platform-admin-empty">Loading accounts…</td></tr> : visibleUsers.length ? visibleUsers.map((account) => <tr key={account.id}>
              <td><b>{account.name}</b><small>{account.email}</small></td><td>{account.shopName}</td><td><span className="platform-admin-role">{account.role === 'overview_viewer' ? 'Overview only' : account.role === 'owner' ? 'Shop owner' : 'Shop account'}</span></td><td><span className={`platform-admin-status ${account.active ? 'active' : 'inactive'}`}>{account.active ? 'Active' : 'Disabled'}</span></td><td>{account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleDateString() : 'Never'}</td><td><div className="platform-admin-row-actions"><button type="button" className="btn ghost small" onClick={() => openEditUser(account)}><KeyRound size={14} /> Edit</button><button type="button" className={`btn small ${account.active ? 'secondary' : ''}`} onClick={() => toggleAccount(account)}>{account.active ? 'Disable' : 'Enable'}</button></div></td>
            </tr>) : <tr><td colSpan="6" className="platform-admin-empty">No accounts match this search.</td></tr>}</tbody>
          </table>
        </div>
      </section>

      {modal && <div className="platform-admin-modal-backdrop" onClick={(event) => event.target === event.currentTarget && setModal('')}>
        <div className="platform-admin-modal" role="dialog" aria-modal="true">
          <div className="platform-admin-modal-head"><div><small>PLATFORM ACCESS</small><h2>{modal === 'design' ? 'Invoice design for a shop' : modal === 'shop' ? 'Create a shop and owner' : modal === 'edit' ? 'Edit shop account' : 'Add account to a shop'}</h2><p>{modal === 'design' ? 'Each shop keeps its own invoice style and logo.' : modal === 'shop' ? 'This creates an isolated workspace and its first owner login.' : 'Choose exactly which store this account can access.'}</p></div><button type="button" className="icon-btn" onClick={() => setModal('')}>×</button></div>
          {error && <div className="platform-admin-alert error">{error}</div>}
          {modal === 'design' ? <form onSubmit={saveInvoiceDesign} className="platform-admin-form">
            <label>Shop<select required value={designForm.shopId} onChange={(event) => changeDesignShop(event.target.value)}><option value="">Choose shop</option>{summary.shops.map((shop) => <option value={shop.id} key={shop.id}>{shop.name}</option>)}</select></label>
            <div className="platform-admin-form-row"><label>Theme<select value={designForm.theme} onChange={(event) => setDesignForm({ ...designForm, theme: event.target.value, accentColor: invoiceThemeColors[event.target.value] || invoiceThemeColors.blue })}><option value="blue">Classic Blue</option><option value="teal">Teal</option><option value="violet">Violet</option><option value="graphite">Graphite</option></select></label><label>Accent color<input type="color" value={designForm.accentColor} onChange={(event) => setDesignForm({ ...designForm, accentColor: event.target.value })} style={{ width: 80, padding: 3 }} /></label></div>
            <label>Shop logo (PNG, JPEG, or WebP; max 240 KB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseInvoiceLogo} /></label>
            {(() => { const selected = summary.shops.find((shop) => String(shop.id) === designForm.shopId); const preview = designForm.logo || (designForm.removeLogo ? '' : selected?.invoiceDesign?.logo || ''); return preview ? <div className="platform-admin-logo-preview"><img src={preview} alt="Selected shop logo preview" /><button type="button" className="btn ghost small" onClick={() => setDesignForm({ ...designForm, logo: '', removeLogo: true })}>Remove logo</button></div> : null; })()}
            <p className="platform-admin-form-note">Invoice design is isolated per shop; accounts in a shop share its invoice branding.</p>
            <div className="platform-admin-modal-actions"><button type="button" className="btn ghost" onClick={() => setModal('')}>Cancel</button><button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save invoice design'}</button></div>
          </form> : modal === 'shop' ? <form onSubmit={submitShop} className="platform-admin-form">
            <label>Shop name<input required value={shopForm.shopName} onChange={(event) => setShopForm({ ...shopForm, shopName: event.target.value })} /></label>
            <label>Owner name<input required value={shopForm.ownerName} onChange={(event) => setShopForm({ ...shopForm, ownerName: event.target.value })} /></label>
            <div className="platform-admin-form-row"><label>Owner email<input type="email" required autoComplete="off" value={shopForm.email} onChange={(event) => setShopForm({ ...shopForm, email: event.target.value })} /></label><label>Temporary password<input type="password" required minLength="12" autoComplete="new-password" value={shopForm.password} onChange={(event) => setShopForm({ ...shopForm, password: event.target.value })} /></label></div>
            <div className="platform-admin-form-row"><label>Phone<input value={shopForm.phone} onChange={(event) => setShopForm({ ...shopForm, phone: event.target.value })} /></label><label>WhatsApp<input value={shopForm.whatsapp} onChange={(event) => setShopForm({ ...shopForm, whatsapp: event.target.value })} /></label></div>
            <div className="platform-admin-form-row"><label>City<input value={shopForm.city} onChange={(event) => setShopForm({ ...shopForm, city: event.target.value })} /></label><label>Address<input value={shopForm.address} onChange={(event) => setShopForm({ ...shopForm, address: event.target.value })} /></label></div>
            <p className="platform-admin-form-note">Use a unique email and at least 12 characters for the temporary password.</p>
            <div className="platform-admin-modal-actions"><button type="button" className="btn ghost" onClick={() => setModal('')}>Cancel</button><button type="submit" className="btn" disabled={saving}>{saving ? 'Creating…' : 'Create shop'}</button></div>
          </form> : <form onSubmit={modal === 'edit' ? saveUser : submitUser} className="platform-admin-form">
            {modal === 'user' && <label>Shop<select required value={userForm.shopId} onChange={(event) => setUserForm({ ...userForm, shopId: event.target.value })}><option value="">Choose shop</option>{summary.shops.map((shop) => <option value={shop.id} key={shop.id}>{shop.name}</option>)}</select></label>}
            <div className="platform-admin-form-row"><label>Full name<input required value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} /></label><label>Email<input type="email" required value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></label></div>
            <label>Access role<select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}><option value="owner">Shop owner · full store control</option><option value="shop_account">Shop account · store operations</option><option value="overview_viewer">Overview only · read-only</option></select></label>
            <label>{modal === 'edit' ? 'New password (leave blank to keep current)' : 'Temporary password'}<input type="password" autoComplete="new-password" minLength="12" required={modal !== 'edit'} value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} /></label>
            <p className="platform-admin-form-note">Passwords need at least 12 characters. Disabling an account blocks future requests but preserves its records.</p>
            <div className="platform-admin-modal-actions"><button type="button" className="btn ghost" onClick={() => setModal('')}>Cancel</button><button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : modal === 'edit' ? 'Save account' : 'Create account'}</button></div>
          </form>}
        </div>
      </div>}
    </main>
  );
}
