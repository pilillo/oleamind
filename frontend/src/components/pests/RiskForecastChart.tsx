import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface DailyRisk {
    date: string
    days_ahead: number
    risk_score: number
    risk_level: string
    risk_trend: string
    confidence: number
}

interface RiskForecastChartProps {
    title: string
    icon: React.ReactNode
    forecast: DailyRisk[]
    pestType: 'olive_fly' | 'peacock_spot'
}

export function RiskForecastChart({ title, icon, forecast, pestType: _pestType }: RiskForecastChartProps) {
    const { t } = useTranslation()

    const maxScore = 100
    const chartHeight = 120

    const riskColors = {
        critical: { bg: 'bg-red-500', text: 'text-red-700', border: 'border-red-500' },
        high: { bg: 'bg-orange-500', text: 'text-orange-700', border: 'border-orange-500' },
        moderate: { bg: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-500' },
        low: { bg: 'bg-yellow-400', text: 'text-yellow-700', border: 'border-yellow-400' },
        none: { bg: 'bg-green-400', text: 'text-green-700', border: 'border-green-400' },
    }

    const formatDate = (dateStr: string, daysAhead: number) => {
        if (daysAhead === 0) return t('forecast.today')
        if (daysAhead === 1) return t('forecast.tomorrow')
        
        const date = new Date(dateStr)
        return date.toLocaleDateString(undefined, { weekday: 'short' })
    }

    const getTrendIcon = (trend: string) => {
        switch (trend) {
            case 'increasing':
                return <TrendingUp size={12} className="text-red-500" />
            case 'decreasing':
                return <TrendingDown size={12} className="text-green-500" />
            default:
                return <Minus size={12} className="text-gray-400" />
        }
    }

    // Calculate the peak risk day
    const peakRisk = useMemo(() => {
        if (!forecast.length) return null
        return forecast.reduce((max, day) => 
            day.risk_score > max.risk_score ? day : max
        , forecast[0])
    }, [forecast])

    if (!forecast || forecast.length === 0) {
        return (
            <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
                {t('forecast.no_data')}
            </div>
        )
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {icon}
                    <h3 className="font-semibold text-gray-800">{title}</h3>
                </div>
                {peakRisk && peakRisk.risk_level !== 'none' && peakRisk.risk_level !== 'low' && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                        peakRisk.risk_level === 'critical' ? 'bg-red-100 text-red-700' :
                        peakRisk.risk_level === 'high' ? 'bg-orange-100 text-orange-700' :
                        'bg-amber-100 text-amber-700'
                    }`}>
                        {t(`forecast.peak_${peakRisk.risk_level}`)} {formatDate(peakRisk.date, peakRisk.days_ahead)}
                    </span>
                )}
            </div>

            {/* Chart */}
            <div className="p-4">
                <div className="flex items-end justify-between gap-1" style={{ height: chartHeight }}>
                    {forecast.map((day, index) => {
                        const barHeight = (day.risk_score / maxScore) * chartHeight
                        const colors = riskColors[day.risk_level as keyof typeof riskColors] || riskColors.none
                        
                        return (
                            <div 
                                key={index} 
                                className="flex-1 flex flex-col items-center gap-1"
                                title={`${day.risk_score}% - ${t(`pests.risk_levels.${day.risk_level}`)}`}
                            >
                                {/* Score label */}
                                <span className={`text-xs font-medium ${colors.text}`}>
                                    {Math.round(day.risk_score)}
                                </span>
                                
                                {/* Bar */}
                                <div 
                                    className={`w-full rounded-t-sm ${colors.bg} transition-all duration-300 relative`}
                                    style={{ 
                                        height: Math.max(barHeight, 4),
                                        opacity: 0.4 + (day.confidence / 100) * 0.6
                                    }}
                                >
                                    {/* Trend indicator */}
                                    {index > 0 && (
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                            {getTrendIcon(day.risk_trend)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* X-axis labels */}
                <div className="flex justify-between mt-2 border-t border-gray-100 pt-2">
                    {forecast.map((day, index) => (
                        <div key={index} className="flex-1 text-center">
                            <span className="text-xs text-gray-500">
                                {formatDate(day.date, day.days_ahead)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                <div className="flex items-center justify-center gap-4 text-xs">
                    {Object.entries(riskColors).map(([level, colors]) => (
                        <div key={level} className="flex items-center gap-1">
                            <div className={`w-3 h-3 rounded-sm ${colors.bg}`}></div>
                            <span className="text-gray-600 capitalize">
                                {t(`pests.risk_levels.${level}`)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

