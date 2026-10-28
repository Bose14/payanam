import axios, { AxiosInstance } from 'axios';
import { ApiResponse, LoginRequest, RegisterRequest, AuthResponse } from '@payanam/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = error.config?.url?.includes('/api/auth/login') ||
      error.config?.url?.includes('/api/auth/register');
    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export const authService = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post<ApiResponse<AuthResponse>>(
      '/api/auth/login',
      data,
    );
    return response.data.data!;
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post<ApiResponse<AuthResponse>>(
      '/api/auth/register',
      data,
    );
    return response.data.data!;
  },

  getMe: async () => {
    const response = await api.get('/api/auth/me');
    return response.data.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/api/auth/logout');
  },
};

export const tripService = {
  createTrip: async (data: {
    from_place: string;
    to_place: string;
    days: number;
    bike_type: string;
    preferences?: string;
  }) => {
    const response = await api.post('/api/trips', data);
    return response.data.data;
  },

  getUserTrips: async () => {
    const response = await api.get('/api/trips');
    return response.data.data;
  },

  getTripById: async (id: string) => {
    const response = await api.get(`/api/trips/${id}`);
    return response.data.data;
  },

  joinRoom: async (invite_code: string) => {
    const response = await api.post('/api/rooms/join', { invite_code });
    return response.data.data;
  },

  getRoomPreview: async (inviteCode: string) => {
    const response = await api.get(`/api/rooms/preview/${inviteCode}`);
    return response.data.data;
  },

  getPendingRequests: async (tripId: string) => {
    const response = await api.get(`/api/trips/${tripId}/requests`);
    return response.data.data;
  },

  respondToRequest: async (tripId: string, memberId: string, action: 'approved' | 'rejected') => {
    const response = await api.put(`/api/trips/${tripId}/requests/${memberId}`, { action });
    return response.data.data;
  },

  getApprovedMembers: async (tripId: string) => {
    const response = await api.get(`/api/trips/${tripId}/members`);
    return response.data.data;
  },

  updateItinerary: async (tripId: string, stops: unknown[]) => {
    const response = await api.put(`/api/trips/${tripId}/itinerary`, { stops });
    return response.data;
  },

  deleteTrip: async (tripId: string) => {
    const response = await api.delete(`/api/trips/${tripId}`);
    return response.data;
  },

  getTripParticipants: async (tripId: string) => {
    const response = await api.get(`/api/trips/${tripId}/participants`);
    return response.data.data.participants;
  },

  getExpenses: async (tripId: string) => {
    const response = await api.get(`/api/trips/${tripId}/expenses`);
    return response.data.data.expenses;
  },

  addExpense: async (tripId: string, data: {
    title: string; amount: number; category: string; paid_by: string;
    split_type: 'equal' | 'custom'; split_among?: string[];
    custom_splits?: Array<{ user_id: string; amount: number }>;
  }) => {
    const response = await api.post(`/api/trips/${tripId}/expenses`, data);
    return response.data.data;
  },

  deleteExpense: async (tripId: string, expenseId: string) => {
    const response = await api.delete(`/api/trips/${tripId}/expenses/${expenseId}`);
    return response.data;
  },
};

export const rideService = {
  startRide: async (tripId: string) => {
    const response = await api.post('/api/rides/start', { tripId });
    return response.data.data;
  },
  endRide: async (sessionId: string) => {
    const response = await api.post(`/api/rides/${sessionId}/end`);
    return response.data.data;
  },
  getActiveSession: async (tripId: string) => {
    const response = await api.get(`/api/rides/active/${tripId}`);
    return response.data.data;
  },
  getSessionById: async (sessionId: string) => {
    const response = await api.get(`/api/rides/${sessionId}`);
    return response.data.data;
  },
  updateLocation: async (sessionId: string, data: { lat: number; lng: number; speedKmh?: number; heading?: number; userName?: string }) => {
    const response = await api.put(`/api/rides/${sessionId}/location`, data);
    return response.data.data;
  },
  updateQuickStatus: async (sessionId: string, quickStatus: string) => {
    const response = await api.put(`/api/rides/${sessionId}/status`, { quickStatus });
    return response.data.data;
  },
  getAllLocations: async (sessionId: string) => {
    const response = await api.get(`/api/rides/${sessionId}/locations`);
    return response.data.data;
  },
  sendMessage: async (sessionId: string, data: { message: string; messageType?: string; userName?: string }) => {
    const response = await api.post(`/api/rides/${sessionId}/messages`, data);
    return response.data.data;
  },
  getMessages: async (sessionId: string, since?: string) => {
    const params = since ? `?since=${encodeURIComponent(since)}` : '';
    const response = await api.get(`/api/rides/${sessionId}/messages${params}`);
    return response.data.data;
  },
};

export default api;
