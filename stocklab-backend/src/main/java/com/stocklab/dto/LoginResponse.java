package com.stocklab.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class LoginResponse {
    private String token;
    private String username;
    private String email;
    private String fullName;
    private String role;

    @JsonProperty("is2faRequired")
    private boolean is2faRequired;

    private String tempToken;
    private String qrCodeBase64; // QR code dạng base64 PNG cho Google Authenticator
}
