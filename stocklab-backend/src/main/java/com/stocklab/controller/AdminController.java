package com.stocklab.controller;

import com.stocklab.dto.AdminDashboardResponse;
import com.stocklab.dto.ApiResponse;
import com.stocklab.dto.ChangeRoleRequest;
import com.stocklab.dto.UserProfileResponse;
import com.stocklab.service.AdminDashboardService;
import com.stocklab.service.UserService;
import com.stocklab.service.OrderService;
import com.stocklab.dto.OrderResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminController {

    private final UserService userService;
    private final AdminDashboardService adminDashboardService;
    private final OrderService orderService;

    @GetMapping("/orders")
    public ResponseEntity<ApiResponse<Page<OrderResponse>>> getAllOrders(Pageable pageable) {
        return ResponseEntity.ok(orderService.getAllOrdersForAdmin(pageable));
    }

    @PutMapping("/orders/{id}/cancel")
    public ResponseEntity<ApiResponse<OrderResponse>> forceCancelOrder(@PathVariable Long id) {
        ApiResponse<OrderResponse> response = orderService.forceCancelOrder(id);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<AdminDashboardResponse>> getAdminDashboard() {
        return ResponseEntity.ok(ApiResponse.success("Lấy dữ liệu thống kê thành công", adminDashboardService.getDashboardStats()));
    }

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<UserProfileResponse>>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @PutMapping("/users/{id}/toggle-lock")
    public ResponseEntity<ApiResponse<String>> toggleUserLock(@PathVariable Long id) {
        ApiResponse<String> response = userService.toggleUserLock(id);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    @PutMapping("/users/{id}/role")
    public ResponseEntity<ApiResponse<String>> changeUserRole(@PathVariable Long id, @RequestBody ChangeRoleRequest request) {
        ApiResponse<String> response = userService.changeUserRole(id, request.getRole());
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }
}
