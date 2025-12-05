import { useState, useEffect } from 'react'
import { Building2, Edit, Trash2, MapPin, Phone, Mail, Award } from 'lucide-react'
import { millService, type Mill } from '../../services/millService'

interface MillListProps {
    refreshTrigger?: number
    onEdit?: (mill: Mill) => void
}

export function MillList({ refreshTrigger, onEdit }: MillListProps) {
    const [mills, setMills] = useState<Mill[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchMills = async () => {
        try {
            setLoading(true)
            const data = await millService.getMills(false) // Get all mills, not just active
            setMills(data)
            setError(null)
        } catch (err) {
            console.error('Failed to fetch mills', err)
            setError('Failed to load mills')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchMills()
    }, [refreshTrigger])

    const handleDelete = async (millId: number, millName: string) => {
        if (!confirm(`Are you sure you want to delete "${millName}"? This action cannot be undone.`)) {
            return
        }

        try {
            await millService.deleteMill(millId)
            await fetchMills() // Refresh the list
        } catch (err) {
            console.error('Failed to delete mill', err)
            alert('Failed to delete mill')
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <div className="text-red-600 mb-2">Error loading mills</div>
                <div className="text-gray-500 text-sm">{error}</div>
                <button
                    onClick={fetchMills}
                    className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                    Try Again
                </button>
            </div>
        )
    }

    if (mills.length === 0) {
        return (
            <div className="text-center py-12">
                <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Mills Registered</h3>
                <p className="text-gray-500">Get started by registering your first olive oil mill.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">Registered Mills</h3>
                <span className="text-sm text-gray-500">{mills.length} mill{mills.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="grid gap-4">
                {mills.map((mill) => (
                    <div
                        key={mill.ID}
                        className={`bg-white rounded-xl shadow-sm border p-6 transition-all hover:shadow-md ${mill.active ? 'border-gray-200' : 'border-gray-300 bg-gray-50'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${mill.active ? 'bg-green-100' : 'bg-gray-100'}`}>
                                    <Building2
                                        size={20}
                                        className={mill.active ? 'text-green-600' : 'text-gray-400'}
                                    />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900">{mill.name}</h4>
                                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                        <span className="capitalize">{mill.mill_type}</span>
                                        {mill.capacity && mill.capacity > 0 && (
                                            <span>{mill.capacity} kg/h</span>
                                        )}
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${mill.active
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {mill.active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {onEdit && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onEdit(mill)}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Edit mill"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={() => mill.ID && handleDelete(mill.ID, mill.name)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete mill"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Location */}
                        {(mill.city || mill.region || mill.country) && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                                <MapPin size={14} />
                                {[mill.city, mill.region, mill.country].filter(Boolean).join(', ')}
                            </div>
                        )}

                        {/* Contact Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            {mill.phone && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Phone size={14} />
                                    {mill.phone}
                                </div>
                            )}
                            {mill.email && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Mail size={14} />
                                    {mill.email}
                                </div>
                            )}
                        </div>

                        {/* Certifications */}
                        {(mill.certified_organic || mill.certified_dop || mill.certified_igp) && (
                            <div className="flex items-center gap-2 mb-4">
                                <Award size={14} className="text-green-600" />
                                <div className="flex gap-2">
                                    {mill.certified_organic && (
                                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                            Organic
                                        </span>
                                    )}
                                    {mill.certified_dop && (
                                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                            DOP
                                        </span>
                                    )}
                                    {mill.certified_igp && (
                                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                                            IGP
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        {mill.notes && (
                            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                                {mill.notes}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}


