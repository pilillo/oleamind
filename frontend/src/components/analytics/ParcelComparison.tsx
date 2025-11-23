import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { BarChart2, Award, TrendingDown, TrendingUp, Download } from 'lucide-react'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { apiCall } from '../../config'

const handleExportComparisonPDF = async (parcelIds: number[], year: number) => {
    try {
        const token = localStorage.getItem('auth_token')
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

        const response = await fetch(`${API_URL}/analytics/export/comparison-report?parcel_ids=${parcelIds.join(',')}&year=${year}`, {
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
        a.download = `parcel_comparison_${year}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        document.body.removeChild(a)
    } catch (error) {
        console.error('Failed to export PDF:', error)
        toast.error('Failed to export PDF')
    }
}


interface ParcelComparisonData {
    parcel_id: number
    parcel_name: string
    area: number
    trees_count: number
    yield_per_hectare: number
    cost_per_liter: number
    average_quality: string
    water_usage_m3: number
    total_revenue: number
    net_profit: number
    roi: number
}

export function ParcelComparison() {
    const { t } = useTranslation()
    const [parcels, setParcels] = useState<{ ID: number, name: string }[]>([])
    const [selectedParcels, setSelectedParcels] = useState<number[]>([])
    const [comparisonData, setComparisonData] = useState<ParcelComparisonData[]>([])
    const [loading, setLoading] = useState(false)
    const [year, setYear] = useState(new Date().getFullYear())

    useEffect(() => {
        fetchParcels()
    }, [])

    useEffect(() => {
        if (selectedParcels.length > 0) {
            fetchComparison()
        }
    }, [selectedParcels, year])

    const fetchParcels = async () => {
        try {
            const response = await apiCall('/parcels')
            const data = await response.json()
            setParcels(data)
            // Auto-select first 3 parcels
            if (data.length > 0) {
                setSelectedParcels(data.slice(0, Math.min(3, data.length)).map((p: any) => p.ID))
            }
        } catch (error) {
            console.error('Failed to fetch parcels:', error)
        }
    }

    const fetchComparison = async () => {
        if (selectedParcels.length === 0) return

        try {
            setLoading(true)
            const response = await apiCall(`/analytics/parcel-comparison?parcel_ids=${selectedParcels.join(',')}&year=${year}`)
            const data: ParcelComparisonData[] = await response.json()
            setComparisonData(data)
        } catch (error) {
            console.error('Failed to fetch comparison:', error)
            toast.error(t('analytics.errors.fetch_comparison'))
        } finally {
            setLoading(false)
        }
    }

    const handleParcelToggle = (parcelId: number) => {
        setSelectedParcels(prev =>
            prev.includes(parcelId)
                ? prev.filter(id => id !== parcelId)
                : prev.length < 5
                    ? [...prev, parcelId]
                    : prev // Max 5 parcels
        )
    }

    // Prepare radar chart data - normalize metrics to 0-100 scale
    const radarData = comparisonData.length > 0 ? (() => {
        const maxYield = Math.max(...comparisonData.map(d => d.yield_per_hectare || 1))
        const maxRevenue = Math.max(...comparisonData.map(d => d.total_revenue || 1))
        const maxROI = Math.max(...comparisonData.filter(d => d.roi > 0).map(d => d.roi), 1)

        const metrics = ['Yield', 'Revenue', 'ROI', 'Efficiency']
        return metrics.map(metric => {
            const point: any = { metric }
            comparisonData.forEach(parcel => {
                let value = 0
                switch (metric) {
                    case 'Yield':
                        value = (parcel.yield_per_hectare / maxYield) * 100
                        break
                    case 'Revenue':
                        value = (parcel.total_revenue / maxRevenue) * 100
                        break
                    case 'ROI':
                        value = parcel.roi > 0 ? (parcel.roi / maxROI) * 100 : 0
                        break
                    case 'Efficiency':
                        // Lower cost is better, invert
                        const minCost = Math.min(...comparisonData.filter(d => d.cost_per_liter > 0).map(d => d.cost_per_liter), 1)
                        value = parcel.cost_per_liter > 0 ? (minCost / parcel.cost_per_liter) * 100 : 0
                        break
                }
                point[parcel.parcel_name] = value
            })
            return point
        })
    })() : []

    const colors = ['#16a34a', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']

    if (loading) {
        return <LoadingSpinner />
    }

    return (
        <div className="space-y-6">
            {/* Header with Parcel Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div className="flex items-center gap-2">
                        <BarChart2 className="text-green-600" size={24} />
                        <h3 className="text-lg font-semibold text-gray-800">{t('analytics.comparison.title')}</h3>
                    </div>
                    <div className="flex gap-2 items-center">
                        {selectedParcels.length > 0 && (
                            <button
                                onClick={() => handleExportComparisonPDF(selectedParcels, year).catch(() => toast.error(t('analytics.errors.export_pdf')))}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors mr-2"
                            >
                                <Download size={16} />
                                {t('analytics.comparison.export_pdf')}
                            </button>
                        )}
                        <label className="text-sm text-gray-600">{t('analytics.comparison.year')}:</label>
                        <input
                            type="number"
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-24"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {parcels.map(parcel => (
                        <button
                            key={parcel.ID}
                            onClick={() => handleParcelToggle(parcel.ID)}
                            disabled={!selectedParcels.includes(parcel.ID) && selectedParcels.length >= 5}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedParcels.includes(parcel.ID)
                                ? 'bg-green-600 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {parcel.name}
                        </button>
                    ))}
                </div>
                {selectedParcels.length >= 5 && (
                    <p className="text-xs text-amber-600 mt-2">Maximum 5 parcels for comparison</p>
                )}
            </div>

            {comparisonData.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-500">{t('analytics.comparison.select_to_compare')}</p>
                </div>
            ) : (
                <>
                    {/* Best Performers Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {(() => {
                            const bestYield = comparisonData.reduce((a, b) => a.yield_per_hectare > b.yield_per_hectare ? a : b)
                            const bestROI = comparisonData.filter(d => d.roi > 0).reduce((a, b) => a.roi > b.roi ? a : b, comparisonData[0])
                            const bestEfficiency = comparisonData.filter(d => d.cost_per_liter > 0).reduce((a, b) => a.cost_per_liter < b.cost_per_liter ? a : b, comparisonData[0])

                            return (
                                <>
                                    <div className="bg-green-50 rounded-xl border border-green-200 p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Award className="text-green-600" size={20} />
                                            <span className="text-sm text-green-700 font-medium">{t('analytics.comparison.highest_yield')}</span>
                                        </div>
                                        <div className="text-xl font-bold text-green-900">{bestYield.parcel_name}</div>
                                        <div className="text-sm text-green-700">{bestYield.yield_per_hectare.toFixed(0)} kg/ha</div>
                                    </div>
                                    <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrendingUp className="text-blue-600" size={20} />
                                            <span className="text-sm text-blue-700 font-medium">{t('analytics.comparison.best_roi')}</span>
                                        </div>
                                        <div className="text-xl font-bold text-blue-900">{bestROI.parcel_name}</div>
                                        <div className="text-sm text-blue-700">{bestROI.roi.toFixed(1)}%</div>
                                    </div>
                                    <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrendingDown className="text-amber-600" size={20} />
                                            <span className="text-sm text-amber-700 font-medium">{t('analytics.comparison.lowest_cost')}</span>
                                        </div>
                                        <div className="text-xl font-bold text-amber-900">{bestEfficiency.parcel_name}</div>
                                        <div className="text-sm text-amber-700">€{bestEfficiency.cost_per_liter.toFixed(2)}/L</div>
                                    </div>
                                </>
                            )
                        })()}
                    </div>

                    {/* Radar Chart */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h4 className="text-md font-semibold text-gray-800 mb-4">{t('analytics.comparison.radar_title')}</h4>
                        <ResponsiveContainer width="100%" height={400}>
                            <RadarChart data={radarData}>
                                <PolarGrid />
                                <PolarAngleAxis dataKey="metric" />
                                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                                {comparisonData.map((parcel, index) => (
                                    <Radar
                                        key={parcel.parcel_id}
                                        name={parcel.parcel_name}
                                        dataKey={parcel.parcel_name}
                                        stroke={colors[index % colors.length]}
                                        fill={colors[index % colors.length]}
                                        fillOpacity={0.3}
                                    />
                                ))}
                                <Legend />
                                <Tooltip />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Comparison Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics.comparison.table.metric')}</th>
                                        {comparisonData.map(parcel => (
                                            <th key={parcel.parcel_id} className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                                {parcel.parcel_name}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{t('analytics.comparison.table.area')}</td>
                                        {comparisonData.map(p => <td key={p.parcel_id} className="px-6 py-4 text-sm text-right">{p.area.toFixed(2)}</td>)}
                                    </tr>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{t('analytics.comparison.table.trees')}</td>
                                        {comparisonData.map(p => <td key={p.parcel_id} className="px-6 py-4 text-sm text-right">{p.trees_count}</td>)}
                                    </tr>
                                    <tr className="hover:bg-gray-50 bg-green-50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{t('analytics.comparison.table.yield')}</td>
                                        {comparisonData.map(p => <td key={p.parcel_id} className="px-6 py-4 text-sm text-right font-semibold text-green-700">{p.yield_per_hectare.toFixed(0)}</td>)}
                                    </tr>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{t('analytics.comparison.table.cost')}</td>
                                        {comparisonData.map(p => <td key={p.parcel_id} className="px-6 py-4 text-sm text-right">€{p.cost_per_liter > 0 ? p.cost_per_liter.toFixed(2) : '-'}</td>)}
                                    </tr>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{t('analytics.comparison.table.quality')}</td>
                                        {comparisonData.map(p => <td key={p.parcel_id} className="px-6 py-4 text-sm text-right capitalize">{p.average_quality || '-'}</td>)}
                                    </tr>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{t('analytics.comparison.table.water')}</td>
                                        {comparisonData.map(p => <td key={p.parcel_id} className="px-6 py-4 text-sm text-right">{p.water_usage_m3.toFixed(0)}</td>)}
                                    </tr>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{t('analytics.comparison.table.revenue')}</td>
                                        {comparisonData.map(p => <td key={p.parcel_id} className="px-6 py-4 text-sm text-right">€{p.total_revenue.toFixed(0)}</td>)}
                                    </tr>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{t('analytics.comparison.table.profit')}</td>
                                        {comparisonData.map(p => <td key={p.parcel_id} className={`px-6 py-4 text-sm text-right font-semibold ${p.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>€{p.net_profit.toFixed(0)}</td>)}
                                    </tr>
                                    <tr className="hover:bg-gray-50 bg-blue-50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{t('analytics.comparison.table.roi')}</td>
                                        {comparisonData.map(p => <td key={p.parcel_id} className="px-6 py-4 text-sm text-right font-semibold text-blue-700">{p.roi > 0 ? p.roi.toFixed(1) : '-'}%</td>)}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
