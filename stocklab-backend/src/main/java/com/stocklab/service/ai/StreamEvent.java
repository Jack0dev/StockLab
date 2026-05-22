package com.stocklab.service.ai;

import java.util.List;

public sealed interface StreamEvent permits 
    StreamEvent.TextDelta, 
    StreamEvent.ToolStart, 
    StreamEvent.ToolResultEvent, 
    StreamEvent.SourceEvent, 
    StreamEvent.DoneEvent, 
    StreamEvent.ErrorEvent, 
    StreamEvent.PingEvent {

    record TextDelta(String text) implements StreamEvent {}
    record ToolStart(String tool) implements StreamEvent {}
    record ToolResultEvent(String tool, Object payload) implements StreamEvent {}
    record SourceEvent(List<String> sources) implements StreamEvent {}
    record DoneEvent() implements StreamEvent {}
    record ErrorEvent(String message) implements StreamEvent {}
    record PingEvent() implements StreamEvent {}
}
