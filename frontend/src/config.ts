// API Configuration
// This allows the frontend to work in different environments (dev, staging, production)

const getApiUrl = (): string => {
  // Check if we have an environment variable set (for production)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }

  // Development fallback
  return 'http://localhost:8080'
}

export const API_URL = getApiUrl()

// Helper function for making API calls with automatic auth headers
export const apiCall = async (endpoint: string, options?: RequestInit) => {
  const url = `${API_URL}${endpoint}`

  // Get token from localStorage
  const token = localStorage.getItem('auth_token')

  // Merge headers with auth token
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Add existing headers
  if (options?.headers) {
    const existingHeaders = new Headers(options.headers)
    existingHeaders.forEach((value, key) => {
      headers[key] = value
    })
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  return response
}
