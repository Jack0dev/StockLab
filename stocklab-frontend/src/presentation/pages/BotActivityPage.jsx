import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { botAPI, stockAPI, adminManipulationAPI } from '@/infrastructure/repositories/api';
import { useMultiWebSocket } from '@/presentation/controllers/useWebSocket';
import { usePageTour } from '@/presentation/controllers/usePageTour';
import { formatPrice } from '@/service/trading.service';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Layers,
  ShieldAlert,
  Play,
  Square,
  AlertTriangle,
  RefreshCw,
  Clock,
  Zap,
  BarChart2,
  ArrowUpRight,
  Sliders,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Check
} from 'lucide-react';
import './BotActivityPage.css';

const MAX_ACTIVITY = 100;

// Metadata for all 6 scenarios (icon, styling, descriptions)
const SCENARIO_META = {
  PUMP_AND_DUMP: {
    name: 'Bơm & Xả (Pump & Dump)',
    description: 'Gom hàng âm thầm ở nền giá thấp, bơm trần liên tục kích hoạt tâm lý FOMO, phân phối trao tay đỉnh điểm và xả sàn thoát vốn.',
    suggestedMinutes: 5,
    iconClass: 'pump',
    icon: TrendingUp,
    phases: ['Gom hàng (30%)', 'Bơm giá trần (30%)', 'Phân phối đỉnh (20%)', 'Xả hàng ép sàn (20%)']
  },
  BEAR_TRAP: {
    name: 'Bẫy Giảm Giá (Bear Trap / Rũ Cung)',
    description: 'Đè giá xuyên thủng các mốc hỗ trợ then chốt ép nhà đầu tư nhỏ lẻ cắt lỗ, sau đó gom sạch lệnh sàn và kéo giật ngược trần.',
    suggestedMinutes: 3,
    iconClass: 'bear',
    icon: TrendingDown,
    phases: ['Đè giá rũ cung (40%)', 'Quét sàn giật trần (60%)']
  },
  BULL_TRAP: {
    name: 'Bẫy Tăng Giá (Bull Trap / Đu Đỉnh)',
    description: 'Kéo giá tăng mạnh vượt đỉnh cũ dụ lệnh mua FOMO của nhà đầu tư, sau đó bất ngờ xả hàng ồ ạt khiến bên mua bị kẹp giá đỉnh.',
    suggestedMinutes: 3,
    iconClass: 'bull',
    icon: ArrowUpRight,
    phases: ['Kéo vượt đỉnh ảo (40%)', 'Úp sọt đảo chiều (60%)']
  },
  SIDEWAY_ACCUMULATION: {
    name: 'Đè Gom Biên Độ Hẹp (Sideway)',
    description: 'Dựng đồng thời 2 bức tường Mua/Bán song song kẹp biên ±1% giữ giá đi ngang tuyệt đối quanh tham chiếu để gom cạn kiệt nguồn cung.',
    suggestedMinutes: 8,
    iconClass: 'sideway',
    icon: Layers,
    phases: ['Dựng tường chặn song song (50%)', 'Gom hàng biên hẹp (50%)']
  },
  WASH_TRADING: {
    name: 'Quay Tay Thanh Khoản (Wash Trading)',
    description: 'Hai hay nhiều bot tự đặt lệnh mua và bán đối ứng với nhau tại cùng mức giá tham chiếu, kích nổ thanh khoản khổng lồ lọt top thị trường.',
    suggestedMinutes: 5,
    iconClass: 'wash',
    icon: BarChart2,
    phases: ['Quay tay khớp chéo 2 chiều (100%)']
  },
  LOCK_LIMIT: {
    name: 'Khóa Cứng Trần / Sàn (Lock Limit)',
    description: 'Chất lệnh mua giá trần hoặc bán giá sàn với khối lượng áp đảo hàng triệu cổ phiếu, tạo tình trạng trắng bảng bên mua hoặc bên bán tuyệt đối.',
    suggestedMinutes: 5,
    iconClass: 'lock',
    icon: ShieldAlert,
    phases: ['Chất tường lệnh khóa biên độ (100%)']
  }
};

export default function BotActivityPage({ defaultTab }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Determine initial active tab based on prop or route or search param
  const computeActiveTab = () => {
    if (defaultTab) return defaultTab;
    if (location.pathname.includes('/admin/manipulation') || location.pathname.includes('/admin/scenarios')) {
      return 'manipulation';
    }
    const tabParam = searchParams.get('tab');
    if (tabParam === 'manipulation') return 'manipulation';
    if (tabParam === 'overview') return 'overview';
    return 'manipulation'; // Default to manipulation for immediate visibility
  };

  const [activeTab, setActiveTab] = useState(computeActiveTab);
  const { restartTour } = usePageTour(activeTab === 'manipulation' ? 'manipulation' : 'botActivity');

  // Sync tab change with URL route dynamically
  useEffect(() => {
    if (location.pathname.includes('/admin/manipulation') || location.pathname.includes('/admin/scenarios')) {
      setActiveTab('manipulation');
    } else if (location.pathname.includes('/admin/bot-activity')) {
      const tabParam = searchParams.get('tab');
      setActiveTab(tabParam === 'manipulation' ? 'manipulation' : 'overview');
    }
  }, [location.pathname, searchParams]);

  // Sync tab change with URL route
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'manipulation') {
      navigate('/admin/manipulation', { replace: true });
    } else {
      navigate('/admin/bot-activity', { replace: true });
    }
  };

  // ===== TAB 1: Bot Overview State =====
  const [status, setStatus] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  // ===== TAB 2: Manipulation State =====
  const [stocks, setStocks] = useState([]);
  const [selectedTickers, setSelectedTickers] = useState(() => {
    const tickerFromUrl = searchParams.get('ticker');
    return tickerFromUrl ? [tickerFromUrl.toUpperCase()] : ['VCB'];
  });
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [intensity, setIntensity] = useState('MEDIUM');
  const [priceStep, setPriceStep] = useState(100);
  const [targetChangePercent, setTargetChangePercent] = useState(5.0);
  const [lockSide, setLockSide] = useState('CEILING');
  const [backendPresets, setBackendPresets] = useState([]);
  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [killSwitchModalOpen, setKillSwitchModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [notification, setNotification] = useState(null);

  // Watch for ticker change in URL query
  useEffect(() => {
    const tickerFromUrl = searchParams.get('ticker');
    if (tickerFromUrl) {
      setSelectedTickers([tickerFromUrl.toUpperCase()]);
      setActiveTab('manipulation');
    }
  }, [searchParams]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusRes, activityRes, stocksRes, presetsRes, campaignsRes] = await Promise.allSettled([
          botAPI.getStatus(),
          botAPI.getActivity(),
          stockAPI.getAll(0, 100),
          adminManipulationAPI.getPresets(),
          adminManipulationAPI.getActiveCampaigns()
        ]);

        if (statusRes.status === 'fulfilled') {
          setStatus(statusRes.value.data?.data || statusRes.value.data);
        }
        if (activityRes.status === 'fulfilled') {
          const actList = Array.isArray(activityRes.value?.data) ? activityRes.value.data : (activityRes.value?.data?.data || []);
          setActivity(actList);
        }
        if (stocksRes.status === 'fulfilled') {
          const payload = stocksRes.value?.data;
          const content = payload?.data?.content || payload?.data || payload?.content || (Array.isArray(payload) ? payload : []);
          setStocks(Array.isArray(content) ? content : []);
        }
        if (presetsRes.status === 'fulfilled' && presetsRes.value.data?.data) {
          setBackendPresets(presetsRes.value.data.data);
        }
        if (campaignsRes.status === 'fulfilled' && campaignsRes.value.data?.data) {
          setActiveCampaigns(campaignsRes.value.data.data);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Show temporary toast notification
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4500);
  };

  // WebSocket realtime: nhận lệnh bot mới qua /topic/bot
  const handleBotOrder = useCallback((order) => {
    setActivity(prev => {
      const next = [order, ...prev];
      return next.length > MAX_ACTIVITY ? next.slice(0, MAX_ACTIVITY) : next;
    });
  }, []);

  // WebSocket realtime: nhận trạng thái bot qua /topic/bot-status
  const handleBotStatus = useCallback((data) => {
    setStatus(data);
  }, []);

  // WebSocket realtime: nhận cập nhật tiến độ chiến dịch thao túng qua /topic/admin/manipulation
  const handleManipulationUpdate = useCallback((event) => {
    if (!event) return;
    setActiveCampaigns(prev => {
      const exists = prev.some(c => c.campaignId === event.campaignId);
      if (event.status === 'COMPLETED' || event.status === 'CANCELLED') {
        return prev.filter(c => c.campaignId !== event.campaignId);
      }
      if (exists) {
        return prev.map(c => c.campaignId === event.campaignId ? { ...c, ...event } : c);
      } else {
        return [event, ...prev];
      }
    });
  }, []);

  const subscriptions = useMemo(() => [
    { topic: '/topic/bot', handler: handleBotOrder },
    { topic: '/topic/bot-status', handler: handleBotStatus },
    { topic: '/topic/admin/manipulation', handler: handleManipulationUpdate }
  ], [handleBotOrder, handleBotStatus, handleManipulationUpdate]);

  const { connected } = useMultiWebSocket(subscriptions);

  const handleToggleBot = async () => {
    try {
      const res = await botAPI.toggle();
      setStatus(prev => ({ ...prev, enabled: res.data.enabled }));
      showNotification('success', res.data.enabled ? 'Đã kích hoạt Bot thanh khoản.' : 'Đã tạm dừng Bot thanh khoản.');
    } catch (err) {
      console.error('Failed to toggle bot', err);
      showNotification('error', 'Lỗi khi thay đổi trạng thái Bot.');
    }
  };

  // Quick sector selection handlers
  const handleSelectSector = (sector) => {
    let tickers = [];
    if (sector === 'THEP') {
      tickers = ['HPG', 'NKG', 'HSG'];
    } else if (sector === 'BANK') {
      tickers = ['VCB', 'BID', 'CTG', 'TCB', 'MBB', 'VPB'];
    } else if (sector === 'BDS') {
      tickers = ['VHM', 'NVL', 'DIG', 'PDR', 'DXG', 'KDH'];
    } else if (sector === 'VN30') {
      tickers = ['VCB', 'HPG', 'FPT', 'MWG', 'VIC', 'VHM', 'MSN'];
    } else if (sector === 'ALL') {
      tickers = Array.isArray(stocks) ? stocks.map(s => s.ticker) : [];
    } else if (sector === 'CLEAR') {
      tickers = [];
    }
    // Filter to tickers that actually exist in stock list if available
    if (sector !== 'CLEAR' && Array.isArray(stocks) && stocks.length > 0) {
      const validTickers = stocks.map(s => s.ticker);
      tickers = tickers.filter(t => validTickers.includes(t));
      if (tickers.length === 0) tickers = ['VCB'];
    }
    setSelectedTickers(tickers);
  };

  const toggleTicker = (ticker) => {
    setSelectedTickers(prev =>
      prev.includes(ticker)
        ? prev.filter(t => t !== ticker)
        : [...prev, ticker]
    );
  };

  // Launch campaign
  const handleStartCampaign = async (scenarioType) => {
    if (selectedTickers.length === 0) {
      showNotification('error', 'Vui lòng chọn ít nhất 1 mã cổ phiếu để áp dụng kịch bản.');
      return;
    }

    setActionLoading(prev => ({ ...prev, [scenarioType]: true }));
    try {
      const payload = {
        scenarioType,
        tickers: selectedTickers,
        durationMinutes: Number(durationMinutes),
        intensity,
        priceStep: Number(priceStep),
        targetChangePercent: Number(targetChangePercent),
        lockSide
      };
      const res = await adminManipulationAPI.startCampaign(payload);
      if (res.data?.success) {
        showNotification('success', `Đã kích hoạt kịch bản [${scenarioType}] thành công trên ${selectedTickers.join(', ')}!`);
        // Refresh active campaigns
        const activeRes = await adminManipulationAPI.getActiveCampaigns();
        if (activeRes.data?.data) {
          setActiveCampaigns(activeRes.data.data);
        }
      } else {
        showNotification('error', res.data?.message || 'Không thể kích hoạt kịch bản.');
      }
    } catch (err) {
      console.error('Start campaign error:', err);
      showNotification('error', err.response?.data?.message || 'Lỗi khi kích hoạt kịch bản thao túng.');
    } finally {
      setActionLoading(prev => ({ ...prev, [scenarioType]: false }));
    }
  };

  // Stop single campaign
  const handleStopCampaign = async (campaignId) => {
    try {
      await adminManipulationAPI.stopCampaign(campaignId);
      setActiveCampaigns(prev => prev.filter(c => c.campaignId !== campaignId));
      showNotification('success', 'Đã dừng chiến dịch thao túng.');
    } catch (err) {
      console.error('Stop campaign error:', err);
      showNotification('error', 'Không thể dừng chiến dịch.');
    }
  };

  // Trigger Kill-Switch
  const handleEmergencyKillSwitch = async () => {
    try {
      const res = await adminManipulationAPI.emergencyKillSwitch();
      setActiveCampaigns([]);
      setKillSwitchModalOpen(false);
      const count = res.data?.data?.canceledOrdersCount || 0;
      showNotification('success', `ĐÃ DỪNG KHẨN CẤP TOÀN BỘ! Đã hủy ${count} lệnh bot đang treo.`);
    } catch (err) {
      console.error('Kill switch error:', err);
      showNotification('error', 'Lỗi khi kích hoạt dừng khẩn cấp.');
    }
  };

  const formatTime = (t) => {
    if (!t) return '—';
    const d = new Date(t);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Build the dynamic list of 6 scenarios merging backend presets with icons & details
  const scenariosList = useMemo(() => {
    const defaultKeys = Object.keys(SCENARIO_META);
    return defaultKeys.map(key => {
      const meta = SCENARIO_META[key];
      const fromBackend = backendPresets.find(p => (p.type === key || p.scenarioType === key));
      return {
        scenarioType: key,
        name: fromBackend?.titleVi || meta.name,
        description: fromBackend?.description || meta.description,
        suggestedMinutes: fromBackend?.defaultDurationMinutes || meta.suggestedMinutes,
        phases: meta.phases || fromBackend?.phases,
        icon: meta.icon,
        iconClass: meta.iconClass
      };
    });
  }, [backendPresets]);

  if (loading) {
    return (
      <div className="bot-page">
        <div className="bot-loading">
          <div className="bot-loading-spinner"></div>
          <span>Đang đồng bộ dữ liệu kịch bản thao túng & bot thị trường...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bot-page">
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          background: notification.type === 'error' ? '#fff1f2' : '#ecfdf5',
          color: notification.type === 'error' ? '#e11d48' : '#059669',
          border: `1px solid ${notification.type === 'error' ? '#fecdd3' : '#a7f3d0'}`,
          padding: '0.85rem 1.25rem',
          borderRadius: '8px',
          fontWeight: '700',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {notification.type === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="bot-header">
        <div>
          <span className="bot-header-kicker">
            {activeTab === 'manipulation' ? 'Phân Hệ Quản Trị & Tạo Xu Hướng Thị Trường' : 'Phân Hệ Tạo Lập Thanh Khoản'}
          </span>
          <h1 className="bot-header-title">
            {activeTab === 'manipulation' ? 'Kịch Bản Thao Túng & Định Hướng Xu Hướng Giá' : 'Giám Sát Bot Tạo Thanh Khoản Tự Động'}
          </h1>
          <p className="bot-subtitle">
            {activeTab === 'manipulation'
              ? 'Điều khiển 6 kịch bản thao túng thị trường chuyên sâu dành cho Quản trị viên: Bơm xả 4 pha, Bẫy giảm giá (Bear Trap), Bẫy tăng giá (Bull Trap), Đè gom đi ngang (Sideway), Quay tay khớp chéo (Wash Trading), Khóa cứng trần/sàn.'
              : 'Hệ thống tự động phát sinh lệnh đối ứng theo thuật toán ngẫu nhiên nhằm kích hoạt biên độ giá và duy trì thanh khoản cho toàn sàn.'
            }
          </p>
        </div>
        <div className="bot-header-actions">
          {activeTab === 'overview' && (
            <button 
              className={`bot-toggle-btn ${status?.enabled ? 'btn-stop' : 'btn-start'}`}
              onClick={handleToggleBot}
            >
              {status?.enabled ? 'Tắt Bot Thanh Khoản' : 'Kích hoạt Bot Thanh Khoản'}
            </button>
          )}
          <span className={`bot-live-badge ${connected ? 'live' : 'offline'}`}>
            {connected ? 'LIVE WS' : 'Mất kết nối'}
          </span>
          <button className="page-tour-btn" onClick={restartTour} title="Hướng dẫn chức năng">
            <HelpCircle size={16} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bot-tabs-nav">
        <button
          className={`bot-tab-btn ${activeTab === 'manipulation' ? 'active' : ''}`}
          onClick={() => handleTabChange('manipulation')}
        >
          <Zap size={16} />
          <span>Kịch Bản Thao Túng Giá</span>
          {activeCampaigns.length > 0 && (
            <span style={{
              background: '#059669',
              color: '#ffffff',
              fontSize: '0.7rem',
              padding: '0.15rem 0.45rem',
              borderRadius: '9999px',
              marginLeft: '0.35rem'
            }}>
              {activeCampaigns.length} đang chạy
            </span>
          )}
        </button>
        <button
          className={`bot-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => handleTabChange('overview')}
        >
          <Activity size={16} />
          <span>Tổng Quan Bot Thanh Khoản</span>
        </button>
      </div>

      {/* TAB 1: KỊCH BẢN THAO TÚNG GIÁ (MANIPULATION) */}
      {activeTab === 'manipulation' && (
        <>
          {/* Emergency Kill Switch Banner */}
          <div className="bot-killswitch-banner">
            <div className="bot-killswitch-info">
              <div className="bot-killswitch-icon">
                <AlertTriangle size={22} />
              </div>
              <div>
                <div className="bot-killswitch-title">CƠ CHẾ DỪNG KHẨN CẤP (EMERGENCY KILL-SWITCH)</div>
                <p className="bot-killswitch-desc">
                  Lập tức dừng toàn bộ chiến dịch thao túng đang chạy và tự động hủy sạch mọi lệnh bot đang treo trong sổ lệnh trên sàn.
                </p>
              </div>
            </div>
            <button
              className="bot-killswitch-action-btn"
              onClick={() => setKillSwitchModalOpen(true)}
            >
              <Square size={16} />
              DỪNG TOÀN BỘ KHẨN CẤP
            </button>
          </div>

          {/* Active Campaigns Monitor */}
          <div className="active-campaigns-card">
            <div className="manipulation-section-title">
              <Activity size={18} />
              <span>Chiến Dịch Đang Thực Thi ({activeCampaigns.length})</span>
            </div>

            {activeCampaigns.length === 0 ? (
              <div className="active-campaigns-empty">
                Chưa có kịch bản thao túng nào đang chạy. Vui lòng chọn mã cổ phiếu và bấm "Kích Hoạt Kịch Bản" bên dưới.
              </div>
            ) : (
              <div>
                {activeCampaigns.map(camp => (
                  <div key={camp.campaignId} className="active-campaign-item">
                    <div className="active-campaign-info">
                      <h4>{camp.scenarioTitle || camp.scenarioType}</h4>
                      <div className="active-campaign-tickers">
                        {camp.tickers?.map(t => (
                          <span key={t} className="bot-ticker-pill">{t}</span>
                        ))}
                      </div>
                    </div>

                    <div className="active-campaign-progress-bar-wrap">
                      <div className="active-campaign-progress-header">
                        <span>Pha: <strong>{camp.currentPhase || 'Đang thực thi'}</strong></span>
                        <span>{camp.progressPercent || 0}%</span>
                      </div>
                      <div className="active-progress-track">
                        <div
                          className="active-progress-fill"
                          style={{ width: `${Math.min(100, Math.max(5, camp.progressPercent || 0))}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="active-campaign-stats">
                      <div>Lệnh đã phát: <strong>{camp.ordersPlaced || camp.totalOrdersPlaced || 0}</strong></div>
                      <div>Cường độ: <strong>{camp.intensity}</strong></div>
                    </div>

                    <div>
                      <button
                        className="btn-stop-campaign"
                        onClick={() => handleStopCampaign(camp.campaignId)}
                      >
                        Dừng
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Configuration Card */}
          <div className="manipulation-config-card">
            <div className="manipulation-section-title">
              <Sliders size={18} />
              <span>Cấu Hình Tham Số & Chọn Mã Cổ Phiếu Áp Dụng</span>
            </div>

            {/* Quick Sector Presets */}
            <div className="manipulation-presets-bar">
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', alignSelf: 'center', marginRight: '0.25rem' }}>
                Chọn nhanh:
              </span>
              <button className="manipulation-sector-btn" onClick={() => handleSelectSector('THEP')}>Thép (HPG, NKG, HSG)</button>
              <button className="manipulation-sector-btn" onClick={() => handleSelectSector('BANK')}>Ngân hàng (VCB, BID, CTG...)</button>
              <button className="manipulation-sector-btn" onClick={() => handleSelectSector('BDS')}>BĐS (VHM, NVL, DIG...)</button>
              <button className="manipulation-sector-btn" onClick={() => handleSelectSector('VN30')}>VN30</button>
              <button className="manipulation-sector-btn" onClick={() => handleSelectSector('ALL')}>Tất cả ({stocks.length})</button>
              <button className="manipulation-sector-btn" onClick={() => handleSelectSector('CLEAR')}>Bỏ chọn</button>
            </div>

            {/* Ticker Selector Grid */}
            <div className="ticker-picker-grid">
              {!Array.isArray(stocks) || stocks.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Đang tải danh sách cổ phiếu...</div>
              ) : (
                stocks.map(stock => {
                  const isSelected = selectedTickers.includes(stock.ticker);
                  return (
                    <div
                      key={stock.ticker}
                      className={`ticker-checkbox-pill ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleTicker(stock.ticker)}
                    >
                      {isSelected && <Check size={12} style={{ marginRight: '2px' }} />}
                      <span>{stock.ticker}</span>
                      <span style={{ fontSize: '0.7rem', opacity: 0.75 }}>({stock.exchange || 'HOSE'})</span>
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '1.25rem' }}>
              Đã chọn <strong>{selectedTickers.length}</strong> mã: <span style={{ color: '#090d16', fontWeight: '700' }}>{selectedTickers.join(', ') || '(Chưa chọn mã nào)'}</span>
            </div>

            {/* Parameter Row */}
            <div className="config-param-row">
              <div className="config-field">
                <label>Thời lượng chiến dịch</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                >
                  <option value={1}>1 Phút (Siêu tốc / Kiểm thử nhanh)</option>
                  <option value={3}>3 Phút (Thử nghiệm)</option>
                  <option value={5}>5 Phút (Tiêu chuẩn)</option>
                  <option value={10}>10 Phút</option>
                  <option value={15}>15 Phút</option>
                  <option value={30}>30 Phút</option>
                </select>
              </div>

              <div className="config-field">
                <label>Cường độ tác động</label>
                <select
                  value={intensity}
                  onChange={(e) => setIntensity(e.target.value)}
                >
                  <option value="LOW">LOW — Thận trọng (100 - 500 CP / lệnh)</option>
                  <option value="MEDIUM">MEDIUM — Vừa phải (500 - 2,000 CP / lệnh)</option>
                  <option value="HIGH">HIGH — Mãnh liệt (2,000 - 10,000 CP / lệnh)</option>
                </select>
              </div>

              <div className="config-field">
                <label>Bước giá đẩy / ép (VND)</label>
                <select
                  value={priceStep}
                  onChange={(e) => setPriceStep(Number(e.target.value))}
                >
                  <option value={100}>100 VND (Chuẩn bước giá HOSE)</option>
                  <option value={200}>200 VND</option>
                  <option value={500}>500 VND</option>
                  <option value={1000}>1,000 VND</option>
                </select>
              </div>
            </div>
          </div>

          {/* 6 Scenario Cards Grid */}
          <div className="scenarios-grid">
            {scenariosList.map(sc => {
              const IconComp = sc.icon || Zap;
              const isRunningForType = activeCampaigns.some(c => c.scenarioType === sc.scenarioType);
              const isLoading = actionLoading[sc.scenarioType];

              return (
                <div key={sc.scenarioType} className="scenario-card">
                  <div>
                    <div className="scenario-header">
                      <div className={`scenario-icon-wrapper ${sc.iconClass}`}>
                        <IconComp size={20} />
                      </div>
                      <div>
                        <h3 className="scenario-title">{sc.name}</h3>
                        <span className="scenario-type-badge">{sc.scenarioType}</span>
                      </div>
                    </div>

                    <p className="scenario-desc">{sc.description}</p>

                    <div className="scenario-phases-list">
                      <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                        Trình tự các pha ({sc.suggestedMinutes} phút gợi ý):
                      </div>
                      {sc.phases?.map((ph, idx) => (
                        <div key={idx} className="scenario-phase-item">
                          <span className="scenario-phase-num">{idx + 1}</span>
                          <span>{ph}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    {sc.scenarioType === 'LOCK_LIMIT' && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            className={`manipulation-sector-btn ${lockSide === 'CEILING' ? 'font-bold' : ''}`}
                            style={{
                              flex: 1,
                              background: lockSide === 'CEILING' ? '#fae8ff' : '#ffffff',
                              color: lockSide === 'CEILING' ? '#86198f' : '#64748b',
                              borderColor: lockSide === 'CEILING' ? '#d8b4fe' : '#e2e8f0'
                            }}
                            onClick={() => setLockSide('CEILING')}
                          >
                            Khóa Trần (CEILING)
                          </button>
                          <button
                            type="button"
                            className={`manipulation-sector-btn ${lockSide === 'FLOOR' ? 'font-bold' : ''}`}
                            style={{
                              flex: 1,
                              background: lockSide === 'FLOOR' ? '#eff6ff' : '#ffffff',
                              color: lockSide === 'FLOOR' ? '#1d4ed8' : '#64748b',
                              borderColor: lockSide === 'FLOOR' ? '#bfdbfe' : '#e2e8f0'
                            }}
                            onClick={() => setLockSide('FLOOR')}
                          >
                            Khóa Sàn (FLOOR)
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      className="scenario-action-btn"
                      disabled={isLoading || isRunningForType || selectedTickers.length === 0}
                      onClick={() => handleStartCampaign(sc.scenarioType)}
                    >
                      {isLoading ? (
                        <>
                          <RefreshCw size={14} className="spin" />
                          Đang kích hoạt...
                        </>
                      ) : isRunningForType ? (
                        <>
                          <Activity size={14} />
                          Đang thực thi...
                        </>
                      ) : (
                        <>
                          <Play size={14} />
                          Kích Hoạt ({selectedTickers.length} mã)
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* TAB 2: TỔNG QUAN BOT THANH KHOẢN (LIQUIDITY OVERVIEW) */}
      {activeTab === 'overview' && (
        <>
          {/* Bento Grid 4 Cards */}
          <div className="bot-stats-grid">
            <div className="bot-stat-card">
              <span className="bot-stat-index">01</span>
              <div className="bot-stat-label">Trạng thái vận hành</div>
              <div>
                <span className={`bot-status-tag ${status?.enabled ? 'active' : 'inactive'}`}>
                  {status?.enabled ? 'Đang chạy' : 'Đã dừng'}
                </span>
              </div>
            </div>

            <div className="bot-stat-card">
              <span className="bot-stat-index">02</span>
              <div className="bot-stat-label">Tổng lệnh đã phát sinh</div>
              <div className="bot-stat-value tabular-num">
                {status?.totalOrdersPlaced?.toLocaleString('vi-VN') || 0}
              </div>
            </div>

            <div className="bot-stat-card">
              <span className="bot-stat-index">03</span>
              <div className="bot-stat-label">Tần suất chu kỳ</div>
              <div className="bot-stat-value tabular-num">
                {(status?.intervalMs / 1000)?.toFixed(0) || 5}s <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>/ lệnh</span>
              </div>
            </div>

            <div className="bot-stat-card">
              <span className="bot-stat-index">04</span>
              <div className="bot-stat-label">Tài khoản điều phối</div>
              <div>
                <span className="bot-username-pill">{status?.username || 'bot_liquidity'}</span>
              </div>
            </div>
          </div>

          {/* Activity Table Card */}
          <div className="bot-activity-card">
            <div className="bot-activity-header">
              <h3>Nhật ký phát sinh lệnh (Thời gian thực)</h3>
              <span className="bot-activity-count">{activity.length} lệnh gần nhất</span>
            </div>

            {activity.length === 0 ? (
              <div className="bot-empty">
                <p>Hệ thống chưa ghi nhận lượt đặt lệnh nào. Hãy kích hoạt bot để bắt đầu...</p>
              </div>
            ) : (
              <div className="bot-table-wrapper">
                <table className="bot-table">
                  <thead>
                    <tr>
                      <th style={{ width: '100px' }}>Thời gian</th>
                      <th style={{ width: '100px' }}>Mã CP</th>
                      <th style={{ width: '100px' }}>Chiều lệnh</th>
                      <th className="th-right" style={{ width: '110px' }}>Khối lượng</th>
                      <th className="th-right" style={{ width: '130px' }}>Mức giá</th>
                      <th className="th-right">Tổng giá trị</th>
                      <th style={{ width: '120px' }}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((order, i) => (
                      <tr key={i} className={i === 0 ? 'bot-row-new' : ''}>
                        <td className="bot-time">{formatTime(order.timestamp)}</td>
                        <td>
                          <span className="bot-ticker-pill">{order.ticker}</span>
                        </td>
                        <td>
                          <span className={`bot-side-badge ${order.side === 'BUY' ? 'buy' : 'sell'}`}>
                            {order.side === 'BUY' ? 'MUA' : 'BÁN'}
                          </span>
                        </td>
                        <td className="th-right tabular-num font-bold">
                          {order.quantity?.toLocaleString('vi-VN')}
                        </td>
                        <td className="th-right tabular-num">
                          {formatPrice(order.price)} đ
                        </td>
                        <td className="th-right tabular-num font-bold" style={{ color: '#090d16' }}>
                          {formatPrice(order.price * order.quantity)} đ
                        </td>
                        <td>
                          <span className="bot-status-badge success">{order.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirmation Modal for Kill Switch */}
      {killSwitchModalOpen && (
        <div className="bot-modal-backdrop" onClick={() => setKillSwitchModalOpen(false)}>
          <div className="bot-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Dừng Khẩn Cấp Toàn Bộ?</h3>
            <p>
              Hành động này sẽ <strong>dừng ngay lập tức toàn bộ các chiến dịch thao túng đang chạy</strong> và 
              hủy mọi lệnh mua/bán của bot đang treo trên toàn bộ sàn giao dịch.
            </p>
            <div className="bot-modal-actions">
              <button
                className="bot-modal-cancel"
                onClick={() => setKillSwitchModalOpen(false)}
              >
                Hủy bỏ
              </button>
              <button
                className="bot-modal-confirm"
                onClick={handleEmergencyKillSwitch}
              >
                Xác nhận Dừng Ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
