package com.stocklab.presentation.dto;

import jakarta.validation.constraints.Email;
import lombok.Data;

@Data
public class UpdateProfileRequest {
    private String fullName;

    @Email(message = "Email không hợp lệ")
    private String email;

    private String phone;
}
