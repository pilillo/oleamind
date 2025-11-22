import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
    children: React.ReactNode
    roles?: string[]
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
    const { user, loading, isAuthenticated } = useAuth()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Loader2 className="animate-spin text-green-600 mx-auto mb-4" size={48} />
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    // Check role-based access
    if (roles && roles.length > 0 && user) {
        if (!roles.includes(user.role)) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="text-center max-w-md p-8">
                        <div className="text-6xl mb-4">🚫</div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                        <p className="text-gray-600 mb-6">
                            You don't have permission to access this page.
                        </p>
                        <button
                            onClick={() => window.history.back()}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            )
        }
    }

    return <>{children}</>
}
