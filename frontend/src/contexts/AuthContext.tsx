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
        // Ensure user has farms array and compute role for backward compatibility
        const userWithRole = {
            ...response.user,
            role: response.user.farms?.some((f: any) => f.role === 'owner') ? 'owner' : 
                  response.user.farms?.[0]?.role || response.user.role || 'viewer'
        }
        setUser(userWithRole)
    }

    const handleRegister = async (data: any) => {
        const response = await authService.register(data)
        // Ensure user has farms array and compute role for backward compatibility
        const userWithRole = {
            ...response.user,
            role: response.user.farms?.some((f: any) => f.role === 'owner') ? 'owner' : 
                  response.user.farms?.[0]?.role || response.user.role || 'viewer'
        }
        setUser(userWithRole)
    }

    const handleLogout = async () => {
        await authService.logout()
        setUser(null)
    }

    const refreshUser = async () => {
        try {
            const currentUser = await authService.getCurrentUser()
            // Ensure user has farms array and compute role for backward compatibility
            const userWithRole = {
                ...currentUser,
                role: currentUser.farms?.some((f: any) => f.role === 'owner') ? 'owner' : 
                      currentUser.farms?.[0]?.role || currentUser.role || 'viewer'
            }
            setUser(userWithRole)
        } catch (error) {
            console.error('Failed to refresh user:', error)
            handleLogout()
        }
    }

    const hasRole = (roles: string[]): boolean => {
        if (!user) return false
        
        // Check if user is owner of any farm (owners have access to everything)
        const isOwner = user.farms?.some(farm => farm.role === 'owner') || false
        if (isOwner) {
            // Owners have access to all roles
            return true
        }
        
        // For non-owners, check if they have the required role in any of their farms
        if (user.farms && user.farms.length > 0) {
            return user.farms.some(farm => roles.includes(farm.role))
        }
        
        // Fallback to legacy role field if farms array is not available
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
