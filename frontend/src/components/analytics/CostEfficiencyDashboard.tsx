import { useState, useEffect } from 'react'
import { DollarSign, TrendingDown, TrendingUp, Euro } from 'lucide-react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { apiCall } from '../../config'

interface CostEfficiencyData {
    parcel_id: number
    parcel_name: string
    total_costs: number
    total_liters_oil: number
    cost_per_liter: number
    cost_breakdown: {
        operations: number
        harvest: number
        irrigation: number
    }
    batch_count: number
    start_date: string
    end_date: string
}

export function CostEfficiencyDashboard() {
    const [data, setData] = useState<CostEfficiencyData[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    })

    useEffect(() => {
        fetchCostEfficiency()
    }, [dateRange])

    const fetchCostEfficiency = async () => {
        try {
            setLoading(true)
            const response = await apiCall(`/analytics/cost-efficiency?start_date=${dateRange.start}&end_date=${dateRange.end}`)
            const result: CostEfficiencyData[] = await response.json()
            setData(result)
            setError(null)
        } catch (err) {
            console.error('Failed to fetch cost efficiency:', err)
            setError('Failed to load cost efficiency data')
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
                <div className="text-red-600 mb-2">Error</div>
                <div className="text-gray-500 text-sm">{error}</div>
            </div>
        )
    }

    if (data.length === 0) {
        return (
            <div className="text-center py-12">
                <DollarSign size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Cost Data</h3>
                <p className="text-gray-500">No production cost data available for the selected period.</p>
            </div>
        )
    }

    // Prepare data for pie chart (aggregate all parcels)
    const totalBreakdown = data.reduce((acc, item) => ({
        operations: acc.operations + item.cost_breakdown.operations,
        harvest: acc.harvest + item.cost_breakdown.harvest,
        irrigation: acc.irrigation + item.cost_breakdown.irrigation
    }), { operations: 0, harvest: 0, irrigation: 0 })

    const pieData = [
        { name: 'Operations', value: totalBreakdown.operations, color: '#3b82f6' },
        { name: 'Harvest', value: totalBreakdown.harvest, color: '#10b981' },
        { name: 'Irrigation', value: totalBreakdown.irrigation, color: '#6366f1' }
    ].filter(item => item.value > 0)

    // Find most/least efficient
    const sorted = [...data].sort((a, b) => a.cost_per_liter - b.cost_per_liter)
    const mostEfficient = sorted[0]
    const leastEfficient = sorted[sorted.length - 1]

    return (
        <div className="space-y-6">
            {/* Header with Date Range */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-2">
                    <Euro className="text-green-600" size={24} />
                    <h3 className="text-lg font-semibold text-gray-800">Cost Efficiency Analysis</h3>
                </div>
                <div className="flex gap-2">
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <span className="self-center text-gray-500">to</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <TrendingUp className="text-green-600" size={20} />
                        <span className="text-sm text-gray-500">Most Efficient</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                        €{mostEfficient.cost_per_liter.toFixed(2)}/L
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{mostEfficient.parcel_name}</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <TrendingDown className="text-red-600" size={20} />
                        <span className="text-sm text-gray-500">Least Efficient</span>
                    </div>
                    <div className="text-2xl font-bold text-red-600">
                        €{leastEfficient.cost_per_liter.toFixed(2)}/L
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{leastEfficient.parcel_name}</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <DollarSign className="text-blue-600" size={20} />
                        <span className="text-sm text-gray-500">Average Cost/Liter</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                        €{(data.reduce((sum, d) => sum + d.cost_per_liter, 0) / data.length).toFixed(2)}/L
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{data.length} parcels</div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart: Cost per Liter by Parcel */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h4 className="text-md font-semibold text-gray-800 mb-4">Cost per Liter by Parcel</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="parcel_name" angle={-45} textAnchor="end" height={80} />
                            <YAxis label={{ value: '€/Liter', angle: -90, position: 'insideLeft' }} />
                            <Tooltip
                                formatter={(value: number) => ['€' + value.toFixed(2) + '/L', 'Cost']}
                            />
                            <Bar dataKey="cost_per_liter" fill="#16a34a" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Pie Chart: Cost Breakdown */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h4 className="text-md font-semibold text-gray-800 mb-4">Total Cost Breakdown</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => '€' + value.toFixed(2)} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parcel</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Oil (L)</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">€/Liter</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Operations</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Harvest</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Irrigation</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {data.map((item) => (
                                <tr key={item.parcel_id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {item.parcel_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                        {item.total_liters_oil.toFixed(1)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                        €{item.total_costs.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-green-600">
                                        €{item.cost_per_liter.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                                        €{item.cost_breakdown.operations.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                                        €{item.cost_breakdown.harvest.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                                        €{item.cost_breakdown.irrigation.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
