import React from 'react';
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
import { apiRequest, money, num } from '../../api.js';

export default function NewSalePage({ app }) {
  const { BANK_CARDS, data, page, cart, setCart, customerId, setCustomerId, salePhone, setSalePhone, saleCnic, setSaleCnic, saleAddress, setSaleAddress, customerInfo, setCustomerInfo, billDiscount, setBillDiscount, saleType, setSaleType, plan, setPlan, salePayment, setSalePayment, productSearch, setProductSearch, setSelectedSearchProductId, newQty, setNewQty, newPrice, setNewPrice, showSuggestions, setShowSuggestions, savingSale, setShowInstallmentCustomerModal, setShowNewCustomerModal, setEditingCustomerRecord, showAlert, gross, appliedDiscount, discounted, add, finalTotal, resetSaleAmounts, cashRec, advanceOrPaid, remainingBalance, excessPayment, monthlyInstallment, handleAddItemToCart, updateCartItemField, handleHoldBill, handleSaveSale, dateText, matchingSearchProducts } = app;
  return (
              <>
                <div className="page-head">
                  <div>
                    <h1>New Sale</h1>
                  </div>
                </div>

                <div className="grid sale-grid">
                  <div className="stack">
                    {/* Customer & Invoice Card */}
                    <section className="card">
                      <div className="card-head">
                        <h2>Customer & Invoice</h2>
                        <span className="tag">NEW BILL · {dateText}</span>
                      </div>
                      <div className="fields">
                        <label className="field full">
                          Customer / Retailer
                          <select
                            id="customerSelect"
                            value={customerId}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'new') {
                                setEditingCustomerRecord(null);
                                setShowNewCustomerModal(true);
                                return;
                              }
                              setCustomerId(val);
                              setCustomerInfo(null);
                              if (val === 'walkin') {
                                setSalePhone('');
                                setSaleCnic('');
                                setSaleAddress('');
                              } else {
                                const found = data.customers.find((c) => c.id === val);
                                if (found) {
                                  setSalePhone(found.phone || '');
                                  setSaleCnic(found.cnic || '');
                                  setSaleAddress(found.address || '');
                                }
                              }
                            }}
                          >
                            <option value="walkin">Walk-in customer</option>
                            {data.customers.map((cu) => (
                              <option key={cu.id} value={cu.id}>
                                {cu.name} · {cu.phone}
                              </option>
                            ))}
                            <option value="new">+ Add new customer</option>
                          </select>
                        </label>
                        <label className="field">
                          Customer phone
                          <input
                            id="salePhone"
                            value={salePhone}
                            onChange={(e) => setSalePhone(e.target.value)}
                            placeholder="03XX XXXXXXX"
                          />
                        </label>
                        <label className="field">
                          Customer ID / CNIC
                          <input
                            id="saleCnic"
                            value={saleCnic}
                            onChange={(e) => setSaleCnic(e.target.value)}
                            placeholder="XXXXX-XXXXXXX-X"
                          />
                        </label>
                        <label className="field full">
                          Address
                          <input
                            id="saleAddress"
                            value={saleAddress}
                            onChange={(e) => setSaleAddress(e.target.value)}
                            placeholder="Customer address"
                          />
                        </label>
                      </div>

                      {customerInfo && saleType === 'installment' && (
                        <div className="customer-details">
                          <div className="customer-details-head">
                            <b style={{ fontSize: 12, color: '#277a61' }}>
                              Installment customer details
                            </b>
                            <button
                              type="button"
                              className="btn ghost small"
                              onClick={() => setShowInstallmentCustomerModal(true)}
                            >
                              Edit details
                            </button>
                          </div>
                          <div className="detail-grid">
                            <div className="detail-pair">
                              Customer<b>{customerInfo.name}</b>
                            </div>
                            <div className="detail-pair">
                              CNIC / ID<b>{customerInfo.cnic || '—'}</b>
                            </div>
                            <div className="detail-pair">
                              Phone<b>{customerInfo.phone || '—'}</b>
                            </div>
                            <div className="detail-pair">
                              WhatsApp<b>{customerInfo.whatsapp || '—'}</b>
                            </div>
                            <div className="detail-pair">
                              Address<b>{customerInfo.address || '—'}</b>
                            </div>
                            <div className="detail-pair">
                              Guarantor<b>{customerInfo.guarantor || 'Not provided'}</b>
                            </div>
                            <div className="detail-pair">
                              Guarantor phone<b>{customerInfo.guarantorPhone || '—'}</b>
                            </div>
                            <div className="detail-pair">
                              Guarantor address<b>{customerInfo.guarantorAddress || 'Not provided'}</b>
                            </div>
                          </div>
                        </div>
                      )}
                    </section>

                    {/* Add an Item Card */}
                    <section className="card">
                      <div className="card-head">
                        <h2>Add an Item</h2>
                      </div>
                      <form className="form-row" onSubmit={handleAddItemToCart}>
                        <label className="field product-search">
                          Product / model
                          <input
                            id="productSearch"
                            autoComplete="off"
                            value={productSearch}
                            onChange={(e) => {
                              setProductSearch(e.target.value);
                              setSelectedSearchProductId('');
                              setShowSuggestions(true);
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
                            placeholder="Search mobile, TV, laptop, or SKU..."
                            required
                          />
                          <div
                            className={`suggestions ${
                              showSuggestions && matchingSearchProducts.length > 0 ? 'show' : ''
                            }`}
                          >
                            {matchingSearchProducts.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className="suggestion"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setProductSearch(p.name);
                                  setSelectedSearchProductId(p.id);
                                  setNewPrice(String(p.price));
                                  setShowSuggestions(false);
                                }}
                              >
                                <b>{p.name}</b>
                                <small>
                                  {p.code} · {money(p.price)} · {p.stock} in stock
                                </small>
                              </button>
                            ))}
                          </div>
                        </label>
                        <div className="product-entry-row">
                          <label className="field">
                            Quantity
                            <input
                              type="number"
                              min="1"
                              value={newQty}
                              onChange={(e) => setNewQty(e.target.value)}
                            />
                          </label>
                          <label className="field">
                            Price (Rs.)
                            <input
                              type="number"
                              min="0"
                              value={newPrice}
                              onChange={(e) => setNewPrice(e.target.value)}
                              placeholder="0"
                            />
                          </label>
                          <button className="btn" type="submit">
                            ＋ Add item
                          </button>
                        </div>
                      </form>
                    </section>

                    {/* Payment Details Card (for Cash Sale) */}
                    {saleType === 'cash' && (
                      <section className="card payment-card">
                        <div className="card-head">
                          <div>
                            <h2>Payment Details</h2>
                            <p className="muted tiny" style={{ margin: '5px 0 0' }}>
                              {customerId === 'walkin'
                                ? 'Walk-in sales must be paid in full; credit is not allowed.'
                                : 'Amounts below apply to this sale only. Any unpaid balance is recorded as customer Udhaar.'}
                            </p>
                          </div>
                          <span className="tag green" style={{ textTransform: 'capitalize' }}>
                            {salePayment.method}
                          </span>
                        </div>

                        <div className="payment-summary" aria-live="polite">
                          <div>
                            <small>Total Sale Amount</small>
                            <b>{money(finalTotal)}</b>
                          </div>
                          <div>
                            <small>Amount Paid</small>
                            <b>{money(cashRec)}</b>
                          </div>
                          <div>
                            <small>Remaining Customer Balance</small>
                            <b>{money(remainingBalance)}</b>
                          </div>
                        </div>

                        <fieldset className="payment-methods">
                          <legend>Payment Method</legend>
                          <div className="payment-method-grid">
                            {[
                              ['cash', 'Cash'],
                              ['bank', 'Bank'],
                            ].map(([val, label]) => (
                              <label
                                key={val}
                                className={`payment-choice ${
                                  salePayment.method === val ? 'selected' : ''
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="sale-payment-method"
                                  value={val}
                                  checked={salePayment.method === val}
                                  onChange={() =>
                                    setSalePayment({ ...salePayment, method: val })
                                  }
                                />
                                <span>{label}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>

                        <div className="payment-fields">
                          {salePayment.method === 'cash' && (
                            <label className="field">
                              Amount Paid (Rs.)
                              <input
                                type="number"
                                min="0"
                                value={salePayment.cash}
                                onChange={(e) =>
                                  setSalePayment({ ...salePayment, cash: e.target.value })
                                }
                                placeholder="0.00"
                              />
                            </label>
                          )}

                          {salePayment.method === 'bank' && (
                            <div className="payment-bank-grid">
                              <div className="bank-options" role="group" aria-label="Bank accounts">
                                {BANK_CARDS.map(([name, logo]) => (
                                  <button
                                    key={name}
                                    type="button"
                                    className={`bank-option ${
                                      salePayment.bankName === name ? 'selected' : ''
                                    }`}
                                    onClick={() =>
                                      setSalePayment({ ...salePayment, bankName: name })
                                    }
                                  >
                                    <img
                                      className="bank-logo"
                                      src={`/assets/payment-banks/${logo}.png`}
                                      alt={`${name} logo`}
                                    />
                                    <span>{name}</span>
                                  </button>
                                ))}
                              </div>
                              <div className="fields">
                                <label className="field">
                                  Amount Paid · {salePayment.bankName || 'Bank'} (Rs.)
                                  <input
                                    type="number"
                                    min="0"
                                    value={salePayment.bank}
                                    onChange={(e) =>
                                      setSalePayment({ ...salePayment, bank: e.target.value })
                                    }
                                    placeholder="0.00"
                                  />
                                </label>
                                <label className="field">
                                  Account / reference (optional)
                                  <input
                                    value={salePayment.bankAccount}
                                    onChange={(e) =>
                                      setSalePayment({
                                        ...salePayment,
                                        bankAccount: e.target.value,
                                      })
                                    }
                                    placeholder="Account or transaction reference"
                                  />
                                </label>
                              </div>
                            </div>
                          )}

                        </div>

                        <p className={`payment-excess ${excessPayment > 0 ? 'show' : ''}`}>
                          Payment exceeds bill total by {money(excessPayment)}
                        </p>
                      </section>
                    )}
                  </div>

                  {/* Sticky Current Cart Card */}
                  <section className="card sticky">
                    <div className="card-head">
                      <h2>Current Cart</h2>
                      <span className="tag">
                        {cart.reduce((a, x) => a + num(x.qty), 0)} units
                      </span>
                    </div>

                    <div id="cartItems">
                      {cart.length === 0 ? (
                        <div className="empty">
                          Cart is empty. Search and add an electronics item to begin.
                        </div>
                      ) : (
                        cart.map((item, idx) => (
                          <div key={idx} className="cart-line">
                            <div className="cart-top">
                              <div>
                                <div className="cart-product">{item.name}</div>
                                <div className="cart-code">
                                  {item.code} · {item.category || 'Electronics'}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => setCart(cart.filter((_, i) => i !== idx))}
                                title="Remove item"
                                aria-label={`Remove ${item.name}`}
                              >
                                ×
                              </button>
                            </div>
                            <div className="cart-fields">
                              <label className="mini-field">
                                Qty
                                <input
                                  type="number"
                                  min="1"
                                  value={item.qty}
                                  onChange={(e) =>
                                    updateCartItemField(idx, 'qty', e.target.value)
                                  }
                                />
                              </label>
                              <label className="mini-field">
                                Rate (Rs.)
                                <input
                                  type="number"
                                  min="0"
                                  value={item.price}
                                  onChange={(e) =>
                                    updateCartItemField(idx, 'price', e.target.value)
                                  }
                                />
                              </label>
                              <div className="line-total">
                                {money(num(item.price) * Math.max(1, num(item.qty)))}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="summary">
                      <div className="summary-row">
                        <span>Subtotal</span>
                        <strong>{money(gross)}</strong>
                      </div>
                    </div>

                    <div className="discount-band">
                      <div className="discount-row">
                        <label htmlFor="billDiscount">Discount (Rs.)</label>
                        <input
                          id="billDiscount"
                          type="number"
                          min="0"
                          value={billDiscount}
                          onChange={(e) => setBillDiscount(num(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="sale-type">
                      <div className="sale-type-title">Sale type · choose below discount</div>
                      <div className="segmented">
                        <button
                          type="button"
                          className={saleType === 'cash' ? 'selected' : ''}
                          onClick={() => setSaleType('cash')}
                        >
                          Cash Sale
                        </button>
                        <button
                          type="button"
                          className={saleType === 'installment' ? 'selected' : ''}
                          onClick={() => {
                            setSaleType('installment');
                            setShowInstallmentCustomerModal(true);
                          }}
                        >
                          Installment Sale
                        </button>
                      </div>
                    </div>

                    {saleType === 'installment' && customerInfo && (
                      <div className="plan-box show">
                        <div className="plan-title">INSTALLMENT PLAN</div>
                        <div className="fields">
                          <label className="field">
                            Installment percentage (%)
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={plan.percent}
                              onChange={(e) =>
                                setPlan({ ...plan, percent: num(e.target.value) })
                              }
                            />
                          </label>
                          <label className="field">
                            Advance payment (Rs.)
                            <input
                              type="number"
                              min="0"
                              value={plan.advance}
                              onChange={(e) =>
                                setPlan({ ...plan, advance: num(e.target.value) })
                              }
                            />
                          </label>
                          <label className="field">
                            Duration (months)
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={plan.months}
                              onChange={(e) =>
                                setPlan({
                                  ...plan,
                                  months: Math.max(1, Math.floor(num(e.target.value))),
                                })
                              }
                            />
                          </label>
                        </div>
                        <div className="summary" style={{ marginBottom: 0 }}>
                          <div className="summary-row">
                            <span>Price after discount</span>
                            <strong>{money(discounted)}</strong>
                          </div>
                          <div className="summary-row">
                            <span>Installment percentage amount</span>
                            <strong>+ {money(add)}</strong>
                          </div>
                          <div className="summary-row">
                            <span>Final installment price</span>
                            <strong>{money(finalTotal)}</strong>
                          </div>
                          <div className="summary-row">
                            <span>Remaining balance</span>
                            <strong>{money(remainingBalance)}</strong>
                          </div>
                          <div className="summary-row emph">
                            <span>Monthly installment</span>
                            <strong>{money(monthlyInstallment)}</strong>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="summary">
                      <div className="summary-row">
                        <span>Price after discount</span>
                        <strong>{money(discounted)}</strong>
                      </div>
                      {saleType === 'installment' && (
                        <div className="summary-row emph">
                          <span>Installment percentage amount</span>
                          <strong>+ {money(add)}</strong>
                        </div>
                      )}
                      <div className="summary-row">
                        <span>Discount</span>
                        <strong>− {money(appliedDiscount)}</strong>
                      </div>
                    </div>

                    <div className="grand">
                      <span>
                        {saleType === 'installment' ? 'FINAL INSTALLMENT PRICE' : 'AMOUNT DUE'}
                      </span>
                      <strong>{money(finalTotal)}</strong>
                    </div>

                    {saleType === 'installment' && customerInfo && (
                      <div className="plan-stats" style={{ marginTop: 11 }}>
                        <div className="plan-stat">
                          <small>Advance</small>
                          <b>{money(advanceOrPaid)}</b>
                        </div>
                        <div className="plan-stat">
                          <small>Balance</small>
                          <b>{money(remainingBalance)}</b>
                        </div>
                        <div className="plan-stat">
                          <small>Monthly · {plan.months} months</small>
                          <b>{money(monthlyInstallment)}</b>
                        </div>
                      </div>
                    )}

                    <div className="actions">
                      <button type="button" className="btn ghost" onClick={handleHoldBill}>
                        Hold bill
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => {
                          if (cart.length === 0) {
                            showAlert('Cart is already empty', 'Add an item first.', 'warning');
                            return;
                          }
                          showAlert(
                            'Clear the cart?',
                            `All ${cart.length} item(s) will be removed from this bill.`,
                            'danger',
                            'Yes, clear cart',
                            () => {
                              setCart([]);
                              resetSaleAmounts();
                            }
                          );
                        }}
                      >
                        Clear cart
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={savingSale}
                        onClick={handleSaveSale}
                      >
                        {savingSale ? 'Saving...' : 'Save & Preview Invoice →'}
                      </button>
                    </div>
                  </section>
                </div>
              </>
  );
}
