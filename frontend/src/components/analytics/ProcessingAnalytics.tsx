import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { Loader2, Droplets, Activity, FlaskConical } from 'lucide-react'
import { analyticsService, type ProcessingEfficiency, type QualityDistribution } from '../../services/analyticsService'

const COLORS = ['#16a34a', '#ca8a04', '#dc2626', '#9ca3af']

export function ProcessingAnalytics() {
    const [efficiency, setEfficiency] = useState<ProcessingEfficiency[]>([])
    const [quality, setQuality] = useState<QualityDistribution[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [efficiencyData, qualityData] = await Promise.all([
                    analyticsService.getProcessingEfficiency(),
                    analyticsService.getQualityDistribution()
                ])
                setEfficiency(efficiencyData)
                setQuality(qualityData)
            } catch (err) {
                console.error('Failed to load processing analytics', err)
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

    const totalOil = efficiency.reduce((sum, item) => sum + item.oil_produced, 0)
    const avgYield = efficiency.length > 0
        ? efficiency.reduce((sum, item) => sum + item.yield_percentage, 0) / efficiency.length
        : 0

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Oil Produced</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">{totalOil.toLocaleString()} L</h3>
                        </div>
                        <div className="p-2 bg-yellow-50 text-yellow-600 rounded-lg">
                            <Droplets size={20} />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Average Yield</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">{avgYield.toFixed(2)}%</h3>
                        </div>
                        <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                            <Activity size={20} />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Batches Processed</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">{efficiency.length}</h3>
                        </div>
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                            <FlaskConical size={20} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Yield Efficiency Trend */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-6">Yield Efficiency Trend</h3>
                    <div className="h-80 min-w-0 w-full relative">
                        {efficiency.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                                <AreaChart data={efficiency}>
                                    <defs>
                                        <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    />
                                    <YAxis domain={['auto', 'auto']} />
                                    <Tooltip
                                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                        formatter={(value: number) => [`${value.toFixed(2)}%`, 'Yield']}
                                    />
                                    <Area type="monotone" dataKey="yield_percentage" stroke="#16a34a" fillOpacity={1} fill="url(#colorYield)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                <p className="text-sm">No efficiency data available</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quality Distribution */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-6">Quality Classification</h3>
                    <div className="h-80 min-w-0 w-full relative">
                        {quality.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                                <PieChart>
                                    <Pie
                                        data={quality as any[]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="count"
                                        nameKey="classification"
                                    >
                                        {quality.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                <p className="text-sm">No quality data available</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
