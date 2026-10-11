// src/services/streakApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Centralized API layer for Daily Streak & Rewards feature.
// React components NEVER invoke axios/fetch directly.
// ─────────────────────────────────────────────────────────────────────────────
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Auth ────────────────────────────────────────────────────────────────────
export async function register(email, password) {
  const { data } = await api.post('/auth/register', { email, password });
  return data;
}

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
}

// ─── Streak Endpoints ────────────────────────────────────────────────────────

/**
 * GET /api/daily-streak
 * Returns full authoritative state: serverTime, streak, rewards[], wallet
 */
export async function getStreak() {
  const { data } = await api.get('/daily-streak');
  return data;
}

/**
 * GET /api/daily-streak/status
 * Authoritative poll endpoint called when countdown reaches zero.
 */
export async function getStreakStatus() {
  const { data } = await api.get('/daily-streak/status');
  return data;
}

/**
 * GET /api/daily-streak/wallet
 * Returns real-time wallet balances.
 */
export async function getWallet() {
  const { data } = await api.get('/daily-streak/wallet');
  return data;
}

/**
 * POST /api/daily-streak/claim
 * Sends claim request. Client dayHint is advisory; backend derives eligible day.
 */
export async function claimStreak(dayHint = null, idempotencyKey = null) {
  const headers = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  const payload = dayHint !== null ? { day: dayHint } : {};
  const { data } = await api.post('/daily-streak/claim', payload, { headers });
  return data;
}

/**
 * GET /api/daily-streak/history?page=1&limit=10
 * Paginated successful claims ledger.
 */
export async function getHistory(page = 1, limit = 10) {
  const { data } = await api.get('/daily-streak/history', {
    params: { page, limit },
  });
  return data;
}

export default api;
