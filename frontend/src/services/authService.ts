import { API_URL } from '../config'

export interface User {
    id: number
    email: string
    firstName: string
    lastName: string
    role: 'owner' | 'agronomist' | 'mill_operator' | 'viewer'
    farmId?: number
    farm?: {
        id: number
        name: string
    }
    farms?: Array<{
        id: number
        name: string
        role: string
        tier?: string
    }>
    emailVerified: boolean
    active: boolean
    lastLogin?: string
}

export interface LoginCredentials {
    email: string
    password: string
}

export interface RegisterData {
    email: string
    password: string
    firstName: string
    lastName: string
    farmName: string
    farmAddress?: string
}

export interface AuthResponse {
    token: string
    user: User
}

class AuthService {
    private tokenKey = 'auth_token'

    // Get stored token
    getToken(): string | null {
        return localStorage.getItem(this.tokenKey)
    }

    // Store token
    setToken(token: string): void {
        localStorage.setItem(this.tokenKey, token)
    }

    // Remove token
    removeToken(): void {
        localStorage.removeItem(this.tokenKey)
    }

    // Register new user
    async register(data: RegisterData): Promise<AuthResponse> {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Registration failed')
        }

        const result = await response.json()

        // If token is returned, store it
        if (result.token) {
            this.setToken(result.token)
        }

        return result
    }

    // Login user
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Login failed')
        }

        const result = await response.json()

        // Store token
        if (result.token) {
            this.setToken(result.token)
        }

        return result
    }

    // Logout user
    async logout(): Promise<void> {
        const token = this.getToken()

        if (token) {
            try {
                await fetch(`${API_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                })
            } catch (error) {
                console.error('Logout request failed:', error)
            }
        }

        this.removeToken()
    }

    // Get current user
    async getCurrentUser(): Promise<User> {
        const token = this.getToken()

        if (!token) {
            throw new Error('No authentication token')
        }

        const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        })

        if (!response.ok) {
            if (response.status === 401) {
                this.removeToken()
            }
            const error = await response.json()
            throw new Error(error.error || 'Failed to get user')
        }

        const result = await response.json()
        return result.user
    }

    // Refresh token
    async refreshToken(): Promise<string> {
        const token = this.getToken()

        if (!token) {
            throw new Error('No authentication token')
        }

        const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        })

        if (!response.ok) {
            this.removeToken()
            throw new Error('Token refresh failed')
        }

        const result = await response.json()

        if (result.token) {
            this.setToken(result.token)
        }

        return result.token
    }

    // Forgot password
    async forgotPassword(email: string): Promise<void> {
        const response = await fetch(`${API_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to send reset email')
        }
    }

    // Reset password
    async resetPassword(token: string, password: string): Promise<void> {
        const response = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token, password }),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to reset password')
        }
    }

    // Verify email
    async verifyEmail(token: string): Promise<void> {
        const response = await fetch(`${API_URL}/auth/verify-email?token=${token}`)

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Email verification failed')
        }
    }

    // Update profile
    async updateProfile(data: { firstName: string; lastName: string }): Promise<User> {
        const token = this.getToken()

        if (!token) {
            throw new Error('No authentication token')
        }

        const response = await fetch(`${API_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to update profile')
        }

        const result = await response.json()
        return result.user
    }

    // Change password
    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
        const token = this.getToken()

        if (!token) {
            throw new Error('No authentication token')
        }

        const response = await fetch(`${API_URL}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ currentPassword, newPassword }),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to change password')
        }
    }

    // Check if user is authenticated
    isAuthenticated(): boolean {
        return !!this.getToken()
    }
}

export const authService = new AuthService()
