package com.stocklab.domain.exception;

/**
 * Ngoại lệ ném ra khi vi phạm các quy tắc nghiệp vụ giao dịch
 * (ví dụ: thiếu tiền, thiếu cổ phiếu, đặt giá ngoài trần/sàn, sai lô chẵn).
 */
public class BusinessRuleException extends StocklabException {

    public BusinessRuleException(ErrorCode errorCode) {
        super(errorCode);
    }

    public BusinessRuleException(ErrorCode errorCode, String customMessage) {
        super(errorCode, customMessage);
    }
}
