package com.stocklab.service.ai;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * Manages chat history in Redis for multi-turn conversation support.
 * Stores last N messages per user, auto-expires after 24h.
 */
@Service
@Slf4j
public class ChatMemoryService {

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    private static final String CHAT_MEMORY_PREFIX = "ai:chat:memory:";
    private static final int MAX_MESSAGES = 10;
    private static final long MEMORY_TTL_HOURS = 24;

    public ChatMemoryService(StringRedisTemplate redis) {
        this.redis = redis;
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Get conversation history for a user.
     */
    public List<ChatMessage> getHistory(Long userId) {
        try {
            String key = CHAT_MEMORY_PREFIX + userId;
            String json = redis.opsForValue().get(key);
            if (json != null) {
                return objectMapper.readValue(json, new TypeReference<List<ChatMessage>>() {});
            }
        } catch (Exception e) {
            log.debug("[ChatMemory] Read error: {}", e.getMessage());
        }
        return new ArrayList<>();
    }

    /**
     * Add a user message to history.
     */
    public void addUserMessage(Long userId, String message) {
        addMessage(userId, "user", message);
    }

    /**
     * Add an AI response to history.
     */
    public void addAIMessage(Long userId, String message) {
        addMessage(userId, "model", message);
    }

    /**
     * Clear conversation history for a user.
     */
    public void clearHistory(Long userId) {
        String key = CHAT_MEMORY_PREFIX + userId;
        redis.delete(key);
    }

    private void addMessage(Long userId, String role, String content) {
        try {
            String key = CHAT_MEMORY_PREFIX + userId;
            List<ChatMessage> history = getHistory(userId);

            history.add(new ChatMessage(role, content,
                    LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)));

            // Keep only last N messages
            if (history.size() > MAX_MESSAGES) {
                history = new ArrayList<>(history.subList(history.size() - MAX_MESSAGES, history.size()));
            }

            String json = objectMapper.writeValueAsString(history);
            redis.opsForValue().set(key, json, MEMORY_TTL_HOURS, TimeUnit.HOURS);
        } catch (Exception e) {
            log.debug("[ChatMemory] Write error: {}", e.getMessage());
        }
    }

    /**
     * Convert chat history to Gemini API "contents" format.
     */
    public List<Map<String, Object>> toGeminiContents(List<ChatMessage> history) {
        List<Map<String, Object>> contents = new ArrayList<>();
        for (ChatMessage msg : history) {
            Map<String, Object> content = new LinkedHashMap<>();
            content.put("role", msg.getRole());
            content.put("parts", List.of(Map.of("text", msg.getContent())));
            contents.add(content);
        }
        return contents;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChatMessage {
        private String role;    // "user" or "model"
        private String content;
        private String timestamp;
    }
}
