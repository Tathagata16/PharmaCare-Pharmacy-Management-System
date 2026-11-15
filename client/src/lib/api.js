import axios from 'axios'

const configuredApiUrl = import.meta.env.VITE_API_URL
const localApiUrl = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/
const productionApiUrl = 'https://pharmacare-pharmacy-management-system-4tou.onrender.com/api'
const baseURL = import.meta.env.PROD && (!configuredApiUrl || localApiUrl.test(configuredApiUrl))
  ? productionApiUrl
  : configuredApiUrl || 'http://localhost:5001/api'

export const api = axios.create({
  baseURL,
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
    const responseData = error.response?.data
    if (responseData?.details?.length) {
      const details = responseData.details
        .map(({ path, message }) => `${path}: ${message}`)
        .join('; ')
      return `${responseData.error || 'Invalid request'}: ${details}`
    }
    return responseData?.error || error.message || 'The request could not be completed.'
  }
  return error instanceof Error ? error.message : 'The request could not be completed.'
}
