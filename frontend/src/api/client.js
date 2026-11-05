import axios from 'axios';

/**
 * Central API client.
 * - Base URL: VITE_API_BASE_URL if set, otherwise '' (uses the Vite dev proxy).
 * - Attaches the JWT from localStorage to every request.
 * - Normalises errors into a single shape: { code, message, details }.
 */
const baseURL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const payload = error.response?.data?.error;
    const normalised = {
      code: payload?.code || 'NETWORK_ERROR',
      message:
        payload?.message ||
        error.message ||
        'Something went wrong. Please try again.',
      details: payload?.details || null,
      status: error.response?.status || 0,
    };

    // Auto-logout on an expired/invalid token.
    if (normalised.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(normalised);
  },
);

export default api;

/* ---------- Typed endpoint helpers ---------- */

export const authApi = {
  register: (data) => api.post('/api/auth/register', data).then((r) => r.data.data),
  login: (data) => api.post('/api/auth/login', data).then((r) => r.data.data),
  me: () => api.get('/api/auth/me').then((r) => r.data.data),
};

export const courseApi = {
  list: () => api.get('/api/courses').then((r) => r.data.data.courses),
  get: (id) => api.get(`/api/courses/${id}`).then((r) => r.data.data.course),
};

export const paymentApi = {
  createOrder: (courseId, idempotencyKey) =>
    api.post('/api/payments/create-order', { courseId, idempotencyKey }).then((r) => r.data.data),
  captureOrder: (orderId, paypalOrderId) =>
    api.post('/api/payments/capture-order', { orderId, paypalOrderId }).then((r) => r.data.data),
  cancelOrder: (orderId) =>
    api.post('/api/payments/cancel-order', { orderId }).then((r) => r.data.data),
  requestRefund: (orderId, reason) =>
    api.post('/api/payments/refund', { orderId, reason }).then((r) => r.data.data),
};

export const orderApi = {
  list: () => api.get('/api/orders').then((r) => r.data.data.orders),
  get: (id) => api.get(`/api/orders/${id}`).then((r) => r.data.data.order),
};

export const adminApi = {
  stats: () => api.get('/api/admin/stats').then((r) => r.data.data),
  payments: (params) => api.get('/api/admin/payments', { params }).then((r) => r.data.data.payments),
  refunds: () => api.get('/api/admin/refunds').then((r) => r.data.data.refunds),
  failedPayments: () => api.get('/api/admin/failed-payments').then((r) => r.data.data.failedPayments),
  cancelOrder: (id, reason) =>
    api.post(`/api/admin/orders/${id}/cancel`, { reason }).then((r) => r.data.data),
  refundOrder: (id, body) =>
    api.post(`/api/admin/orders/${id}/refund`, body).then((r) => r.data.data),
  paymentsReportUrl: () => `${baseURL}/api/admin/reports/payments.csv`,
  refundsReportUrl: () => `${baseURL}/api/admin/reports/refunds.csv`,
};

export const configApi = {
  get: () => api.get('/api/config').then((r) => r.data.data),
};
