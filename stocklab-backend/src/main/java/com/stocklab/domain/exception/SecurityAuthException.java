package com.stocklab.domain.exception;

/**
 * Ngoại lệ ném ra khi vi phạm các quy tắc bảo mật hoặc xác thực (Sai pass, OTP lỗi, 2FA yêu cầu).
 */
public class SecurityAuthException extends StocklabException {

    public SecurityAuthException(ErrorCode errorCode) {
        super(errorCode);
    }

    public SecurityAuthException(ErrorCode errorCode, String customMessage) {
        super(errorCode, customMessage);
    }
}
