import React, { useEffect, useState } from 'react';
import { apiRequest, money } from '../../api.js';

const timeLabel = (value) => value ? new Date(value).toLocaleString() : '—';

export default function CashRegisterPage({ onRefresh, notify, showAlert }) {
  const [current, setCurrent] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadRegister() {
    setLoading(true);
    try {
      const result = await apiRequest('/cash-register');
      setCurrent(result.current || null);
      setSessions(result.sessions || []);
    } catch (error) {
      showAlert('Cash register unavailable', error.message, 'warning');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRegister(); }, []);

  async function submit(action) {
    const amount = action === 'open' ? openingAmount : closingAmount;
    if (amount === '' || !Number.isFinite(Number(amount)) || Number(amount) < 0) {
      showAlert('Check cash amount', 'Enter a valid amount before continuing.', 'warning');
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
      notify(action === 'open' ? 'Cash register opened.' : `Cash register closed. Difference: ${money(result.session.difference)}.`);
      await loadRegister();
      await onRefresh?.();
    } catch (error) {
      showAlert(action === 'open' ? 'Could not open register' : 'Could not close register', error.message, 'warning');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cash-session-page">
      <section className="card" style={{ padding: 22 }}>
        <div className="cash-session-head">
          <div>
            <h2>Cash Register</h2>
            <p className="muted">Record the cash drawer at opening and reconcile it at closing.</p>
          </div>
          <span className={`cash-session-state ${current ? 'open' : ''}`}>{current ? 'Open' : 'Closed'}</span>
        </div>

        {loading ? <p className="muted">Loading cash register…</p> : current ? (
          <>
            <div className="cash-session-kpis">
              <div className="cash-session-kpi"><small>Opening cash</small><b>{money(current.openingAmount)}</b><span>{timeLabel(current.openedAt)}</span></div>
              <div className="cash-session-kpi"><small>Cash received</small><b>{money(current.cashIn)}</b><span>Cash sales and receipts</span></div>
              <div className="cash-session-kpi"><small>Cash paid out</small><b>{money(current.cashOut)}</b><span>Cash expenses and refunds</span></div>
              <div className="cash-session-kpi"><small>Expected in drawer</small><b>{money(current.expectedClosingAmount)}</b><span>Opening + received − paid out</span></div>
            </div>
            <div className="fields" style={{ marginTop: 18 }}>
              <label className="field">Counted closing cash (Rs.)<input type="number" min="0" step="1" value={closingAmount} onChange={(event) => setClosingAmount(event.target.value)} placeholder="Count the cash in the drawer" /></label>
              <label className="field">Closing note (optional)<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Short / extra cash reason" /></label>
            </div>
            <button type="button" className="btn" style={{ marginTop: 14 }} disabled={saving} onClick={() => submit('close')}>{saving ? 'Saving…' : 'Close register and reconcile'}</button>
          </>
        ) : (
          <>
            <p>No cash session is open. Count the cash currently in the drawer to start today’s session.</p>
            <div className="fields" style={{ maxWidth: 680 }}>
              <label className="field">Opening cash (Rs.)<input type="number" min="0" step="1" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} placeholder="Cash counted at opening" /></label>
              <label className="field">Opening note (optional)<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Float or handover note" /></label>
            </div>
            <button type="button" className="btn" style={{ marginTop: 14 }} disabled={saving} onClick={() => submit('open')}>{saving ? 'Saving…' : 'Open cash register'}</button>
          </>
        )}
      </section>

      <section className="card cash-session-history" style={{ padding: 22 }}>
        <h3>Recent cash sessions</h3>
        {sessions.length ? <div className="table-wrap"><table><thead><tr><th>Opened</th><th>Opened by</th><th>Opening</th><th>Expected</th><th>Counted</th><th>Difference</th><th>Status</th></tr></thead><tbody>
          {sessions.map((session) => <tr key={session.id}><td>{timeLabel(session.openedAt)}</td><td>{session.openedBy || '—'}</td><td>{money(session.openingAmount)}</td><td>{session.status === 'open' ? money(current?.expectedClosingAmount) : money(session.expectedClosingAmount)}</td><td>{session.status === 'open' ? '—' : money(session.actualClosingAmount)}</td><td>{session.status === 'open' ? '—' : money(session.difference)}</td><td>{session.status === 'open' ? 'Open' : 'Closed'}</td></tr>)}
        </tbody></table></div> : <p className="muted">No cash sessions have been recorded yet.</p>}
      </section>
    </div>
  );
}
