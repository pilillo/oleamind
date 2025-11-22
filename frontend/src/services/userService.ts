import { apiCall } from '../config'

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
    emailVerified: boolean
    active: boolean
    lastLogin?: string
    createdAt: string
}

export interface CreateUserData {
    email: string
    password: string
    firstName: string
    lastName: string
    role: string
    farmId?: number
}

export interface UpdateUserData {
    firstName?: string
    lastName?: string
    role?: string
    farmId?: number
}

class UserService {
    // Get all users
    async getUsers(filters?: { role?: string; active?: string; farmId?: string }): Promise<User[]> {
        const params = new URLSearchParams()
        if (filters?.role) params.append('role', filters.role)
        if (filters?.active) params.append('active', filters.active)
        if (filters?.farmId) params.append('farmId', filters.farmId)

        const queryString = params.toString()
        const endpoint = queryString ? `/users?${queryString}` : '/users'

        const response = await apiCall(endpoint)

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to fetch users')
        }

        return response.json()
    }

    // Get user by ID
    async getUser(id: number): Promise<User> {
        const response = await apiCall(`/users/${id}`)

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to fetch user')
        }

        const result = await response.json()
        return result
    }

    // Create user
    async createUser(data: CreateUserData): Promise<User> {
        const response = await apiCall('/users', {
            method: 'POST',
            body: JSON.stringify(data),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to create user')
        }

        const result = await response.json()
        return result.user
    }

    // Update user
    async updateUser(id: number, data: UpdateUserData): Promise<User> {
        const response = await apiCall(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to update user')
        }

        const result = await response.json()
        return result.user
    }

    // Deactivate user
    async deactivateUser(id: number): Promise<void> {
        const response = await apiCall(`/users/${id}/deactivate`, {
            method: 'POST',
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to deactivate user')
        }
    }

    // Activate user
    async activateUser(id: number): Promise<void> {
        const response = await apiCall(`/users/${id}/activate`, {
            method: 'POST',
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to activate user')
        }
    }
}

export const userService = new UserService()
