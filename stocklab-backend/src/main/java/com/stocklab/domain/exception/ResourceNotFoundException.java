package com.stocklab.domain.exception;

/**
 * Ngoại lệ ném ra khi không tìm thấy thực thể hoặc tài nguyên yêu cầu (User, Stock, Order, Portfolio).
 */
public class ResourceNotFoundException extends StocklabException {

    public ResourceNotFoundException(ErrorCode errorCode) {
        super(errorCode);
    }

    public ResourceNotFoundException(ErrorCode errorCode, String customMessage) {
        super(errorCode, customMessage);
    }
}
