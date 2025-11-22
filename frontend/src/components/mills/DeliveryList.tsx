import { useState, useEffect } from 'react'
import { Truck, Edit, Trash2, MapPin, Calendar, Scale, Thermometer } from 'lucide-react'
import { millService, type OliveDelivery } from '../../services/millService'

interface DeliveryListProps {
    refreshTrigger?: number
    onEdit?: (delivery: OliveDelivery) => void
}

export function DeliveryList({ refreshTrigger, onEdit }: DeliveryListProps) {
    const [deliveries, setDeliveries] = useState<OliveDelivery[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchDeliveries = async () => {
        try {
            setLoading(true)
            const data = await millService.getDeliveries()
            setDeliveries(data)
            setError(null)
        } catch (err) {
            console.error('Failed to fetch deliveries', err)
            setError('Failed to load deliveries')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDeliveries()
    }, [refreshTrigger])

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this delivery?')) {
            return
        }

        try {
            await millService.deleteDelivery(id)
            await fetchDeliveries()
        } catch (err) {
            console.error('Failed to delete delivery', err)
            alert('Failed to delete delivery')
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
                <div className="text-red-600 mb-2">Error loading deliveries</div>
                <div className="text-gray-500 text-sm">{error}</div>
                <button
                    onClick={fetchDeliveries}
                    className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                    Try Again
                </button>
            </div>
        )
    }

    if (deliveries.length === 0) {
        return (
            <div className="text-center py-12">
                <Truck size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Deliveries Recorded</h3>
                <p className="text-gray-500">Record your first olive delivery to a mill.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">Recent Deliveries</h3>
                <span className="text-sm text-gray-500">{deliveries.length} records</span>
            </div>

            <div className="grid gap-4">
                {deliveries.map((delivery) => (
                    <div
                        key={delivery.ID}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition-all hover:shadow-md"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                                    <Truck size={20} />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900">
                                        Delivery #{delivery.delivery_number || delivery.ID}
                                    </h4>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                        <Calendar size={14} />
                                        {new Date(delivery.delivery_date).toLocaleDateString()}
                                        <span className="text-gray-300">|</span>
                                        <span className="capitalize">{delivery.processing_type?.replace('_', ' ')}</span>
                                    </div>
                                </div>
                            </div>

                            {onEdit && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onEdit(delivery)}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={() => delivery.ID && handleDelete(delivery.ID)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Quantity</div>
                                <div className="font-semibold text-gray-900 flex items-center gap-1">
                                    <Scale size={14} className="text-gray-400" />
                                    {delivery.quantity_kg} kg
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Quality</div>
                                <div className="font-semibold text-gray-900 capitalize">
                                    {delivery.quality || 'N/A'}
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Cultivar</div>
                                <div className="font-semibold text-gray-900">
                                    {delivery.cultivar || 'Mixed'}
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Temp</div>
                                <div className="font-semibold text-gray-900 flex items-center gap-1">
                                    <Thermometer size={14} className="text-gray-400" />
                                    {delivery.temperature ? `${delivery.temperature}°C` : 'N/A'}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <MapPin size={14} />
                                <span className="font-medium">From:</span>
                                {delivery.parcel?.name || `Parcel #${delivery.parcel_id}`}
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin size={14} />
                                <span className="font-medium">To:</span>
                                {delivery.mill?.name || `Mill #${delivery.mill_id}`}
                            </div>
                        </div>

                        {delivery.notes && (
                            <div className="mt-4 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                                {delivery.notes}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
