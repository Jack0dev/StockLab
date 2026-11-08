import { useState } from 'react';
import { customPortfolioAPI } from '@/infrastructure/repositories/api';

export function usePortfolioModal({
  refreshCustomPortfolios,
  setActiveTab,
  activeTab,
  fetchCustomSummary,
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState(null);
  const [deletingPortfolio, setDeletingPortfolio] = useState(null);

  const [formData, setFormData] = useState({ name: '', description: '', tickers: [] });
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const openCreateModal = () => {
    setFormData({ name: '', description: '', tickers: [] });
    setModalError('');
    setShowCreateModal(true);
  };

  const openEditModal = (cp) => {
    setEditingPortfolio(cp);
    setFormData({
      name: cp.name,
      description: cp.description || '',
      tickers: cp.tickers || [],
    });
    setModalError('');
  };

  const openDeleteModal = (cp) => {
    setDeletingPortfolio(cp);
    setModalError('');
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setEditingPortfolio(null);
    setDeletingPortfolio(null);
    setModalError('');
  };

  const toggleStockTicker = (ticker) => {
    setFormData((prev) => {
      const exists = prev.tickers.includes(ticker);
      return {
        ...prev,
        tickers: exists ? prev.tickers.filter((t) => t !== ticker) : [...prev.tickers, ticker],
      };
    });
  };

  const handleCreateSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name.trim()) {
      setModalError('Vui lòng nhập tên danh mục');
      return;
    }
    setModalSubmitting(true);
    setModalError('');
    try {
      const res = await customPortfolioAPI.create({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        tickers: formData.tickers,
      });
      if (res.data.success) {
        setShowCreateModal(false);
        await refreshCustomPortfolios();
        if (res.data.data?.id) {
          setActiveTab(res.data.data.id);
        }
      } else {
        setModalError(res.data.message || 'Tạo danh mục thất bại');
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Có lỗi xảy ra khi tạo danh mục');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name.trim()) {
      setModalError('Vui lòng nhập tên danh mục');
      return;
    }
    setModalSubmitting(true);
    setModalError('');
    try {
      const res = await customPortfolioAPI.update(editingPortfolio.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      });
      if (!res.data.success) {
        setModalError(res.data.message || 'Cập nhật danh mục thất bại');
        return;
      }

      const stocksRes = await customPortfolioAPI.updateStocks(editingPortfolio.id, {
        tickers: formData.tickers,
      });
      if (!stocksRes.data.success) {
        setModalError(stocksRes.data.message || 'Cập nhật cổ phiếu thất bại');
        return;
      }

      setEditingPortfolio(null);
      await refreshCustomPortfolios();
      if (activeTab === editingPortfolio.id) {
        fetchCustomSummary(editingPortfolio.id);
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật danh mục');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deletingPortfolio) return;
    setModalSubmitting(true);
    setModalError('');
    try {
      const res = await customPortfolioAPI.delete(deletingPortfolio.id);
      if (res.data.success) {
        if (activeTab === deletingPortfolio.id) {
          setActiveTab('all');
        }
        setDeletingPortfolio(null);
        await refreshCustomPortfolios();
      } else {
        setModalError(res.data.message || 'Xóa danh mục thất bại');
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Có lỗi xảy ra khi xóa danh mục');
    } finally {
      setModalSubmitting(false);
    }
  };

  return {
    showCreateModal,
    setShowCreateModal,
    editingPortfolio,
    setEditingPortfolio,
    deletingPortfolio,
    setDeletingPortfolio,
    formData,
    setFormData,
    modalSubmitting,
    modalError,
    openCreateModal,
    openEditModal,
    openDeleteModal,
    closeModals,
    toggleStockTicker,
    handleCreateSubmit,
    handleEditSubmit,
    handleDeleteSubmit,
  };
}
