import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { LayoutDashboard, Map, Package, ClipboardList, LogOut, User, Globe, Building2, BarChart2, Users as UsersIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Parcels from './pages/Parcels'
import Inventory from './pages/Inventory'
import Operations from './pages/Operations'
import Harvest from './pages/Harvest'
import Mills from './pages/Mills'
import AnalyticsDashboard from './pages/AnalyticsDashboard'
import Users from './pages/Users'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import './i18n/config'
import './index.css'

function Sidebar() {
  const location = useLocation()
  const { t, i18n } = useTranslation()
  const { user, logout, hasRole } = useAuth()

  const navItems = [
    { path: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, roles: [] },
    { path: '/parcels', label: t('nav.parcels'), icon: Map, roles: [] },
    { path: '/inventory', label: t('nav.inventory'), icon: Package, roles: [] },
    { path: '/operations', label: t('nav.operations'), icon: ClipboardList, roles: [] },
    { path: '/harvest', label: t('nav.harvest'), icon: ClipboardList, roles: ['owner', 'agronomist'] },
    { path: '/mills', label: t('nav.mills'), icon: Building2, roles: ['owner', 'mill_operator'] },
    { path: '/analytics', label: t('nav.analytics'), icon: BarChart2, roles: [] },
    { path: '/users', label: t('nav.users'), icon: UsersIcon, roles: ['owner'] },
  ]

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'it' : 'en'
    i18n.changeLanguage(newLang)
    localStorage.setItem('language', newLang)
  }

  const handleLogout = async () => {
    await logout()
  }

  // Filter nav items based on user role
  const visibleNavItems = navItems.filter(item => {
    if (item.roles.length === 0) return true
    return hasRole(item.roles)
  })

  return (
    <div className="w-64 bg-white h-screen border-r border-gray-200 flex flex-col shadow-sm z-20">
      <div className="p-6 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm">
          O
        </div>
        <span className="text-xl font-bold text-gray-800 tracking-tight">OleaMind</span>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {visibleNavItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                ? 'bg-green-50 text-green-700 shadow-sm'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <item.icon size={20} className={isActive ? 'text-green-600' : 'text-gray-400'} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3 mb-2">
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
            <User size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.firstName || user?.lastName ? `${user.firstName} ${user.lastName}` : 'User'}
            </p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            <p className="text-xs text-green-600 font-medium capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={toggleLanguage}
          className="w-full flex items-center gap-3 px-4 py-2 mb-2 text-sm font-medium text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
        >
          <Globe size={20} />
          {i18n.language === 'en' ? '🇮🇹 Italiano' : '🇬🇧 English'}
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut size={20} />
          {t('nav.logout')}
        </button>
      </div>
    </div>
  )
}

function HeaderTitle({ pathname }: { pathname: string }) {
  const { t } = useTranslation()
  
  const titleMap: Record<string, string> = {
    '/dashboard': t('nav.dashboard'),
    '/parcels': t('nav.parcels'),
    '/inventory': t('nav.inventory'),
    '/operations': t('nav.operations'),
    '/harvest': t('nav.harvest'),
    '/mills': t('nav.mills'),
    '/analytics': t('nav.analytics'),
    '/users': t('nav.users'),
  }
  
  return (
    <h1 className="text-xl font-semibold text-gray-800">
      {titleMap[pathname] || pathname.slice(1)}
    </h1>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email']

  if (publicRoutes.includes(location.pathname)) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm z-10">
          <HeaderTitle pathname={location.pathname} />
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* Protected routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/parcels" element={
        <ProtectedRoute>
          <Parcels />
        </ProtectedRoute>
      } />
      <Route path="/inventory" element={
        <ProtectedRoute>
          <Inventory />
        </ProtectedRoute>
      } />
      <Route path="/operations" element={
        <ProtectedRoute>
          <Operations />
        </ProtectedRoute>
      } />
      <Route path="/harvest" element={
        <ProtectedRoute roles={['owner', 'agronomist']}>
          <Harvest />
        </ProtectedRoute>
      } />
      <Route path="/mills" element={
        <ProtectedRoute roles={['owner', 'mill_operator']}>
          <Mills />
        </ProtectedRoute>
      } />
      <Route path="/analytics" element={
        <ProtectedRoute>
          <AnalyticsDashboard />
        </ProtectedRoute>
      } />
      <Route path="/users" element={
        <ProtectedRoute roles={['owner']}>
          <Users />
        </ProtectedRoute>
      } />

      {/* Redirect root to dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Layout>
          <AppRoutes />
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
