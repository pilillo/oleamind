import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Cloud,
  Droplets,
  Bug,
  Leaf,
  AlertTriangle,
  CheckCircle,
  Info,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { apiCall } from '../../config'

interface Advisory {
  type: string
  priority: string
  days_ahead: number
  message: string
  reason: string
  action: string
  avoid_until?: string
}

interface WeatherAdvisoryData {
  parcel_id: number
  parcel_name: string
  generated_at: string
  climate_zone: string
  growing_season: string
  is_dormant: boolean
  hemisphere: string
  advisories: Advisory[]
  best_spray_day: number
  best_irrigate_day: number
  rain_expected_days: number[]
  warnings: string[]
}

interface WeatherAdvisoryPanelProps {
  parcelId: number
  compact?: boolean
}

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'critical': return 'bg-red-50 border-red-200 text-red-800'
    case 'high': return 'bg-orange-50 border-orange-200 text-orange-800'
    case 'medium': return 'bg-yellow-50 border-yellow-200 text-yellow-800'
    case 'low': return 'bg-blue-50 border-blue-200 text-blue-800'
    default: return 'bg-gray-50 border-gray-200 text-gray-700'
  }
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'irrigation': return <Droplets className="w-4 h-4" />
    case 'pest': return <Bug className="w-4 h-4" />
    case 'disease': return <Leaf className="w-4 h-4" />
    case 'treatment': return <Sparkles className="w-4 h-4" />
    case 'weather': return <Cloud className="w-4 h-4" />
    default: return <Info className="w-4 h-4" />
  }
}

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />
    case 'high': return <AlertTriangle className="w-4 h-4 text-orange-500" />
    case 'medium': return <Info className="w-4 h-4 text-yellow-600" />
    default: return <CheckCircle className="w-4 h-4 text-green-500" />
  }
}

export const WeatherAdvisoryPanel: React.FC<WeatherAdvisoryPanelProps> = ({
  parcelId,
  compact = false
}) => {
  const { t } = useTranslation()
  const [advisory, setAdvisory] = useState<WeatherAdvisoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(!compact)

  useEffect(() => {
    fetchAdvisory()
  }, [parcelId])

  const fetchAdvisory = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiCall(`/weather/advisory/${parcelId}`)
      if (!response.ok) throw new Error('Failed to fetch advisory')
      const data = await response.json()
      setAdvisory(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load advisory')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-1/3 mb-3"></div>
        <div className="space-y-2">
          <div className="h-12 bg-gray-100 rounded"></div>
          <div className="h-12 bg-gray-100 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-xl border border-red-200 p-4">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={fetchAdvisory}
          className="mt-2 text-xs text-red-700 underline"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!advisory) return null

  // Sort advisories by priority
  const sortedAdvisories = [...(advisory.advisories || [])].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
    return (priorityOrder[a.priority as keyof typeof priorityOrder] || 5) -
      (priorityOrder[b.priority as keyof typeof priorityOrder] || 5)
  })

  // Get urgent advisories (critical/high)
  const urgentAdvisories = sortedAdvisories.filter(a =>
    a.priority === 'critical' || a.priority === 'high'
  )

  const displayAdvisories = compact && !expanded
    ? urgentAdvisories.slice(0, 2)
    : sortedAdvisories

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-800">
              {t('weather.advisory', 'Weather Advisory')}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAdvisory}
              className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
            {compact && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Context badges */}
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="px-2 py-0.5 bg-white/80 rounded-full text-xs text-gray-600">
            {advisory.climate_zone}
          </span>
          <span className="px-2 py-0.5 bg-white/80 rounded-full text-xs text-gray-600 capitalize">
            {advisory.growing_season} season
          </span>
          {advisory.is_dormant && (
            <span className="px-2 py-0.5 bg-purple-100 rounded-full text-xs text-purple-700">
              Dormant
            </span>
          )}
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-green-600" />
          <span className="text-gray-600">Best spray:</span>
          <span className="font-medium">
            {advisory.best_spray_day >= 0
              ? `Day ${advisory.best_spray_day}`
              : 'Not available'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Droplets className="w-4 h-4 text-blue-600" />
          <span className="text-gray-600">Irrigate:</span>
          <span className="font-medium">
            {advisory.best_irrigate_day >= 0
              ? `Day ${advisory.best_irrigate_day}`
              : 'Not needed'}
          </span>
        </div>
        {advisory.rain_expected_days && advisory.rain_expected_days.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Cloud className="w-4 h-4 text-blue-600" />
            <span className="text-gray-600">Rain:</span>
            <span className="font-medium">
              Day {advisory.rain_expected_days.join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* Advisories List */}
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        {displayAdvisories.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm">No urgent advisories</p>
            <p className="text-xs">Conditions look favorable</p>
          </div>
        ) : (
          displayAdvisories.map((adv, idx) => (
            <div
              key={idx}
              className={`rounded-lg border p-3 ${getPriorityColor(adv.priority)}`}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5">
                  {getTypeIcon(adv.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getPriorityIcon(adv.priority)}
                    <span className="font-medium text-sm">{adv.message}</span>
                    {adv.days_ahead !== undefined && adv.days_ahead >= 0 && (
                      <span className="text-xs opacity-70">
                        (Day {adv.days_ahead})
                      </span>
                    )}
                  </div>
                  {adv.reason && (
                    <p className="text-xs opacity-80 mb-1">{adv.reason}</p>
                  )}
                  {adv.action && (
                    <p className="text-xs font-medium flex items-center gap-1">
                      <span className="opacity-70">→</span> {adv.action}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Show more button for compact mode */}
        {compact && !expanded && sortedAdvisories.length > 2 && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            Show {sortedAdvisories.length - 2} more advisories
          </button>
        )}
      </div>

      {/* Warnings */}
      {advisory.warnings && advisory.warnings.length > 0 && (
        <div className="px-4 pb-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Coordination Notes
            </h4>
            <ul className="text-xs text-amber-700 space-y-1">
              {advisory.warnings.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 text-center">
          Generated: {new Date(advisory.generated_at).toLocaleString()}
        </p>
      </div>
    </div>
  )
}

