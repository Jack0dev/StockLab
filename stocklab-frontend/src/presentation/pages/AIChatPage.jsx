import { useState, useRef, useEffect, useCallback } from 'react';
import { aiAPI } from '@/infrastructure/repositories/api';
import './AIChatPage.css';

// Tool name → display info mapping (No emojis)
const TOOL_INFO = {
  get_stock_signal: { label: 'Tín hiệu ML' },
  get_stock_price: { label: 'Tra cứu giá cổ phiếu' },
  get_financial_news: { label: 'Tin tức tài chính' },
  get_portfolio: { label: 'Danh mục tài sản' },
  get_market_overview: { label: 'Tổng quan thị trường' },
};

const SUGGESTED_PROMPTS = [
  { text: 'VCB tín hiệu gì hôm nay?' },
  { text: 'Tin tức chứng khoán mới nhất?' },
  { text: 'So sánh FPT và VNM' },
  { text: 'Portfolio tôi lãi lỗ thế nào?' },
  { text: 'Tổng quan thị trường hôm nay' },
  { text: 'Chỉ số P/E là gì?' },
];

const MODEL_DISPLAY = {
  local: { label: 'Local AI', color: '#16a34a' },
  gemini: { label: 'Gemini', color: '#2563eb' },
};

export default function AIChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [quota, setQuota] = useState(null);
  const [trainingState, setTrainingState] = useState('');
  const messagesEndRef = useRef(null);
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
          content: `Đã học xong tài liệu **${file.name}** (${res.data.chunksIndexed} đoạn nội dung). Bây giờ bạn có thể đặt câu hỏi về tài liệu này.`,
          timestamp: new Date(),
          id: Date.now()
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Lỗi tải tài liệu: ${err.message}`,
        error: true,
        timestamp: new Date(),
        id: Date.now()
      }]);
    } finally {
      setTrainingState('');
    }
  };

  const sanitizeErrorMessage = (msg) => {
    if (!msg) return 'Đã xảy ra lỗi. Vui lòng thử lại.';
    if (msg.length > 300 || /```|at\s+\w+\.|Exception|Error:|Traceback|java\.|org\.|com\./i.test(msg)) {
      const shortPart = msg.split(/```|\n\n/)[0]?.trim();
      if (shortPart && shortPart.length > 10 && shortPart.length < 200) {
        return shortPart;
      }
      return 'Đã xảy ra lỗi xử lý yêu cầu. Vui lòng thử lại sau.';
    }
    return msg;
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
      modelUsed: null,
      error: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg, initialAiMsg]);
    setInput('');
    setIsLoading(true);
    let isStreamDone = false;

    try {
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
        buffer = events.pop();

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
              updatedMsg.modelUsed = parsedData.model;
            } else if (eventType === 'model_switch') {
              updatedMsg.modelUsed = parsedData.to;
              updatedMsg.content += `\n\n> *Local AI không khả dụng — đã tự động chuyển sang Gemini*\n\n`;
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

  // Markdown rendering
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
    <div className="ai-chat-page" id="ai-chat-page">
      {/* Header */}
      <div className="ai-chat-header">
        <div className="ai-chat-header-left">
          <div className="ai-chat-avatar">AI</div>
          <div>
            <h1 className="ai-chat-title">StockLab AI</h1>
            <span className="ai-chat-subtitle">Trợ lý phân tích tài chính thông minh</span>
          </div>
        </div>
        <div className="ai-chat-header-right">
          {quota !== null && (
            <div className="ai-quota-badge">
              Gemini còn lại: {quota}
            </div>
          )}
          <label className="ai-upload-btn" title="Tải tài liệu lên để AI học (PDF, TXT, MD)">
            <input type="file" accept=".pdf,.txt,.md" style={{ display: 'none' }} onChange={handleFileUpload} disabled={trainingState !== ''} />
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
            {trainingState === 'uploading' ? 'Đang học tài liệu...' : 'Tải tài liệu'}
          </label>
          {messages.length > 0 && (
            <button className="ai-clear-btn" onClick={handleClearHistory} title="Xóa toàn bộ lịch sử trò chuyện">
              Xóa lịch sử
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="ai-chat-messages">
        {messages.length === 0 ? (
          <div className="ai-welcome">
            <span className="ai-welcome-tag">TRỢ LÝ TÀI CHÍNH</span>
            <h2>StockLab AI Assistant</h2>
            <p>
              Hệ thống hỗ trợ phân tích chứng khoán, đọc hiểu tài liệu doanh nghiệp và tra cứu danh mục.
              Tự động phân phối tác vụ thông minh giữa <strong>Local AI</strong> và <strong>Gemini</strong>.
            </p>
            <div className="ai-suggestions">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  className="ai-suggestion-chip"
                  onClick={() => handleSuggestionClick(prompt.text)}
                >
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
                  {msg.role === 'user' ? 'Bạn' : 'AI'}
                </div>
                <div className="ai-message-content">
                  {/* Model indicator badge */}
                  {msg.role === 'assistant' && msg.modelUsed && (
                    <div className="ai-model-badge">
                      {MODEL_DISPLAY[msg.modelUsed]?.label || msg.modelUsed}
                    </div>
                  )}

                  {/* Tool badges */}
                  {msg.role === 'assistant' && msg.toolsUsed?.length > 0 && (
                    <div className="ai-tool-badges">
                      {msg.toolsUsed.map((tool, j) => {
                        const info = TOOL_INFO[tool] || { label: tool };
                        return (
                          <span key={j} className="ai-tool-badge">
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
                        <span key={j} className="ai-source-tag">Nguồn: {src}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="ai-typing">
                <div className="ai-message-avatar">AI</div>
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
          <div className="ai-chat-stop-container">
            <button className="ai-stop-btn" onClick={handleStopGenerating}>
              <span className="ai-stop-icon" />
              Dừng phản hồi
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
            placeholder="Hỏi về cổ phiếu, tín hiệu ML, tin tức, phân tích doanh nghiệp..."
            rows={1}
            disabled={isLoading}
            id="ai-chat-input"
          />
          <button
            className="ai-send-btn"
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            id="ai-send-btn"
            title="Gửi câu hỏi"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
