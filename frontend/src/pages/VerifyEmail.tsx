import { useState, useEffect } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { authService } from '../services/authService'
import { Loader2, CheckCircle, AlertCircle, Mail } from 'lucide-react'

export default function VerifyEmail() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing verification token.')
      setLoading(false)
      return
    }

    verifyEmail()
  }, [token])

  const verifyEmail = async () => {
    if (!token) return

    try {
      await authService.verifyEmail(token)
      setSuccess(true)
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Email verification failed. The link may have expired.')
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

        {/* Verify Email Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {loading ? (
            <div className="text-center">
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <Loader2 className="text-green-600 animate-spin" size={32} />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Verifying your email...</h2>
              <p className="text-gray-600">Please wait while we verify your email address.</p>
            </div>
          ) : success ? (
            <div>
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="text-green-600" size={32} />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">Email verified!</h2>
              <p className="text-gray-600 text-center mb-6">
                Your email address has been successfully verified. You can now access all features of OleaMind.
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
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="text-red-600" size={32} />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">Verification failed</h2>
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 text-center">{error}</p>
              </div>
              <p className="text-gray-600 text-center mb-6">
                The verification link may have expired or is invalid. Please request a new verification email from your account settings.
              </p>
              <div className="space-y-3">
                <Link
                  to="/login"
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
                >
                  Go to Login
                </Link>
                <Link
                  to="/register"
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Mail size={20} />
                  Create new account
                </Link>
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

