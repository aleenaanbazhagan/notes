import axios from 'axios';
import toast from 'react-hot-toast';

// Create axios instance with default configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle token expiry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post(`${api.defaults.baseURL}/auth/refresh`, {
            refreshToken,
          });

          const { token, refreshToken: newRefreshToken } = response.data;
          
          localStorage.setItem('token', token);
          localStorage.setItem('refreshToken', newRefreshToken);
          
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token, redirect to login
        window.location.href = '/login';
      }
    }

    // Handle specific error codes
    if (error.response?.status === 403) {
      toast.error('Access denied. Insufficient permissions.');
    } else if (error.response?.status === 429) {
      toast.error('Too many requests. Please slow down.');
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.');
    }

    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
  refreshToken: (data) => api.post('/auth/refresh', data),
  getProfile: () => api.get('/auth/profile'),
  changePassword: (data) => api.post('/auth/change-password', data),
  setupMFA: () => api.post('/auth/mfa/setup'),
  verifyMFA: (data) => api.post('/auth/mfa/verify', data),
  disableMFA: (data) => api.post('/auth/mfa/disable', data),
};

// User Management API
export const userAPI = {
  getUsers: (params) => api.get('/users', { params }),
  getUser: (id) => api.get(`/users/${id}`),
  createUser: (userData) => api.post('/users', userData),
  updateUser: (id, userData) => api.put(`/users/${id}`, userData),
  deleteUser: (id) => api.delete(`/users/${id}`),
  updateUserRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
  updateUserPermissions: (id, permissions) => api.patch(`/users/${id}/permissions`, { permissions }),
  lockUser: (id) => api.patch(`/users/${id}/lock`),
  unlockUser: (id) => api.patch(`/users/${id}/unlock`),
  resetUserPassword: (id) => api.post(`/users/${id}/reset-password`),
  getUserSessions: (id) => api.get(`/users/${id}/sessions`),
  terminateUserSession: (id, sessionId) => api.delete(`/users/${id}/sessions/${sessionId}`),
  getHighRiskUsers: () => api.get('/users/high-risk'),
};

// Security Monitoring API
export const securityAPI = {
  getDashboardStats: () => api.get('/security/dashboard'),
  getSecurityAlerts: (params) => api.get('/security/alerts', { params }),
  getSecurityAlert: (id) => api.get(`/security/alerts/${id}`),
  updateAlertStatus: (id, status) => api.patch(`/security/alerts/${id}/status`, { status }),
  dismissAlert: (id) => api.patch(`/security/alerts/${id}/dismiss`),
  getThreatIntelligence: () => api.get('/security/threat-intelligence'),
  getIncidents: (params) => api.get('/security/incidents', { params }),
  createIncident: (data) => api.post('/security/incidents', data),
  updateIncident: (id, data) => api.put(`/security/incidents/${id}`, data),
  getComplianceStatus: () => api.get('/security/compliance'),
  runSecurityScan: () => api.post('/security/scan'),
  getVulnerabilities: (params) => api.get('/security/vulnerabilities', { params }),
};

// Audit Logs API
export const auditAPI = {
  getAuditLogs: (params) => api.get('/audit/logs', { params }),
  getAuditLog: (id) => api.get(`/audit/logs/${id}`),
  exportAuditLogs: (params) => api.get('/audit/export', { params, responseType: 'blob' }),
  getAuditStats: (params) => api.get('/audit/stats', { params }),
  searchAuditLogs: (query) => api.post('/audit/search', query),
  getLoginHistory: (userId, params) => api.get(`/audit/login-history/${userId}`, { params }),
  getDataAccessLogs: (params) => api.get('/audit/data-access', { params }),
  getSystemEvents: (params) => api.get('/audit/system-events', { params }),
};

// Analytics API
export const analyticsAPI = {
  getUserBehaviorAnalytics: (params) => api.get('/analytics/user-behavior', { params }),
  getAnomalyDetection: (params) => api.get('/analytics/anomalies', { params }),
  getRiskAssessment: (userId) => api.get(`/analytics/risk-assessment/${userId}`),
  getBehavioralBaseline: (userId) => api.get(`/analytics/behavioral-baseline/${userId}`),
  getAccessPatterns: (params) => api.get('/analytics/access-patterns', { params }),
  getSecurityMetrics: (params) => api.get('/analytics/security-metrics', { params }),
  getTrendAnalysis: (params) => api.get('/analytics/trends', { params }),
  generateReport: (reportType, params) => api.post(`/analytics/reports/${reportType}`, params),
  getReports: () => api.get('/analytics/reports'),
  downloadReport: (reportId) => api.get(`/analytics/reports/${reportId}/download`, { responseType: 'blob' }),
};

// Data Classification API
export const dataAPI = {
  getDataAssets: (params) => api.get('/data/assets', { params }),
  getDataAsset: (id) => api.get(`/data/assets/${id}`),
  classifyData: (id, classification) => api.patch(`/data/assets/${id}/classify`, { classification }),
  getDataAccessRequests: (params) => api.get('/data/access-requests', { params }),
  createAccessRequest: (data) => api.post('/data/access-requests', data),
  approveAccessRequest: (id) => api.patch(`/data/access-requests/${id}/approve`),
  rejectAccessRequest: (id, reason) => api.patch(`/data/access-requests/${id}/reject`, { reason }),
  getDataFlows: () => api.get('/data/flows'),
  getDataRetentionPolicies: () => api.get('/data/retention-policies'),
  createRetentionPolicy: (data) => api.post('/data/retention-policies', data),
  updateRetentionPolicy: (id, data) => api.put(`/data/retention-policies/${id}`, data),
  deleteRetentionPolicy: (id) => api.delete(`/data/retention-policies/${id}`),
};

// Settings API
export const settingsAPI = {
  getSecurityPolicies: () => api.get('/settings/security-policies'),
  updateSecurityPolicy: (id, data) => api.put(`/settings/security-policies/${id}`, data),
  getSystemSettings: () => api.get('/settings/system'),
  updateSystemSettings: (data) => api.patch('/settings/system', data),
  getNotificationSettings: () => api.get('/settings/notifications'),
  updateNotificationSettings: (data) => api.patch('/settings/notifications', data),
  getIntegrations: () => api.get('/settings/integrations'),
  createIntegration: (data) => api.post('/settings/integrations', data),
  updateIntegration: (id, data) => api.put(`/settings/integrations/${id}`, data),
  deleteIntegration: (id) => api.delete(`/settings/integrations/${id}`),
  testIntegration: (id) => api.post(`/settings/integrations/${id}/test`),
  backupSystem: () => api.post('/settings/backup'),
  getBackups: () => api.get('/settings/backups'),
  restoreBackup: (id) => api.post(`/settings/backups/${id}/restore`),
};

// File Upload API
export const fileAPI = {
  uploadFile: (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  },
  downloadFile: (fileId) => api.get(`/files/${fileId}/download`, { responseType: 'blob' }),
  deleteFile: (fileId) => api.delete(`/files/${fileId}`),
  getFileMetadata: (fileId) => api.get(`/files/${fileId}/metadata`),
};

// Real-time API (WebSocket wrapper)
export class RealTimeAPI {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  connect() {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No token available for WebSocket connection');
      return;
    }

    const wsUrl = `${process.env.REACT_APP_WS_URL || 'ws://localhost:5000'}/ws?token=${token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.type, data.payload);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.emit('disconnected');
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(type, payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      toast.error('Lost connection to server. Please refresh the page.');
    }
  }
}

// Create real-time API instance
export const realTimeAPI = new RealTimeAPI();

// Export default api instance
export default api;