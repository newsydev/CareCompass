import axios from 'axios'

export const apiClient = axios.create({
  // Use relative URL when running through Vite proxy (works seamlessly on mobile & localhost)
  baseURL: import.meta.env.VITE_API_BASE_URL !== undefined ? import.meta.env.VITE_API_BASE_URL : '',
  timeout: 20_000,
  withCredentials: true,
})
