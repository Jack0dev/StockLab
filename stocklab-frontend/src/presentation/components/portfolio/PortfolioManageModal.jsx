export default function PortfolioManageModal({
  showCreateModal,
  editingPortfolio,
  deletingPortfolio,
  formData,
  setFormData,
  modalSubmitting,
  modalError,
  portfolio = [],
  closeModals,
  toggleStockTicker,
  handleCreateSubmit,
  handleEditSubmit,
  handleDeleteSubmit,
  openDeleteModal,
}) {
  return (
    <>
      {/* 1. Modal: Tạo Danh Mục Mới */}
      {showCreateModal && (
        <div className="pf-modal-backdrop" onClick={closeModals}>
          <div className="pf-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pf-modal-header">
              <h3 className="pf-modal-title">Tạo Danh Mục Mới</h3>
              <button className="pf-modal-close" onClick={closeModals}>×</button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="pf-modal-body">
                {modalError && (
                  <div style={{ color: '#e11d48', fontSize: '0.85rem', fontWeight: 600 }}>
                    ⚠️ {modalError}
                  </div>
                )}
                <div className="pf-form-group">
                  <label className="pf-form-label">Tên danh mục *</label>
                  <input
                    type="text"
                    className="pf-form-input"
                    placeholder="VD: Đầu tư dài hạn, Lướt sóng T+..."
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    maxLength={50}
                    required
                    autoFocus
                  />
                </div>
                <div className="pf-form-group">
                  <label className="pf-form-label">Mô tả chiến lược</label>
                  <textarea
                    className="pf-form-textarea"
                    placeholder="VD: Gom cổ phiếu đầu ngành, nắm giữ trên 1 năm..."
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    maxLength={255}
                  />
                </div>
                <div className="pf-form-group">
                  <label className="pf-form-label">
                    <span>Chọn cổ phiếu đưa vào danh mục</span>
                    <span style={{ color: '#0284c7', fontWeight: 600 }}>{formData.tickers.length} đã chọn</span>
                  </label>
                  {portfolio.length === 0 ? (
                    <div style={{ fontSize: '0.825rem', color: '#64748b' }}>
                      Bạn chưa sở hữu cổ phiếu nào để thêm. Bạn có thể tạo danh mục trước và thêm sau.
                    </div>
                  ) : (
                    <div className="pf-stock-select-list">
                      {portfolio.map((p) => {
                        const checked = formData.tickers.includes(p.ticker);
                        return (
                          <div
                            key={p.ticker}
                            className={`pf-stock-select-item ${checked ? 'checked' : ''}`}
                            onClick={() => toggleStockTicker(p.ticker)}
                          >
                            <input
                              type="checkbox"
                              className="pf-stock-checkbox"
                              checked={checked}
                              onChange={() => {}}
                            />
                            <span className="pf-stock-ticker mono-num">{p.ticker}</span>
                            <span className="pf-stock-company">{p.companyName}</span>
                            <span className="pf-stock-holding-badge mono-num">
                              {p.quantity.toLocaleString('vi-VN')} CP
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="pf-modal-footer">
                <button
                  type="button"
                  className="pf-btn-secondary"
                  onClick={closeModals}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="pf-btn-primary"
                  disabled={modalSubmitting}
                >
                  {modalSubmitting ? 'Đang tạo...' : 'Tạo danh mục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Chỉnh Sửa Danh Mục */}
      {editingPortfolio && (
        <div className="pf-modal-backdrop" onClick={closeModals}>
          <div className="pf-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pf-modal-header">
              <h3 className="pf-modal-title">✏️ Chỉnh Sửa Danh Mục</h3>
              <button className="pf-modal-close" onClick={closeModals}>×</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="pf-modal-body">
                {modalError && (
                  <div style={{ color: '#e11d48', fontSize: '0.85rem', fontWeight: 600 }}>
                    ⚠️ {modalError}
                  </div>
                )}
                <div className="pf-form-group">
                  <label className="pf-form-label">Tên danh mục *</label>
                  <input
                    type="text"
                    className="pf-form-input"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    maxLength={50}
                    required
                    autoFocus
                  />
                </div>
                <div className="pf-form-group">
                  <label className="pf-form-label">Mô tả chiến lược</label>
                  <textarea
                    className="pf-form-textarea"
                    placeholder="Ghi chú về chiến lược..."
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    maxLength={255}
                  />
                </div>
                <div className="pf-form-group">
                  <label className="pf-form-label">
                    <span>Quản lý cổ phiếu trong danh mục</span>
                    <span style={{ color: '#0284c7', fontWeight: 600 }}>{formData.tickers.length} đã chọn</span>
                  </label>
                  {portfolio.length === 0 ? (
                    <div style={{ fontSize: '0.825rem', color: '#64748b' }}>
                      Tài khoản hiện chưa có cổ phiếu nào đang nắm giữ.
                    </div>
                  ) : (
                    <div className="pf-stock-select-list">
                      {portfolio.map((p) => {
                        const checked = formData.tickers.includes(p.ticker);
                        return (
                          <div
                            key={p.ticker}
                            className={`pf-stock-select-item ${checked ? 'checked' : ''}`}
                            onClick={() => toggleStockTicker(p.ticker)}
                          >
                            <input
                              type="checkbox"
                              className="pf-stock-checkbox"
                              checked={checked}
                              onChange={() => {}}
                            />
                            <span className="pf-stock-ticker mono-num">{p.ticker}</span>
                            <span className="pf-stock-company">{p.companyName}</span>
                            <span className="pf-stock-holding-badge mono-num">
                              {p.quantity.toLocaleString('vi-VN')} CP
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="pf-modal-footer">
                <button
                  type="button"
                  className="pf-btn-text-danger"
                  onClick={() => {
                    const cp = editingPortfolio;
                    closeModals();
                    openDeleteModal(cp);
                  }}
                >
                  🗑️ Xóa danh mục này
                </button>
                <div className="pf-modal-footer-right">
                  <button
                    type="button"
                    className="pf-btn-secondary"
                    onClick={closeModals}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="pf-btn-primary"
                    disabled={modalSubmitting}
                  >
                    {modalSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal: Xác Nhận Xóa Danh Mục */}
      {deletingPortfolio && (
        <div className="pf-modal-backdrop" onClick={closeModals}>
          <div className="pf-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pf-modal-header">
              <h3 className="pf-modal-title" style={{ color: '#e11d48' }}>Xóa Danh Mục?</h3>
              <button className="pf-modal-close" onClick={closeModals}>×</button>
            </div>
            <div className="pf-modal-body">
              {modalError && (
                <div style={{ color: '#e11d48', fontSize: '0.85rem', fontWeight: 600 }}>
                  ⚠️ {modalError}
                </div>
              )}
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b', lineHeight: 1.5 }}>
                Bạn có chắc chắn muốn xóa danh mục <strong>"{deletingPortfolio.name}"</strong> không?
              </p>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  fontSize: '0.8rem',
                  color: '#64748b',
                }}
              >
                ℹ️ <strong>Lưu ý an toàn:</strong> Thao tác này chỉ xóa nhóm phân loại danh mục. Toàn bộ cổ phiếu và số dư tiền mặt của bạn <strong>vẫn được giữ nguyên vẹn 100%</strong>.
              </div>
            </div>
            <div className="pf-modal-footer">
              <button
                type="button"
                className="pf-btn-secondary"
                onClick={closeModals}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="pf-btn-danger"
                disabled={modalSubmitting}
                onClick={handleDeleteSubmit}
              >
                {modalSubmitting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
