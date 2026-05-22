import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: Tự động gắn JWT token vào mỗi request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor: Xử lý lỗi 401 (hết hạn token) → auto logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ===== Auth APIs =====
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  verifyRegistration: (data) => api.post('/auth/verify-registration', data),
  resendOtp: (email) => api.post('/auth/resend-otp', null, { params: { email } }),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  changePassword: (data) => api.put('/users/change-password', data),
  verify2fa: (data) => api.post('/auth/login/verify-2fa', data),
  forgotPasswordRequest: (data) => api.post('/auth/forgot-password/request', data),
  forgotPasswordReset: (data) => api.post('/auth/forgot-password/reset', data),
};

// ===== User APIs =====
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  changePassword: (data) => api.put('/users/change-password', data),
  uploadAvatar: (avatarBase64) => api.post('/users/avatar', { avatarBase64 }),
};

// ===== Stock APIs =====
export const stockAPI = {
  getAll: (page = 0, size = 20, sort = 'ticker', exchange = '') => {
    const params = { page, size, sort };
    if (exchange) params.exchange = exchange;
    return api.get('/stocks', { params });
  },
  getByTicker: (ticker) => api.get(`/stocks/${ticker}`),
  search: (keyword) => api.get('/stocks/search', { params: { keyword } }),
  getPriceHistory: (ticker, range = '1M') =>
    api.get(`/stocks/${ticker}/history`, { params: { range } }),
  getIndicators: (ticker) => api.get(`/stocks/${ticker}/indicators`),
};

// ===== Trade APIs (migrated to OrderService) =====
export const tradeAPI = {
  getTransactions: (page = 0, size = 20, type = '') => {
    const params = { page, size };
    if (type) params.type = type;
    return api.get('/orders/transactions', { params });
  },
  getPortfolio: () => api.get('/orders/portfolio'),
  getPortfolioSummary: () => api.get('/orders/portfolio/summary'),
};

// ===== Order APIs (OMS) =====
export const orderAPI = {
  placeOrder: (data) => api.post('/orders', data),
  getMyOrders: (page = 0, size = 20, status = '') => {
    const params = { page, size };
    if (status) params.status = status;
    return api.get('/orders', { params });
  },
  getOrderDetail: (id) => api.get(`/orders/${id}`),
  cancelOrder: (id) => api.put(`/orders/${id}/cancel`),
  modifyOrder: (id, data) => api.put(`/orders/${id}/modify`, data),
  getOrderBook: (ticker) => api.get(`/orders/book/${ticker}`),
};

// ===== OTP APIs =====
export const otpAPI = {
  sendOtp: () => api.post('/otp/send'),
};

// ===== Conditional Order APIs =====
export const conditionalOrderAPI = {
  placeOrder: (data) => api.post('/conditional-orders', data),
  getMyOrders: (page = 0, size = 20, status = '') => {
    const params = { page, size };
    if (status) params.status = status;
    return api.get('/conditional-orders', { params });
  },
  cancelOrder: (id) => api.put(`/conditional-orders/${id}/cancel`),
};

// ===== Watchlist APIs =====
export const watchlistAPI = {
  getAll: () => api.get('/watchlist'),
  add: (ticker) => api.post(`/watchlist/${ticker}`),
  remove: (ticker) => api.delete(`/watchlist/${ticker}`),
  isWatched: (ticker) => api.get(`/watchlist/check/${ticker}`),
};

// ===== Admin APIs =====
export const adminAPI = {
  getAdminDashboard: () => api.get('/admin/dashboard'),
  getAllUsers: () => api.get('/admin/users'),
  toggleUserLock: (userId) => api.put(`/admin/users/${userId}/toggle-lock`),
  changeUserRole: (userId, role) => api.put(`/admin/users/${userId}/role`, { role }),
};

// ===== Wallet APIs =====
export const walletAPI = {
  deposit: (data) => api.post('/wallet/deposit', data),
  withdraw: (data) => api.post('/wallet/withdraw', data),
  requestWithdrawOtp: () => api.post('/wallet/withdraw/request-otp'),
  getHistory: (page = 0, size = 20) => api.get('/wallet/history', { params: { page, size } }),
};

// ===== VNPay APIs =====
export const vnpayAPI = {
  createPayment: (data) => api.post('/vnpay/create-payment', data),
  getResult: (params) => api.get('/vnpay/return', { params }),
  cancelPayment: (txnRef) => api.post(`/vnpay/cancel/${txnRef}`),
};

// ===== Bank APIs =====
export const bankAPI = {
  lookupAccount: (bankCode, accountNo) => api.get('/bank/lookup', { params: { bankCode, accountNo } }),
};

// ===== Bot APIs (Module 6) =====
export const botAPI = {
  getStatus: () => api.get('/bot/status'),
  getActivity: () => api.get('/bot/activity'),
  toggle: () => api.put('/bot/toggle'),
};

// ===== Platform Token APIs (SLP) =====
export const platformTokenAPI = {
  getInfo: () => api.get('/platform-token'),
};

// ===== Admin Stock APIs =====
export const adminStockAPI = {
  getAllStocks: (params) => api.get('/admin/stocks', { params }),
  createStock: (data) => api.post('/admin/stocks', data),
  updateStock: (id, data) => api.put(`/admin/stocks/${id}`, data),
  toggleStockStatus: (id) => api.put(`/admin/stocks/${id}/toggle-status`),
  deleteStock: (id) => api.delete(`/admin/stocks/${id}`),
};

// ===== Admin Order APIs =====
export const adminOrderAPI = {
  getAllOrders: (params) => api.get('/admin/orders', { params }),
  forceCancelOrder: (id) => api.put(`/admin/orders/${id}/cancel`),
};

// ===== Export APIs =====
export const exportAPI = {
  exportTransactions: () => api.get('/reports/transactions/export', { responseType: 'blob' }),
};




// ===== News APIs =====
export const newsAPI = {
  getLatest: () => api.get('/news'),
};

// ===== AI Assistant APIs (Hybrid RAG) =====
export const aiAPI = {
  chat: (message) => api.post('/ai/chat', { message }),
  chatStream: async (message, signal) => {
    const token = localStorage.getItem('token');
    return fetch(`${API_BASE_URL}/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ message }),
      signal
    });
  },
  getTools: () => api.get('/ai/tools'),
  getQuota: () => api.get('/ai/quota'),
  clearHistory: () => api.delete('/ai/history'),

  // Local AI Endpoints
  trainLocalModel: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/ai/local/train', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  chatLocalStream: async (message, signal) => {
    const token = localStorage.getItem('token');
    return fetch(`${API_BASE_URL}/ai/local/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ message }),
      signal
    });
  },

  // Smart AI Router (auto-selects Local or Gemini)
  chatSmartStream: async (message, signal) => {
    const token = localStorage.getItem('token');
    return fetch(`${API_BASE_URL}/ai/smart/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ message }),
      signal
    });
  },
  getRouterStatus: () => api.get('/ai/router/status'),
};

export default api;
