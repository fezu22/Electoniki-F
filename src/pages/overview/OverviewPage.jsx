import React from 'react';
import { money } from '../../api.js';

export default function OverviewPage({ data, onLogout }) {
  const cards = [
    ['Sales today', money(data.summary?.todaySales), `${data.summary?.todayBillsCount || 0} bills today`],
    ['Sales this period', money(data.summary?.netSales), `${data.summary?.periodBillsCount || 0} bills recorded`],
    ['Collected payments', money(data.summary?.collectedPayments), 'Cash, bank and installments'],
    ['Customer balances', money(data.summary?.totalCustomerOutstanding), 'Installments and credit'],
    ['Stock at cost', money(data.summary?.stockCostValuation), `${Number(data.summary?.stockUnits || 0).toLocaleString()} units available`],
    ['Shop expenses', money(data.summary?.expensesTotal), `${data.summary?.expensesCount || 0} entries`],
    ['Net profit', money(data.summary?.netProfit), 'Sales less costs, returns and expenses'],
    ['Supplier payables', money(data.summary?.supplierPayablesTotal), 'Current outstanding balance'],
  ];
  return (
    <main className="overview-viewer-page">
      <header className="overview-viewer-header">
        <div><span className="overview-viewer-kicker">READ-ONLY SHOP OVERVIEW</span><h1>{data.shop?.name || 'Shop Overview'}</h1></div>
        <button type="button" className="btn ghost" onClick={onLogout}>Sign out</button>
      </header>
      <div className="overview-viewer-grid">
        {cards.map(([label, value, note]) => <section className="card overview-viewer-card" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></section>)}
      </div>
    </main>
  );
}
