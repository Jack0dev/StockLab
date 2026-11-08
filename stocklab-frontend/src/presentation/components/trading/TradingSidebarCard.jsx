import { useState } from 'react';
import { formatPrice, getStatusClass, getStatusLabel } from '@/service/trading.service';

export default function TradingSidebarCard({ recentOrders = [], portfolio = [] }) {
  const [sidebarTab, setSidebarTab] = useState('ALL'); // 'ALL' | 'ORDERS' | 'PORTFOLIO'

  return (
    <div className="trading-sidebar">
      <div className="sidebar-card">
        {/* Tab Header */}
        <div className="sidebar-tab-header">
          <button
            type="button"
            className={`sidebar-tab-btn ${sidebarTab === 'ALL' ? 'active' : ''}`}
            onClick={() => setSidebarTab('ALL')}
          >
            <span>Tất cả</span>
          </button>
          <button
            type="button"
            className={`sidebar-tab-btn ${sidebarTab === 'ORDERS' ? 'active' : ''}`}
            onClick={() => setSidebarTab('ORDERS')}
          >
            <span>Lệnh gần đây</span>
            <span className="sidebar-tab-badge">{recentOrders.length}</span>
          </button>
          <button
            type="button"
            className={`sidebar-tab-btn ${sidebarTab === 'PORTFOLIO' ? 'active' : ''}`}
            onClick={() => setSidebarTab('PORTFOLIO')}
          >
            <span>Danh mục hiện tại</span>
            <span className="sidebar-tab-badge">{portfolio.length}</span>
          </button>
        </div>

        {/* Content for ALL mode */}
        {sidebarTab === 'ALL' && (
          <div className="sidebar-all-sections">
            <div className="sidebar-section-block">
              <div className="sidebar-section-header">
                <span className="sidebar-section-num">01</span>
                <span className="sidebar-section-title">Lệnh gần đây</span>
                <span className="sidebar-section-badge">{recentOrders.length}</span>
              </div>
              {recentOrders.length === 0 ? (
                <div className="sidebar-empty">Chưa có lệnh nào phát sinh</div>
              ) : (
                <div className="sidebar-orders-list">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="so-item">
                      <div className="so-left">
                        <span className={`so-side-badge ${order.side === 'BUY' ? 'buy' : 'sell'}`}>
                          {order.side === 'BUY' ? 'MUA' : 'BÁN'}
                        </span>
                        <div className="so-info">
                          <span className="so-ticker">{order.ticker}</span>
                          <span className="so-detail">
                            {order.filledQuantity}/{order.quantity} CP · {formatPrice(order.price)} đ
                          </span>
                        </div>
                      </div>
                      <div className="so-right">
                        <span className={`so-status-pill status-${getStatusClass(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sidebar-section-divider"></div>

            <div className="sidebar-section-block">
              <div className="sidebar-section-header">
                <span className="sidebar-section-num">02</span>
                <span className="sidebar-section-title">Danh mục hiện tại</span>
                <span className="sidebar-section-badge">{portfolio.length}</span>
              </div>
              {portfolio.length === 0 ? (
                <div className="sidebar-empty">Chưa có cổ phiếu trong danh mục</div>
              ) : (
                <div className="sidebar-portfolio-list">
                  {portfolio.map((item) => (
                    <div key={item.ticker} className="sp-item">
                      <div className="sp-left">
                        <span className="sp-ticker-badge">{item.ticker}</span>
                        <div className="sp-info">
                          <span className="sp-qty">{item.quantity?.toLocaleString('vi-VN')} CP</span>
                          <span className="sp-val">{formatPrice(item.totalValue)} đ</span>
                        </div>
                      </div>
                      <div className="sp-right">
                        <span className={`sp-pnl-pill ${item.profitLoss >= 0 ? 'profit' : 'loss'}`}>
                          {item.profitLoss >= 0 ? '+' : ''}{item.profitLossPercent?.toFixed(2)}%
                        </span>
                        <span className={`sp-pnl-amount ${item.profitLoss >= 0 ? 'profit' : 'loss'}`}>
                          {item.profitLoss >= 0 ? '+' : ''}{formatPrice(item.profitLoss)} đ
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content for ORDERS ONLY */}
        {sidebarTab === 'ORDERS' && (
          <div className="sidebar-single-section">
            {recentOrders.length === 0 ? (
              <div className="sidebar-empty">Chưa có lệnh nào phát sinh</div>
            ) : (
              <div className="sidebar-orders-list">
                {recentOrders.map((order) => (
                  <div key={order.id} className="so-item">
                    <div className="so-left">
                      <span className={`so-side-badge ${order.side === 'BUY' ? 'buy' : 'sell'}`}>
                        {order.side === 'BUY' ? 'MUA' : 'BÁN'}
                      </span>
                      <div className="so-info">
                        <span className="so-ticker">{order.ticker}</span>
                        <span className="so-detail">
                          {order.filledQuantity}/{order.quantity} CP · {formatPrice(order.price)} đ
                        </span>
                      </div>
                    </div>
                    <div className="so-right">
                      <span className={`so-status-pill status-${getStatusClass(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content for PORTFOLIO ONLY */}
        {sidebarTab === 'PORTFOLIO' && (
          <div className="sidebar-single-section">
            {portfolio.length === 0 ? (
              <div className="sidebar-empty">Chưa có cổ phiếu trong danh mục</div>
            ) : (
              <div className="sidebar-portfolio-list">
                {portfolio.map((item) => (
                  <div key={item.ticker} className="sp-item">
                    <div className="sp-left">
                      <span className="sp-ticker-badge">{item.ticker}</span>
                      <div className="sp-info">
                        <span className="sp-qty">{item.quantity?.toLocaleString('vi-VN')} CP</span>
                        <span className="sp-val">{formatPrice(item.totalValue)} đ</span>
                      </div>
                    </div>
                    <div className="sp-right">
                      <span className={`sp-pnl-pill ${item.profitLoss >= 0 ? 'profit' : 'loss'}`}>
                        {item.profitLoss >= 0 ? '+' : ''}{item.profitLossPercent?.toFixed(2)}%
                      </span>
                      <span className={`sp-pnl-amount ${item.profitLoss >= 0 ? 'profit' : 'loss'}`}>
                        {item.profitLoss >= 0 ? '+' : ''}{formatPrice(item.profitLoss)} đ
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
