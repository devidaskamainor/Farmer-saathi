import axios from 'axios';
import { supabase } from '../config/supabase.js';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 20000
});

api.interceptors.request.use(async config => {
  if (!supabase) return config;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function errorMessage(error) {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
    return 'The request took too long. Please try again.';
  }
  if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
    return 'Could not reach the data service. Check your connection and try again.';
  }
  return error?.message || 'Something went wrong. Please try again.';
}
