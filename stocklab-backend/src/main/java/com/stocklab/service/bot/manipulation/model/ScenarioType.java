package com.stocklab.service.bot.manipulation.model;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.List;

@Getter
@RequiredArgsConstructor
public enum ScenarioType {

    PUMP_AND_DUMP(
            "Bơm & Xả (Pump and Dump)",
            "Gom hàng âm thầm -> Bơm trần FOMO liên tục -> Phân phối đỉnh -> Xả hàng sàn tự do.",
            5,
            List.of("GOM_HANG", "BOM_GIA_PUMP", "PHAN_PHOI", "XA_HANG_DUMP")
    ),

    BEAR_TRAP(
            "Bẫy Giảm Giá (Bear Trap / Rũ Cung)",
            "Đè giá thủng hỗ trợ ép cắt lỗ hoảng loạn -> Quét sạch giá sàn giật ngược trần tạo nến búa.",
            3,
            List.of("DE_GIA_RU_CUNG", "QUET_SAN_GIAT_TRAN")
    ),

    BULL_TRAP(
            "Bẫy Tăng Giá (Bull Trap / Lừa Đu Đỉnh)",
            "Kéo vượt đỉnh cũ dụ đu đỉnh -> Úp sọt đảo chiều lao dốc tạo nến bia mộ.",
            3,
            List.of("KEO_VUOT_DINH_AO", "UP_SOT_DAO_CHIEU")
    ),

    SIDEWAY_ACCUMULATION(
            "Đè Gom Biên Độ Hẹp (Sideway)",
            "Dựng 2 bức tường Mua/Bán kẹp biên ±1% giữ giá đi ngang tuyệt đối để gom cạn kiệt.",
            8,
            List.of("DUNG_TUONG_CHAN", "GOM_HANG_BIEN_HEP")
    ),

    WASH_TRADING(
            "Quay Tay Thanh Khoản (Wash Trading)",
            "Hai bot tự mua tự bán khối lượng khủng ở giá tham chiếu, kích nổ thanh khoản lọt top giao dịch.",
            5,
            List.of("QUAY_TAY_KHOP_CHEO")
    ),

    LOCK_LIMIT(
            "Khóa Cứng Trần / Sàn (Lock Limit)",
            "Chất lệnh triệu cổ phiếu khóa cứng giá trần (trắng bên bán) hoặc sàn (trắng bên mua).",
            5,
            List.of("CHAT_LENH_KHOA_BIEN_DO")
    );

    private final String titleVi;
    private final String description;
    private final int defaultDurationMinutes;
    private final List<String> phases;
}
