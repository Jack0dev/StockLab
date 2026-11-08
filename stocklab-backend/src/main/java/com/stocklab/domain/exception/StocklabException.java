package com.stocklab.domain.exception;

import lombok.Getter;

/**
 * Lớp cơ sở (Base Class) cho toàn bộ Ngoại lệ Miền Nghiệp vụ của StockLab.
 */
@Getter
public abstract class StocklabException extends RuntimeException {

    private final ErrorCode errorCode;

    public StocklabException(ErrorCode errorCode) {
        super(errorCode.getDefaultMessage());
        this.errorCode = errorCode;
    }

    public StocklabException(ErrorCode errorCode, String customMessage) {
        super(customMessage != null ? customMessage : errorCode.getDefaultMessage());
        this.errorCode = errorCode;
    }

    public StocklabException(ErrorCode errorCode, String customMessage, Throwable cause) {
        super(customMessage != null ? customMessage : errorCode.getDefaultMessage(), cause);
        this.errorCode = errorCode;
    }
}
