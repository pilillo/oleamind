import { useState, useEffect } from 'react'
import { Wine, Calendar, Package, Tag } from 'lucide-react'
import { millService, type OilBottling } from '../../services/millService'

interface BottlingListProps {
    refreshTrigger?: number
}

export function BottlingList({ refreshTrigger }: BottlingListProps) {
    const [bottlings, setBottlings] = useState<OilBottling[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchBottlings = async () => {
        try {
            setLoading(true)
            const data = await millService.getBottlings()
            setBottlings(data)
            setError(null)
        } catch (err) {
            console.error('Failed to fetch bottlings', err)
            setError('Failed to load bottling records')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchBottlings()
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
                <div className="text-red-600 mb-2">Error loading bottlings</div>
                <div className="text-gray-500 text-sm">{error}</div>
            </div>
        )
    }

    if (bottlings.length === 0) {
        return (
            <div className="text-center py-12">
                <Wine size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Bottling Records</h3>
                <p className="text-gray-500">Record your first bottling operation from an oil batch.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">Bottling History</h3>
                <span className="text-sm text-gray-500">{bottlings.length} records</span>
            </div>

            <div className="grid gap-4">
                {bottlings.map((bottling) => (
                    <div
                        key={bottling.ID}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition-all hover:shadow-md"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                                    <Wine size={20} />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900">
                                        Lot: {bottling.lot_number || `#${bottling.ID}`}
                                    </h4>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                        <Calendar size={14} />
                                        {new Date(bottling.bottling_date).toLocaleDateString()}
                                        <span className="text-gray-300">|</span>
                                        <span>Batch #{bottling.oil_batch?.batch_number || bottling.oil_batch_id}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Total Volume</div>
                                <div className="font-semibold text-gray-900">
                                    {bottling.quantity_liters} L
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Format</div>
                                <div className="font-semibold text-gray-900">
                                    {bottling.bottle_size} L
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Bottles</div>
                                <div className="font-semibold text-gray-900 flex items-center gap-1">
                                    <Package size={14} className="text-gray-400" />
                                    {bottling.bottles_count}
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Label</div>
                                <div className="font-semibold text-gray-900 capitalize">
                                    {bottling.label_type || 'Standard'}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-gray-600">
                            {bottling.destination && (
                                <div className="flex items-center gap-2">
                                    <Tag size={14} />
                                    <span className="font-medium">Destination:</span>
                                    <span className="capitalize">{bottling.destination}</span>
                                </div>
                            )}
                            {bottling.expiry_date && (
                                <div className="flex items-center gap-2">
                                    <Calendar size={14} />
                                    <span className="font-medium">Expires:</span>
                                    {new Date(bottling.expiry_date).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
