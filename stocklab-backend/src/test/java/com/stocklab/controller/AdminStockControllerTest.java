package com.stocklab.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class AdminStockControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    @DisplayName("TDD 1: Admin lấy toàn bộ danh sách cổ phiếu thành công")
    void shouldGetAllStocksForAdmin() throws Exception {
        mockMvc.perform(get("/api/admin/stocks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @WithMockUser(username = "user1", roles = {"USER"})
    @DisplayName("TDD 2: User thông thường KHÔNG CÓ QUYỀN truy cập API Quản lý Cổ phiếu")
    void shouldDenyAccessForNormalUser() throws Exception {
        mockMvc.perform(get("/api/admin/stocks"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    @DisplayName("TDD 3: Admin thêm mới một mã cổ phiếu thành công")
    void shouldCreateNewStock() throws Exception {
        String newStockJson = """
                {
                    "ticker": "VNZ",
                    "companyName": "VinFast",
                    "exchange": "UPCOM",
                    "basePrice": 85000.00
                }
                """;

        mockMvc.perform(post("/api/admin/stocks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(newStockJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Thêm mã cổ phiếu thành công!"));
    }
}
