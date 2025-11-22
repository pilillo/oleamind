import { useState, useEffect } from 'react'
import { Droplets, Edit, Calendar, Scale, Tag, MapPin } from 'lucide-react'
import { millService, type OilBatch } from '../../services/millService'

interface BatchListProps {
    refreshTrigger?: number
    onEdit?: (batch: OilBatch) => void
}

export function BatchList({ refreshTrigger, onEdit }: BatchListProps) {
    const [batches, setBatches] = useState<OilBatch[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchBatches = async () => {
        try {
            setLoading(true)
            const data = await millService.getOilBatches()
            setBatches(data)
            setError(null)
        } catch (err) {
            console.error('Failed to fetch batches', err)
            setError('Failed to load oil batches')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchBatches()
    }, [refreshTrigger])

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
                <div className="text-red-600 mb-2">Error loading batches</div>
                <div className="text-gray-500 text-sm">{error}</div>
                <button
                    onClick={fetchBatches}
                    className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                    Try Again
                </button>
            </div>
        )
    }

    if (batches.length === 0) {
        return (
            <div className="text-center py-12">
                <Droplets size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Oil Batches Produced</h3>
                <p className="text-gray-500">Create your first oil batch from processed deliveries.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">Oil Batches</h3>
                <span className="text-sm text-gray-500">{batches.length} batches</span>
            </div>

            <div className="grid gap-4">
                {batches.map((batch) => (
                    <div
                        key={batch.ID}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition-all hover:shadow-md"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                                    <Droplets size={20} />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900">
                                        Batch #{batch.batch_number}
                                    </h4>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                        <Calendar size={14} />
                                        {new Date(batch.production_date).toLocaleDateString()}
                                        <span className="text-gray-300">|</span>
                                        <span className="capitalize">{batch.processing_method?.replace('_', ' ')}</span>
                                    </div>
                                </div>
                            </div>

                            {onEdit && (
                                <button
                                    onClick={() => onEdit(batch)}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    <Edit size={16} />
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Quantity</div>
                                <div className="font-semibold text-gray-900 flex items-center gap-1">
                                    <Scale size={14} className="text-gray-400" />
                                    {batch.quantity_liters} L
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Type</div>
                                <div className="font-semibold text-gray-900 capitalize">
                                    {batch.oil_type?.replace('_', ' ') || 'N/A'}
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Status</div>
                                <div className={`font-semibold capitalize ${batch.status === 'stored' ? 'text-blue-600' :
                                    batch.status === 'bottled' ? 'text-purple-600' :
                                        batch.status === 'sold' ? 'text-green-600' : 'text-gray-900'
                                    }`}>
                                    {batch.status || 'Unknown'}
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Yield</div>
                                <div className="font-semibold text-gray-900">
                                    {batch.yield_percentage ? `${batch.yield_percentage.toFixed(1)}%` : 'N/A'}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <MapPin size={14} />
                                <span className="font-medium">Location:</span>
                                {batch.storage_location || 'Not assigned'}
                            </div>
                            {batch.monocultivar && (
                                <div className="flex items-center gap-2">
                                    <Tag size={14} />
                                    <span className="font-medium">Cultivar:</span>
                                    {batch.cultivar}
                                </div>
                            )}
                        </div>

                        {batch.notes && (
                            <div className="mt-4 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                                {batch.notes}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
