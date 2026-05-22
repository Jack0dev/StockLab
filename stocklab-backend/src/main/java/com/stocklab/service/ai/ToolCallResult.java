package com.stocklab.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

/**
 * Result of a tool execution, including metadata for frontend display.
 */
@Data
@Builder
@AllArgsConstructor
public class ToolCallResult {
    private final String toolName;
    private final JsonNode result;
    private final boolean success;
    private final String error;
    private final long executionTimeMs;
    private final boolean fromCache;
    private final String source; // Human-readable source description (e.g., "ML Signal VCB")
}
