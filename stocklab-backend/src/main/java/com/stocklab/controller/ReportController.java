package com.stocklab.controller;

import com.stocklab.model.Transaction;
import com.stocklab.model.User;
import com.stocklab.repository.TransactionRepository;
import com.stocklab.repository.UserRepository;
import com.stocklab.service.ReportExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.ByteArrayInputStream;
import java.io.IOException;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportExportService reportExportService;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    /**
     * GET /api/reports/transactions/export
     * Trả về luồng file Excel cho Frontend
     */
    @GetMapping("/transactions/export")
    public ResponseEntity<Resource> exportTransactions(@AuthenticationPrincipal UserDetails userDetails) throws IOException {
        
        // Xác định thông tin của người đang gửi Yêu cầu xuất file
        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("Tài khoản không tồn tại."));

        // Truy vấn dữ liệu Giao dịch từ Database
        Pageable pageable = PageRequest.of(0, 50000); // Lấy tối đa 5 vạn dòng cho an toàn Memory
        Page<Transaction> transactionPage = transactionRepository.findByUserIdOrderByCreatedAtDesc(user.getId(), pageable);

        // Gọi Excel Service
        ByteArrayInputStream stream = reportExportService.generateTransactionExcel(transactionPage.getContent());

        // Stream file Data
        HttpHeaders headers = new HttpHeaders();
        headers.add("Content-Disposition", "attachment; filename=LichSuGiaoDich_StockLab.xlsx");

        return ResponseEntity.ok()
                .headers(headers)
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(new InputStreamResource(stream));
    }
}
