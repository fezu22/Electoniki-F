import React, { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Banknote, CalendarDays, Check, CircleAlert, Clock3, History, RotateCw, Wallet } from 'lucide-react';
import NumericInput from '../../components/NumericInput.jsx';
import { apiRequest, money } from '../../api.js';

const timeLabel = (value) => value
  ? new Intl.DateTimeFormat('en-PK', {
      timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date(value))
  : '—';

const localBusinessDate = () => new Intl.DateTimeFormat('en-PK', {
  timeZone: 'Asia/Karachi', dateStyle: 'full',
}).format(new Date());

const businessDateKey = (value) => {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const date = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map(({ type, value: partValue }) => [type, partValue]));
  return `${date.year}-${date.month}-${date.day}`;
};

const movementNames = {
  sale_receipt: 'Cash sales',
  installment_receipt: 'Installment receipts',
  customer_receipt: 'Customer payments',
  supplier_payment: 'Supplier payments',
  expense: 'Expenses',
  return_refund: 'Cash refunds',
  other_cash_movement: 'Other cash movements',
};

const formatMovementBreakdown = (breakdown = {}) => Object.entries(breakdown)
  .filter(([, amount]) => Number(amount) !== 0)
  .map(([type, amount]) => `${movementNames[type] || type.replaceAll('_', ' ')} ${money(amount)}`)
  .join(' · ');

function SummaryTile({ icon: Icon, label, amount, caption, tone = '' }) {
  return (
    <div className={`cash-register-tile ${tone}`}>
      <div className="cash-register-tile-top">
        <span className="cash-register-tile-icon"><Icon size={17} /></span>
        <small>{label}</small>
      </div>
      <strong>{money(amount)}</strong>
      <span className="cash-register-tile-caption">{caption}</span>
    </div>
  );
}

export default function CashRegisterPage({ data, onRefresh, notify, showAlert }) {
  const [current, setCurrent] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [installmentReviewConfirmed, setInstallmentReviewConfirmed] = useState(false);

  async function loadRegister() {
    setLoading(true);
    try {
      const result = await apiRequest('/cash-register');
      setCurrent(result.current || null);
      setSessions(result.sessions || []);
      setInstallmentReviewConfirmed(false);
    } catch (error) {
      showAlert('Daily opening & closing unavailable', error.message, 'warning');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRegister(); }, []);

  async function submit(action) {
    if (action === 'close' && installmentReviewRows.length > 0 && !installmentReviewConfirmed) {
      showAlert('Review installment collections first', 'Check this month’s installment list before closing the day.', 'warning');
      return;
    }
    const amount = action === 'open' ? openingAmount : closingAmount;
    if (amount === '' || !Number.isFinite(Number(amount)) || Number(amount) < 0) {
      showAlert('Check cash amount', 'Enter the cash counted in the drawer before continuing.', 'warning');
      return;
    }
    setSaving(true);
    try {
      const result = await apiRequest(`/cash-register/${action}`, {
        method: 'POST',
        body: action === 'open'
          ? { openingAmount: Number(amount), note }
          : { actualClosingAmount: Number(amount), note },
      });
      setCurrent(action === 'open' ? result.session : null);
      setOpeningAmount('');
      setClosingAmount('');
      setNote('');
      notify(action === 'open' ? 'Daily opening saved.' : `Daily closing saved. Difference: ${money(result.session.difference)}.`);
      await loadRegister();
      await onRefresh?.();
    } catch (error) {
      showAlert(action === 'open' ? 'Could not open register' : 'Could not close register', error.message, 'warning');
    } finally {
      setSaving(false);
    }
  }

  const expected = Number(current?.expectedClosingAmount || 0);
  const hasClosingCount = closingAmount !== '' && Number.isFinite(Number(closingAmount));
  const liveDifference = hasClosingCount ? Number(closingAmount) - expected : null;
  const negativeExpectedSessions = sessions.filter((session) => Number(session.expectedClosingAmount) < 0);
  const todayKey = businessDateKey(new Date());
  const monthKey = todayKey.slice(0, 7);
  const [year, month] = monthKey.split('-').map(Number);
  const monthEndKey = `${monthKey}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')}`;
  const paidThisMonth = new Map();
  for (const payment of data?.installmentPayments || []) {
    if (businessDateKey(payment.createdAt).slice(0, 7) !== monthKey) continue;
    const planId = String(payment.planId || '');
    if (!planId) continue;
    paidThisMonth.set(planId, (paidThisMonth.get(planId) || 0) + Number(payment.amount || 0));
  }
  const installmentReviewRows = (data?.installmentPlans || [])
    .map((plan) => {
      const planId = String(plan.id || plan._id || '');
      const paidAmount = paidThisMonth.get(planId) || 0;
      const balance = Number(plan.balance || 0);
      const dueDate = String(plan.nextDueDate || '');
      const dueThisMonthOrOverdue = balance > 0 && dueDate && dueDate !== 'Completed' && dueDate <= monthEndKey;
      if (!paidAmount && !dueThisMonthOrOverdue) return null;
      const monthlyAmount = Number(plan.monthlyAmount || 0);
      const status = balance <= 0 || monthlyAmount > 0 && paidAmount >= Math.min(monthlyAmount, balance + paidAmount)
        ? 'Paid'
        : paidAmount > 0 ? 'Part paid' : 'Not received';
      return { ...plan, id: planId, paidAmount, monthlyAmount, status };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.customerName).localeCompare(String(b.customerName)));
  const installmentPaidCount = installmentReviewRows.filter((plan) => plan.status === 'Paid').length;

  return (
    <div className="cash-register-page">
      <section className="cash-register-hero">
        <div className="cash-register-hero-icon"><Wallet size={22} /></div>
        <div className="cash-register-hero-copy">
          <div className="cash-register-eyebrow"><CalendarDays size={14} /> {localBusinessDate()}</div>
          <h2>Daily Opening &amp; Closing</h2>
          <p>Record your opening float, track cash movement, and reconcile the drawer at closing.</p>
        </div>
        <div className={`cash-register-status ${current ? 'is-open' : 'is-closed'}`}>
          <span /> {current ? 'Day open' : 'Day closed'}
        </div>
        <button type="button" className="cash-register-refresh" onClick={loadRegister} disabled={loading || saving} title="Refresh daily opening & closing">
          <RotateCw size={16} className={loading ? 'is-spinning' : ''} />
          <span>Refresh</span>
        </button>
      </section>

      {!loading && negativeExpectedSessions.length > 0 && (
        <section className="cash-register-review-warning" role="status">
          <CircleAlert size={19} />
          <div>
            <strong>Cash ledger needs review</strong>
            <p>{negativeExpectedSessions.length === 1 ? 'A recent session' : `${negativeExpectedSessions.length} recent sessions`} ended with expected cash below zero. Check the cash-out breakdown—especially supplier payments and expenses—against how the money was actually paid. A positive difference here does not automatically mean extra cash.</p>
          </div>
        </section>
      )}

      {loading ? (
        <section className="cash-register-panel cash-register-loading">Loading today’s opening & closing…</section>
      ) : current ? (
        <>
          <section className="cash-register-panel">
            <div className="cash-register-panel-head">
              <div>
                <span className="cash-register-section-label">LIVE SESSION</span>
                <h3>Cash in the drawer</h3>
                <p><Clock3 size={14} /> Opened {timeLabel(current.openedAt)} <span>·</span> {current.openedBy || 'Staff'}</p>
              </div>
              <span className="cash-register-live-pill"><span /> Live totals</span>
            </div>

            <div className="cash-register-tiles">
              <SummaryTile icon={Banknote} label="Opening float" amount={current.openingAmount} caption="Cash counted at opening" />
              <SummaryTile icon={ArrowDownLeft} label="Cash received" amount={current.cashIn} caption={formatMovementBreakdown(current.cashInByType) || 'No cash received yet'} tone="positive" />
              <SummaryTile icon={ArrowUpRight} label="Cash paid out" amount={current.cashOut} caption={formatMovementBreakdown(current.cashOutByType) || 'No cash paid out yet'} tone="negative" />
            </div>

            <div className="cash-register-expected">
              <div>
                <span>Expected closing cash</span>
                <small>Opening float + cash received − cash paid out</small>
              </div>
              <strong>{money(expected)}</strong>
            </div>

            {expected < 0 && (
              <div className="cash-register-negative-warning">
                <CircleAlert size={17} />
                <span>Expected drawer cash is below zero. Review cash-out transactions before closing; confirm any bank-paid supplier bills were recorded as Bank, not Cash.</span>
              </div>
            )}

            <section className="cash-register-installment-review" aria-labelledby="cash-register-installment-title">
              <div className="cash-register-installment-review-head">
                <div>
                  <span className="cash-register-section-label">BEFORE CLOSING</span>
                  <h3 id="cash-register-installment-title">Installment collection check</h3>
                  <p>Review which customers paid this month and which payments are still missing.</p>
                </div>
                <strong>{installmentPaidCount}/{installmentReviewRows.length} paid</strong>
              </div>
              {installmentReviewRows.length ? (
                <>
                  <div className="table-wrap cash-register-installment-table"><table>
                    <thead><tr><th>Customer</th><th>Plan / Invoice</th><th>Monthly amount</th><th>Received this month</th><th>Status</th></tr></thead>
                    <tbody>{installmentReviewRows.map((plan) => (
                      <tr key={plan.id}>
                        <td><b>{plan.customerName || 'Customer'}</b><small>{plan.whatsapp || plan.phone || 'No phone saved'}</small></td>
                        <td>{plan.planNo || plan.invoiceNo || '—'}</td>
                        <td>{money(plan.monthlyAmount)}</td>
                        <td>{money(plan.paidAmount)}</td>
                        <td><span className={`cash-register-installment-status ${plan.status === 'Paid' ? 'paid' : plan.status === 'Part paid' ? 'partial' : 'unpaid'}`}>{plan.status}</span></td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                  <label className="cash-register-installment-confirm">
                    <input type="checkbox" checked={installmentReviewConfirmed} onChange={(event) => setInstallmentReviewConfirmed(event.target.checked)} />
                    <span>I checked this list and recorded every payment received in Installment Khata.</span>
                  </label>
                </>
              ) : (
                <p className="cash-register-installment-empty">No installment payments are due this month. You can close the day.</p>
              )}
            </section>

            <div className="cash-register-reconcile">
              <div className="cash-register-reconcile-copy">
                <span className="cash-register-section-label">END OF DAY</span>
                <h3>Count and reconcile</h3>
                <p>Count the physical cash in the drawer. Bank payments are not included.</p>
              </div>
              <div className="cash-register-reconcile-fields">
                <label className="field">
                  Actual cash counted (Rs.)
                  <NumericInput type="text" min="0" step="1" value={closingAmount} onChange={(event) => setClosingAmount(event.target.value)} placeholder="Enter drawer count" />
                </label>
                <label className="field">
                  Closing note <span className="cash-register-optional">Optional</span>
                  <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain any short or excess cash" />
                </label>
              </div>
              <div className={`cash-register-difference ${expected < 0 && liveDifference !== null ? 'ledger-review' : liveDifference === null ? '' : liveDifference === 0 ? 'matched' : liveDifference < 0 ? 'short' : 'excess'}`}>
                <div className="cash-register-difference-icon">{liveDifference === null ? <CircleAlert size={17} /> : liveDifference === 0 ? <Check size={17} /> : <CircleAlert size={17} />}</div>
                <div>
                  <small>{liveDifference === null ? 'Difference' : expected < 0 ? 'Ledger needs review' : liveDifference === 0 ? 'Drawer balanced' : liveDifference < 0 ? 'Cash short' : 'Cash excess'}</small>
                  <strong>{liveDifference === null ? 'Enter count to compare' : expected < 0 ? `Ledger below zero ${money(Math.abs(expected))}` : `${liveDifference > 0 ? '+' : ''}${money(liveDifference)}`}</strong>
                </div>
              </div>
              <div className="cash-register-reconcile-footer">
                <span>Closing the register saves this reconciliation to session history.</span>
                <button type="button" className="btn" disabled={saving || closingAmount === '' || installmentReviewRows.length > 0 && !installmentReviewConfirmed} onClick={() => submit('close')}>
                  {saving ? 'Saving…' : 'Close day & save count'}
                </button>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="cash-register-panel cash-register-open-panel">
          <div className="cash-register-open-intro">
            <div className="cash-register-open-icon"><Banknote size={22} /></div>
            <span className="cash-register-section-label">START OF DAY</span>
            <h3>Start today’s opening</h3>
            <p>Count the cash physically in the drawer before the first sale. This becomes the opening float for today’s reconciliation.</p>
          </div>
          <div className="cash-register-open-form">
            <label className="field">
              Opening cash (Rs.)
              <NumericInput type="text" min="0" step="1" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} placeholder="e.g. 10,000" />
              <small>Enter zero if starting with an empty drawer. Bank balance is tracked separately.</small>
            </label>
            <label className="field">
              Opening note <span className="cash-register-optional">Optional</span>
              <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Cash float, handover, or other note" />
            </label>
            <button type="button" className="btn" disabled={saving || openingAmount === ''} onClick={() => submit('open')}>
              {saving ? 'Saving…' : 'Open register'}
            </button>
          </div>
        </section>
      )}

      <section className="cash-register-history-panel">
        <div className="cash-register-history-head">
          <div className="cash-register-history-icon"><History size={18} /></div>
          <div><h3>Recent daily opening & closing</h3><p>Daily sessions stay in their original date, even if a closing count is missed.</p></div>
          <span>{sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}</span>
        </div>
        {sessions.length ? (
          <div className="table-wrap cash-register-table-wrap"><table>
            <thead><tr><th>Opened</th><th>Opened by</th><th>Opening float</th><th>Cash received</th><th>Cash paid out</th><th>Expected cash</th><th>Actual count</th><th>Difference</th><th>Status</th></tr></thead>
            <tbody>{sessions.map((session) => {
              const isOpen = session.status === 'open';
              const autoClosed = session.autoClosed === true;
              const expectedAmount = isOpen ? current?.expectedClosingAmount : session.expectedClosingAmount;
              const difference = Number(session.difference || 0);
              return (
                <tr key={session.id}>
                  <td>{timeLabel(session.openedAt)}</td>
                  <td>{session.openedBy || '—'}</td>
                  <td><b>{money(session.openingAmount)}</b></td>
                  <td><b>{money(session.cashIn)}</b><small className="cash-register-breakdown-text">{formatMovementBreakdown(session.cashInByType) || '—'}</small></td>
                  <td><b>{money(session.cashOut)}</b><small className="cash-register-breakdown-text">{formatMovementBreakdown(session.cashOutByType) || '—'}</small></td>
                  <td>{money(expectedAmount)}</td>
                  <td>{isOpen ? '-' : autoClosed ? 'Not counted' : money(session.actualClosingAmount)}</td>
                  <td className={isOpen ? '' : autoClosed || Number(expectedAmount) < 0 ? 'cash-register-table-review' : difference < 0 ? 'cash-register-table-short' : difference > 0 ? 'cash-register-table-excess' : 'cash-register-table-matched'}>{isOpen ? '-' : autoClosed ? 'Not reconciled' : Number(expectedAmount) < 0 ? `Ledger below zero ${money(Math.abs(Number(expectedAmount)))}` : `${difference > 0 ? '+' : ''}${money(difference)}`}</td>
                  <td><span className={`cash-register-history-status ${isOpen ? 'open' : autoClosed || Number(expectedAmount) < 0 ? 'review' : 'closed'}`}>{isOpen ? 'Open' : autoClosed ? 'Auto closed' : Number(expectedAmount) < 0 ? 'Needs review' : 'Closed'}</span></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <div className="cash-register-empty-history">No cash sessions yet. Open the register to start tracking a day.</div>}
      </section>
    </div>
  );
}
