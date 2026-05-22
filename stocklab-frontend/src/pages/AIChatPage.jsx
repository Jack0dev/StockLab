import { useState, useRef, useEffect, useCallback } from 'react';
import { aiAPI } from '../api/api';
import './AIChatPage.css';

// Tool name → display info mapping
const TOOL_INFO = {
  get_stock_signal: { icon: '📊', label: 'ML Signal' },
  get_stock_price: { icon: '💰', label: 'Stock Price' },
  get_financial_news: { icon: '📰', label: 'News' },
  get_portfolio: { icon: '💼', label: 'Portfolio' },
  get_market_overview: { icon: '🌐', label: 'Market Overview' },
};

const SUGGESTED_PROMPTS = [
  { icon: '📊', text: 'VCB tín hiệu gì hôm nay?' },
  { icon: '📰', text: 'Tin tức chứng khoán mới nhất?' },
  { icon: '🔍', text: 'So sánh FPT và VNM' },
  { icon: '💼', text: 'Portfolio tôi lãi lỗ thế nào?' },
  { icon: '🌐', text: 'Tổng quan thị trường hôm nay' },
  { icon: '📚', text: 'P/E ratio là gì?' },
];

const MODEL_DISPLAY = {
  local: { icon: '🖥️', label: 'Local AI', color: '#48bb78' },
  gemini: { icon: '☁️', label: 'Gemini', color: '#667eea' },
};

export default function AIChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [quota, setQuota] = useState(null);
  const [trainingState, setTrainingState] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Fetch quota on mount
  useEffect(() => {
    fetchQuota();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const fetchQuota = async () => {
    try {
      const res = await aiAPI.getQuota();
      setQuota(res.data.remaining);
    } catch {
      setQuota(null);
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
          role: 'assistant',
          content: `✅ Đã học xong tài liệu **${file.name}** (${res.data.chunksIndexed} đoạn nội dung). Bây giờ bạn có thể đặt câu hỏi về tài liệu này.`,
          timestamp: new Date(),
          id: Date.now()
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Lỗi tải tài liệu: ${err.message}`,
        error: true,
        timestamp: new Date(),
        id: Date.now()
      }]);
    } finally {
      setTrainingState('');
    }
  };

  const sendMessage = useCallback(async (messageText) => {
    const text = (messageText || input).trim();
    if (!text || isLoading) return;

    if (abortController) {
      abortController.abort();
    }

    const newController = new AbortController();
    setAbortController(newController);

    // Add user message and initial AI message shell
    const userMsg = { role: 'user', content: text, timestamp: new Date() };
    const aiMsgId = Date.now();
    const initialAiMsg = {
        id: aiMsgId,
        role: 'assistant',
        content: '',
        toolsUsed: [],
        sources: [],
        modelUsed: null, // will be set by model_info event
        error: false,
        timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg, initialAiMsg]);
    setInput('');
    setIsLoading(true);
    let isStreamDone = false;

    try {
      // Always use Smart Router — backend auto-selects the best AI
      const response = await aiAPI.chatSmartStream(text, newController.signal);
      
      if (!response.ok) {
         throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        const events = buffer.split("\n\n");
        buffer = events.pop(); // keep incomplete chunk

        for (const eventStr of events) {
          const lines = eventStr.split('\n');
          let eventType = 'message';
          let eventData = '';
          
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
              eventData = line.substring(5).trim();
            }
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
              // Smart Router tells us which AI is responding
              updatedMsg.modelUsed = parsedData.model; // 'local' or 'gemini'
            } else if (eventType === 'model_switch') {
              // Auto-fallback happened: Local AI → Gemini
              updatedMsg.modelUsed = parsedData.to;
              updatedMsg.content += `\n\n> ⚡ *Local AI không khả dụng — đã tự động chuyển sang Gemini*\n\n`;
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
              updatedMsg.content = parsedData.message || 'Lỗi server';
              updatedMsg.error = true;
              isStreamDone = true;
              newController.abort();
            }
            return updatedMsg;
          }));
        }
        if (newController.signal.aborted) break;
      }
      
      fetchQuota();
    } catch (err) {
      if (err.name === 'AbortError') {
          if (!isStreamDone) {
            setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: msg.content + '\n\n*[Đã dừng tạo phản hồi]*' } : msg));
          }
      } else {
          setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, error: true, content: 'Không thể kết nối đến AI. Vui lòng thử lại.' } : msg));
      }
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  }, [input, isLoading, abortController]);

  const handleStopGenerating = () => {
    if (abortController) {
      abortController.abort();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestionClick = (text) => {
    sendMessage(text);
  };

  const handleClearHistory = async () => {
    try {
      await aiAPI.clearHistory();
      setMessages([]);
      fetchQuota();
    } catch {
      // Silently fail
    }
  };

  // Simple markdown-like rendering
  const renderMarkdown = (text) => {
    if (!text) return null;
    // Split by newlines and process
    return text.split('\n').map((line, i) => {
      // Bold
      let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Inline code
      processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');
      // Bullet points
      if (processed.startsWith('- ') || processed.startsWith('• ')) {
        return <li key={i} dangerouslySetInnerHTML={{ __html: processed.slice(2) }} />;
      }
      if (processed.trim() === '') return <br key={i} />;
      return <p key={i} dangerouslySetInnerHTML={{ __html: processed }} />;
    });
  };

  return (
    <div className="ai-chat-page" id="ai-chat-page">
      {/* Header */}
      <div className="ai-chat-header">
        <div className="ai-chat-header-left">
          <div className="ai-chat-avatar">🤖</div>
          <div>
            <h1 className="ai-chat-title" style={{ fontSize: '18px', margin: 0 }}>StockLab AI</h1>
            <span style={{ fontSize: '11px', color: '#718096' }}>
              Tự động chọn AI phù hợp nhất
            </span>
          </div>
        </div>
        <div className="ai-chat-header-right">
          {quota !== null && (
            <div className="ai-quota-badge">
              ⚡ {quota} Gemini còn lại
            </div>
          )}
          <label className="ai-upload-btn" title="Tải tài liệu lên để AI học (PDF, TXT, MD)" style={{
            cursor: trainingState ? 'not-allowed' : 'pointer',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#a0aec0',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)',
            transition: 'all 0.2s',
            fontSize: '14px',
            gap: '4px'
          }}>
            <input type="file" accept=".pdf,.txt,.md" style={{ display: 'none' }} onChange={handleFileUpload} disabled={trainingState !== ''} />
            {trainingState === 'uploading' ? (
               <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
            ) : '📎 Tải tài liệu'}
          </label>
          {messages.length > 0 && (
            <button className="ai-clear-btn" onClick={handleClearHistory}>
              🗑️ Xóa lịch sử
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="ai-chat-messages">
        {messages.length === 0 ? (
          <div className="ai-welcome">
            <div className="ai-welcome-icon">🧠</div>
            <h2>Xin chào! Tôi là StockLab AI</h2>
            <p>
              Trợ lý phân tích tài chính thông minh. Hệ thống tự động chọn AI phù hợp nhất:
              ưu tiên <strong>Local AI</strong> (miễn phí, riêng tư), tự động chuyển sang <strong>Gemini</strong> khi cần.
            </p>
            <div className="ai-suggestions">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  className="ai-suggestion-chip"
                  onClick={() => handleSuggestionClick(prompt.text)}
                >
                  <span>{prompt.icon}</span>
                  {prompt.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`ai-message ${msg.role}`}>
                <div className="ai-message-avatar">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="ai-message-content">
                  {/* Model indicator badge */}
                  {msg.role === 'assistant' && msg.modelUsed && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      marginBottom: '6px',
                      background: MODEL_DISPLAY[msg.modelUsed]?.color + '20',
                      color: MODEL_DISPLAY[msg.modelUsed]?.color,
                      border: `1px solid ${MODEL_DISPLAY[msg.modelUsed]?.color}40`,
                    }}>
                      {MODEL_DISPLAY[msg.modelUsed]?.icon} {MODEL_DISPLAY[msg.modelUsed]?.label}
                    </div>
                  )}

                  {/* Tool badges (before AI response) */}
                  {msg.role === 'assistant' && msg.toolsUsed?.length > 0 && (
                    <div className="ai-tool-badges">
                      {msg.toolsUsed.map((tool, j) => {
                        const info = TOOL_INFO[tool] || { icon: '🔧', label: tool };
                        return (
                          <span key={j} className="ai-tool-badge">
                            <span className="tool-icon">{info.icon}</span>
                            {info.label}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Message bubble */}
                  <div className={`ai-message-bubble ${msg.error ? 'ai-error-bubble' : ''}`}>
                    {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                  </div>

                  {/* Sources */}
                  {msg.role === 'assistant' && msg.sources?.length > 0 && (
                    <div className="ai-sources">
                      {msg.sources.map((src, j) => (
                        <span key={j} className="ai-source-tag">📎 {src}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="ai-typing">
                <div className="ai-message-avatar" style={{
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  borderRadius: '10px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  flexShrink: 0
                }}>🤖</div>
                <div className="ai-typing-dots">
                  <div className="ai-typing-dot" />
                  <div className="ai-typing-dot" />
                  <div className="ai-typing-dot" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="ai-chat-input-area">
        {isLoading && (
          <div className="ai-chat-stop-container" style={{ textAlign: 'center', marginBottom: '10px' }}>
            <button className="ai-stop-btn" onClick={handleStopGenerating} style={{
              background: 'transparent',
              border: '1px solid #4a5568',
              color: '#a0aec0',
              padding: '4px 12px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ width: '8px', height: '8px', background: '#e53e3e', borderRadius: '2px', display: 'inline-block' }}></span>
              Stop generating
            </button>
          </div>
        )}
        <div className="ai-chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="ai-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi về cổ phiếu, tín hiệu ML, tin tức, portfolio..."
            rows={1}
            disabled={isLoading}
            id="ai-chat-input"
          />
          <button
            className="ai-send-btn"
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            id="ai-send-btn"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
