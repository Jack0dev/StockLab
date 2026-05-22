package com.stocklab.service.ai;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Interface for AI tools that Gemini can call via Function Calling.
 * Each tool encapsulates a specific capability (stock signal, price, news, etc.)
 */
public interface AITool {

    /**
     * Tool name as declared to Gemini (e.g., "get_stock_signal").
     */
    String getName();

    /**
     * Human-readable description for Gemini to understand when to use this tool.
     */
    String getDescription();

    /**
     * JSON Schema for the tool's parameters (Gemini function declaration format).
     * Returns null if the tool has no parameters.
     */
    JsonNode getParameterSchema();

    /**
     * Execute the tool with given arguments.
     *
     * @param args    Arguments from Gemini's functionCall
     * @param context User context (userId, username) injected from auth — NOT from Gemini
     * @return Result as JsonNode to send back to Gemini as functionResponse
     */
    JsonNode execute(JsonNode args, UserContext context);

    /**
     * Timeout in seconds for this tool's execution.
     */
    default int getTimeoutSeconds() {
        return 3;
    }

    /**
     * Redis cache TTL in seconds. Return 0 to disable caching.
     */
    default int getCacheTtlSeconds() {
        return 0;
    }
}
