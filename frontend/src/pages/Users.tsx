import { useState, useEffect } from 'react'
import { userService, type User, type CreateUserData, type UpdateUserData } from '../services/userService'
import { UserPlus, Edit2, CheckCircle, XCircle, Loader2, Search } from 'lucide-react'

export default function Users() {
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
        } catch (err: any) {
            alert(err.message)
        }
    }

    const handleUpdateUser = async (id: number, data: UpdateUserData) => {
        try {
            await userService.updateUser(id, data)
            setEditingUser(null)
            fetchUsers()
        } catch (err: any) {
            alert(err.message)
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
        } catch (err: any) {
            alert(err.message)
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
                    <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                    <p className="text-gray-600 mt-1">Manage system users and their roles</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                    <UserPlus size={20} />
                    Add User
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search users..."
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
                        <option value="">All Roles</option>
                        <option value="owner">Owner</option>
                        <option value="agronomist">Agronomist</option>
                        <option value="mill_operator">Mill Operator</option>
                        <option value="viewer">Viewer</option>
                    </select>
                    <select
                        value={filters.active}
                        onChange={(e) => setFilters({ ...filters, active: e.target.value })}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                        <option value="">All Status</option>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                    </select>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
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
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                                        {user.role.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                        {user.active ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                        {user.active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => setEditingUser(user)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                            title="Edit user"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleToggleActive(user)}
                                            className={`p-2 rounded-lg transition ${user.active
                                                ? 'text-red-600 hover:bg-red-50'
                                                : 'text-green-600 hover:bg-green-50'
                                                }`}
                                            title={user.active ? 'Deactivate' : 'Activate'}
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
                        <p className="text-gray-500">No users found</p>
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
    const [formData, setFormData] = useState<{
        email: string
        password: string
        firstName: string
        lastName: string
        role: 'owner' | 'agronomist' | 'mill_operator' | 'viewer'
    }>({
        email: user?.email || '',
        password: '',
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        role: user?.role || 'viewer',
    })
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
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
                    {user ? 'Edit User' : 'Create User'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                            <input
                                type="text"
                                value={formData.firstName}
                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                            disabled={!!user}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                    </div>

                    {!user && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                        <select
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value as 'owner' | 'agronomist' | 'mill_operator' | 'viewer' })}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        >
                            <option value="viewer">Viewer</option>
                            <option value="agronomist">Agronomist</option>
                            <option value="mill_operator">Mill Operator</option>
                            <option value="owner">Owner</option>
                        </select>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : user ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
