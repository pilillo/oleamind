import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { 
    Bug, 
    Leaf, 
    AlertTriangle, 
    CheckCircle, 
    RefreshCw, 
    Calendar,
    Loader2,
    ChevronDown,
    ChevronUp
} from 'lucide-react'
import { apiCall } from '../../config'
import { RiskForecastChart } from './RiskForecastChart'

interface DailyRiskSummary {
    date: string
    days_ahead: number
    risk_score: number
    risk_level: string
    risk_trend: string
    confidence: number
}

interface RiskForecastSummary {
    parcel_id: number
    parcel_name: string
    generated_at: string
    olive_fly_forecast: DailyRiskSummary[]
    peacock_spot_forecast: DailyRiskSummary[]
    alerts: string[]
    recommended_actions: string[]
}

interface RiskForecastPanelProps {
    parcelId: number
}

export function RiskForecastPanel({ parcelId }: RiskForecastPanelProps) {
    const { t } = useTranslation()
    const [summary, setSummary] = useState<RiskForecastSummary | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [refreshing, setRefreshing] = useState(false)
    const [expanded, setExpanded] = useState(true)

    useEffect(() => {
        fetchForecast()
    }, [parcelId])

    const fetchForecast = async () => {
        try {
            setLoading(true)
            setError(null)
            const response = await apiCall(`/pests/risk-forecast/${parcelId}/summary`)
            
            if (!response.ok) {
                throw new Error('Failed to fetch forecast')
            }
            
            const data = await response.json()
            setSummary(data)
        } catch (err) {
            console.error('Failed to fetch risk forecast:', err)
            setError(t('forecast.error_loading'))
        } finally {
            setLoading(false)
        }
    }

    const handleRefresh = async () => {
        try {
            setRefreshing(true)
            await apiCall(`/pests/risk-forecast/${parcelId}/refresh`, { method: 'POST' })
            await fetchForecast()
        } catch (err) {
            console.error('Failed to refresh forecast:', err)
        } finally {
            setRefreshing(false)
        }
    }

    const getHighestRisk = (forecast: DailyRiskSummary[]): string => {
        if (!forecast.length) return 'none'
        const riskOrder = ['critical', 'high', 'moderate', 'low', 'none']
        return forecast.reduce((highest, day) => {
            const currentIndex = riskOrder.indexOf(day.risk_level)
            const highestIndex = riskOrder.indexOf(highest)
            return currentIndex < highestIndex ? day.risk_level : highest
        }, 'none')
    }

    const formatLastUpdated = (timestamp: string) => {
        const date = new Date(timestamp)
        return date.toLocaleString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            day: 'numeric',
            month: 'short'
        })
    }

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-center gap-2 text-gray-500">
                    <Loader2 className="animate-spin" size={20} />
                    <span>{t('forecast.loading')}</span>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="text-center text-gray-500">
                    <AlertTriangle className="mx-auto mb-2 text-amber-500" size={24} />
                    <p>{error}</p>
                    <button 
                        onClick={fetchForecast}
                        className="mt-2 text-sm text-green-600 hover:text-green-700"
                    >
                        {t('common.try_again')}
                    </button>
                </div>
            </div>
        )
    }

    if (!summary) return null

    const flyHighestRisk = getHighestRisk(summary.olive_fly_forecast)
    const spotHighestRisk = getHighestRisk(summary.peacock_spot_forecast)
    const hasAlerts = summary.alerts.length > 0
    const criticalLevel = flyHighestRisk === 'critical' || spotHighestRisk === 'critical'
    const highLevel = flyHighestRisk === 'high' || spotHighestRisk === 'high'

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div 
                className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${
                    criticalLevel ? 'bg-red-50 border-b-2 border-red-500' :
                    highLevel ? 'bg-orange-50 border-b-2 border-orange-500' :
                    hasAlerts ? 'bg-amber-50 border-b-2 border-amber-500' :
                    'bg-green-50 border-b-2 border-green-500'
                }`}
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                        criticalLevel ? 'bg-red-100' :
                        highLevel ? 'bg-orange-100' :
                        hasAlerts ? 'bg-amber-100' :
                        'bg-green-100'
                    }`}>
                        <Calendar size={20} className={
                            criticalLevel ? 'text-red-600' :
                            highLevel ? 'text-orange-600' :
                            hasAlerts ? 'text-amber-600' :
                            'text-green-600'
                        } />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">
                            {t('forecast.title')}
                        </h3>
                        <p className="text-xs text-gray-500">
                            {t('forecast.updated')} {formatLastUpdated(summary.generated_at)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            handleRefresh()
                        }}
                        disabled={refreshing}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
                        title={t('forecast.refresh')}
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                    {expanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                </div>
            </div>

            {expanded && (
                <>
                    {/* Alerts Section */}
                    {summary.alerts.length > 0 && (
                        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
                                <div className="flex-1">
                                    <h4 className="text-sm font-medium text-amber-800 mb-1">
                                        {t('forecast.alerts')}
                                    </h4>
                                    <ul className="space-y-1">
                                        {summary.alerts.map((alert, index) => (
                                            <li key={index} className="text-sm text-amber-700">
                                                • {alert}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Recommended Actions */}
                    {summary.recommended_actions.length > 0 && (
                        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
                            <div className="flex items-start gap-3">
                                <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={18} />
                                <div className="flex-1">
                                    <h4 className="text-sm font-medium text-green-800 mb-1">
                                        {t('forecast.recommended_actions')}
                                    </h4>
                                    <ul className="space-y-1">
                                        {summary.recommended_actions.map((action, index) => (
                                            <li key={index} className="text-sm text-green-700">
                                                • {action}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Charts */}
                    <div className="p-4 space-y-4">
                        {/* Olive Fly Chart */}
                        <RiskForecastChart
                            title={t('pests.pests.olive_fly')}
                            icon={<Bug size={18} className="text-amber-600" />}
                            forecast={summary.olive_fly_forecast}
                            pestType="olive_fly"
                        />

                        {/* Peacock Spot Chart */}
                        <RiskForecastChart
                            title={t('pests.pests.peacock_spot')}
                            icon={<Leaf size={18} className="text-green-600" />}
                            forecast={summary.peacock_spot_forecast}
                            pestType="peacock_spot"
                        />
                    </div>

                    {/* Summary Stats */}
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                                <div className="flex items-center justify-center gap-1">
                                    <Bug size={14} className="text-amber-600" />
                                    <span className="text-xs text-gray-500">{t('pests.pests.olive_fly')}</span>
                                </div>
                                <div className={`text-sm font-medium capitalize ${
                                    flyHighestRisk === 'critical' ? 'text-red-600' :
                                    flyHighestRisk === 'high' ? 'text-orange-600' :
                                    flyHighestRisk === 'moderate' ? 'text-amber-600' :
                                    'text-green-600'
                                }`}>
                                    {t(`pests.risk_levels.${flyHighestRisk}`)} {t('forecast.peak_this_week')}
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-center gap-1">
                                    <Leaf size={14} className="text-green-600" />
                                    <span className="text-xs text-gray-500">{t('pests.pests.peacock_spot')}</span>
                                </div>
                                <div className={`text-sm font-medium capitalize ${
                                    spotHighestRisk === 'critical' ? 'text-red-600' :
                                    spotHighestRisk === 'high' ? 'text-orange-600' :
                                    spotHighestRisk === 'moderate' ? 'text-amber-600' :
                                    'text-green-600'
                                }`}>
                                    {t(`pests.risk_levels.${spotHighestRisk}`)} {t('forecast.peak_this_week')}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

