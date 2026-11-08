import OtpInput from '../OtpInput';
import { formatPrice, getTickerColor } from '@/service/trading.service';

export default function TradingFormCard({
  activeTab,
  setActiveTab,
  orderType,
  setOrderType,
  ticker,
  setTicker,
  quantity,
  setQuantity,
  price,
  setPrice,
  selectedStock,
  setSelectedStock,
  searchResults,
  showDropdown,
  tradeStep,
  setTradeStep,
  otpCode,
  setOtpCode,
  otpLoading,
  loading,
  holdingQty,
  calculations,
  portfolio,
  availableBalance,
  handleSelectStock,
  handleSelectPortfolioStock,
  resetForm,
  canTrade,
  handleSendOtp,
  handlePlaceOrder,
}) {
  const { effectivePrice, feeAmount, finalBuyTotal, finalSellTotal } = calculations;

  return (
    <div className="trading-form-card">
      {/* Tabs */}
      <div className="trade-tabs">
        <button
          className={`trade-tab ${activeTab === 'BUY' ? 'active buy' : ''}`}
          onClick={() => {
            setActiveTab('BUY');
            resetForm();
          }}
        >
          MUA
        </button>
        <button
          className={`trade-tab ${activeTab === 'SELL' ? 'active sell' : ''}`}
          onClick={() => {
            setActiveTab('SELL');
            resetForm();
          }}
        >
          BÁN
        </button>
      </div>

      <div className="form-body">
        {/* Step Indicator */}
        <div className="trade-steps">
          <div className={`trade-step ${activeTab === 'BUY' ? 'buy' : 'sell'} ${tradeStep >= 1 ? 'active' : ''}`}>
            <div className="trade-step-number">1</div>
            <div className="trade-step-text">Tạo lệnh</div>
          </div>
          <div className={`trade-step-line ${tradeStep >= 2 ? 'active' : ''}`}></div>
          <div className={`trade-step ${activeTab === 'BUY' ? 'buy' : 'sell'} ${tradeStep >= 2 ? 'active' : ''}`}>
            <div className="trade-step-number">2</div>
            <div className="trade-step-text">Xác nhận</div>
          </div>
        </div>

        {tradeStep === 1 ? (
          <>
            {/* Order Type Selector */}
            <div className="form-group">
              <label>Loại lệnh</label>
              <div className="trade-tabs" style={{ marginBottom: 0 }}>
                <button
                  className={`trade-tab ${orderType === 'LIMIT' ? 'active' : ''}`}
                  onClick={() => setOrderType('LIMIT')}
                  style={{ flex: 1 }}
                >
                  Lệnh Giới Hạn (LO)
                </button>
                <button
                  className={`trade-tab ${orderType === 'MARKET' ? 'active' : ''}`}
                  onClick={() => setOrderType('MARKET')}
                  style={{ flex: 1 }}
                >
                  Lệnh Thị Trường (MP)
                </button>
              </div>
            </div>

            {/* Stock Picker - BUY */}
            {activeTab === 'BUY' && (
              <div className="form-group">
                <label>Mã cổ phiếu</label>
                <div className="stock-search-wrapper">
                  <input
                    type="text"
                    placeholder="Nhập mã CP (VD: VNM, FPT...)"
                    value={ticker}
                    onChange={(e) => {
                      setTicker(e.target.value.toUpperCase());
                      setSelectedStock(null);
                    }}
                    className="form-input"
                    autoComplete="off"
                  />
                  {showDropdown && searchResults.length > 0 && (
                    <div className="stock-dropdown">
                      {searchResults.slice(0, 8).map((s) => (
                        <div
                          key={s.ticker}
                          className="stock-dropdown-item"
                          onClick={() => handleSelectStock(s)}
                        >
                          <div
                            className="sd-icon"
                            style={{ background: getTickerColor(s.ticker) }}
                          >
                            {s.ticker.substring(0, 2)}
                          </div>
                          <div className="sd-info">
                            <span className="sd-ticker">{s.ticker}</span>
                            <span className="sd-name">{s.companyName}</span>
                          </div>
                          <span className="sd-price">{formatPrice(s.currentPrice)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stock Picker - SELL */}
            {activeTab === 'SELL' && (
              <div className="form-group">
                <label>Chọn cổ phiếu đang giữ</label>
                {portfolio.length === 0 ? (
                  <div className="empty-portfolio-msg">Bạn chưa có cổ phiếu nào trong danh mục</div>
                ) : (
                  <div className="portfolio-select-list">
                    {portfolio.map((item) => (
                      <div
                        key={item.ticker}
                        className={`portfolio-select-item ${selectedStock?.ticker === item.ticker ? 'selected' : ''}`}
                        onClick={() => handleSelectPortfolioStock(item)}
                      >
                        <div
                          className="sd-icon"
                          style={{ background: getTickerColor(item.ticker) }}
                        >
                          {item.ticker.substring(0, 2)}
                        </div>
                        <div className="ps-info">
                          <span className="sd-ticker">{item.ticker}</span>
                          <span className="ps-qty">Đang giữ: {item.quantity} CP</span>
                        </div>
                        <div className="ps-price-info">
                          <span className="sd-price">{formatPrice(item.currentPrice)}</span>
                          <span className={`ps-pnl ${item.profitLoss >= 0 ? 'up' : 'down'}`}>
                            {item.profitLoss >= 0 ? '+' : ''}{formatPrice(item.profitLoss)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Selected Stock Info */}
            {selectedStock && (
              <div className="selected-stock-info">
                <div className="ssi-header">
                  <div
                    className="ssi-icon"
                    style={{ background: getTickerColor(selectedStock.ticker) }}
                  >
                    {selectedStock.ticker.substring(0, 2)}
                  </div>
                  <div>
                    <div className="ssi-ticker">{selectedStock.ticker}</div>
                    <div className="ssi-name">{selectedStock.companyName}</div>
                  </div>
                </div>
                <div className="ssi-price">{formatPrice(selectedStock.currentPrice)} VND</div>
              </div>
            )}

            {/* Price Input — chỉ hiển khi LIMIT */}
            {orderType === 'LIMIT' && (
              <div className="form-group">
                <label>Giá (VND)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  placeholder="Nhập giá đặt lệnh"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="form-input"
                />
                {selectedStock && (
                  <div className="price-hint">
                    Giá hiện tại: <strong>{formatPrice(selectedStock.currentPrice)} VND</strong>
                    <button
                      className="price-fill-btn"
                      onClick={() => setPrice(String(selectedStock.currentPrice))}
                    >
                      Dùng giá hiện tại
                    </button>
                  </div>
                )}
              </div>
            )}

            {orderType === 'MARKET' && selectedStock && (
              <div
                className="price-hint"
                style={{
                  marginBottom: '12px',
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'rgba(255,165,0,0.1)',
                  border: '1px solid rgba(255,165,0,0.3)',
                }}
              >
                Lệnh thị trường sẽ khớp ngay theo giá tốt nhất. Giá hiện tại:{' '}
                <strong>{formatPrice(selectedStock.currentPrice)} VND</strong>
              </div>
            )}

            {/* Quantity */}
            <div className="form-group">
              <label>Số lượng</label>
              <input
                type="number"
                min="1"
                placeholder="Nhập số lượng CP"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="form-input"
              />
              {activeTab === 'SELL' && selectedStock && (
                <div className="qty-hint">
                  Đang giữ: <strong>{holdingQty} CP</strong>
                  <button
                    className="qty-max-btn"
                    onClick={() => setQuantity(holdingQty.toString())}
                  >
                    Bán hết
                  </button>
                </div>
              )}
            </div>

            {/* Summary */}
            {selectedStock && Number(quantity) > 0 && (
              <div className="trade-summary">
                <div className="summary-row">
                  <span>Giá đặt</span>
                  <span>{formatPrice(effectivePrice)} VND</span>
                </div>
                <div className="summary-row">
                  <span>Số lượng</span>
                  <span>{Number(quantity).toLocaleString('vi-VN')} CP</span>
                </div>
                <div className="summary-row">
                  <span>Phí dự kiến ({((calculations.feeRate || 0.0015) * 100).toFixed(2)}%)</span>
                  <span>{formatPrice(feeAmount)} VND</span>
                </div>
                <div className="summary-divider"></div>
                <div className="summary-row total">
                  <span>{activeTab === 'BUY' ? 'Tổng chi phí' : 'Tổng nhận'}</span>
                  <span className={activeTab === 'BUY' ? 'text-danger' : 'text-success'}>
                    {activeTab === 'BUY' ? '-' : '+'}{formatPrice(activeTab === 'BUY' ? finalBuyTotal : finalSellTotal)} VND
                  </span>
                </div>
                {activeTab === 'BUY' && (
                  <div className="summary-row">
                    <span>Số dư sau GD</span>
                    <span className={availableBalance - finalBuyTotal < 0 ? 'text-danger' : ''}>
                      {formatPrice(availableBalance - finalBuyTotal)} VND
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Next Button */}
            <button
              className={`trade-btn ${activeTab === 'BUY' ? 'buy' : 'sell'}`}
              disabled={!canTrade() || loading}
              onClick={() => setTradeStep(2)}
            >
              Tiếp theo
            </button>

            {calculations.validationMessage && !calculations.valid && (
              <div className="insufficient-msg">
                {calculations.validationMessage}
              </div>
            )}
          </>
        ) : (
          <div className="trade-step-2">
            <div className="trade-summary mb-3" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <div className="summary-row">
                <span>Lệnh:</span>
                <strong>{activeTab === 'BUY' ? 'MUA' : 'BÁN'} {selectedStock?.ticker}</strong>
              </div>
              <div className="summary-row">
                <span>Số lượng:</span>
                <strong>{Number(quantity).toLocaleString('vi-VN')} CP</strong>
              </div>
              <div className="summary-row">
                <span>Tổng {activeTab === 'BUY' ? 'chi phí' : 'nhận'}:</span>
                <strong className={activeTab === 'BUY' ? 'text-danger' : 'text-success'}>
                  {formatPrice(activeTab === 'BUY' ? finalBuyTotal : finalSellTotal)} VND
                </strong>
              </div>
            </div>

            <div className="form-group otp-section" style={{ marginTop: '16px' }}>
              <OtpInput
                key={tradeStep}
                value={otpCode}
                onChange={setOtpCode}
                onSendOtp={handleSendOtp}
                isSending={otpLoading}
                autoSend={true}
                title="Xác thực giao dịch"
                desc="Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra và nhập mã bên dưới."
              />
            </div>

            <div className="action-row" style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
              <button
                type="button"
                className="btn-withdraw-back"
                onClick={() => setTradeStep(1)}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#4a5568',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Quay lại
              </button>
              <button
                className={`trade-btn ${activeTab === 'BUY' ? 'buy' : 'sell'}`}
                disabled={loading || !otpCode}
                onClick={handlePlaceOrder}
                style={{ flex: 2, margin: 0 }}
              >
                {loading ? (
                  <span className="btn-loading">Đang xử lý...</span>
                ) : activeTab === 'BUY' ? (
                  'XÁC NHẬN MUA'
                ) : (
                  'XÁC NHẬN BÁN'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
