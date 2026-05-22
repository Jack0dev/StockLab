package com.stocklab.service.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Registry that maps tool names to AITool instances.
 * Auto-discovers all @Component classes implementing AITool.
 */
@Component
@Slf4j
public class ToolRegistry {

    private final Map<String, AITool> tools = new LinkedHashMap<>();

    public ToolRegistry(List<AITool> toolBeans) {
        for (AITool tool : toolBeans) {
            tools.put(tool.getName(), tool);
            log.info("[ToolRegistry] Registered tool: {}", tool.getName());
        }
        log.info("[ToolRegistry] Total tools registered: {}", tools.size());
    }

    /**
     * Get a tool by name (as returned by Gemini functionCall).
     */
    public AITool getTool(String name) {
        return tools.get(name);
    }

    /**
     * Get all registered tools (for building Gemini function declarations).
     */
    public Collection<AITool> getAllTools() {
        return Collections.unmodifiableCollection(tools.values());
    }

    /**
     * Check if a tool exists.
     */
    public boolean hasTool(String name) {
        return tools.containsKey(name);
    }

    /**
     * Get tool names.
     */
    public Set<String> getToolNames() {
        return Collections.unmodifiableSet(tools.keySet());
    }
}
