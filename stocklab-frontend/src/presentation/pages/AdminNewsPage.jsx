import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminNewsAPI } from '@/infrastructure/repositories/api';
import './AdminNewsPage.css';

const SOURCES = [
  { id: 'all', label: 'Tất cả nguồn' },
  { id: 'CafeF', label: 'CafeF' },
  { id: 'VnEconomy', label: 'VnEconomy' },
  { id: 'VnExpress', label: 'VnExpress' },
  { id: 'Tuổi Trẻ', label: 'Tuổi Trẻ' },
];

export default function AdminNewsPage() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [crawling, setCrawling] = useState(false);
  const [crawlMsg, setCrawlMsg] = useState(null);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  // Modal delete confirmation
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(0);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminNewsAPI.getStats();
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('Lỗi tải thống kê crawler:', err);
    }
  }, []);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminNewsAPI.getArticles({
        source: sourceFilter === 'all' ? undefined : sourceFilter,
        search: debouncedSearch || undefined,
        page,
        size: 15,
      });

      if (res.data?.success && res.data.data) {
        const paged = res.data.data;
        setArticles(paged.content || []);
        setTotalPages(paged.totalPages || 1);
        setTotalElements(paged.totalElements || 0);
      } else {
        const list = Array.isArray(res.data) ? res.data : [];
        setArticles(list);
        setTotalPages(1);
        setTotalElements(list.length);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách bài viết:', err);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [sourceFilter, debouncedSearch, page]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleCrawlNow = async () => {
    setCrawling(true);
    setCrawlMsg(null);
    try {
      const res = await adminNewsAPI.crawlNow();
      if (res.data?.success) {
        const d = res.data.data;
        setCrawlMsg({
          type: 'success',
          text: `Đã hoàn tất cào tin! Thu thập: ${d.totalFetched} tin | Lưu mới: ${d.newSaved} tin | Bỏ qua trùng: ${d.duplicatesSkipped} (${d.durationMs}ms)`
        });
        fetchStats();
        fetchArticles();
      } else {
        setCrawlMsg({ type: 'error', text: res.data?.message || 'Lỗi khi kích hoạt cào tin.' });
      }
    } catch (err) {
      setCrawlMsg({
        type: 'error',
        text: err.response?.data?.message || 'Có lỗi xảy ra khi thực hiện cào tin.'
      });
    } finally {
      setCrawling(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await adminNewsAPI.deleteArticle(deleteId);
      if (res.data?.success) {
        setArticles((prev) => prev.filter((a) => a.id !== deleteId));
        setTotalElements((prev) => Math.max(0, prev - 1));
        fetchStats();
        setDeleteId(null);
      }
    } catch (err) {
      alert('Không thể xóa bài viết: ' + (err.response?.data?.message || err.message));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admin-news-container fade-in">
      {/* Top Header */}
      <div className="admin-news-header">
        <div>
          <span className="admin-news-kicker">QUẢN TRỊ BẢN TIN TÀI CHÍNH</span>
          <h1 className="admin-news-title">Quản Lý Tin Tức & Dữ Liệu Crawl</h1>
          <p className="admin-news-sub">
            Giám sát tiến trình cào dữ liệu tự động, kiểm soát nguồn tin tức tài chính và quản lý lưu trữ bài viết trong hệ thống.
          </p>
        </div>
        <div className="admin-news-header-actions">
          <button
            type="button"
            className="admin-news-crawl-btn"
            onClick={handleCrawlNow}
            disabled={crawling}
          >
            {crawling ? (
              <>
                <span className="btn-spinner"></span>
                Đang cào dữ liệu...
              </>
            ) : (
              'Kích hoạt cào tin ngay'
            )}
          </button>
        </div>
      </div>

      {/* Crawl Result Feedback Banner */}
      {crawlMsg && (
        <div className={`admin-news-alert alert-${crawlMsg.type}`}>
          {crawlMsg.text}
        </div>
      )}

      {/* 5 Stats Cards */}
      <div className="admin-news-stats-grid">
        <div className="admin-news-stat-card">
          <span className="stat-card-label">Tổng bài trong CSDL</span>
          <span className="stat-card-value mono-num">
            {stats?.totalArticles != null ? stats.totalArticles.toLocaleString('vi-VN') : totalElements}
          </span>
          <span className="stat-card-foot">Lưu trữ MySQL persistent</span>
        </div>

        <div className="admin-news-stat-card">
          <span className="stat-card-label">Bài gắn mã cổ phiếu</span>
          <span className="stat-card-value mono-num text-bullish">
            {stats?.articlesWithTickers != null ? stats.articlesWithTickers.toLocaleString('vi-VN') : '—'}
          </span>
          <span className="stat-card-foot">Tự động nhận diện ticker</span>
        </div>

        <div className="admin-news-stat-card">
          <span className="stat-card-label">Chu kỳ tự động</span>
          <span className="stat-card-value mono-num">3 Giờ / Lần</span>
          <span className="stat-card-foot">Cron: 0 0 */3 * * *</span>
        </div>

        <div className="admin-news-stat-card">
          <span className="stat-card-label">Giới hạn cào tin</span>
          <span className="stat-card-value mono-num">5 bài / nguồn</span>
          <span className="stat-card-foot">4 nguồn báo uy tín</span>
        </div>

        <div className="admin-news-stat-card">
          <span className="stat-card-label">Lọc trùng lặp</span>
          <span className="stat-card-value" style={{ fontSize: '1.25rem' }}>SHA-256</span>
          <span className="stat-card-foot">Băm URL chuẩn hóa + GUID</span>
        </div>
      </div>

      {/* Content Panel */}
      <div className="admin-news-panel">
        <div className="panel-toolbar">
          <div className="source-filter-group">
            {SOURCES.map((s) => (
              <button
                key={s.id}
                className={`filter-btn ${sourceFilter === s.id ? 'active' : ''}`}
                onClick={() => {
                  setSourceFilter(s.id);
                  setPage(0);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="search-filter-box">
            <input
              type="text"
              placeholder="Tìm theo tiêu đề, nội dung, mã CP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="admin-search-input"
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="table-responsive">
          <table className="admin-news-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Ảnh</th>
                <th>Tiêu đề & Tóm tắt</th>
                <th style={{ width: '130px' }}>Nguồn báo</th>
                <th style={{ width: '100px' }}>Mã CP</th>
                <th style={{ width: '150px' }}>Thời gian</th>
                <th style={{ width: '120px', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="table-loading-cell">
                    <div className="spinner"></div>
                    <span>Đang tải danh sách bài viết...</span>
                  </td>
                </tr>
              ) : articles.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-empty-cell">
                    Không có bản tin nào thỏa mãn điều kiện lọc.
                  </td>
                </tr>
              ) : (
                articles.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.thumbnail ? (
                        <div className="table-thumb-wrap">
                          <img
                            src={item.thumbnail}
                            alt=""
                            className="table-thumb-img"
                            onError={(e) => {
                              e.currentTarget.parentElement.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="table-no-thumb">No img</div>
                      )}
                    </td>
                    <td>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="table-article-title"
                      >
                        {item.title}
                      </a>
                      <p className="table-article-desc">
                        {item.description ? (item.description.length > 120 ? item.description.substring(0, 120) + '...' : item.description) : ''}
                      </p>
                    </td>
                    <td>
                      <span className="table-source-badge">
                        {item.source}
                      </span>
                    </td>
                    <td>
                      {item.relatedTickers ? (
                        <span 
                          className="table-ticker-badge mono-num clickable-ticker"
                          style={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/stocks/${item.relatedTickers}`)}
                          title={`Xem biểu đồ giao dịch & phân tích kỹ thuật ${item.relatedTickers}`}
                        >
                          {item.relatedTickers} ↗
                        </span>
                      ) : (
                        <span className="table-no-ticker">—</span>
                      )}
                    </td>
                    <td className="table-date-cell mono-num">
                      {item.publishedAt || item.pubDate}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="table-actions">
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="action-view-btn"
                          title="Mở bài viết gốc"
                        >
                          ↗
                        </a>
                        <button
                          type="button"
                          className="action-del-btn"
                          onClick={() => setDeleteId(item.id)}
                          title="Xóa bài viết"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="table-pagination-bar">
            <span className="pagi-count-text">
              Tổng số <strong>{totalElements}</strong> bản tin
            </span>
            <div className="pagi-controls">
              <button
                className="pagi-nav-btn"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Trước
              </button>
              <span className="pagi-current mono-num">
                {page + 1} / {totalPages}
              </span>
              <button
                className="pagi-nav-btn"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-box">
            <h3>Xác nhận xóa bài viết</h3>
            <p>
              Bạn có chắc chắn muốn xóa bản tin (ID: <strong>#{deleteId}</strong>) này khỏi cơ sở dữ liệu không? Thao tác này không thể hoàn tác.
            </p>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="modal-btn-cancel"
                onClick={() => setDeleteId(null)}
                disabled={deleting}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="modal-btn-delete"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
