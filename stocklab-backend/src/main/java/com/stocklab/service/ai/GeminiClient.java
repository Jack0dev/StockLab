package com.stocklab.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

/**
 * Gemini API client with native Function Calling support.
 * Handles the complete flow: user message → Gemini → function calls → tool results → final answer.
 */
@Component
@Slf4j
public class GeminiClient {

    @Value("${app.gemini.api-key:}")
    private String apiKey;

    @Value("${app.gemini.model:gemini-2.0-flash}")
    private String model;

    private final ToolRegistry toolRegistry;
    private final ToolExecutor toolExecutor;
    private final PromptBuilder promptBuilder;
    private final ChatMemoryService chatMemoryService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    // Max rounds of function calling (prevent infinite loops)
    private static final int MAX_FUNCTION_CALL_ROUNDS = 3;

    public GeminiClient(ToolRegistry toolRegistry, ToolExecutor toolExecutor,
                        PromptBuilder promptBuilder, ChatMemoryService chatMemoryService) {
        this.toolRegistry = toolRegistry;
        this.toolExecutor = toolExecutor;
        this.promptBuilder = promptBuilder;
        this.chatMemoryService = chatMemoryService;
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
    }

    /**
     * Main chat method with function calling loop.
     *
     * @return GeminiResponse containing the final text + metadata about tools used
     */
    public GeminiResponse chat(String userMessage, UserContext context) {
        if (apiKey == null || apiKey.isBlank()) {
            return GeminiResponse.error("AI Assistant chưa được cấu hình. Vui lòng thiết lập GEMINI_API_KEY.");
        }

        List<String> toolsUsed = new ArrayList<>();
        List<String> sources = new ArrayList<>();

        try {
            // Build conversation contents with history
            List<Map<String, Object>> contents = new ArrayList<>();

            // Add chat history
            List<ChatMemoryService.ChatMessage> history = chatMemoryService.getHistory(context.getUserId());
            contents.addAll(chatMemoryService.toGeminiContents(history));

            // Add current user message
            contents.add(Map.of(
                    "role", "user",
                    "parts", List.of(Map.of("text", userMessage))
            ));

            // Function calling loop
            for (int round = 0; round < MAX_FUNCTION_CALL_ROUNDS; round++) {
                // Call Gemini
                JsonNode geminiResponse = callGeminiApi(contents);

                if (geminiResponse == null) {
                    return GeminiResponse.error("Không thể kết nối đến Gemini API.");
                }

                // Extract candidate
                JsonNode candidate = geminiResponse.path("candidates").path(0).path("content");
                JsonNode parts = candidate.path("parts");

                if (!parts.isArray() || parts.isEmpty()) {
                    return GeminiResponse.error("Gemini trả về response rỗng.");
                }

                // Check if Gemini wants to call functions
                List<JsonNode> functionCalls = new ArrayList<>();
                String textResponse = null;

                for (JsonNode part : parts) {
                    if (part.has("functionCall")) {
                        functionCalls.add(part.get("functionCall"));
                    }
                    if (part.has("text")) {
                        textResponse = part.get("text").asText();
                    }
                }

                // If no function calls, we have our final answer
                if (functionCalls.isEmpty()) {
                    // Save to chat memory
                    chatMemoryService.addUserMessage(context.getUserId(), userMessage);
                    if (textResponse != null) {
                        chatMemoryService.addAIMessage(context.getUserId(), textResponse);
                    }

                    return GeminiResponse.builder()
                            .message(textResponse != null ? textResponse : "Không thể tạo phản hồi.")
                            .toolsUsed(toolsUsed)
                            .sources(sources)
                            .success(true)
                            .build();
                }

                // Execute function calls
                // Add model's function call to contents
                List<Map<String, Object>> modelParts = new ArrayList<>();
                for (JsonNode fc : functionCalls) {
                    modelParts.add(Map.of("functionCall", objectMapper.convertValue(fc, Map.class)));
                }
                contents.add(Map.of("role", "model", "parts", modelParts));

                // Execute each function call IN PARALLEL and collect results
                List<Map<String, Object>> functionResponseParts = new ArrayList<>();
                List<java.util.concurrent.CompletableFuture<Map<String, Object>>> futures = new ArrayList<>();

                for (JsonNode fc : functionCalls) {
                    java.util.concurrent.CompletableFuture<Map<String, Object>> future = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
                        String funcName = fc.get("name").asText();
                        JsonNode funcArgs = fc.has("args") ? fc.get("args") : objectMapper.createObjectNode();

                        log.info("[GeminiClient] Function call: {}({})", funcName, funcArgs);

                        ToolCallResult result = toolExecutor.execute(funcName, funcArgs, context);

                        synchronized (toolsUsed) {
                            toolsUsed.add(funcName);
                            if (result.getSource() != null) {
                                sources.add(result.getSource());
                            }
                        }

                        // Build function response
                        Map<String, Object> funcResponse = new LinkedHashMap<>();
                        funcResponse.put("functionResponse", Map.of(
                                "name", funcName,
                                "response", result.isSuccess()
                                        ? objectMapper.convertValue(result.getResult(), Map.class)
                                        : Map.of("error", result.getError())
                        ));
                        return funcResponse;
                    });
                    futures.add(future);
                }

                // Wait for all function calls to complete
                java.util.concurrent.CompletableFuture.allOf(futures.toArray(new java.util.concurrent.CompletableFuture[0])).join();
                for (java.util.concurrent.CompletableFuture<Map<String, Object>> future : futures) {
                    functionResponseParts.add(future.join());
                }

                // Add function responses to contents
                contents.add(Map.of("role", "function", "parts", functionResponseParts));

                log.info("[GeminiClient] Round {} completed, {} function calls executed", round + 1, functionCalls.size());
            }

            // If we exhausted rounds, return what we have
            return GeminiResponse.error("Đã vượt quá số vòng xử lý cho phép.");

        } catch (Exception e) {
            log.error("[GeminiClient] Error: {}", e.getMessage(), e);
            return GeminiResponse.error("Xin lỗi, AI đang gặp sự cố. Vui lòng thử lại sau.");
        }
    }

    /**
     * Call Gemini API with function declarations.
     */
    private JsonNode callGeminiApi(List<Map<String, Object>> contents) throws Exception {
        String url = String.format(
                "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
                model, apiKey
        );

        // Build request body
        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("contents", contents);

        // System instruction
        requestBody.put("system_instruction", Map.of(
                "parts", List.of(Map.of("text", promptBuilder.buildSystemPrompt()))
        ));

        // Tool declarations
        requestBody.put("tools", List.of(Map.of(
                "function_declarations", buildFunctionDeclarations()
        )));

        // Generation config
        requestBody.put("generation_config", Map.of(
                "temperature", 0.7,
                "max_output_tokens", 2048
        ));

        String body = objectMapper.writeValueAsString(requestBody);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            log.error("[GeminiClient] API error: HTTP {} - {}", response.statusCode(), response.body());
            throw new RuntimeException("Gemini API error: HTTP " + response.statusCode());
        }

        return objectMapper.readTree(response.body());
    }

    /**
     * Build function declarations from registered tools.
     */
    private List<Map<String, Object>> buildFunctionDeclarations() {
        List<Map<String, Object>> declarations = new ArrayList<>();

        for (AITool tool : toolRegistry.getAllTools()) {
            Map<String, Object> decl = new LinkedHashMap<>();
            decl.put("name", tool.getName());
            decl.put("description", tool.getDescription());

            JsonNode paramSchema = tool.getParameterSchema();
            if (paramSchema != null) {
                decl.put("parameters", objectMapper.convertValue(paramSchema, Map.class));
            }

            declarations.add(decl);
        }

        return declarations;
    }

    /**
     * Response from GeminiClient.
     */
    @lombok.Data
    @lombok.Builder
    @lombok.AllArgsConstructor
    public static class GeminiResponse {
        private String message;
        private boolean success;
        private List<String> toolsUsed;
        private List<String> sources;

        public static GeminiResponse error(String message) {
            return GeminiResponse.builder()
                    .message(message)
                    .success(false)
                    .toolsUsed(List.of())
                    .sources(List.of())
                    .build();
        }
    }

    /**
     * Call Gemini API stream.
     */
    private void callGeminiApiStream(List<Map<String, Object>> contents, java.util.function.Consumer<String> onData, java.util.function.Supplier<Boolean> isCancelled) throws Exception {
        String url = String.format(
                "https://generativelanguage.googleapis.com/v1beta/models/%s:streamGenerateContent?alt=sse&key=%s",
                model, apiKey
        );

        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("contents", contents);
        requestBody.put("system_instruction", Map.of(
                "parts", List.of(Map.of("text", promptBuilder.buildSystemPrompt()))
        ));
        requestBody.put("tools", List.of(Map.of(
                "function_declarations", buildFunctionDeclarations()
        )));
        requestBody.put("generation_config", Map.of(
                "temperature", 0.7,
                "max_output_tokens", 2048
        ));

        String body = objectMapper.writeValueAsString(requestBody);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<java.util.stream.Stream<String>> response = httpClient.send(request, HttpResponse.BodyHandlers.ofLines());

        if (response.statusCode() != 200) {
            String errorBody = response.body().collect(java.util.stream.Collectors.joining("\n"));
            throw new RuntimeException("Gemini API error: HTTP " + response.statusCode() + " - " + errorBody);
        }

        try (java.util.stream.Stream<String> lines = response.body()) {
            lines.takeWhile(line -> !isCancelled.get()).forEach(line -> {
                if (line.startsWith("data: ")) {
                    String data = line.substring(6).trim();
                    if (!data.isEmpty() && !data.equals("[") && !data.equals("]") && !data.equals(",")) {
                         onData.accept(data);
                    }
                }
            });
        }
    }

    /**
     * Chat with AI using Streaming SSE and Function Calling loop.
     */
    public void chatStream(String userMessage, UserContext context, java.util.function.Consumer<StreamEvent> eventConsumer, java.util.function.Supplier<Boolean> isCancelled) {
        if (apiKey == null || apiKey.isBlank()) {
            eventConsumer.accept(new StreamEvent.ErrorEvent("AI Assistant chưa được cấu hình."));
            return;
        }

        try {
            List<Map<String, Object>> contents = new ArrayList<>();
            List<ChatMemoryService.ChatMessage> history = chatMemoryService.getHistory(context.getUserId());
            contents.addAll(chatMemoryService.toGeminiContents(history));
            contents.add(Map.of("role", "user", "parts", List.of(Map.of("text", userMessage))));

            StringBuilder fullResponse = new StringBuilder();

            for (int round = 0; round < MAX_FUNCTION_CALL_ROUNDS; round++) {
                if (isCancelled.get()) return;

                List<JsonNode> functionCalls = new ArrayList<>();
                StringBuilder currentText = new StringBuilder();

                callGeminiApiStream(contents, data -> {
                    try {
                        JsonNode chunk = objectMapper.readTree(data);
                        JsonNode parts = chunk.path("candidates").path(0).path("content").path("parts");
                        for (JsonNode part : parts) {
                            if (part.has("text")) {
                                String text = part.get("text").asText();
                                currentText.append(text);
                                fullResponse.append(text);
                                eventConsumer.accept(new StreamEvent.TextDelta(text));
                            }
                            if (part.has("functionCall")) {
                                functionCalls.add(part.get("functionCall"));
                            }
                        }
                    } catch (Exception e) {
                        log.error("Error parsing Gemini stream chunk", e);
                    }
                }, isCancelled);

                if (isCancelled.get()) return;

                if (functionCalls.isEmpty()) {
                    chatMemoryService.addUserMessage(context.getUserId(), userMessage);
                    chatMemoryService.addAIMessage(context.getUserId(), fullResponse.toString());
                    eventConsumer.accept(new StreamEvent.DoneEvent());
                    return;
                }

                List<Map<String, Object>> modelParts = new ArrayList<>();
                for (JsonNode fc : functionCalls) {
                    modelParts.add(Map.of("functionCall", objectMapper.convertValue(fc, Map.class)));
                }
                if (!currentText.isEmpty()) {
                     modelParts.add(Map.of("text", currentText.toString()));
                }
                contents.add(Map.of("role", "model", "parts", modelParts));

                List<Map<String, Object>> functionResponseParts = new ArrayList<>();
                List<java.util.concurrent.CompletableFuture<Map<String, Object>>> futures = new ArrayList<>();

                for (JsonNode fc : functionCalls) {
                    String funcName = fc.get("name").asText();
                    JsonNode funcArgs = fc.has("args") ? fc.get("args") : objectMapper.createObjectNode();
                    eventConsumer.accept(new StreamEvent.ToolStart(funcName));

                    java.util.concurrent.CompletableFuture<Map<String, Object>> future = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
                        ToolCallResult result = toolExecutor.execute(funcName, funcArgs, context);
                        
                        eventConsumer.accept(new StreamEvent.ToolResultEvent(funcName, result.isSuccess() ? result.getResult() : Map.of("error", result.getError())));
                        if (result.getSource() != null) {
                            eventConsumer.accept(new StreamEvent.SourceEvent(List.of(result.getSource())));
                        }

                        Map<String, Object> funcResponse = new LinkedHashMap<>();
                        funcResponse.put("functionResponse", Map.of(
                                "name", funcName,
                                "response", result.isSuccess() ? objectMapper.convertValue(result.getResult(), Map.class) : Map.of("error", result.getError())
                        ));
                        return funcResponse;
                    });
                    futures.add(future);
                }

                java.util.concurrent.CompletableFuture.allOf(futures.toArray(new java.util.concurrent.CompletableFuture[0])).join();
                for (java.util.concurrent.CompletableFuture<Map<String, Object>> future : futures) {
                    functionResponseParts.add(future.join());
                }

                contents.add(Map.of("role", "function", "parts", functionResponseParts));
            }

            eventConsumer.accept(new StreamEvent.ErrorEvent("Vượt quá số vòng xử lý."));
        } catch (Exception e) {
            log.error("Gemini stream error", e);
            eventConsumer.accept(new StreamEvent.ErrorEvent("Lỗi xử lý luồng: " + e.getMessage()));
        }
    }
}
