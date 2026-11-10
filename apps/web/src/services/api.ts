import axios, { AxiosInstance } from 'axios';
import { ApiResponse, LoginRequest, RegisterRequest, AuthResponse } from '@payanam/types';

function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // If accessing from a phone/tablet or other machine on the local Wi-Fi/LAN (e.g. 192.168.x.x, 10.x.x.x)
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      if (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
        return `http://${hostname}:3001`;
      }
    }
  }

  return envUrl || 'http://localhost:3001';
}

const api: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
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
      error.config?.url?.includes('/api/auth/register') ||
      error.config?.url?.includes('/api/rooms/status');
    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      const currentPath = window.location.pathname + window.location.search;
      const redirectParam = currentPath && currentPath !== '/login' && currentPath !== '/register'
        ? `?redirect=${encodeURIComponent(currentPath)}`
        : '';
      window.location.href = `/login${redirectParam}`;
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
  forgotPassword: async (email: string) => {
    const response = await api.post('/api/auth/forgot-password', { email });
    return response.data.data;
  },
  resetPassword: async (token: string, password: string) => {
    const response = await api.post('/api/auth/reset-password', { token, password });
    return response.data.data;
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

  getRoomMemberStatus: async (inviteCode: string) => {
    const response = await api.get(`/api/rooms/status/${inviteCode}`);
    return response.data.data;
  },

  getPendingCounts: async (): Promise<Record<string, number>> => {
    const response = await api.get('/api/trips/pending-counts');
    return response.data.data.counts;
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

  removeMember: async (tripId: string, memberId: string) => {
    const response = await api.delete(`/api/trips/${tripId}/members/${memberId}`);
    return response.data.data;
  },

  updateItinerary: async (tripId: string, stops: unknown[]) => {
    const response = await api.put(`/api/trips/${tripId}/itinerary`, { stops });
    return response.data;
  },

  addStop: async (tripId: string, stop: {
    place: string;
    item_type?: string;
    description?: string;
    day_number?: number;
    order_index?: number;
    lat?: number | null;
    lng?: number | null;
  }) => {
    const response = await api.post(`/api/trips/${tripId}/stops`, stop);
    return response.data.data;
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

  toggleSplitSettled: async (tripId: string, splitId: string) => {
    const response = await api.patch(`/api/trips/${tripId}/expenses/splits/${splitId}/settle`);
    return response.data.data;
  },

  recordSettlement: async (tripId: string, data: {
    fromUserId: string;
    toUserId: string;
    amount: number;
    notes?: string;
  }) => {
    const response = await api.post(`/api/trips/${tripId}/expenses/settle`, data);
    return response.data.data;
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
  uploadLocationBatch: async (
    sessionId: string,
    fixes: Array<{
      lat: number;
      lng: number;
      speedKmh?: number;
      heading?: number;
      userName?: string;
      seq: number;
      timestamp: string;
    }>,
    userName?: string,
  ) => {
    const response = await api.post(`/api/rides/${sessionId}/locations/batch`, { fixes, userName });
    return response.data.data;
  },
  getRiderTrails: async (sessionId: string) => {
    const response = await api.get(`/api/rides/${sessionId}/trails`);
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

export interface RiderProfile {
  userId: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  phone?: string | null;
  bloodGroup?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  allergies?: string | null;
  medicalNotes?: string | null;
  bikeModel?: string | null;
  bikeRegNo?: string | null;
  drivingLicenseNo?: string | null;
  ridingStyle?: string | null;
  city?: string | null;
  bio?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const profileService = {
  getProfile: async (): Promise<{ profile: RiderProfile }> => {
    const response = await api.get('/api/profile');
    return response.data.data;
  },
  updateProfile: async (data: Partial<RiderProfile>): Promise<{ profile: RiderProfile; message: string }> => {
    const response = await api.put('/api/profile', data);
    return response.data.data;
  },
  getRiderCard: async (userId?: string): Promise<{ card: RiderProfile }> => {
    const url = userId ? `/api/profile/card/${userId}` : '/api/profile/card';
    const response = await api.get(url);
    return response.data.data;
  },
};

export default api;
