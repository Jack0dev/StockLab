package com.stocklab.controller;

import com.stocklab.dto.ApiResponse;
import com.stocklab.dto.CreateStockRequest;
import com.stocklab.dto.StockResponse;
import com.stocklab.service.StockService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/stocks")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminStockController {

    private final StockService stockService;

    @GetMapping
    public ApiResponse<Page<StockResponse>> getAllStocks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size,
            @RequestParam(defaultValue = "ticker") String sort,
            @RequestParam(required = false) String exchange) {

        Pageable pageable = PageRequest.of(page, size, Sort.by(sort).ascending());
        if (exchange != null && !exchange.isEmpty()) {
            return stockService.getStocksByExchange(exchange, pageable);
        }
        return stockService.getAllStocks(pageable);
    }

    @PostMapping
    public ApiResponse<StockResponse> createStock(@Valid @RequestBody CreateStockRequest request) {
        return stockService.createStock(request);
    }

    @PutMapping("/{id}")
    public ApiResponse<StockResponse> updateStock(
            @PathVariable Long id, 
            @Valid @RequestBody CreateStockRequest request) {
        return stockService.updateStock(id, request);
    }
    
    @PutMapping("/{id}/toggle-status")
    public ApiResponse<String> toggleStockStatus(@PathVariable Long id) {
        return stockService.toggleStockStatus(id);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<String> deleteStock(@PathVariable Long id) {
        return stockService.deleteStock(id);
    }
}
