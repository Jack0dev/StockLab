package com.stocklab.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ChangePasswordVerifyRequest {
    @NotBlank(message = "Mã OTP không được để trống")
    private String otpCode;
}
