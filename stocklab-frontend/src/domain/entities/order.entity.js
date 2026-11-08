/**
 * Domain Entity: Order
 * Defines core rules, constants, and validations for trading orders.
 */

export const ORDER_TYPES = {
  LO: 'LO',
  MP: 'MP',
  ATO: 'ATO',
  ATC: 'ATC',
  STOP_LOSS: 'STOP_LOSS',
  TAKE_PROFIT: 'TAKE_PROFIT',
  TRAILING_STOP: 'TRAILING_STOP',
  OCO: 'OCO',
};

export const ORDER_SIDES = {
  BUY: 'BUY',
  SELL: 'SELL',
};

export const ORDER_STATUS = {
  PENDING: 'PENDING',
  PARTIALLY_FILLED: 'PARTIALLY_FILLED',
  FILLED: 'FILLED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
};

export const TRADING_RULES = {
  FEE_RATE: 0.0015, // 0.15% phí giao dịch
  MIN_QUANTITY: 100, // Lô chẵn tối thiểu 100 cổ phiếu
  LOT_STEP: 100,
};

/**
 * Validates basic order parameters against market boundaries.
 */
export function validateOrderInput({ side, orderType, price, quantity, stock }) {
  if (!side || !['BUY', 'SELL'].includes(side)) {
    return { valid: false, message: 'Chiều giao dịch không hợp lệ (MUA hoặc BÁN).' };
  }
  
  const qty = Number(quantity);
  if (!qty || qty <= 0 || !Number.isInteger(qty)) {
    return { valid: false, message: 'Khối lượng phải là số nguyên dương.' };
  }
  
  if (qty % TRADING_RULES.LOT_STEP !== 0) {
    return { valid: false, message: `Khối lượng phải là bội số của ${TRADING_RULES.LOT_STEP} (Lô chẵn).` };
  }

  if (['LO', 'STOP_LOSS', 'TAKE_PROFIT', 'OCO'].includes(orderType)) {
    const p = Number(price);
    if (!p || p <= 0) {
      return { valid: false, message: 'Giá đặt lệnh phải lớn hơn 0.' };
    }
    if (stock && stock.floorPrice && stock.ceilingPrice) {
      if (p < stock.floorPrice || p > stock.ceilingPrice) {
        return {
          valid: false,
          message: `Giá đặt (${p.toLocaleString()}) nằm ngoài biên độ trần/sàn [${stock.floorPrice.toLocaleString()} - ${stock.ceilingPrice.toLocaleString()}].`
        };
      }
    }
  }

  return { valid: true };
}
