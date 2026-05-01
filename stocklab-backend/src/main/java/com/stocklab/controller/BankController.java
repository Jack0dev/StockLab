package com.stocklab.controller;

import com.stocklab.dto.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/bank")
public class BankController {

    private final List<String> MOCK_NAMES = Arrays.asList(
            "NGUYEN VAN A", "TRAN THI B", "LE VAN C", "PHAM THI D", "HOANG VAN E",
            "DO THI F", "VU VAN G", "NGO THI H", "DUONG VAN I", "LY THI K",
            "BUI VAN L", "PHAN THI M", "HOANG QUOC N", "TRUONG VAN O", "VO THI P"
    );

    @GetMapping("/lookup")
    public ResponseEntity<ApiResponse<String>> lookupBankAccount(
            @RequestParam(value = "bankCode", required = false) String bankCode,
            @RequestParam(value = "accountNo", required = false) String accountNo) {
            
        // Validate inputs
        if (accountNo == null || accountNo.trim().length() < 8) {
            return ResponseEntity.ok(
                    ApiResponse.error("Số tài khoản không hợp lệ hoặc không tồn tại.")
            );
        }

        // Mock a 1.2 second delay to simulate network call to NAPAS
        try {
            Thread.sleep(1200);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        // Simple deterministic random name based on account number
        int hash = Math.abs(accountNo.hashCode());
        String name = MOCK_NAMES.get(hash % MOCK_NAMES.size());

        return ResponseEntity.ok(ApiResponse.success("Lấy thông tin tài khoản thành công", name));
    }
}
