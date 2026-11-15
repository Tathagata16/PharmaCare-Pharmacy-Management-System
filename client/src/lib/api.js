import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pharmacare.accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export function getApiError(error) {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ERR_NETWORK') {
      return 'Cannot reach the PharmaCare API. Start the server and check its MongoDB connection, then try again.'
    }
    return error.response?.data?.error || error.message || 'The request could not be completed.'
  }
  return error instanceof Error ? error.message : 'The request could not be completed.'
}
