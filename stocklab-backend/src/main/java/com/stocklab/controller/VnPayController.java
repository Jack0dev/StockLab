package com.stocklab.controller;

import com.stocklab.dto.ApiResponse;
import com.stocklab.dto.DepositRequest;
import com.stocklab.model.User;
import com.stocklab.model.WalletTransaction;
import com.stocklab.model.WalletTransactionStatus;
import com.stocklab.model.WalletTransactionType;
import com.stocklab.repository.UserRepository;
import com.stocklab.repository.WalletTransactionRepository;
import com.stocklab.service.VnPayService;
import com.stocklab.service.WalletService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/vnpay")
@RequiredArgsConstructor
public class VnPayController {

    private final VnPayService vnPayService;
    private final WalletService walletService;
    private final UserRepository userRepository;
    private final WalletTransactionRepository walletTransactionRepository;

    /**
     * Tạo URL thanh toán VNPay (user đã đăng nhập)
     */
    @PostMapping("/create-payment")
    public ApiResponse<Map<String, String>> createPayment(
            Authentication authentication,
            @RequestBody DepositRequest request,
            HttpServletRequest httpRequest) {

        String username = authentication.getName();
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ApiResponse.error("Không tìm thấy người dùng");
        }

        if (request.getAmount() == null || request.getAmount().doubleValue() < 10000) {
            return ApiResponse.error("Số tiền nạp tối thiểu là 10.000 VNĐ");
        }
        if (request.getAmount().doubleValue() > 1000000000) {
            return ApiResponse.error("Số tiền nạp tối đa là 1.000.000.000 VNĐ/lần");
        }

        // Sinh mã giao dịch duy nhất (8 chữ số)
        String txnRef = String.valueOf(System.currentTimeMillis());

        // Tạo WalletTransaction PENDING
        WalletTransaction transaction = WalletTransaction.builder()
                .user(user)
                .type(WalletTransactionType.DEPOSIT)
                .amount(request.getAmount())
                .status(WalletTransactionStatus.PENDING)
                .bankName("VNPAY")
                .transactionCode(txnRef)
                .note("Nạp tiền qua VNPay - Chờ thanh toán")
                .build();
        walletTransactionRepository.save(transaction);

        // Lấy IP client
        String ipAddr = httpRequest.getHeader("X-Forwarded-For");
        if (ipAddr == null || ipAddr.isEmpty()) {
            ipAddr = httpRequest.getRemoteAddr();
        }
        // Force public IP to bypass VNPay Sandbox local IP rules
        if ("0:0:0:0:0:0:0:1".equals(ipAddr) || "127.0.0.1".equals(ipAddr)) {
            ipAddr = "113.190.232.1"; // Default Vietnam Public IP
        }

        // Tạo URL thanh toán
        String orderInfo = "StockLab_nap_tien_" + txnRef; // Remove spaces completely to avoid URL Encode + vs %20 issues
        String paymentUrl = vnPayService.createPaymentUrl(
                request.getAmount().longValue(),
                txnRef,
                orderInfo,
                ipAddr
        );

        log.info("====== VNPAY GENERATED URL ======");
        log.info(paymentUrl);
        log.info("=================================");

        Map<String, String> result = new HashMap<>();
        result.put("paymentUrl", paymentUrl);
        result.put("txnRef", txnRef);

        return ApiResponse.success("Đã tạo URL thanh toán VNPay", result);
    }

    /**
     * Hủy giao dịch thanh toán khi người dùng chủ động chọn "Tạo lệnh mới"
     */
    @PostMapping("/cancel/{txnRef}")
    public ApiResponse<String> cancelPayment(Authentication authentication, @PathVariable String txnRef) {
        String username = authentication.getName();
        return walletService.cancelPendingTransaction(username, txnRef);
    }

    /**
     * VNPay IPN (Instant Payment Notification) - Server-to-Server callback
     * VNPay gọi URL này khi giao dịch hoàn tất
     */
    @GetMapping("/ipn")
    public ResponseEntity<Map<String, String>> ipnHandler(@RequestParam Map<String, String> params) {
        Map<String, String> response = new HashMap<>();

        try {
            String secureHash = params.get("vnp_SecureHash");
            String txnRef = params.get("vnp_TxnRef");
            String responseCode = params.get("vnp_ResponseCode");
            String transactionStatus = params.get("vnp_TransactionStatus");
            long vnpAmount = Long.parseLong(params.getOrDefault("vnp_Amount", "0")) / 100;

            log.info("VNPay IPN received: txnRef={}, responseCode={}, status={}, amount={}",
                    txnRef, responseCode, transactionStatus, vnpAmount);

            // 1. Verify checksum
            if (!vnPayService.validateSignature(params, secureHash)) {
                log.warn("VNPay IPN: Invalid signature for txnRef={}", txnRef);
                response.put("RspCode", "97");
                response.put("Message", "Invalid signature");
                return ResponseEntity.ok(response);
            }

            // 2. Tìm giao dịch trong DB
            WalletTransaction tx = walletTransactionRepository.findByTransactionCode(txnRef).orElse(null);
            if (tx == null) {
                log.warn("VNPay IPN: Order not found for txnRef={}", txnRef);
                response.put("RspCode", "01");
                response.put("Message", "Order not found");
                return ResponseEntity.ok(response);
            }

            // 3. Kiểm tra số tiền
            if (tx.getAmount().longValue() != vnpAmount) {
                log.warn("VNPay IPN: Amount mismatch for txnRef={}, expected={}, got={}",
                        txnRef, tx.getAmount(), vnpAmount);
                response.put("RspCode", "04");
                response.put("Message", "Invalid amount");
                return ResponseEntity.ok(response);
            }

            // 4. Kiểm tra trạng thái (tránh xử lý trùng lặp)
            if (tx.getStatus() != WalletTransactionStatus.PENDING) {
                log.info("VNPay IPN: Order already confirmed for txnRef={}", txnRef);
                response.put("RspCode", "02");
                response.put("Message", "Order already confirmed");
                return ResponseEntity.ok(response);
            }

            // 5. Cập nhật kết quả
            if ("00".equals(responseCode) && "00".equals(transactionStatus)) {
                walletService.completeDeposit(txnRef, params.get("vnp_TransactionNo"));
                log.info("VNPay IPN: Payment SUCCESS for txnRef={}", txnRef);
            } else {
                tx.setStatus(WalletTransactionStatus.FAILED);
                tx.setNote("Thanh toán VNPay thất bại. Mã lỗi: " + responseCode);
                walletTransactionRepository.save(tx);
                log.info("VNPay IPN: Payment FAILED for txnRef={}, code={}", txnRef, responseCode);
            }

            response.put("RspCode", "00");
            response.put("Message", "Confirm Success");
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("VNPay IPN error", e);
            response.put("RspCode", "99");
            response.put("Message", "Unknown error");
            return ResponseEntity.ok(response);
        }
    }

    /**
     * VNPay Return URL - Redirect user về sau khi thanh toán
     * Frontend sẽ gọi endpoint này để lấy kết quả
     */
    @GetMapping("/return")
    public ApiResponse<Map<String, String>> returnHandler(@RequestParam Map<String, String> params) {
        String secureHash = params.get("vnp_SecureHash");
        String txnRef = params.get("vnp_TxnRef");
        String responseCode = params.get("vnp_ResponseCode");
        long vnpAmount = Long.parseLong(params.getOrDefault("vnp_Amount", "0")) / 100;

        Map<String, String> result = new HashMap<>();
        result.put("txnRef", txnRef);
        result.put("amount", String.valueOf(vnpAmount));
        result.put("responseCode", responseCode);
        result.put("bankCode", params.getOrDefault("vnp_BankCode", ""));
        result.put("transactionNo", params.getOrDefault("vnp_TransactionNo", ""));
        result.put("payDate", params.getOrDefault("vnp_PayDate", ""));

        // Verify checksum
        if (!vnPayService.validateSignature(params, secureHash)) {
            return ApiResponse.error("Chữ ký không hợp lệ! Giao dịch có thể bị giả mạo.");
        }

        if ("00".equals(responseCode)) {
            // Fallback: cập nhật giao dịch + cộng tiền tại đây
            // (phòng trường hợp IPN không gọi được - VD: localhost, Docker, Sandbox)
            try {
                walletService.completeDeposit(txnRef, params.getOrDefault("vnp_TransactionNo", ""));
                log.info("VNPay Return: Deposit completed for txnRef={}", txnRef);
            } catch (Exception e) {
                log.warn("VNPay Return: completeDeposit fallback error for txnRef={}: {}", txnRef, e.getMessage());
            }
            return ApiResponse.success("Giao dịch thanh toán thành công!", result);
        } else {
            // Fallback: cập nhật trạng thái thất bại tại đây (trường hợp IPN không gọi được)
            try {
                WalletTransaction tx = walletTransactionRepository.findByTransactionCode(txnRef).orElse(null);
                if (tx != null && tx.getStatus() == WalletTransactionStatus.PENDING) {
                    tx.setStatus(WalletTransactionStatus.FAILED);
                    tx.setNote("Thanh toán VNPay thất bại/hủy. Mã lỗi: " + responseCode);
                    walletTransactionRepository.save(tx);
                    log.info("VNPay Return: Payment FAILED for txnRef={}, code={}", txnRef, responseCode);
                }
            } catch (Exception e) {
                log.warn("VNPay Return: FAILED fallback error for txnRef={}: {}", txnRef, e.getMessage());
            }
            return ApiResponse.error("Giao dịch không thành công. Mã lỗi: " + responseCode);
        }
    }
}
