import React from 'react';
import { Gamepad2, CandlestickChart } from 'lucide-react';
import './StockLabLogo.css';

/**
 * StockLabLogo - Kết hợp gamepad-2 + candlestick-chart để thể hiện rõ game trading
 * 
 * Các biến thể:
 * - 'icon': Biểu tượng vector tích hợp Gamepad + Candlestick (chuẩn Lucide 24x24)
 * - 'duo': Cặp icon Gamepad2 + CandlestickChart trong khung badge
 * - 'badge': Icon trong khối squircle nền tối chuẩn Thụy Sĩ (Swiss Modernist)
 * - 'brand': Logo hoàn chỉnh gồm Icon/Badge + Chữ "StockLab" + Tag "GAME TRADING"
 */
export default function StockLabLogo({
  variant = 'icon', // 'icon' | 'duo' | 'badge' | 'brand'
  size = 24,
  className = '',
  pillText = 'GAME TRADING',
  showPill = true,
  onClick,
}) {
  // Biểu tượng Fused Vector Icon: Gamepad-2 với Candlestick-Chart trung tâm
  const FusedGameTradingSvg = ({ svgSize = size, strokeWidth = 2, color = 'currentColor' }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={svgSize}
      height={svgSize}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="stocklab-game-trading-icon"
      aria-label="StockLab Game Trading"
    >
      {/* Khung thân Gamepad-2 chuẩn mực */}
      <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
      
      {/* Phía trái: D-Pad điều khiển game */}
      <line x1="5.5" x2="8.5" y1="11" y2="11" />
      <line x1="7" x2="7" y1="9.5" y2="12.5" />

      {/* Phía phải: Cụm nút bấm thao tác Buy/Sell */}
      <circle cx="16.5" cy="11.5" r="0.75" fill={color} />
      <circle cx="18.5" cy="9.5" r="0.75" fill={color} />

      {/* Trọng tâm trung tâm: 2 Nến Candlestick Chart đại diện giao dịch */}
      {/* Nến 1: Thân nến + Bóng trên & Bóng dưới */}
      <line x1="10.5" y1="7" x2="10.5" y2="8.5" strokeWidth={1.75} />
      <rect x="9.5" y="8.5" width="2" height="3" rx="0.5" fill={color} fillOpacity={0.2} strokeWidth={1.5} />
      <line x1="10.5" y1="11.5" x2="10.5" y2="13" strokeWidth={1.75} />

      {/* Nến 2 (Tăng trưởng cao hơn): Thân nến + Bóng nến */}
      <line x1="13.5" y1="6" x2="13.5" y2="7.5" strokeWidth={1.75} />
      <rect x="12.5" y="7.5" width="2" height="4.5" rx="0.5" fill={color} strokeWidth={1.5} />
      <line x1="13.5" y1="12" x2="13.5" y2="13.5" strokeWidth={1.75} />
    </svg>
  );

  // Biến thể 1: Chỉ render icon vector tích hợp
  if (variant === 'icon') {
    return <FusedGameTradingSvg svgSize={size} className={className} />;
  }

  // Biến thể 2: Duo Icon (Hiển thị cặp Gamepad-2 + Candlestick-Chart)
  if (variant === 'duo') {
    const iconSize = Math.round(size * 0.75);
    return (
      <span className={`stocklab-duo-badge ${className}`} style={{ height: size }} onClick={onClick}>
        <Gamepad2 size={iconSize} strokeWidth={2.2} className="duo-icon duo-gamepad" />
        <span className="duo-divider">/</span>
        <CandlestickChart size={iconSize} strokeWidth={2.2} className="duo-icon duo-chart" />
      </span>
    );
  }

  // Biến thể 3: Badge khối squircle chuẩn Swiss Design
  if (variant === 'badge') {
    return (
      <span className={`stocklab-logo-badge ${className}`} style={{ width: size, height: size }} onClick={onClick}>
        <FusedGameTradingSvg svgSize={Math.round(size * 0.65)} color="#ffffff" strokeWidth={2.2} />
      </span>
    );
  }

  // Biến thể 4: Brand hoàn chỉnh (Badge/Icon + StockLab Text + Pill Tag)
  return (
    <div className={`stocklab-brand-container ${className}`} onClick={onClick}>
      <span className="stocklab-logo-badge" style={{ width: size, height: size }}>
        <FusedGameTradingSvg svgSize={Math.round(size * 0.65)} color="#ffffff" strokeWidth={2.2} />
      </span>
      <div className="stocklab-brand-text">
        <span className="stocklab-brand-name">StockLab</span>
        {showPill && (
          <span className="stocklab-trading-pill">
            <span className="pill-dot"></span>
            {pillText}
          </span>
        )}
      </div>
    </div>
  );
}

export { StockLabLogo };
