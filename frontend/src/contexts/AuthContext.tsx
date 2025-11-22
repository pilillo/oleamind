import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { authService, type User } from '../services/authService'

interface AuthContextType {
    user: User | null
    loading: boolean
    login: (email: string, password: string) => Promise<void>
    register: (data: any) => Promise<void>
    logout: () => Promise<void>
    refreshUser: () => Promise<void>
    isAuthenticated: boolean
    hasRole: (roles: string[]) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    // Load user on mount
    useEffect(() => {
        loadUser()
    }, [])

    // Set up token refresh interval
    useEffect(() => {
        if (user) {
            // Refresh token every 20 hours (token expires in 24 hours)
            const interval = setInterval(() => {
                authService.refreshToken().catch(() => {
                    // If refresh fails, log out
                    handleLogout()
                })
            }, 20 * 60 * 60 * 1000)

            return () => clearInterval(interval)
        }
    }, [user])

    const loadUser = async () => {
        try {
            if (authService.isAuthenticated()) {
                const currentUser = await authService.getCurrentUser()
                setUser(currentUser)
            }
        } catch (error) {
            console.error('Failed to load user:', error)
            authService.removeToken()
        } finally {
            setLoading(false)
        }
    }

    const handleLogin = async (email: string, password: string) => {
        const response = await authService.login({ email, password })
        setUser(response.user)
    }

    const handleRegister = async (data: any) => {
        const response = await authService.register(data)
        setUser(response.user)
    }

    const handleLogout = async () => {
        await authService.logout()
        setUser(null)
    }

    const refreshUser = async () => {
        try {
            const currentUser = await authService.getCurrentUser()
            setUser(currentUser)
        } catch (error) {
            console.error('Failed to refresh user:', error)
            handleLogout()
        }
    }

    const hasRole = (roles: string[]): boolean => {
        if (!user) return false
        return roles.includes(user.role)
    }

    const value: AuthContextType = {
        user,
        loading,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
        refreshUser,
        isAuthenticated: !!user,
        hasRole,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
