import React, { useState } from 'react'
import { Save, X, Loader2, Building2, CheckCircle, XCircle } from 'lucide-react'
import { millService, type Mill } from '../../services/millService'

interface MillFormProps {
    onSuccess: () => void
    onCancel: () => void
    initialData?: Mill
}

export function MillForm({ onSuccess, onCancel, initialData }: MillFormProps) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState<Partial<Mill>>({
        name: '',
        address: '',
        city: '',
        region: '',
        country: '',
        phone: '',
        email: '',
        contact_person: '',
        mill_type: 'traditional',
        capacity: 0,
        certified_organic: false,
        certified_dop: false,
        certified_igp: false,
        notes: '',
        active: true,
        ...initialData
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            if (initialData?.ID) {
                await millService.updateMill(initialData.ID, formData)
            } else {
                await millService.createMill(formData as Mill)
            }
            onSuccess()
        } catch (err) {
            console.error('Failed to save mill', err)
            alert('Failed to save mill')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <Building2 className="text-green-600" size={24} />
                    <h3 className="text-lg font-semibold text-gray-800">
                        {initialData ? 'Edit Mill' : 'Register New Mill'}
                    </h3>
                </div>
                <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mill Name *</label>
                    <input
                        type="text"
                        required
                        value={formData.name || ''}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Oleificio Rossi"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                {/* Address Information */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                        type="text"
                        value={formData.address || ''}
                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Street address"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                        type="text"
                        value={formData.city || ''}
                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                        placeholder="City name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                    <input
                        type="text"
                        value={formData.region || ''}
                        onChange={e => setFormData({ ...formData, region: e.target.value })}
                        placeholder="e.g. Umbria"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                    <input
                        type="text"
                        required
                        value={formData.country || ''}
                        onChange={e => setFormData({ ...formData, country: e.target.value })}
                        placeholder="e.g. Italy"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                {/* Contact Information */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                        type="tel"
                        value={formData.phone || ''}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+39 123 456 7890"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                        type="email"
                        value={formData.email || ''}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder="contact@mill.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                    <input
                        type="text"
                        value={formData.contact_person || ''}
                        onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                        placeholder="Primary contact name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                {/* Technical Information */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mill Type</label>
                    <select
                        value={formData.mill_type || 'traditional'}
                        onChange={e => setFormData({ ...formData, mill_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                        <option value="traditional">Traditional</option>
                        <option value="continuous">Continuous</option>
                        <option value="cooperative">Cooperative</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Processing Capacity (kg/hour)</label>
                    <input
                        type="number"
                        min="0"
                        value={formData.capacity || ''}
                        onChange={e => {
                            const value = e.target.value
                            setFormData({ ...formData, capacity: value === '' ? 0 : parseFloat(value) || 0 })
                        }}
                        placeholder="500"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                {/* Certifications */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Certifications</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.certified_organic || false}
                                onChange={e => setFormData({ ...formData, certified_organic: e.target.checked })}
                                className="text-green-600 focus:ring-green-500"
                            />
                            <div className="flex items-center gap-2">
                                {formData.certified_organic ? (
                                    <CheckCircle size={18} className="text-green-600" />
                                ) : (
                                    <XCircle size={18} className="text-gray-300" />
                                )}
                                <span className="text-sm font-medium">Organic</span>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.certified_dop || false}
                                onChange={e => setFormData({ ...formData, certified_dop: e.target.checked })}
                                className="text-green-600 focus:ring-green-500"
                            />
                            <div className="flex items-center gap-2">
                                {formData.certified_dop ? (
                                    <CheckCircle size={18} className="text-green-600" />
                                ) : (
                                    <XCircle size={18} className="text-gray-300" />
                                )}
                                <span className="text-sm font-medium">DOP</span>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.certified_igp || false}
                                onChange={e => setFormData({ ...formData, certified_igp: e.target.checked })}
                                className="text-green-600 focus:ring-green-500"
                            />
                            <div className="flex items-center gap-2">
                                {formData.certified_igp ? (
                                    <CheckCircle size={18} className="text-green-600" />
                                ) : (
                                    <XCircle size={18} className="text-gray-300" />
                                )}
                                <span className="text-sm font-medium">IGP</span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                        value={formData.notes || ''}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        placeholder="Additional notes about the mill..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {initialData ? 'Update Mill' : 'Register Mill'}
                </button>
            </div>
        </form>
    )
}


