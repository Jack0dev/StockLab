package com.stocklab.service.ai;

import lombok.AllArgsConstructor;
import lombok.Data;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

public class LocalAIContextHolder {
    private static final ThreadLocal<LocalAIContext> contextHolder = new ThreadLocal<>();

    public static void setContext(LocalAIContext context) {
        contextHolder.set(context);
    }

    public static LocalAIContext getContext() {
        return contextHolder.get();
    }

    public static void clearContext() {
        contextHolder.remove();
    }

    @Data
    @AllArgsConstructor
    public static class LocalAIContext {
        private UserContext userContext;
        private SseEmitter emitter;
    }
}
