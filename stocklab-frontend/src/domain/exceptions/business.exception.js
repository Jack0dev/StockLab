/**
 * Domain Exceptions
 * Business-specific error representations.
 */

export class BusinessException extends Error {
  constructor(message, code = 'BUSINESS_ERROR', details = null) {
    super(message);
    this.name = 'BusinessException';
    this.code = code;
    this.details = details;
  }
}

export class InsufficientFundsException extends BusinessException {
  constructor(message = 'Số dư khả dụng không đủ để thực hiện giao dịch.') {
    super(message, 'INSUFFICIENT_FUNDS');
  }
}

export class InsufficientHoldingsException extends BusinessException {
  constructor(message = 'Số lượng cổ phiếu khả dụng không đủ để bán.') {
    super(message, 'INSUFFICIENT_HOLDINGS');
  }
}

export class PriceOutOfRangeException extends BusinessException {
  constructor(message = 'Giá đặt nằm ngoài biên độ trần/sàn.') {
    super(message, 'PRICE_OUT_OF_RANGE');
  }
}
