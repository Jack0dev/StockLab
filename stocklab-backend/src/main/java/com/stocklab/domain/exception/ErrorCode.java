package com.stocklab.domain.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

/**
 * Mã định danh lỗi nghiệp vụ chuẩn toàn hệ thống (Domain Error Codes).
 * Ánh xạ tương ứng với mã trạng thái HTTP chuẩn RFC 7807.
 */
@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    // === 400 Bad Request ===
    INVALID_LOT_STEP(HttpStatus.BAD_REQUEST, "Khối lượng phải là bội số của lô chẵn 100 CP"),
    PRICE_OUT_OF_BOUNDS(HttpStatus.BAD_REQUEST, "Giá đặt vượt quá biên độ trần/sàn cho phép"),
    PRICE_BELOW_FLOOR(HttpStatus.BAD_REQUEST, "Giá đặt thấp hơn giá sàn"),
    PRICE_ABOVE_CEILING(HttpStatus.BAD_REQUEST, "Giá đặt cao hơn giá trần"),
    INSUFFICIENT_FUNDS(HttpStatus.BAD_REQUEST, "Số dư tài khoản không đủ thanh toán"),
    INSUFFICIENT_HOLDINGS(HttpStatus.BAD_REQUEST, "Số lượng cổ phiếu khả dụng không đủ"),
    INVALID_ORDER_PARAMETERS(HttpStatus.BAD_REQUEST, "Tham số lệnh không hợp lệ"),
    INVALID_OTP(HttpStatus.BAD_REQUEST, "Mã OTP không chính xác hoặc đã hết hạn"),
    OTP_REQUIRED(HttpStatus.BAD_REQUEST, "Yêu cầu mã xác thực OTP"),

    // === 401 Unauthorized ===
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Yêu cầu đăng nhập để thực hiện thao tác"),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Tên đăng nhập hoặc mật khẩu không chính xác"),
    ACCOUNT_LOCKED(HttpStatus.UNAUTHORIZED, "Tài khoản của bạn chưa được kích hoạt hoặc đã bị khóa"),
    TWO_FA_REQUIRED(HttpStatus.UNAUTHORIZED, "Tài khoản yêu cầu xác thực bảo mật 2 lớp"),
    EXPIRED_SESSION(HttpStatus.UNAUTHORIZED, "Phiên làm việc đã hết hạn"),

    // === 403 Forbidden ===
    FORBIDDEN(HttpStatus.FORBIDDEN, "Bạn không có quyền thực hiện thao tác này"),

    // === 404 Not Found ===
    RESOURCE_NOT_FOUND(HttpStatus.NOT_FOUND, "Không tìm thấy tài nguyên yêu cầu"),
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng"),
    STOCK_NOT_FOUND(HttpStatus.NOT_FOUND, "Không tìm thấy mã cổ phiếu"),
    ORDER_NOT_FOUND(HttpStatus.NOT_FOUND, "Không tìm thấy lệnh giao dịch"),
    PORTFOLIO_NOT_FOUND(HttpStatus.NOT_FOUND, "Không tìm thấy danh mục yêu cầu"),

    // === 500 Internal Error ===
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi hệ thống nội bộ, vui lòng thử lại sau");

    private final HttpStatus httpStatus;
    private final String defaultMessage;
}
