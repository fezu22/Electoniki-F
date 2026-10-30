import React, { useState } from 'react';
import { apiRequest, money } from '../../api.js';

export default function OrdersView({ heldOrders = [], onResumeHeldOrder, onRefresh, notify, showAlert }) {
  const [search, setSearch] = useState('');

  const filtered = heldOrders.filter((o) => {
    if (o.status !== 'Held') return false;
    const q = search.trim().toLowerCase();
    return (
      !q ||
      String(o.orderNo || '').toLowerCase().includes(q) ||
      String(o.customerName || '').toLowerCase().includes(q)
    );
  });

  function deleteOrder(order) {
    showAlert('Delete held bill?', `${order.orderNo} will be removed from Held Bills. No saved sale or invoice will be changed.`, 'danger', 'Delete held bill', async () => {
      try {
        await apiRequest(`/orders/${order.id}`, { method: 'DELETE' });
        await onRefresh();
        notify(`Deleted ${order.orderNo}.`);
      } catch (error) {
        showAlert('Could not delete held bill', error.message, 'warning');
      }
    });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Orders & Held Bills</h1>
        </div>
      </div>

      <div className="mod-summary">
        <div>
          <small>Total Held / Orders</small>
          <b>{heldOrders.length}</b>
        </div>
        <div>
          <small>Held Carts Ready to Resume</small>
          <b>{heldOrders.filter((o) => o.status === 'Held').length}</b>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Saved Carts & Delivery Orders</h2>
          <input
            className="table-input"
            placeholder="Search order # or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search held orders"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            No held bills or orders found.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>{o.orderNo}</strong>
                    </td>
                    <td>{o.customerName}</td>
                    <td>
                      {(o.cartItems || []).map((i) => `${i.name} × ${i.qty}`).join(', ')}
                    </td>
                    <td>
                      <strong>{money(o.total)}</strong>
                    </td>
                    <td>
                      <span
                        className={`status ${
                          o.status === 'Completed'
                            ? ''
                            : o.status === 'Cancelled'
                            ? 'overdue'
                            : 'pending'
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td>
                      {o.updatedAt
                        ? new Date(o.updatedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Today'}
                    </td>
                    <td>
                      <div className="inline">
                        {o.status === 'Held' && (
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => onResumeHeldOrder(o)}
                          >
                            Resume in POS →
                          </button>
                        )}
                        <button type="button" className="btn danger small" onClick={() => deleteOrder(o)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
