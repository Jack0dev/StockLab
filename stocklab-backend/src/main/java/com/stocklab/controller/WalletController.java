package com.stocklab.controller;

import com.stocklab.dto.ApiResponse;
import com.stocklab.dto.DepositRequest;
import com.stocklab.dto.WalletTransactionResponse;
import com.stocklab.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
public class WalletController {

    private final WalletService walletService;

    @PostMapping("/deposit")
    public ApiResponse<WalletTransactionResponse> deposit(
            Authentication authentication,
            @RequestBody DepositRequest request) {
        return walletService.deposit(authentication.getName(), request);
    }

    @PostMapping("/withdraw")
    public ApiResponse<WalletTransactionResponse> withdraw(
            Authentication authentication,
            @RequestBody com.stocklab.dto.WithdrawRequest request) {
        return walletService.withdraw(authentication.getName(), request);
    }

    @PostMapping("/withdraw/request-otp")
    public ApiResponse<String> requestWithdrawOtp(Authentication authentication) {
        return walletService.sendWithdrawOtp(authentication.getName());
    }

    @GetMapping("/history")
    public ApiResponse<Page<WalletTransactionResponse>> getHistory(
            Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return walletService.getHistory(authentication.getName(), pageable);
    }
}
