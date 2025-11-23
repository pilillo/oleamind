import { useState, useEffect } from 'react'
import { TrendingUp, BarChart3, Download } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { apiCall } from '../../config'

const handleExportPDF = async (parcelId: number) => {
    try {
        const token = localStorage.getItem('auth_token')
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

        const response = await fetch(`${API_URL}/analytics/export/parcel-report/${parcelId}?year=${new Date().getFullYear()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/pdf'
            }
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('Server response:', errorText)
            throw new Error(`Export failed: ${response.status} ${response.statusText}`)
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `parcel_${parcelId}_report_${new Date().getFullYear()}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
    } catch (error) {
        console.error('Failed to export PDF:', error)
        alert('Failed to export PDF. Please check the console for details.')
    }
}

interface YieldTrendData {
    year: number
    total_yield_kg: number
    yield_per_hectare: number
    yield_per_tree: number
    average_quality: string
    harvest_count: number
    total_revenue: number
    average_price_per_kg: number
}

interface YieldTrendChartProps {
    parcelId: number
    years?: number
}

export function YieldTrendChart({ parcelId, years = 5 }: YieldTrendChartProps) {
    const [trends, setTrends] = useState<YieldTrendData[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchTrends()
    }, [parcelId, years])

    const fetchTrends = async () => {
        try {
            setLoading(true)
            const response = await apiCall(`/analytics/yield-trends/${parcelId}?years=${years}`)
            const data: YieldTrendData[] = await response.json()
            // Sort by year ascending for better visualization
            setTrends(data.sort((a: YieldTrendData, b: YieldTrendData) => a.year - b.year))
            setError(null)
        } catch (err) {
            console.error('Failed to fetch yield trends:', err)
            setError('Failed to load yield trends')
        } finally {
            setLoading(false)
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
                <div className="text-red-600 mb-2">Error loading trends</div>
                <div className="text-gray-500 text-sm">{error}</div>
            </div>
        )
    }

    if (trends.length === 0) {
        return (
            <div className="text-center py-12">
                <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Historical Data</h3>
                <p className="text-gray-500">
                    Not enough harvest data available for this parcel to show trends.
                </p>
            </div>
        )
    }

    // Calculate min/max for better axis scaling
    const maxYield = Math.max(...trends.map(t => t.yield_per_hectare))
    const minYield = Math.min(...trends.map(t => t.yield_per_hectare))

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <TrendingUp className="text-green-600" size={24} />
                    <h3 className="text-lg font-semibold text-gray-800">
                        {years}-Year Yield Trends
                    </h3>
                </div>
                <button
                    onClick={() => handleExportPDF(parcelId)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                    <Download size={16} />
                    Export PDF
                </button>
            </div>

            {/* Main Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="year"
                            tickFormatter={(year) => year.toString()}
                        />
                        <YAxis
                            yAxisId="left"
                            domain={[Math.floor(minYield * 0.9), Math.ceil(maxYield * 1.1)]}
                            label={{ value: 'Yield (kg/ha)', angle: -90, position: 'insideLeft' }}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            label={{ value: 'Revenue (€)', angle: 90, position: 'insideRight' }}
                        />
                        <Tooltip
                            formatter={(value: number, name: string) => {
                                if (name === 'Yield/Ha') return [value.toFixed(1) + ' kg/ha', name]
                                if (name === 'Revenue') return ['€' + value.toFixed(0), name]
                                return [value, name]
                            }}
                        />
                        <Legend />
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="yield_per_hectare"
                            stroke="#16a34a"
                            strokeWidth={2}
                            name="Yield/Ha"
                            dot={{ fill: '#16a34a', r: 5 }}
                        />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="total_revenue"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            name="Revenue"
                            dot={{ fill: '#3b82f6', r: 5 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Avg Yield/Ha</div>
                    <div className="text-2xl font-bold text-gray-900">
                        {(trends.reduce((sum, t) => sum + t.yield_per_hectare, 0) / trends.length).toFixed(0)}
                        <span className="text-sm font-normal text-gray-500 ml-1">kg/ha</span>
                    </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Best Year</div>
                    <div className="text-2xl font-bold text-green-600">
                        {trends.reduce((best, t) => t.yield_per_hectare > best.yield_per_hectare ? t : best).year}
                    </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Total Harvests</div>
                    <div className="text-2xl font-bold text-gray-900">
                        {trends.reduce((sum, t) => sum + t.harvest_count, 0)}
                    </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Avg Price</div>
                    <div className="text-2xl font-bold text-gray-900">
                        €{(trends.reduce((sum, t) => sum + t.average_price_per_kg, 0) / trends.filter(t => t.average_price_per_kg > 0).length || 0).toFixed(2)}
                        <span className="text-sm font-normal text-gray-500 ml-1">/kg</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
