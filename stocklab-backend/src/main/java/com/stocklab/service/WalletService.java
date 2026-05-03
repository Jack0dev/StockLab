package com.stocklab.service;

import com.stocklab.dto.ApiResponse;
import com.stocklab.dto.DepositRequest;
import com.stocklab.dto.WalletTransactionResponse;
import com.stocklab.model.User;
import com.stocklab.model.WalletTransaction;
import com.stocklab.model.WalletTransactionStatus;
import com.stocklab.model.WalletTransactionType;
import com.stocklab.repository.UserRepository;
import com.stocklab.repository.WalletTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class WalletService {

    private final UserRepository userRepository;
    private final WalletTransactionRepository walletTransactionRepository;
    private final OtpService otpService;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher;

    @Transactional
    public ApiResponse<WalletTransactionResponse> deposit(String username, DepositRequest request) {
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

        // Sinh mã giao dịch tự động dạng SL-XXXXXX
        String randomCode = "SL" + java.util.UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        
        // Tạo giao dịch
        WalletTransaction transaction = WalletTransaction.builder()
                .user(user)
                .type(WalletTransactionType.DEPOSIT)
                .amount(request.getAmount())
                .status(WalletTransactionStatus.PENDING) // Lưu PENDING chờ duyệt Webhook
                .bankAccount(request.getBankAccount())
                .bankName(request.getBankName())
                .transactionCode(randomCode)
                .note("Nạp tiền " + (request.getBankName() != null ? "qua " + request.getBankName() : "vào tài khoản"))
                .build();

        // KHÔNG cộng tiền ngay lúc này! Tiền chỉ cộng khi Webhook báo về.
        
        WalletTransaction savedTx = walletTransactionRepository.save(transaction);

        return ApiResponse.success("Đã tạo lệnh nạp. Vui lòng chuyển khoản đính kèm mã để hệ thống duyệt!", toResponse(savedTx));
    }

    @Transactional
    public ApiResponse<WalletTransactionResponse> withdraw(String username, com.stocklab.dto.WithdrawRequest request) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ApiResponse.error("Không tìm thấy người dùng");
        }

        // Kiểm tra OTP
        if (request.getOtpCode() == null || request.getOtpCode().isEmpty()) {
            return ApiResponse.error("Vui lòng nhập mã xác nhận OTP");
        }
        
        if (!otpService.verifyOtp(user.getEmail(), request.getOtpCode())) {
            return ApiResponse.error("Mã OTP không hợp lệ hoặc đã hết hạn!");
        }

        if (request.getAmount() == null || request.getAmount().doubleValue() < 10000) {
            return ApiResponse.error("Số tiền rút tối thiểu là 10.000 VNĐ");
        }

        if (request.getAmount().doubleValue() > 50000000) {
            return ApiResponse.error("Số tiền rút tối đa là 50.000.000 VNĐ/lần");
        }

        if (user.getAvailableBalance().compareTo(request.getAmount()) < 0) {
            return ApiResponse.error("Số dư khả dụng không đủ để rút số tiền này");
        }

        // Sinh mã giao dịch duy nhất dạng SLxxxxxx
        String txCode = "SL" + java.util.UUID.randomUUID().toString().substring(0, 6).toUpperCase();

        // Tạo giao dịch rút
        WalletTransaction transaction = WalletTransaction.builder()
                .user(user)
                .type(WalletTransactionType.WITHDRAW)
                .amount(request.getAmount())
                .status(WalletTransactionStatus.COMPLETED) // OTP đã xác thực → duyệt luôn
                .bankAccount(request.getBankAccount())
                .bankName(request.getBankName())
                .transactionCode(txCode)
                .note("Rút tiền về " + request.getBankName() + " - Mã GD: " + txCode)
                .build();

        // Trừ tiền user
        user.setBalance(user.getBalance().subtract(request.getAmount()));
        
        userRepository.save(user);
        WalletTransaction savedTx = walletTransactionRepository.save(transaction);

        eventPublisher.publishEvent(new com.stocklab.event.BalanceChangedEvent(this, username));

        return ApiResponse.success("Rút tiền thành công! Mã giao dịch: " + txCode, toResponse(savedTx));
    }

    /**
     * Hoàn tất giao dịch nạp tiền sau khi VNPay IPN xác nhận thành công.
     */
    @Transactional
    public void completeDeposit(String txnRef, String vnpayTransactionNo) {
        WalletTransaction tx = walletTransactionRepository.findByTransactionCode(txnRef).orElse(null);
        if (tx == null || tx.getStatus() != WalletTransactionStatus.PENDING) {
            return;
        }

        tx.setStatus(WalletTransactionStatus.COMPLETED);
        tx.setNote("Thanh toán VNPay thành công. Mã GD VNPay: " + vnpayTransactionNo);
        walletTransactionRepository.save(tx);

        // Cộng tiền cho user
        User user = tx.getUser();
        user.setBalance(user.getBalance().add(tx.getAmount()));
        userRepository.save(user);
        
        eventPublisher.publishEvent(new com.stocklab.event.BalanceChangedEvent(this, user.getUsername()));
    }

    @Transactional
    public ApiResponse<String> cancelPendingTransaction(String username, String txnRef) {
        WalletTransaction tx = walletTransactionRepository.findByTransactionCode(txnRef).orElse(null);
        if (tx == null) {
            return ApiResponse.error("Không tìm thấy giao dịch");
        }
        if (!tx.getUser().getUsername().equals(username)) {
            return ApiResponse.error("Không có quyền hủy giao dịch này");
        }
        if (tx.getStatus() != WalletTransactionStatus.PENDING) {
            return ApiResponse.error("Chỉ có thể hủy giao dịch đang chờ xử lý");
        }
        
        tx.setStatus(WalletTransactionStatus.FAILED);
        tx.setNote("Người dùng chủ động hủy để tạo lệnh mới");
        walletTransactionRepository.save(tx);
        return ApiResponse.success("Đã hủy giao dịch thành công", null);
    }

    public ApiResponse<String> sendWithdrawOtp(String username) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ApiResponse.error("Không tìm thấy người dùng");
        }
        return otpService.sendOtp(user.getEmail());
    }

    public ApiResponse<Page<WalletTransactionResponse>> getHistory(String username, Pageable pageable) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ApiResponse.error("Không tìm thấy người dùng");
        }
        Page<WalletTransaction> page = walletTransactionRepository.findByUserIdOrderByCreatedAtDesc(user.getId(), pageable);
        return ApiResponse.success("Lấy lịch sử giao dịch tiền thành công", page.map(this::toResponse));
    }

    WalletTransactionResponse toResponse(WalletTransaction tx) {
        WalletTransactionResponse response = WalletTransactionResponse.builder()
                .id(tx.getId())
                .type(tx.getType().name())
                .amount(tx.getAmount())
                .status(tx.getStatus().name())
                .bankAccount(tx.getBankAccount())
                .bankName(tx.getBankName())
                .transactionCode(tx.getTransactionCode())
                .note(tx.getNote())
                .createdAt(tx.getCreatedAt())
                .build();
                
        // Trả về thông tin tài khoản nhận của Admin (dùng để render QR)
        if (tx.getType() == WalletTransactionType.DEPOSIT) {
            response.setSystemBankAccount("8858253943");
            response.setSystemAccountName("STOCK LAB CK");
            response.setSystemBankName("MB BANK");
        }
        
        return response;
    }

    /**
     * Tự động quét và hủy các giao dịch Nạp tiền bị treo (PENDING) quá 30 phút.
     * Chạy mỗi 5 phút một lần.
     */
    @org.springframework.scheduling.annotation.Scheduled(fixedRate = 300000)
    @Transactional
    public void cancelExpiredPendingTransactions() {
        java.time.LocalDateTime expiryTime = java.time.LocalDateTime.now().minusMinutes(30);
        java.util.List<WalletTransaction> expiredTransactions = walletTransactionRepository
                .findAllByStatusAndCreatedAtBefore(WalletTransactionStatus.PENDING, expiryTime);

        if (!expiredTransactions.isEmpty()) {
            for (WalletTransaction tx : expiredTransactions) {
                tx.setStatus(WalletTransactionStatus.FAILED);
                tx.setNote("Giao dịch tự động hủy do quá hạn thanh toán (> 30 phút)");
            }
            walletTransactionRepository.saveAll(expiredTransactions);
            log.info("Đã đánh dấu {} giao dịch nạp tiền quá hạn thành FAILED.", expiredTransactions.size());
        }
    }
}
