package com.stocklab.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ChangeRoleRequest {
    @NotBlank
    private String role;
}
