package com.stocklab.service.ai;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * User context injected from authentication layer.
 * Gemini NEVER decides userId — it's always injected by backend.
 */
@Data
@AllArgsConstructor
public class UserContext {
    private final Long userId;
    private final String username;
    private final String email;
}
