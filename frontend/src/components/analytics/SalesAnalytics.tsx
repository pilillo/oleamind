import { useState, useEffect } from 'react'
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Loader2, DollarSign, ShoppingBag, TrendingUp } from 'lucide-react'
import { analyticsService, type SalesTrend } from '../../services/analyticsService'

export function SalesAnalytics() {
    const [trends, setTrends] = useState<SalesTrend[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await analyticsService.getSalesTrends()
                setTrends(data)
            } catch (err) {
                console.error('Failed to load sales analytics', err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="animate-spin text-green-600" size={32} />
            </div>
        )
    }

    const totalRevenue = trends.reduce((sum, item) => sum + item.revenue, 0)
    const totalVolume = trends.reduce((sum, item) => sum + item.volume, 0)
    const avgPrice = totalVolume > 0 ? totalRevenue / totalVolume : 0

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">€{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                        </div>
                        <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                            <DollarSign size={20} />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Volume Sold</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">{totalVolume.toLocaleString()} L</h3>
                        </div>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <ShoppingBag size={20} />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Avg. Price / Liter</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">€{avgPrice.toFixed(2)}</h3>
                        </div>
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                            <TrendingUp size={20} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800 mb-6">Revenue & Volume Trends</h3>
                <div className="h-96 min-w-0 w-full relative">
                    {trends.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                            <ComposedChart data={trends}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" />
                                <YAxis yAxisId="left" orientation="left" stroke="#16a34a" />
                                <YAxis yAxisId="right" orientation="right" stroke="#2563eb" />
                                <Tooltip />
                                <Legend />
                                <Bar yAxisId="left" dataKey="revenue" name="Revenue (€)" fill="#16a34a" radius={[4, 4, 0, 0]} barSize={20} />
                                <Line yAxisId="right" type="monotone" dataKey="volume" name="Volume (L)" stroke="#2563eb" strokeWidth={2} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            <p className="text-sm">No sales data available</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
