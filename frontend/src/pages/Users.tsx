import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { userService, type User, type CreateUserData, type UpdateUserData } from '../services/userService'
import { useAuth } from '../contexts/AuthContext'
import { UserPlus, Edit2, CheckCircle, XCircle, Loader2, Search } from 'lucide-react'

export default function Users() {
    const { t } = useTranslation()
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [filters, setFilters] = useState({ role: '', active: '' })
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchUsers()
    }, [filters])

    const fetchUsers = async () => {
        try {
            setLoading(true)
            const data = await userService.getUsers(filters.role || filters.active ? filters : undefined)
            setUsers(data)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateUser = async (data: CreateUserData) => {
        try {
            await userService.createUser(data)
            setShowCreateModal(false)
            fetchUsers()
            toast.success(t('users.user_created'))
        } catch (err: any) {
            toast.error(err.message || t('users.create_failed'))
        }
    }

    const handleUpdateUser = async (id: number, data: UpdateUserData) => {
        try {
            await userService.updateUser(id, data)
            setEditingUser(null)
            fetchUsers()
            toast.success(t('users.user_updated'))
        } catch (err: any) {
            toast.error(err.message || t('users.update_failed'))
        }
    }

    const handleToggleActive = async (user: User) => {
        try {
            if (user.active) {
                await userService.deactivateUser(user.id)
            } else {
                await userService.activateUser(user.id)
            }
            fetchUsers()
            toast.success(user.active ? t('users.user_deactivated') : t('users.user_activated'))
        } catch (err: any) {
            toast.error(err.message || t('users.status_update_failed'))
        }
    }

    const filteredUsers = users.filter(user => {
        const searchLower = searchTerm.toLowerCase()
        return (
            user.email.toLowerCase().includes(searchLower) ||
            user.firstName?.toLowerCase().includes(searchLower) ||
            user.lastName?.toLowerCase().includes(searchLower)
        )
    })

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'owner': return 'bg-purple-100 text-purple-800'
            case 'agronomist': return 'bg-green-100 text-green-800'
            case 'mill_operator': return 'bg-blue-100 text-blue-800'
            case 'viewer': return 'bg-gray-100 text-gray-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-green-600" size={48} />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('users.title')}</h1>
                    <p className="text-gray-600 mt-1">{t('users.subtitle')}</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                    <UserPlus size={20} />
                    {t('users.add_user')}
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder={t('users.search_placeholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                    </div>
                    <select
                        value={filters.role}
                        onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                        <option value="">{t('users.all_roles')}</option>
                        <option value="owner">{t('users.role_owner')}</option>
                        <option value="agronomist">{t('users.role_agronomist')}</option>
                        <option value="mill_operator">{t('users.role_mill_operator')}</option>
                        <option value="viewer">{t('users.role_viewer')}</option>
                    </select>
                    <select
                        value={filters.active}
                        onChange={(e) => setFilters({ ...filters, active: e.target.value })}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                        <option value="">{t('users.all_status')}</option>
                        <option value="true">{t('users.status_active')}</option>
                        <option value="false">{t('users.status_inactive')}</option>
                    </select>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('users.user')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('users.role')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('users.status')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('users.last_login')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('users.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50 transition">
                                <td className="px-6 py-4">
                                    <div>
                                        <div className="font-medium text-gray-900">
                                            {user.firstName} {user.lastName}
                                        </div>
                                        <div className="text-sm text-gray-500">{user.email}</div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {(() => {
                                        // Get role from farms array or fallback to role field
                                        const userRole = user.farms?.[0]?.role || user.role || 'viewer'
                                        return (
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(userRole)}`}>
                                                {userRole.replace('_', ' ')}
                                            </span>
                                        )
                                    })()}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                        {user.active ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                        {user.active ? t('users.status_active') : t('users.status_inactive')}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : t('users.never')}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => setEditingUser(user)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                            title={t('users.edit_user')}
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleToggleActive(user)}
                                            className={`p-2 rounded-lg transition ${user.active
                                                ? 'text-red-600 hover:bg-red-50'
                                                : 'text-green-600 hover:bg-green-50'
                                                }`}
                                            title={user.active ? t('users.deactivate') : t('users.activate')}
                                        >
                                            {user.active ? <XCircle size={18} /> : <CheckCircle size={18} />}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filteredUsers.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-gray-500">{t('users.no_users')}</p>
                    </div>
                )}
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <UserModal
                    onClose={() => setShowCreateModal(false)}
                    onSave={handleCreateUser}
                />
            )}

            {/* Edit User Modal */}
            {editingUser && (
                <UserModal
                    user={editingUser}
                    onClose={() => setEditingUser(null)}
                    onSave={(data) => handleUpdateUser(editingUser.id, data)}
                />
            )}
        </div>
    )
}

// User Modal Component
interface UserModalProps {
    user?: User
    onClose: () => void
    onSave: (data: any) => void
}

function UserModal({ user, onClose, onSave }: UserModalProps) {
    const { t } = useTranslation()
    const { user: currentUser } = useAuth()
    
    // Get farms where current user is owner
    const ownedFarms = currentUser?.farms?.filter(f => f.role === 'owner') || []
    
    // Get farmId from user - could be from farmId field or farm.id
    const getUserFarmId = () => {
        if (user?.farmId) return user.farmId
        if (user?.farm?.id) return user.farm.id
        return ownedFarms.length > 0 ? ownedFarms[0].id : 0
    }

    // Get role from farms array or fallback to role field
    const getUserRole = () => {
        if (user?.farms && user.farms.length > 0) {
            const role = user.farms[0].role
            return (role === 'owner' ? 'viewer' : (role as 'agronomist' | 'mill_operator' | 'viewer')) || 'viewer'
        }
        const role = user?.role || 'viewer'
        return (role === 'owner' ? 'viewer' : (role as 'agronomist' | 'mill_operator' | 'viewer')) || 'viewer'
    }

    const [formData, setFormData] = useState<{
        email: string
        password: string
        firstName: string
        lastName: string
        role: 'agronomist' | 'mill_operator' | 'viewer'
        farmId: number
    }>({
        email: user?.email || '',
        password: '',
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        role: getUserRole(),
        farmId: getUserFarmId(),
    })
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        // Validate farmId
        if (formData.farmId === 0) {
            toast.error(t('users.select_farm'))
            return
        }
        
        setLoading(true)
        try {
            await onSave(formData)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    {user ? t('users.edit_user') : t('users.create_user')}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('users.first_name')}</label>
                            <input
                                type="text"
                                value={formData.firstName}
                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('users.last_name')}</label>
                            <input
                                type="text"
                                value={formData.lastName}
                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('users.email')}</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                            disabled={!!user}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('users.farm')} <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={formData.farmId}
                            onChange={(e) => setFormData({ ...formData, farmId: parseInt(e.target.value) })}
                            required
                            disabled={!!user}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        >
                            <option value={0}>{t('users.select_farm')}</option>
                            {ownedFarms.map((farm) => (
                                <option key={farm.id} value={farm.id}>
                                    {farm.name}
                                </option>
                            ))}
                        </select>
                        {ownedFarms.length === 0 && (
                            <p className="text-xs text-red-500 mt-1">{t('users.no_farms_owned')}</p>
                        )}
                        {user && (
                            <p className="text-xs text-gray-500 mt-1">{t('users.farm_cannot_change')}</p>
                        )}
                    </div>

                    {!user && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('users.password')}</label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                                minLength={8}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('users.role')}</label>
                        <select
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value as 'agronomist' | 'mill_operator' | 'viewer' })}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        >
                            <option value="viewer">{t('users.role_viewer')}</option>
                            <option value="agronomist">{t('users.role_agronomist')}</option>
                            <option value="mill_operator">{t('users.role_mill_operator')}</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">{t('users.role_note')}</p>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                        >
                            {t('users.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                        >
                            {loading ? t('users.saving') : user ? t('users.update') : t('users.create')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
