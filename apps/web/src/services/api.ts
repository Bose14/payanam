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

  updateItinerary: async (tripId: string, stops: unknown[]) => {
    const response = await api.put(`/api/trips/${tripId}/itinerary`, { stops });
    return response.data;
  },
};

export default api;
