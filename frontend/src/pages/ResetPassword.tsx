import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { authService } from '../services/authService'
import { Loader2, Lock, AlertCircle, CheckCircle } from 'lucide-react'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset link.')
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password strength
    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    if (!token) {
      setError('Invalid reset token')
      return
    }

    setLoading(true)

    try {
      await authService.resetPassword(token, password)
      setSuccess(true)
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-full mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">OleaMind</h1>
          <p className="text-gray-600 mt-2">Olive Farm Management System</p>
        </div>

        {/* Reset Password Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {success ? (
            <div>
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="text-green-600" size={32} />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">Password reset successful!</h2>
              <p className="text-gray-600 text-center mb-6">
                Your password has been successfully reset. You can now log in with your new password.
              </p>
              <p className="text-sm text-gray-500 text-center mb-6">
                Redirecting to login page...
              </p>
              <Link
                to="/login"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
              >
                Go to Login
              </Link>
            </div>
          ) : (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Reset password</h2>
                <p className="text-gray-600 mt-1">Enter your new password below.</p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    New password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    minLength={8}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                    placeholder="••••••••"
                    disabled={loading || !token}
                  />
                  <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters long</p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm new password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    minLength={8}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                    placeholder="••••••••"
                    disabled={loading || !token}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Resetting password...
                    </>
                  ) : (
                    <>
                      <Lock size={20} />
                      Reset password
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Remember your password?{' '}
                  <Link to="/login" className="text-green-600 hover:text-green-700 font-medium">
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-8">
          © 2024 OleaMind. All rights reserved.
        </p>
      </div>
    </div>
  )
}

