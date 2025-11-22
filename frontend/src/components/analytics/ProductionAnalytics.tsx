import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { Loader2, TrendingUp, Scale, Sprout } from 'lucide-react'
import { analyticsService, type MonthlyProduction, type CultivarYield } from '../../services/analyticsService'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

export function ProductionAnalytics() {
    const [trends, setTrends] = useState<MonthlyProduction[]>([])
    const [cultivars, setCultivars] = useState<CultivarYield[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [trendsData, cultivarsData] = await Promise.all([
                    analyticsService.getProductionTrends(),
                    analyticsService.getCultivarYields()
                ])
                setTrends(trendsData)
                setCultivars(cultivarsData)
            } catch (err) {
                console.error('Failed to load production analytics', err)
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

    const totalHarvest = trends.reduce((sum, item) => sum + item.quantity, 0)
    const topCultivar = cultivars.length > 0 ? cultivars[0] : null

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Harvest</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">{totalHarvest.toLocaleString()} kg</h3>
                        </div>
                        <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                            <Scale size={20} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center text-sm text-green-600">
                        <TrendingUp size={16} className="mr-1" />
                        <span>Season Total</span>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Top Cultivar</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">{topCultivar?.cultivar || 'N/A'}</h3>
                        </div>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Sprout size={20} />
                        </div>
                    </div>
                    <div className="mt-4 text-sm text-gray-500">
                        {topCultivar ? `${topCultivar.quantity.toLocaleString()} kg (${topCultivar.percentage.toFixed(1)}%)` : 'No data'}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Active Months</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">{trends.length}</h3>
                        </div>
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                            <TrendingUp size={20} />
                        </div>
                    </div>
                    <div className="mt-4 text-sm text-gray-500">
                        Harvesting period duration
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly Trends */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-6">Monthly Production</h3>
                    <div className="h-80 min-w-0 w-full relative">
                        {trends.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                                <BarChart data={trends}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" />
                                    <YAxis />
                                    <Tooltip
                                        formatter={(value: number) => [`${value.toLocaleString()} kg`, 'Quantity']}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="quantity" fill="#16a34a" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                <p className="text-sm">No production data available</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Cultivar Distribution */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-6">Cultivar Distribution</h3>
                    <div className="h-80 min-w-0 w-full relative">
                        {cultivars.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                                <PieChart>
                                    <Pie
                                        data={cultivars as any[]}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="quantity"
                                        nameKey="cultivar"
                                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                    >
                                        {cultivars.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => [`${value.toLocaleString()} kg`, 'Quantity']} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                <p className="text-sm">No cultivar data available</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
