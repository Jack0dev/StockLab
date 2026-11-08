/**
 * Service Layer — Trading Business Logic
 * Chứa toàn bộ các hàm nghiệp vụ, quy tắc tính toán phí, tỷ lệ và format
 * 100% Pure Functions — Độc lập với UI và Framework
 */

import { TRADING_RULES } from '@/domain/entities/order.entity.js';
export {
  formatPrice,
  formatVolume,
  formatCompactVolume,
  formatPercent,
  formatDateTime,
  getTickerColor,
  getStatusLabel,
  getStatusClass,
  getStatusBadgeClass,
  getPriceClass,
} from '@/domain/utils/formatter.js';

export const TRADING_FEE_RATE = TRADING_RULES.FEE_RATE;

export function calculateOrderValues({ selectedStock, price, quantity, orderType, side }) {
  const numQty = Number(quantity) || 0;
  const effectivePrice = price ? Number(price) : (selectedStock?.currentPrice || 0);
  const totalAmount = selectedStock && numQty > 0 ? effectivePrice * numQty : 0;
  const feeAmount = totalAmount * TRADING_FEE_RATE;
  const finalBuyTotal = totalAmount + feeAmount;
  const finalSellTotal = totalAmount - feeAmount;

  return {
    effectivePrice,
    totalAmount,
    feeAmount,
    finalBuyTotal,
    finalSellTotal,
  };
}
