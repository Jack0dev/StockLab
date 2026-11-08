export default function PortfolioCustomTabs({
  isAll,
  activeTab,
  setActiveTab,
  customPortfolios = [],
  portfolioLength = 0,
  openEditModal,
  openCreateModal,
}) {
  return (
    <div className="pf-nav-section">
      <div className="pf-tabs-bar">
        <div
          className={`pf-tab-item ${isAll ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <span className="pf-tab-label">💼 Tất cả tài sản</span>
          <span className="pf-tab-badge mono-num">{portfolioLength}</span>
        </div>

        {customPortfolios.map((cp) => {
          const isActive = activeTab === cp.id;
          return (
            <div
              key={cp.id}
              className={`pf-tab-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(cp.id)}
            >
              <span className="pf-tab-label">📊 {cp.name}</span>
              <span className="pf-tab-badge mono-num">{cp.stockCount || 0}</span>
              <button
                type="button"
                className="pf-tab-edit-icon"
                title="Chỉnh sửa danh mục này"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(cp);
                }}
              >
                ✏️
              </button>
            </div>
          );
        })}

        <button
          className="pf-add-tab-btn"
          disabled={customPortfolios.length >= 10}
          title={
            customPortfolios.length >= 10
              ? 'Bạn đã đạt giới hạn tối đa 10 danh mục'
              : 'Tạo danh mục mới'
          }
          onClick={openCreateModal}
        >
          <span>+ Tạo danh mục</span>
          {customPortfolios.length > 0 && (
            <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>
              ({customPortfolios.length}/10)
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
