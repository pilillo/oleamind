import { useState, useEffect } from 'react'
import { TrendingUp, Scale, TreeDeciduous, Euro } from 'lucide-react'
import { harvestService, type YieldStats } from '../../services/harvestService'
import { apiCall } from '../../config'

export function YieldStatsDashboard() {
    const [stats, setStats] = useState<YieldStats | null>(null)
    const [loading, setLoading] = useState(false)
    const [parcels, setParcels] = useState<any[]>([])
    const [selectedParcelId, setSelectedParcelId] = useState<number | ''>('')
    const [year, setYear] = useState(new Date().getFullYear())

    useEffect(() => {
        fetchParcels()
    }, [])

    useEffect(() => {
        if (selectedParcelId) {
            fetchStats()
        }
    }, [selectedParcelId, year])

    const fetchParcels = async () => {
        try {
            const response = await apiCall('/parcels')
            if (!response.ok) {
                throw new Error('Failed to fetch parcels')
            }
            const data = await response.json()
            setParcels(data)
            if (data.length > 0) {
                setSelectedParcelId(data[0].ID)
            }
        } catch (err) {
            console.error('Failed to fetch parcels', err)
        }
    }

    const fetchStats = async () => {
        if (!selectedParcelId) return
        setLoading(true)
        try {
            const data = await harvestService.getYieldStats(Number(selectedParcelId), year)
            setStats(data)
        } catch (err) {
            console.error('Failed to fetch yield stats', err)
            setStats(null)
        } finally {
            setLoading(false)
        }
    }

    if (!selectedParcelId) return null

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <select
                    value={selectedParcelId}
                    onChange={e => setSelectedParcelId(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                >
                    {parcels.map(p => (
                        <option key={p.ID} value={p.ID}>{p.name}</option>
                    ))}
                </select>
                <select
                    value={year}
                    onChange={e => setYear(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                >
                    {[...Array(5)].map((_, i) => {
                        const y = new Date().getFullYear() - i
                        return <option key={y} value={y}>{y}</option>
                    })}
                </select>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading statistics...</div>
            ) : stats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                                <Scale size={20} />
                            </div>
                            <span className="text-sm font-medium text-gray-500">Total Yield</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                            {stats.total_yield_kg.toLocaleString()} <span className="text-sm font-normal text-gray-500">kg</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                <TrendingUp size={20} />
                            </div>
                            <span className="text-sm font-medium text-gray-500">Yield / Hectare</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                            {stats.yield_per_hectare.toLocaleString()} <span className="text-sm font-normal text-gray-500">kg/ha</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                <TreeDeciduous size={20} />
                            </div>
                            <span className="text-sm font-medium text-gray-500">Yield / Tree</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                            {stats.yield_per_tree.toFixed(1)} <span className="text-sm font-normal text-gray-500">kg</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                                <Euro size={20} />
                            </div>
                            <span className="text-sm font-medium text-gray-500">Total Revenue</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                            €{stats.total_revenue.toLocaleString()}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    No harvest data available for this parcel and year.
                </div>
            )}
        </div>
    )
}
