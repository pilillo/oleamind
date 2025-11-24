import { useState, useEffect } from 'react'
import { TrendingUp, Droplets, BarChart3, AlertTriangle, Info } from 'lucide-react'
import { apiCall } from '../../config'

interface SatelliteData {
    ndvi_mean: number
    evi?: number
    savi?: number
    ndwi?: number
    ndmi?: number
    product_date: string
    cloud_cover: number
}

interface SatelliteInsightsProps {
    parcelId: number
    lastUpdated?: number
}

export function SatelliteInsights({ parcelId, lastUpdated }: SatelliteInsightsProps) {
    const [data, setData] = useState<SatelliteData | null>(null)
    const [loading, setLoading] = useState(true)
    const [ageDays, setAgeDays] = useState(0)

    useEffect(() => {
        fetchLatestData()
    }, [parcelId, lastUpdated])

    const fetchLatestData = async () => {
        try {
            setLoading(true)
            const response = await apiCall(`/satellite/${parcelId}/latest`)
            if (response.ok) {
                const result = await response.json()
                setData(result.data)
                setAgeDays(result.age_days)
            } else {
                // If 404 or other error, clear data
                setData(null)
            }
        } catch (err) {
            console.error('Failed to fetch satellite data:', err)
            setData(null)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-20 bg-gray-200 rounded"></div>
                </div>
            </div>
        )
    }

    if (!data) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="text-center py-8 text-gray-400">
                    <BarChart3 size={48} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No satellite data available</p>
                    <p className="text-xs mt-1">Data will be available after processing</p>
                </div>
            </div>
        )
    }

    // Helper functions for interpreting indices
    const getHealthStatus = (ndvi: number): { label: string; color: string; description: string } => {
        if (ndvi >= 0.7) return { label: 'Excellent', color: 'green', description: 'Very healthy, dense vegetation' }
        if (ndvi >= 0.5) return { label: 'Good', color: 'green', description: 'Healthy vegetation' }
        if (ndvi >= 0.3) return { label: 'Moderate', color: 'yellow', description: 'Moderate vegetation vigor' }
        return { label: 'Poor', color: 'red', description: 'Low vegetation vigor or stress' }
    }

    const getWaterStatus = (ndwi?: number): { label: string; color: string; description: string } => {
        if (!ndwi) return { label: 'N/A', color: 'gray', description: 'Data not available' }
        if (ndwi >= 0.3) return { label: 'Well-watered', color: 'green', description: 'Good water content' }
        if (ndwi >= 0.1) return { label: 'Moderate stress', color: 'yellow', description: 'Watch closely' }
        return { label: 'Water stress', color: 'red', description: 'Consider irrigation' }
    }

    const getMoistureStatus = (ndmi?: number): { label: string; color: string; description: string } => {
        if (!ndmi) return { label: 'N/A', color: 'gray', description: 'Data not available' }
        if (ndmi >= 0.4) return { label: 'High', color: 'green', description: 'Good canopy moisture' }
        if (ndmi >= 0.2) return { label: 'Moderate', color: 'yellow', description: 'Normal range' }
        return { label: 'Low', color: 'red', description: 'Low water content' }
    }

    const healthStatus = getHealthStatus(data.ndvi_mean)
    const waterStatus = getWaterStatus(data.ndwi)
    const moistureStatus = getMoistureStatus(data.ndmi)

    const getColorClasses = (color: string) => {
        switch (color) {
            case 'green':
                return {
                    bg: 'bg-green-50',
                    border: 'border-green-200',
                    text: 'text-green-700',
                    icon: 'text-green-600'
                }
            case 'yellow':
                return {
                    bg: 'bg-yellow-50',
                    border: 'border-yellow-200',
                    text: 'text-yellow-700',
                    icon: 'text-yellow-600'
                }
            case 'red':
                return {
                    bg: 'bg-red-50',
                    border: 'border-red-200',
                    text: 'text-red-700',
                    icon: 'text-red-600'
                }
            default:
                return {
                    bg: 'bg-gray-50',
                    border: 'border-gray-200',
                    text: 'text-gray-700',
                    icon: 'text-gray-600'
                }
        }
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <BarChart3 size={20} className="text-green-600" />
                    Satellite Insights
                </h3>
                <div className="text-xs text-gray-500">
                    Updated {ageDays === 0 ? 'today' : ageDays === 1 ? 'yesterday' : `${ageDays} days ago`}
                </div>
            </div>

            <div className="space-y-3">
                {/* Vegetation Health Row */}
                <div className={`p-4 rounded-lg border ${getColorClasses(healthStatus.color).bg} ${getColorClasses(healthStatus.color).border}`}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <TrendingUp size={18} className={getColorClasses(healthStatus.color).icon} />
                            <span className="text-sm font-medium text-gray-700">Vegetation Health</span>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${getColorClasses(healthStatus.color).bg} ${getColorClasses(healthStatus.color).text}`}>
                            {healthStatus.label}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-4">
                            <div className="flex items-baseline gap-2">
                                <span className="text-sm text-gray-600">NDVI:</span>
                                <span className="text-lg font-bold text-gray-900">{data.ndvi_mean.toFixed(3)}</span>
                            </div>
                            {data.evi && (
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xs text-gray-500">EVI:</span>
                                    <span className="text-sm font-semibold text-gray-700">{data.evi.toFixed(3)}</span>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-600 italic">{healthStatus.description}</p>
                    </div>
                </div>

                {/* Water Status Row */}
                <div className={`p-4 rounded-lg border ${getColorClasses(waterStatus.color).bg} ${getColorClasses(waterStatus.color).border}`}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Droplets size={18} className={getColorClasses(waterStatus.color).icon} />
                            <span className="text-sm font-medium text-gray-700">Water Status</span>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${getColorClasses(waterStatus.color).bg} ${getColorClasses(waterStatus.color).text}`}>
                            {waterStatus.label}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-4">
                            {data.ndwi !== undefined && data.ndwi !== null ? (
                                <>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-sm text-gray-600">NDWI:</span>
                                        <span className="text-lg font-bold text-gray-900">{data.ndwi.toFixed(3)}</span>
                                    </div>
                                    {data.ndmi !== undefined && data.ndmi !== null && (
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xs text-gray-500">NDMI:</span>
                                            <span className="text-sm font-semibold text-gray-700">{data.ndmi.toFixed(3)}</span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <span className="text-xs text-gray-500 italic">No water data</span>
                            )}
                        </div>
                        <p className="text-xs text-gray-600 italic">{waterStatus.description}</p>
                    </div>
                </div>

                {/* Recommendation Banner */}
                {(waterStatus.color === 'red' || waterStatus.color === 'yellow') && data.ndwi !== undefined && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
                        <Info size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-blue-800">
                            <p className="font-medium">💡 Recommendation</p>
                            <p className="text-xs mt-1">
                                {waterStatus.color === 'red'
                                    ? 'Water stress detected. Consider irrigating within 1-3 days if no rain is forecast.'
                                    : 'Moderate water stress. Monitor closely and plan irrigation if conditions worsen.'}
                            </p>
                        </div>
                    </div>
                )}

                {ageDays > 7 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-start gap-3">
                        <AlertTriangle size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-gray-600">
                            This data is {ageDays} days old. New satellite imagery will be processed automatically when available.
                        </p>
                    </div>
                )}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Data from: {new Date(data.product_date).toLocaleDateString()}</span>
                <span>Cloud cover: {data.cloud_cover.toFixed(1)}%</span>
            </div>
        </div>
    )
}
