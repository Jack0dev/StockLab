package com.stocklab.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class Verify2faRequest {
    @NotBlank(message = "Temp token không được để trống")
    private String tempToken;

    @NotBlank(message = "Mã OTP không được để trống")
    private String otpCode;
}
