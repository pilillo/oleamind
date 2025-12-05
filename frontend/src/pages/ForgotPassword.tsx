import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authService } from '../services/authService'
import { Loader2, Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await authService.forgotPassword(email)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.')
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

        {/* Forgot Password Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {success ? (
            <div>
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="text-green-600" size={32} />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">Check your email</h2>
              <p className="text-gray-600 text-center mb-6">
                If an account exists with <strong>{email}</strong>, you will receive a password reset link shortly.
              </p>
              <p className="text-sm text-gray-500 text-center mb-6">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <Link
                to="/login"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
              >
                <ArrowLeft size={20} />
                Back to Login
              </Link>
            </div>
          ) : (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Forgot password?</h2>
                <p className="text-gray-600 mt-1">Enter your email address and we'll send you a link to reset your password.</p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                    placeholder="your@email.com"
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail size={20} />
                      Send reset link
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link to="/login" className="text-sm text-green-600 hover:text-green-700 font-medium inline-flex items-center gap-1">
                  <ArrowLeft size={16} />
                  Back to login
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

