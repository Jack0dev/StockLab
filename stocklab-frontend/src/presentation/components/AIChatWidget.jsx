import { useState, useRef, useEffect, useCallback } from 'react';
import { aiAPI } from '@/infrastructure/repositories/api';
import './AIChatWidget.css';

const TOOL_INFO = {
  get_stock_price: { label: 'Tra cứu giá cổ phiếu' },
  get_financial_news: { label: 'Tin tức tài chính' },
  get_portfolio: { label: 'Danh mục tài sản' },
};

const SUGGESTED_PROMPTS = [
  { text: 'VCB tín hiệu gì hôm nay?' },
  { text: 'Tin tức chứng khoán mới nhất?' },
  { text: 'Portfolio tôi lãi lỗ thế nào?' },
  { text: 'Chỉ số P/E là gì?' },
];

const MODEL_DISPLAY = {
  local: { label: 'Local AI', color: '#16a34a' },
  gemini: { label: 'Gemini', color: '#2563eb' },
};

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [trainingState, setTrainingState] = useState('');
  const [hasUnread, setHasUnread] = useState(false);
  const [inputMode, setInputMode] = useState('text'); // 'text' | 'voice'
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  // Draggable Bubble State & Persistence
  const [bubblePos, setBubblePos] = useState(() => {
    try {
      const saved = localStorage.getItem('stocklab_ai_bubble_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return {
            x: Math.min(Math.max(12, parsed.x), Math.max(12, window.innerWidth - 68)),
            y: Math.min(Math.max(12, parsed.y), Math.max(12, window.innerHeight - 68)),
          };
        }
      }
    } catch {}
    return null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragInfoRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    hasMoved: false,
  });
  const justDraggedRef = useRef(false);

  // Giữ bong bóng nằm trong màn hình khi thay đổi kích thước viewport
  useEffect(() => {
    const handleResize = () => {
      setBubblePos((prev) => {
        if (!prev) return null;
        const maxX = Math.max(12, window.innerWidth - 68);
        const maxY = Math.max(12, window.innerHeight - 68);
        const clampedX = Math.min(Math.max(12, prev.x), maxX);
        const clampedY = Math.min(Math.max(12, prev.y), maxY);
        if (clampedX !== prev.x || clampedY !== prev.y) {
          return { x: clampedX, y: clampedY };
        }
        return prev;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const btn = e.currentTarget;
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {}

    const rect = btn.getBoundingClientRect();
    dragInfoRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
      hasMoved: false,
    };
    justDraggedRef.current = false;
  };

  const handlePointerMove = (e) => {
    if (!dragInfoRef.current.isDragging) return;

    const dx = e.clientX - dragInfoRef.current.startX;
    const dy = e.clientY - dragInfoRef.current.startY;

    if (!dragInfoRef.current.hasMoved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      dragInfoRef.current.hasMoved = true;
      justDraggedRef.current = true;
      setIsDragging(true);
    }

    if (dragInfoRef.current.hasMoved) {
      const fabSize = 56;
      const padding = 12;
      const maxX = Math.max(padding, window.innerWidth - fabSize - padding);
      const maxY = Math.max(padding, window.innerHeight - fabSize - padding);

      const newX = Math.min(Math.max(padding, dragInfoRef.current.originX + dx), maxX);
      const newY = Math.min(Math.max(padding, dragInfoRef.current.originY + dy), maxY);

      setBubblePos({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e) => {
    if (!dragInfoRef.current.isDragging) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const wasMoved = dragInfoRef.current.hasMoved;
    dragInfoRef.current.isDragging = false;
    dragInfoRef.current.hasMoved = false;
    setIsDragging(false);

    if (wasMoved) {
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 100);

      setBubblePos((current) => {
        if (current) {
          try {
            localStorage.setItem('stocklab_ai_bubble_pos', JSON.stringify(current));
          } catch {}
        }
        return current;
      });
    } else {
      justDraggedRef.current = false;
    }
  };

  const handleBubbleClick = (e) => {
    if (justDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    toggleChat();
  };

  const handleBubbleDoubleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setBubblePos(null);
    try {
      localStorage.removeItem('stocklab_ai_bubble_pos');
    } catch {}
  };

  const getPanelStyle = () => {
    if (!bubblePos || window.innerWidth <= 480) return undefined;

    const panelWidth = Math.min(400, window.innerWidth - 32);
    const panelHeight = Math.min(560, window.innerHeight - 32);
    const fabSize = 56;
    const gap = 12;

    let top;
    let left;

    // Vị trí trục Y: Mở phía trên nếu bóng nằm ở nửa dưới màn hình
    if (bubblePos.y > window.innerHeight / 2) {
      top = bubblePos.y - panelHeight - gap;
      if (top < 16) {
        top = Math.max(16, bubblePos.y + fabSize + gap);
      }
    } else {
      top = bubblePos.y + fabSize + gap;
      if (top + panelHeight > window.innerHeight - 16) {
        top = Math.max(16, bubblePos.y - panelHeight - gap);
      }
    }
    top = Math.max(16, Math.min(top, window.innerHeight - panelHeight - 16));

    // Vị trí trục X: Canh lề phải nếu bóng ở nửa phải màn hình
    if (bubblePos.x > window.innerWidth / 2) {
      left = bubblePos.x + fabSize - panelWidth;
    } else {
      left = bubblePos.x;
    }
    left = Math.max(16, Math.min(left, window.innerWidth - panelWidth - 16));

    return {
      left: `${left}px`,
      top: `${top}px`,
      right: 'auto',
      bottom: 'auto',
      width: `${panelWidth}px`,
      maxHeight: `${panelHeight}px`,
    };
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && textareaRef.current && inputMode === 'text') {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, inputMode]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  const toggleChat = () => {
    setIsOpen(prev => !prev);
    if (!isOpen) setHasUnread(false);
    // Stop recording when closing
    if (isOpen && isRecording) stopRecording();
  };

  const toggleInputMode = () => {
    if (isRecording) stopRecording();
    setInputMode(prev => prev === 'text' ? 'voice' : 'text');
    setVoiceTranscript('');
  };

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages(prev => [...prev, {
        role: 'assistant', id: Date.now(), timestamp: new Date(),
        content: 'Trình duyệt không hỗ trợ nhận dạng giọng nói. Vui lòng dùng Chrome.', error: true,
      }]);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      setVoiceTranscript(finalTranscript || interimTranscript);
    };

    recognition.onerror = (event) => {
      console.error('Speech error:', event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setVoiceTranscript('');
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  const sendVoiceMessage = () => {
    if (voiceTranscript.trim()) {
      sendMessage(voiceTranscript.trim());
      setVoiceTranscript('');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTrainingState('uploading');
    try {
      const res = await aiAPI.trainLocalModel(file);
      if (res.data.success) {
        setMessages(prev => [...prev, {
          role: 'assistant', id: Date.now(), timestamp: new Date(),
          content: `Đã học xong tài liệu **${file.name}** (${res.data.chunksIndexed} đoạn nội dung). Bây giờ bạn có thể đặt câu hỏi về tài liệu này.`,
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant', id: Date.now(), timestamp: new Date(),
        content: `Lỗi tải tài liệu: ${err.message}`, error: true,
      }]);
    } finally {
      setTrainingState('');
    }
  };

  const sendMessage = useCallback(async (messageText) => {
    const text = (messageText || input).trim();
    if (!text || isLoading) return;

    if (abortController) abortController.abort();
    const newController = new AbortController();
    setAbortController(newController);

    const userMsg = { role: 'user', content: text, timestamp: new Date() };
    const aiMsgId = Date.now();
    const initialAiMsg = {
      id: aiMsgId, role: 'assistant', content: '', toolsUsed: [],
      sources: [], modelUsed: null, error: false, timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg, initialAiMsg]);
    setInput('');
    setIsLoading(true);
    let isStreamDone = false;

    try {
      const response = await aiAPI.chatSmartStream(text, newController.signal);
      if (!response.ok) {
        throw new Error(`Lỗi kết nối server (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop();

        for (const eventStr of events) {
          const lines = eventStr.split('\n');
          let eventType = 'message';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event:')) eventType = line.substring(6).trim();
            else if (line.startsWith('data:')) eventData = line.substring(5).trim();
          }

          if (!eventData || eventType === 'ping') continue;
          const parsedData = JSON.parse(eventData);

          if (eventType === 'done') {
            isStreamDone = true;
            newController.abort();
            break;
          }

          setMessages(prev => prev.map(msg => {
            if (msg.id !== aiMsgId) return msg;
            const updatedMsg = { ...msg };

            if (eventType === 'model_info') {
              updatedMsg.modelUsed = parsedData.model;
            } else if (eventType === 'model_switch') {
              updatedMsg.modelUsed = parsedData.to;
              updatedMsg.content += `\n\n> *Đã chuyển sang Gemini*\n\n`;
            } else if (eventType === 'text') {
              updatedMsg.content += parsedData.delta;
            } else if (eventType === 'tool_start') {
              if (!updatedMsg.toolsUsed.includes(parsedData.tool)) {
                updatedMsg.toolsUsed = [...updatedMsg.toolsUsed, parsedData.tool];
              }
            } else if (eventType === 'source') {
              if (parsedData.sources) {
                updatedMsg.sources = [...new Set([...updatedMsg.sources, ...parsedData.sources])];
              }
            } else if (eventType === 'error') {
              // Only show friendly message, no code dumps
              updatedMsg.content = sanitizeErrorMessage(parsedData.message);
              updatedMsg.error = true;
              isStreamDone = true;
              newController.abort();
            }
            return updatedMsg;
          }));
        }
        if (newController.signal.aborted) break;
      }

      // Show unread dot if chat is closed
      if (!isOpen) setHasUnread(true);
    } catch (err) {
      if (err.name === 'AbortError') {
        if (!isStreamDone) {
          setMessages(prev => prev.map(msg =>
            msg.id === aiMsgId ? { ...msg, content: msg.content + '\n\n*[Đã dừng]*' } : msg
          ));
        }
      } else {
        setMessages(prev => prev.map(msg =>
          msg.id === aiMsgId ? { ...msg, error: true, content: 'Không thể kết nối đến AI. Vui lòng thử lại.' } : msg
        ));
      }
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  }, [input, isLoading, abortController, isOpen]);

  const handleStopGenerating = () => {
    if (abortController) abortController.abort();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleClearHistory = async () => {
    try {
      await aiAPI.clearHistory();
      setMessages([]);
    } catch { /* silent */ }
  };

  // Sanitize error: strip code blocks, stack traces, and long technical output
  const sanitizeErrorMessage = (msg) => {
    if (!msg) return 'Đã xảy ra lỗi. Vui lòng thử lại.';
    // If it contains stack trace or code patterns, replace with friendly message
    if (msg.length > 300 || /```|at\s+\w+\.|Exception|Error:|Traceback|java\.|org\.|com\./i.test(msg)) {
      // Try to extract a short human-readable part before code
      const shortPart = msg.split(/```|\n\n/)[0]?.trim();
      if (shortPart && shortPart.length > 10 && shortPart.length < 200) {
        return shortPart;
      }
      return 'Đã xảy ra lỗi xử lý yêu cầu. Vui lòng thử lại sau.';
    }
    return msg;
  };

  const renderMarkdown = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');
      if (processed.startsWith('- ') || processed.startsWith('• ')) {
        return <li key={i} dangerouslySetInnerHTML={{ __html: processed.slice(2) }} />;
      }
      if (processed.trim() === '') return <br key={i} />;
      return <p key={i} dangerouslySetInnerHTML={{ __html: processed }} />;
    });
  };

  return (
    <>
      {/* Floating draggable toggle button */}
      <button
        className={`ai-widget-fab ${isOpen ? 'ai-widget-fab--open' : ''} ${hasUnread ? 'ai-widget-fab--unread' : ''} ${isDragging ? 'ai-widget-fab--dragging' : ''}`}
        onClick={handleBubbleClick}
        onDoubleClick={handleBubbleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={bubblePos ? {
          left: `${bubblePos.x}px`,
          top: `${bubblePos.y}px`,
          right: 'auto',
          bottom: 'auto',
        } : undefined}
        title={isOpen ? 'Đóng AI Chat (Kéo thả mọi nơi, click đúp để về góc)' : 'Mở AI Chat (Kéo thả mọi nơi, click đúp để về góc)'}
        id="ai-widget-fab"
      >
        {isOpen ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        )}
        {hasUnread && !isOpen && <span className="ai-widget-fab__dot" />}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="ai-widget-panel" style={getPanelStyle()}>
          {/* Header */}
          <div className="ai-widget-header">
            <div className="ai-widget-header__left">
              <span className="ai-widget-header__badge">AI</span>
              <div>
                <div className="ai-widget-header__title">StockLab AI</div>
                <div className="ai-widget-header__sub">Trợ lý phân tích tài chính</div>
              </div>
            </div>
            <div className="ai-widget-header__actions">
              {messages.length > 0 && (
                <button className="ai-widget-clear-btn" onClick={handleClearHistory} title="Xóa lịch sử trò chuyện">
                  Xóa lịch sử
                </button>
              )}
              <button className="ai-widget-close-btn" onClick={toggleChat} title="Đóng">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="ai-widget-messages">
            {messages.length === 0 ? (
              <div className="ai-widget-welcome">
                <span className="ai-widget-welcome__tag">TRỢ LÝ TÀI CHÍNH</span>
                <h3>Xin chào!</h3>
                <p>Tôi là StockLab AI — trợ lý hỗ trợ phân tích dữ liệu thị trường và danh mục.</p>
                <div className="ai-widget-suggestions">
                  {SUGGESTED_PROMPTS.map((p, i) => (
                    <button key={i} className="ai-widget-suggestion" onClick={() => sendMessage(p.text)}>
                      {p.text}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div key={i} className={`ai-widget-msg ai-widget-msg--${msg.role}`}>
                    <div className="ai-widget-msg__role-tag">
                      {msg.role === 'user' ? 'Bạn' : 'AI'}
                    </div>
                    <div className="ai-widget-msg__body">
                      {msg.role === 'assistant' && msg.modelUsed && (
                        <span className="ai-widget-model-tag">
                          {MODEL_DISPLAY[msg.modelUsed]?.label || msg.modelUsed}
                        </span>
                      )}
                      {msg.role === 'assistant' && msg.toolsUsed?.length > 0 && (
                        <div className="ai-widget-tools">
                          {msg.toolsUsed.map((tool, j) => {
                            const info = TOOL_INFO[tool] || { label: tool };
                            return <span key={j} className="ai-widget-tool">{info.label}</span>;
                          })}
                        </div>
                      )}
                      <div className={`ai-widget-bubble ${msg.error ? 'ai-widget-bubble--error' : ''}`}>
                        {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                      </div>
                      {msg.role === 'assistant' && msg.sources?.length > 0 && (
                        <div className="ai-widget-sources">
                          {msg.sources.map((src, j) => (
                            <span key={j} className="ai-widget-source">Nguồn: {src}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="ai-widget-typing">
                    <div className="ai-widget-msg__role-tag">AI</div>
                    <div className="ai-widget-typing__dots">
                      <span /><span /><span />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="ai-widget-input-area">
            {isLoading && (
              <button className="ai-widget-stop" onClick={handleStopGenerating}>
                <span className="ai-widget-stop__icon" />Stop
              </button>
            )}

            {/* Mode switch */}
            <div className="ai-widget-mode-row">
              <div className="ai-widget-mode-switch">
                <button
                  className={`ai-widget-mode-btn ${inputMode === 'text' ? 'active' : ''}`}
                  onClick={() => { if (inputMode !== 'text') toggleInputMode(); }}
                  title="Nhập văn bản"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 10H3M21 6H3M21 14H3M17 18H3" />
                  </svg>
                </button>
                <button
                  className={`ai-widget-mode-btn ${inputMode === 'voice' ? 'active' : ''}`}
                  onClick={() => { if (inputMode !== 'voice') toggleInputMode(); }}
                  title="Giọng nói"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                    <path d="M19 10v2a7 7 0 01-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>
              </div>
            </div>

            {inputMode === 'text' ? (
              <div className="ai-widget-input-wrap">
                <label className="ai-widget-attach" title="Tải tài liệu">
                  <input type="file" accept=".pdf,.txt,.md" style={{ display: 'none' }} onChange={handleFileUpload} disabled={trainingState !== ''} />
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                  </svg>
                </label>
                <textarea
                  ref={textareaRef}
                  className="ai-widget-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Hỏi về cổ phiếu, tin tức, portfolio..."
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  className="ai-widget-send"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="ai-widget-voice-area">
                <div className="ai-widget-voice-transcript">
                  {voiceTranscript || (isRecording ? 'Đang nghe...' : 'Nhấn nút mic để bắt đầu nói')}
                </div>
                <div className="ai-widget-voice-controls">
                  <button
                    className={`ai-widget-mic-btn ${isRecording ? 'ai-widget-mic-btn--active' : ''}`}
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isLoading}
                    title={isRecording ? 'Dừng ghi âm' : 'Bắt đầu nói'}
                  >
                    {isRecording ? (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                        <path d="M19 10v2a7 7 0 01-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    )}
                  </button>
                  {voiceTranscript && (
                    <button
                      className="ai-widget-voice-send"
                      onClick={sendVoiceMessage}
                      disabled={isLoading}
                    >
                      Gửi
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
