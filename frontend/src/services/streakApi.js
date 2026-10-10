// src/services/streakApi.js
// All network calls to the daily-streak backend.
// React components NEVER call fetch/axios directly — they go through here.
// All values shown in the UI must come from these responses (backend is authoritative).

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// ─── Axios instance ──────────────────────────────────────────────────────────
const api = axios.create({ baseURL: BASE_URL });

// Attach JWT on every request from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
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

// ─── Streak ──────────────────────────────────────────────────────────────────

/**
 * GET /api/daily-streak
 * Returns full state: serverTime, streak, rewards[], wallet
 */
export async function getStreak() {
  const { data } = await api.get('/daily-streak');
  return data;
}

/**
 * GET /api/daily-streak/status
 * Lightweight poll — used when countdown hits zero.
 * Returns serverTime, eligible, nextClaimAt, currentDay
 */
export async function getStreakStatus() {
  const { data } = await api.get('/daily-streak/status');
  return data;
}

/**
 * POST /api/daily-streak/claim
 * dayHint is advisory — backend always re-derives the eligible day.
 * Returns full refreshed state (same shape as getStreak).
 */
export async function claimStreak(dayHint) {
  const { data } = await api.post('/daily-streak/claim', { day: dayHint });
  return data;
}

/**
 * GET /api/daily-streak/history?page=1&limit=10
 */
export async function getHistory(page = 1, limit = 10) {
  const { data } = await api.get('/daily-streak/history', { params: { page, limit } });
  return data;
}
