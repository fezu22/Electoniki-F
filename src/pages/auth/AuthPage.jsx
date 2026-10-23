import React, { useState } from 'react';
import {
  ArrowRight, BarChart3, Eye, EyeOff, FileText, LockKeyhole, Mail, Package,
  ShieldCheck, ShoppingCart, Store,
} from 'lucide-react';
import { apiRequest, setSessionToken } from '../../api.js';

const REMEMBERED_EMAIL_KEY = 'electroniki.rememberedEmail';

function ElectronikiMark({ small = false }) {
  return (
    <span className={`electroniki-mark${small ? ' small' : ''}`} aria-hidden="true">
      <img src="/electroniki-assets/electroniki-logo.png" alt="" />
    </span>
  );
}

function InventoryIllustration() {
  const productItems = [
    { image: 'ceiling_fan.png', name: 'Ceiling Fan', tone: 'blue' },
    { image: 'led_bulb.jpg', name: 'LED Bulb', tone: 'mint' },
    { image: 'wall_switch_socket.jpg', name: 'Switch & Socket', tone: 'violet' },
    { image: 'table_fan.jpg', name: 'Table Fan', tone: 'orange' },
    { image: 'electric_kettle.jpg', name: 'Electric Kettle', tone: 'sky' },
    { image: 'barcode_scanner-clean.png', name: 'Barcode Scanner', tone: 'blue' },
  ];

  return (
    <div className="inventory-scene" aria-label="Illustrated inventory overview with shop analytics and products">
      <div className="scene-orb scene-orb-one" />
      <div className="scene-orb scene-orb-two" />
      <div className="scene-product scene-product-fan"><img src="/electroniki-assets/ceiling_fan.png" alt="" /></div>
      <div className="scene-product scene-product-bulb"><img src="/electroniki-assets/led_bulb.jpg" alt="" /></div>
      <div className="scene-product scene-product-washer"><img src="/electroniki-assets/electric_kettle.jpg" alt="" /></div>
      <div className="scene-product scene-product-cart"><img src="/electroniki-assets/barcode_scanner-clean.png" alt="" /></div>
      <section className="inventory-dashboard-card">
        <div className="inventory-dashboard-head">
          <div><span className="dashboard-live-dot" /> STORE OVERVIEW</div>
          <span className="dashboard-period">This month <span>⌄</span></span>
        </div>
        <h2>Inventory overview</h2>
        <div className="inventory-stat-grid">
          <div className="inventory-stat"><span className="stat-icon stat-blue"><Package size={17} /></span><b>256</b><small>Total products</small></div>
          <div className="inventory-stat"><span className="stat-icon stat-mint"><ShoppingCart size={17} /></span><b>48</b><small>Today’s sales</small></div>
          <div className="inventory-stat"><span className="stat-icon stat-orange"><Store size={17} /></span><b>32</b><small>Customers</small></div>
          <div className="inventory-stat"><span className="stat-icon stat-violet"><BarChart3 size={17} /></span><b>24.8k</b><small>Revenue</small></div>
        </div>
        <div className="scene-chart-head"><strong>Sales overview</strong><span>Last 12 months</span></div>
        <div className="scene-chart">
          <div className="scene-chart-grid"><i /><i /><i /><i /></div>
          <div className="scene-bars" aria-hidden="true">
            {[32, 45, 38, 58, 47, 64, 53, 74, 66, 84, 69, 92].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
          </div>
          <svg viewBox="0 0 520 110" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 78 C30 73 35 55 65 61 S105 52 130 60 S165 89 195 73 S230 78 255 53 S293 64 320 43 S355 57 385 30 S420 39 445 24 S485 33 520 8" />
            {[0, 65, 130, 195, 255, 320, 385, 445, 520].map((x, i) => <circle key={i} cx={x} cy={[78,61,60,73,53,43,30,24,8][i]} r="3.2" />)}
          </svg>
          <div className="scene-chart-months"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span></div>
        </div>
        <div className="scene-products-head"><strong>Popular products</strong><span>View inventory <ArrowRight size={11} /></span></div>
        <div className="scene-products">
          {productItems.map(({ image, name, tone }) => <div className="scene-product-card" key={name}><span className={`scene-product-icon ${tone}`}><img src={`/electroniki-assets/${image}`} alt="" /></span><small>{name}</small></div>)}
        </div>
      </section>
      <div className="scene-base" />
    </div>
  );
}

export default function AuthView({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resetRequested, setResetRequested] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    try { return localStorage.getItem(REMEMBERED_EMAIL_KEY) !== ''; } catch { return true; }
  });
  const [login, setLogin] = useState(() => {
    let email = '';
    try { email = localStorage.getItem(REMEMBERED_EMAIL_KEY) || ''; } catch { /* storage can be unavailable */ }
    return { email, password: '' };
  });
  const [reset, setReset] = useState({ email: '', code: '', password: '' });

  const clearMessages = () => { setError(''); setInfo(''); };
  const changeMode = (next) => { setMode(next); clearMessages(); setResetRequested(false); };

  async function handleLogin(event) {
    event.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const result = await apiRequest('/auth/login', { method: 'POST', body: login });
      try {
        if (rememberMe) localStorage.setItem(REMEMBERED_EMAIL_KEY, login.email.trim());
        else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      } catch { /* sign-in should work when browser storage is disabled */ }
      setSessionToken(result.token);
      await onAuthenticated(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestReset(event) {
    event.preventDefault(); clearMessages(); setLoading(true);
    try {
      const result = await apiRequest('/auth/forgot-password', { method: 'POST', body: { email: reset.email } });
      setInfo(result.message);
      setResetRequested(true);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleReset(event) {
    event.preventDefault(); clearMessages(); setLoading(true);
    try {
      const result = await apiRequest('/auth/reset-password', {
        method: 'POST', body: { email: reset.email, resetCode: reset.code, newPassword: reset.password },
      });
      setInfo(result.message);
      setLogin((current) => ({ ...current, email: reset.email, password: '' }));
      setMode('login'); setResetRequested(false);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  const features = [
    { icon: Package, title: 'Inventory', detail: 'Management' },
    { icon: ShoppingCart, title: 'Sales', detail: 'Tracking' },
    { icon: BarChart3, title: 'Product', detail: 'Catalog' },
    { icon: FileText, title: 'Smart', detail: 'Reports' },
  ];

  return (
    <main className={`auth-page electroniki-auth-page${mode === 'reset' ? ' electroniki-reset-screen' : ''}`}>
      <section className="auth-brand-panel electroniki-brand-panel">
        <div className="electroniki-brand-content">
          <div className="electroniki-brand-title"><h1>ELECTRONIKI</h1><p>Manage your store with ease.</p></div>
          <div className="electroniki-feature-row">
            {features.map(({ icon: Icon, title, detail }) => <div className="electroniki-feature" key={title}><span><Icon size={20} strokeWidth={2.2} /></span><div>{title}<br />{detail}</div></div>)}
          </div>
          <InventoryIllustration />
        </div>
        <div className="electroniki-brand-footer"><ShieldCheck size={15} /> Your shop workspace stays private and secure</div>
      </section>

      <section className="auth-form-panel electroniki-form-panel">
        <div className="electroniki-form-wrap">
          <div className="electroniki-login-brand"><ElectronikiMark small /><strong>ELECTRONIKI</strong></div>
          <div className="auth-form-heading electroniki-form-heading">
            <span className="auth-eyebrow">{mode === 'reset' ? 'ACCOUNT RECOVERY' : 'WELCOME BACK'}</span>
            <h2>{mode === 'reset' ? 'Reset your password' : 'Welcome Back'}</h2>
            <p>{mode === 'reset' ? 'We’ll send a verification code to your registered email.' : 'Sign in to manage your store.'}</p>
          </div>

          {error && <div className="auth-alert error" role="alert">{error}</div>}
          {info && <div className="auth-alert info" role="status">{info}</div>}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="auth-form electroniki-login-form">
              <label className="auth-input-label electroniki-input-label">Email or Username
                <span className="auth-input-wrap electroniki-input-wrap"><Mail size={19} /><input type="email" required autoComplete="username" placeholder="Enter your email or username" value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} /></span>
              </label>
              <label className="auth-input-label electroniki-input-label">Password
                <span className="auth-input-wrap electroniki-input-wrap"><LockKeyhole size={19} /><input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" placeholder="Enter your password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} /><button className="auth-eye electroniki-eye" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button></span>
              </label>
              <div className="auth-form-meta electroniki-form-meta"><label className="electroniki-remember"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span className="electroniki-checkmark" />Remember Me</label><button type="button" onClick={() => { setReset({ ...reset, email: login.email }); changeMode('reset'); }}>Forgot Password?</button></div>
              <button type="submit" className="auth-submit electroniki-submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</button>
            </form>
          ) : (
            <div className="electroniki-reset-wrap">
              {!resetRequested ? (
                <form onSubmit={handleRequestReset} className="auth-form electroniki-login-form">
                  <label className="auth-input-label electroniki-input-label">Registered email<input type="email" required autoComplete="email" placeholder="Enter your registered email" value={reset.email} onChange={(event) => setReset({ ...reset, email: event.target.value })} /></label>
                  <button type="submit" className="auth-submit electroniki-submit" disabled={loading}>{loading ? 'Sending code…' : 'Send Reset Code'}</button>
                </form>
              ) : (
                <form onSubmit={handleReset} className="auth-form electroniki-login-form">
                  <label className="auth-input-label electroniki-input-label">Six-digit email code<input inputMode="numeric" maxLength={6} required value={reset.code} onChange={(event) => setReset({ ...reset, code: event.target.value })} /></label>
                  <label className="auth-input-label electroniki-input-label">New password<input type="password" minLength={8} required autoComplete="new-password" value={reset.password} onChange={(event) => setReset({ ...reset, password: event.target.value })} /></label>
                  <button type="submit" className="auth-submit electroniki-submit" disabled={loading}>{loading ? 'Updating…' : 'Update Password'}</button>
                </form>
              )}
              <div className="auth-switch electroniki-back"><button type="button" onClick={() => changeMode('login')}>← Back to sign in</button></div>
            </div>
          )}
          <div className="auth-form-footer electroniki-form-footer">© 2024 Electroniki. All rights reserved.</div>
        </div>
      </section>
    </main>
  );
}
