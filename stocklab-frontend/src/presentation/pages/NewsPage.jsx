import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { newsAPI } from '@/infrastructure/repositories/api';
import { usePageTour } from '@/presentation/controllers/usePageTour';
import './NewsPage.css';

const SOURCES = [
  { id: 'all', label: 'Tất cả nguồn' },
  { id: 'CafeF', label: 'CafeF' },
  { id: 'VnEconomy', label: 'VnEconomy' },
  { id: 'VnExpress', label: 'VnExpress' },
  { id: 'Tuổi Trẻ', label: 'Tuổi Trẻ' },
];

export default function NewsPage() {
  const navigate = useNavigate();
  const { restartTour } = usePageTour('news');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(0);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await newsAPI.getPaged({
        source: sourceFilter === 'all' ? undefined : sourceFilter,
        search: debouncedSearch || undefined,
        page,
        size: 12,
      });

      if (res.data?.success && res.data.data) {
        const pagedData = res.data.data;
        setArticles(pagedData.content || []);
        setTotalPages(pagedData.totalPages || 1);
        setTotalElements(pagedData.totalElements || 0);
      } else {
        // Fallback to simple list if paged endpoint returns raw list
        const list = Array.isArray(res.data) ? res.data : [];
        setArticles(list);
        setTotalPages(1);
        setTotalElements(list.length);
      }
    } catch (err) {
      console.error('Lỗi khi tải tin tức tài chính:', err);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [sourceFilter, debouncedSearch, page]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const handleSourceChange = (srcId) => {
    setSourceFilter(srcId);
    setPage(0);
  };

  const handleTickerClick = (e, ticker) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/stocks/${ticker}`);
  };

  return (
    <div className="news-page-container fade-in">
      {/* Top Header */}
      <div className="news-top-header">
        <div>
          <span className="news-kicker">TIN TỨC & THỜI SỰ TÀI CHÍNH</span>
          <h1 className="news-main-title">Dòng Chảy Thị Trường 24/7</h1>
          <p className="news-main-sub">
            Cập nhật liên tục tin tức kinh tế vĩ mô, doanh nghiệp niêm yết và diễn biến thị trường chứng khoán từ 4 nguồn báo tài chính hàng đầu Việt Nam.
          </p>
        </div>
        <div className="news-header-meta">
          <button className="help-text-btn" onClick={restartTour} title="Hướng dẫn sử dụng">
            Trợ giúp
          </button>
          <span className="news-live-chip">
            <span className="live-dot"></span>
            CẬP NHẬT 3 GIỜ / LẦN
          </span>
          <span className="news-count-chip mono-num">
            {totalElements} bản tin
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="news-control-bar">
        <div className="news-source-tabs">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              className={`news-tab-btn ${sourceFilter === s.id ? 'active' : ''}`}
              onClick={() => handleSourceChange(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="news-search-box">
          <svg className="news-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="news-search-input"
            placeholder="Tìm theo tiêu đề, nội dung, mã CP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="news-search-clear" onClick={() => setSearchQuery('')}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="news-loading-wrap">
          <div className="spinner"></div>
          <span>Đang tải các bản tin tài chính mới nhất...</span>
        </div>
      ) : articles.length === 0 ? (
        <div className="news-empty-wrap">
          <div className="news-empty-icon">📰</div>
          <h3>Không tìm thấy bản tin nào phù hợp</h3>
          <p>Hãy thử thay đổi từ khóa tìm kiếm hoặc chọn nguồn báo khác.</p>
          {(searchQuery || sourceFilter !== 'all') && (
            <button
              className="news-reset-btn"
              onClick={() => {
                setSearchQuery('');
                setSourceFilter('all');
                setPage(0);
              }}
            >
              Xem tất cả bản tin
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Featured Headline Article (First page & index 0) */}
          {page === 0 && articles[0] && (
            <div className="news-featured-card">
              {articles[0].thumbnail && (
                <div className="featured-img-wrap">
                  <img
                    src={articles[0].thumbnail}
                    alt={articles[0].title}
                    className="featured-img"
                    onError={(e) => {
                      e.currentTarget.parentElement.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="featured-body">
                <div className="news-card-topline">
                  <span className={`news-source-tag source-${articles[0].source?.toLowerCase().replace(/\s+/g, '')}`}>
                    {articles[0].source}
                  </span>
                  <span className="news-date-text">
                    {articles[0].publishedAt || articles[0].pubDate}
                  </span>
                  {articles[0].relatedTickers && (
                    <span
                      className="news-ticker-tag"
                      onClick={(e) => handleTickerClick(e, articles[0].relatedTickers)}
                      title={`Xem chi tiết cổ phiếu ${articles[0].relatedTickers}`}
                    >
                      {articles[0].relatedTickers}
                    </span>
                  )}
                </div>
                <a
                  href={articles[0].link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="featured-title"
                >
                  {articles[0].title}
                </a>
                <p className="featured-desc">{articles[0].description}</p>
                <div className="featured-action">
                  <a
                    href={articles[0].link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="news-read-btn"
                  >
                    Đọc toàn bộ bài báo →
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Regular News Grid */}
          <div className="news-cards-grid">
            {(page === 0 ? articles.slice(1) : articles).map((item, idx) => (
              <a
                key={item.id || item.link || idx}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="news-item-card"
              >
                {item.thumbnail && (
                  <div className="news-thumb-box">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="news-thumb-img"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.parentElement.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="news-card-content">
                  <div className="news-card-topline">
                    <span className="news-source-tag">{item.source || 'Báo chí'}</span>
                    <span className="news-date-text">
                      {item.publishedAt || item.pubDate}
                    </span>
                  </div>
                  <h4 className="news-card-title">{item.title}</h4>
                  <p className="news-card-desc">
                    {item.description ? (item.description.length > 140 ? item.description.substring(0, 140) + '...' : item.description) : ''}
                  </p>
                  <div className="news-card-footer">
                    {item.relatedTickers ? (
                      <span
                        className="news-ticker-tag"
                        onClick={(e) => handleTickerClick(e, item.relatedTickers)}
                        title={`Xem chi tiết mã ${item.relatedTickers}`}
                      >
                        {item.relatedTickers}
                      </span>
                    ) : (
                      <span></span>
                    )}
                    <span className="news-link-hint">Xem chi tiết ↗</span>
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="news-pagination">
              <button
                className="pagi-btn"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ← Trang trước
              </button>
              <div className="pagi-info mono-num">
                Trang <strong>{page + 1}</strong> / {totalPages}
              </div>
              <button
                className="pagi-btn"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Trang tiếp →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
