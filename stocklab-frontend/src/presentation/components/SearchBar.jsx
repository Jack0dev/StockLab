import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { stockAPI } from '@/infrastructure/repositories/api';
import { formatPrice, getPriceClass, getTickerColor } from '@/service/trading.service';
import './SearchBar.css';

export default function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const debounceTimer = useRef(null);

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchStocks = useCallback(async (keyword) => {
    if (!keyword || keyword.trim().length < 1) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const res = await stockAPI.search(keyword.trim());
      if (res.data.success) {
        setResults(res.data.data || []);
        setShowDropdown(true);
      }
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    // Debounce 300ms
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      searchStocks(value);
    }, 300);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  const handleSelect = (ticker) => {
    setQuery('');
    setShowDropdown(false);
    setResults([]);
    navigate(`/stocks/${ticker}`);
  };

  const highlightMatch = (text, keyword) => {
    if (!keyword) return text;
    const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <span key={i} className="highlight">{part}</span> : part
    );
  };

  return (
    <div className="search-bar" ref={wrapperRef}>
      <div className="search-input-wrapper">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85a1.007 1.007 0 00-.115-.1zM12 6.5a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z"/>
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Tìm mã CP, tên công ty..."
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
        />
        {query && (
          <button className="search-clear" onClick={handleClear}>×</button>
        )}
      </div>

      {showDropdown && (
        <div className="search-dropdown">
          {loading ? (
            <div className="search-loading">
              <div className="spinner"></div>
            </div>
          ) : results.length === 0 ? (
            <div className="search-no-result">
              Không tìm thấy kết quả cho "{query}"
            </div>
          ) : (
            results.map(stock => (
              <div
                key={stock.id}
                className="search-result-item"
                onClick={() => handleSelect(stock.ticker)}
              >
                <div className="search-result-left">
                  <div
                    className="search-result-ticker-icon"
                    style={{ background: getTickerColor(stock.ticker) }}
                  >
                    {stock.ticker.substring(0, 2)}
                  </div>
                  <div className="search-result-info">
                    <span className="search-result-ticker">
                      {highlightMatch(stock.ticker, query)}
                    </span>
                    <span className="search-result-name">
                      {highlightMatch(stock.companyName, query)}
                    </span>
                  </div>
                </div>
                <div className="search-result-right">
                  <div className={`search-result-price ${getPriceClass(stock.change)}`}>
                    {formatPrice(stock.currentPrice)}
                  </div>
                  <div className={`search-result-change ${getPriceClass(stock.change)}`}>
                    {stock.changePercent > 0 ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
