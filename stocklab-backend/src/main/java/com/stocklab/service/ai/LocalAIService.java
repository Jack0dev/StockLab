package com.stocklab.service.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.ollama.api.OllamaOptions;

import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class LocalAIService {

    private final ChatModel chatModel;
    private final VectorStore vectorStore;
    private final ChatMemoryService chatMemoryService;

    private static final String SYSTEM_PROMPT_TEMPLATE = """
            You are StockLab private assistant. Answer in Vietnamese.
            
            You have access to INTERNAL DOCUMENTS:
            {docContext}
            
            Rules:
            - If the user asks about the stock market, prices, AI signals, news, or portfolio, YOU MUST CALL THE RELEVANT TOOLS.
            - If the question is about policies, rules, or internal knowledge, prioritize INTERNAL DOCUMENTS.
            - Always be specific and cite which source you used.
            - Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu.
            """;

    /**
     * Chat with Local AI using Document RAG + Agentic Function Calling.
     * Supports optional fallback callback when an error occurs.
     *
     * @param onFallback If provided, called with error message instead of sending error to emitter.
     *                   This allows SmartAIRouterService to catch the error and fallback to Gemini.
     */
    public void chatStreamLocal(String question, SseEmitter emitter, UserContext userContext,
                                 Consumer<String> onFallback) {
        log.info("[LocalAI] Received question from user={}: {}", userContext.getUsername(), question);

        // Set context so the @Bean tools can access UserContext and Emitter
        LocalAIContextHolder.setContext(new LocalAIContextHolder.LocalAIContext(userContext, emitter));

        try {
            // 1. Similarity Search from internal documents
            String docContext = getDocumentContext(question);

            // 2. Build Prompt
            String systemPromptText = SYSTEM_PROMPT_TEMPLATE.replace("{docContext}", docContext);
            SystemMessage systemMessage = new SystemMessage(systemPromptText);
            
            // Build history
            List<org.springframework.ai.chat.messages.Message> messages = new java.util.ArrayList<>();
            messages.add(systemMessage);
            
            List<ChatMemoryService.ChatMessage> history = chatMemoryService.getHistory(userContext.getUserId());
            for (ChatMemoryService.ChatMessage msg : history) {
                if ("user".equals(msg.getRole())) {
                    messages.add(new UserMessage(msg.getContent()));
                } else if ("model".equals(msg.getRole())) {
                    messages.add(new org.springframework.ai.chat.messages.AssistantMessage(msg.getContent()));
                }
            }
            messages.add(new UserMessage(question));

            // Enable tools for Ollama
            OllamaOptions options = new OllamaOptions();
            options.setToolNames(java.util.Set.of(
                    "getStockPrice",
                    "getStockSignal",
                    "getPortfolio",
                    "getFinancialNews",
                    "getMarketOverview"
            ));

            Prompt prompt = new Prompt(messages, options);

            StringBuilder fullResponse = new StringBuilder();

            // 4. Call Ollama Stream
            chatModel.stream(prompt).subscribe(
                    response -> {
                        try {
                            String content = response.getResult().getOutput().getText();
                            if (content != null && !content.isEmpty()) {
                                fullResponse.append(content);
                                synchronized (emitter) {
                                    emitter.send(SseEmitter.event().name("text").data(Map.of("delta", content)));
                                }
                            }
                        } catch (Exception e) {
                            log.error("Error sending SSE", e);
                        }
                    },
                    error -> {
                        log.error("[LocalAI] Stream error", error);
                        LocalAIContextHolder.clearContext();

                        // If fallback callback is provided, delegate to it instead of sending error
                        if (onFallback != null) {
                            onFallback.accept(error.getMessage());
                        } else {
                            try {
                                synchronized (emitter) {
                                    emitter.send(SseEmitter.event().name("error").data(
                                            Map.of("message", "Lỗi Local AI: " + error.getMessage())));
                                }
                            } catch (Exception ignored) {}
                        }
                    },
                    () -> {
                        try {
                            // Save to chat history
                            chatMemoryService.addUserMessage(userContext.getUserId(), question);
                            chatMemoryService.addAIMessage(userContext.getUserId(), fullResponse.toString());
                            
                            synchronized (emitter) {
                                emitter.send(SseEmitter.event().name("done").data(Map.of()));
                            }
                        } catch (Exception ignored) {}
                        LocalAIContextHolder.clearContext();
                    }
            );
        } catch (Exception e) {
            log.error("[LocalAI] Initial stream error: {}", e.getMessage());
            LocalAIContextHolder.clearContext();

            // If fallback callback is provided, delegate to it
            if (onFallback != null) {
                onFallback.accept(e.getMessage());
            } else {
                try {
                    emitter.send(SseEmitter.event().name("error").data(
                            Map.of("message", "Lỗi khởi tạo stream: " + e.getMessage())));
                } catch (Exception ignored) {}
            }
        }
    }

    /**
     * Overload for backward compatibility (no fallback).
     */
    public void chatStreamLocal(String question, SseEmitter emitter, UserContext userContext) {
        chatStreamLocal(question, emitter, userContext, null);
    }

    /**
     * Search internal documents for relevant context.
     */
    private String getDocumentContext(String question) {
        try {
            List<Document> similarDocuments = vectorStore.similaritySearch(
                    org.springframework.ai.vectorstore.SearchRequest.builder()
                            .query(question)
                            .topK(5)
                            .build()
            );

            String context = similarDocuments.stream()
                    .map(Document::getText)
                    .collect(Collectors.joining("\n\n"));

            return context.isEmpty() ? "Không tìm thấy tài liệu nội bộ liên quan." : context;
        } catch (Exception e) {
            log.warn("[LocalAI] Document search failed: {}", e.getMessage());
            return "Không tìm thấy tài liệu nội bộ liên quan.";
        }
    }
}
