package com.stocklab.presentation.controller;

import com.stocklab.presentation.dto.ApiResponse;
import com.stocklab.presentation.dto.bot.CampaignResponseDTO;
import com.stocklab.presentation.dto.bot.ScenarioPresetDTO;
import com.stocklab.presentation.dto.bot.StartCampaignRequest;
import com.stocklab.service.bot.manipulation.engine.ManipulationCampaignManager;
import com.stocklab.service.bot.manipulation.model.CampaignContext;
import com.stocklab.service.bot.manipulation.model.ScenarioType;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/manipulation")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("hasRole('ADMIN')")
public class ManipulationController {

    private final ManipulationCampaignManager campaignManager;

    /**
     * POST /api/admin/manipulation/start — Khởi chạy chiến dịch thao túng giá
     */
    @PostMapping("/start")
    public ResponseEntity<ApiResponse<CampaignResponseDTO>> startCampaign(
            @Valid @RequestBody StartCampaignRequest request) {

        CampaignContext ctx = campaignManager.startCampaign(
                request.getScenarioType(),
                request.getTickers(),
                request.getDurationMinutes() != null ? request.getDurationMinutes() : 0,
                request.getIntensity(),
                request.getTargetPercent(),
                request.getCustomMode()
        );

        return ResponseEntity.ok(ApiResponse.success("Khởi chạy chiến dịch thành công", CampaignResponseDTO.fromContext(ctx)));
    }

    /**
     * POST /api/admin/manipulation/stop/{campaignId} — Dừng chiến dịch cụ thể
     */
    @PostMapping("/stop/{campaignId}")
    public ResponseEntity<ApiResponse<String>> stopCampaign(@PathVariable String campaignId) {
        boolean stopped = campaignManager.stopCampaign(campaignId);
        if (stopped) {
            return ResponseEntity.ok(ApiResponse.success("Đã dừng chiến dịch " + campaignId, campaignId));
        } else {
            return ResponseEntity.badRequest().body(ApiResponse.error("Không tìm thấy chiến dịch đang chạy: " + campaignId));
        }
    }

    /**
     * POST /api/admin/manipulation/kill-switch — Dừng khẩn cấp toàn bộ và hủy lệnh bot
     */
    @PostMapping("/kill-switch")
    public ResponseEntity<ApiResponse<Map<String, Object>>> emergencyKillSwitch() {
        int canceledOrders = campaignManager.emergencyKillSwitch();
        return ResponseEntity.ok(ApiResponse.success("Kích hoạt Dừng Khẩn Cấp thành công", Map.of(
                "message", "Đã dừng toàn bộ chiến dịch và hủy các lệnh treo của bot",
                "canceledOrdersCount", canceledOrders
        )));
    }

    /**
     * GET /api/admin/manipulation/active — Danh sách chiến dịch đang chạy
     */
    @GetMapping("/active")
    public ResponseEntity<ApiResponse<List<CampaignResponseDTO>>> getActiveCampaigns() {
        List<CampaignResponseDTO> list = campaignManager.getActiveCampaigns().stream()
                .map(CampaignResponseDTO::fromContext)
                .toList();
        return ResponseEntity.ok(ApiResponse.success("Danh sách chiến dịch đang chạy", list));
    }

    /**
     * GET /api/admin/manipulation/presets — Danh mục 6 kịch bản có sẵn
     */
    @GetMapping("/presets")
    public ResponseEntity<ApiResponse<List<ScenarioPresetDTO>>> getPresets() {
        List<ScenarioPresetDTO> presets = Arrays.stream(ScenarioType.values())
                .map(ScenarioPresetDTO::fromEnum)
                .toList();
        return ResponseEntity.ok(ApiResponse.success("Danh mục kịch bản mẫu", presets));
    }
}
