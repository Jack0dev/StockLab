package com.stocklab.presentation.controller;

import com.stocklab.domain.exception.BusinessRuleException;
import com.stocklab.domain.exception.ErrorCode;
import com.stocklab.domain.exception.ResourceNotFoundException;
import com.stocklab.domain.exception.SecurityAuthException;
import com.stocklab.domain.exception.StocklabException;
import com.stocklab.presentation.dto.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

/**
 * Xử lý tập trung toàn bộ Ngoại lệ (Global Exception Handling)
 * Tuân thủ chuẩn REST RFC 7807 và Clean Architecture.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Xử lý các lỗi vi phạm nghiệp vụ miền Stocklab (Domain Exceptions)
     */
    @ExceptionHandler(BusinessRuleException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessRuleException(BusinessRuleException ex) {
        log.warn("[BusinessRuleException] Mã: {} - Chi tiết: {}", ex.getErrorCode(), ex.getMessage());
        return ResponseEntity
                .status(ex.getErrorCode().getHttpStatus())
                .body(ApiResponse.error(ex.getErrorCode(), ex.getMessage()));
    }

    /**
     * Xử lý lỗi không tìm thấy tài nguyên
     */
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleResourceNotFoundException(ResourceNotFoundException ex) {
        log.warn("[ResourceNotFoundException] Mã: {} - Chi tiết: {}", ex.getErrorCode(), ex.getMessage());
        return ResponseEntity
                .status(ex.getErrorCode().getHttpStatus())
                .body(ApiResponse.error(ex.getErrorCode(), ex.getMessage()));
    }

    /**
     * Xử lý lỗi bảo mật / xác thực / phân quyền miền
     */
    @ExceptionHandler(SecurityAuthException.class)
    public ResponseEntity<ApiResponse<Void>> handleSecurityAuthException(SecurityAuthException ex) {
        log.warn("[SecurityAuthException] Mã: {} - Chi tiết: {}", ex.getErrorCode(), ex.getMessage());
        return ResponseEntity
                .status(ex.getErrorCode().getHttpStatus())
                .body(ApiResponse.error(ex.getErrorCode(), ex.getMessage()));
    }

    /**
     * Xử lý chung các ngoại lệ con của StocklabException
     */
    @ExceptionHandler(StocklabException.class)
    public ResponseEntity<ApiResponse<Void>> handleStocklabException(StocklabException ex) {
        log.warn("[StocklabException] Mã: {} - Chi tiết: {}", ex.getErrorCode(), ex.getMessage());
        return ResponseEntity
                .status(ex.getErrorCode().getHttpStatus())
                .body(ApiResponse.error(ex.getErrorCode(), ex.getMessage()));
    }

    /**
     * Xử lý lỗi Bean Validation (@Valid trên Request Body)
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(MethodArgumentNotValidException ex) {
        String errorDetails = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining("; "));
        
        log.warn("[ValidationException] Dữ liệu đầu vào không hợp lệ: {}", errorDetails);
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(ErrorCode.INVALID_ORDER_PARAMETERS, errorDetails));
    }

    /**
     * Xử lý vi phạm quyền truy cập từ Spring Security
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDeniedException(AccessDeniedException ex) {
        log.warn("[AccessDeniedException] Không có quyền: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(ErrorCode.FORBIDDEN, "Bạn không có quyền thực hiện thao tác này"));
    }

    /**
     * Xử lý sai thông tin xác thực từ Spring Security
     */
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiResponse<Void>> handleBadCredentialsException(BadCredentialsException ex) {
        log.warn("[BadCredentialsException] Sai thông tin đăng nhập: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error(ErrorCode.INVALID_CREDENTIALS, "Tên đăng nhập hoặc mật khẩu không chính xác"));
    }

    /**
     * Xử lý IllegalArgumentException
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgumentException(IllegalArgumentException ex) {
        log.warn("[IllegalArgumentException] {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(ErrorCode.INVALID_ORDER_PARAMETERS, ex.getMessage()));
    }

    /**
     * Fallback cho mọi lỗi chưa phân loại (500 Internal Server Error)
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnhandledException(Exception ex) {
        log.error("[UnhandledException] Hệ thống gặp lỗi bất ngờ: ", ex);
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(ErrorCode.INTERNAL_SERVER_ERROR, "Hệ thống gặp sự cố, vui lòng thử lại sau"));
    }
}
