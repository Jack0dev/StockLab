/**
 * Presentation DTO: Order DTO
 * Formats and maps order request/response data between UI presentation and API.
 */

export function toCreateOrderPayload({ ticker, side, type, quantity, price, stopPrice }) {
  const payload = {
    ticker: ticker?.trim().toUpperCase(),
    side: side?.toUpperCase(),
    type: type?.toUpperCase() || 'LO',
    quantity: Number(quantity),
  };

  if (price !== undefined && price !== null && price !== '') {
    payload.price = Number(price);
  }
  if (stopPrice !== undefined && stopPrice !== null && stopPrice !== '') {
    payload.stopPrice = Number(stopPrice);
  }

  return payload;
}

export function toOrderViewModel(order) {
  if (!order) return null;
  return {
    ...order,
    formattedPrice: Number(order.price || 0).toLocaleString('vi-VN'),
    formattedQuantity: Number(order.quantity || 0).toLocaleString('vi-VN'),
    formattedFilledQuantity: Number(order.filledQuantity || 0).toLocaleString('vi-VN'),
    formattedTotal: Number(order.totalAmount || (order.price * order.quantity) || 0).toLocaleString('vi-VN'),
  };
}
