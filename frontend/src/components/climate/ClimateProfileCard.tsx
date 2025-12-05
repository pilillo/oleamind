import React from 'react'
import { useTranslation } from 'react-i18next'
import { 
  Thermometer, 
  Droplets, 
  Sun, 
  Snowflake, 
  MapPin, 
  Mountain,
  Waves,
  Leaf,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react'

interface ClimateProfile {
  parcel_id: number
  latitude: number
  longitude: number
  altitude: number
  distance_to_sea: number
  climate_type: string
  is_coastal: boolean
  is_mountainous: boolean
  avg_annual_temp?: number
  avg_jan_temp?: number
  avg_jul_temp?: number
  avg_frost_days_per_year?: number
  avg_hot_days_per_year?: number
  annual_gdd?: number
  chilling_hours?: number
  annual_rainfall?: number
  dry_months_per_year?: number
  dormancy_start_month?: number
  dormancy_end_month?: number
  irrigation_factor: number
  etc_multiplier: number
  pest_pressure_factor: number
  frost_risk_factor: number
  olive_suitability_score: number
  suitability_notes?: string
  data_source: string
  confidence_score: number
  last_calculated?: string
}

interface ClimateProfileCardProps {
  profile: ClimateProfile | null
  loading?: boolean
  onRefresh?: () => void
}

const getMonthName = (month: number): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[month - 1] || '?'
}

const getKoppenDescription = (code: string): string => {
  const descriptions: Record<string, string> = {
    'Csa': 'Hot-Summer Mediterranean',
    'Csb': 'Warm-Summer Mediterranean',
    'BSh': 'Hot Semi-Arid',
    'BSk': 'Cold Semi-Arid',
    'BWh': 'Hot Desert',
    'Cfb': 'Oceanic',
    'Dfb': 'Warm-Summer Continental',
  }
  return descriptions[code] || code
}

const getSuitabilityColor = (score: number): string => {
  if (score >= 80) return 'text-green-600 bg-green-50 border-green-200'
  if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
  if (score >= 40) return 'text-orange-600 bg-orange-50 border-orange-200'
  return 'text-red-600 bg-red-50 border-red-200'
}

const getSuitabilityIcon = (score: number) => {
  if (score >= 80) return <CheckCircle className="w-5 h-5" />
  if (score >= 60) return <Info className="w-5 h-5" />
  return <AlertTriangle className="w-5 h-5" />
}

const getDataSourceBadge = (source: string, confidence: number) => {
  const badges: Record<string, { label: string; color: string }> = {
    'historical_api': { label: '5-Year Historical', color: 'bg-green-100 text-green-700' },
    'weather_history': { label: 'Weather History', color: 'bg-blue-100 text-blue-700' },
    'location_estimate': { label: 'Location Estimate', color: 'bg-yellow-100 text-yellow-700' },
    'latitude_fallback': { label: 'Latitude Fallback', color: 'bg-gray-100 text-gray-600' },
  }
  const badge = badges[source] || { label: source, color: 'bg-gray-100 text-gray-600' }
  
  return (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
      <span className="text-xs text-gray-500">
        {Math.round(confidence * 100)}% confidence
      </span>
    </div>
  )
}

export const ClimateProfileCard: React.FC<ClimateProfileCardProps> = ({ 
  profile, 
  loading = false,
  onRefresh 
}) => {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
        <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">{t('climate.noData', 'Climate profile not available')}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header with Suitability Score */}
      <div className={`p-4 border-b ${getSuitabilityColor(profile.olive_suitability_score)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getSuitabilityIcon(profile.olive_suitability_score)}
            <div>
              <h3 className="font-bold text-lg">
                {t('climate.suitability', 'Olive Suitability')}: {Math.round(profile.olive_suitability_score)}/100
              </h3>
              <p className="text-sm opacity-80">
                {profile.climate_type && getKoppenDescription(profile.climate_type)}
              </p>
            </div>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              title={t('climate.refresh', 'Refresh with historical data')}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
        {profile.suitability_notes && (
          <p className="mt-2 text-sm opacity-90">{profile.suitability_notes}</p>
        )}
      </div>

      {/* Location Info */}
      <div className="p-4 bg-gray-50 border-b border-gray-100">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span>{profile.latitude.toFixed(2)}°N, {profile.longitude.toFixed(2)}°E</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Mountain className="w-4 h-4 text-gray-400" />
            <span>{Math.round(profile.altitude)}m</span>
            {profile.is_mountainous && (
              <span className="text-xs bg-purple-100 text-purple-600 px-1.5 rounded">Mountain</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Waves className="w-4 h-4 text-gray-400" />
            <span>{Math.round(profile.distance_to_sea)}km to sea</span>
            {profile.is_coastal && (
              <span className="text-xs bg-blue-100 text-blue-600 px-1.5 rounded">Coastal</span>
            )}
          </div>
        </div>
      </div>

      {/* Climate Stats Grid */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Temperature */}
        <div className="text-center p-3 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg">
          <Thermometer className="w-5 h-5 text-orange-500 mx-auto mb-1" />
          <div className="text-lg font-bold text-gray-900">
            {profile.avg_annual_temp?.toFixed(1) || '?'}°C
          </div>
          <div className="text-xs text-gray-500">{t('climate.avgTemp', 'Avg Temp')}</div>
          {profile.avg_jan_temp && profile.avg_jul_temp && (
            <div className="text-[10px] text-gray-400 mt-1">
              {profile.avg_jan_temp.toFixed(0)}°–{profile.avg_jul_temp.toFixed(0)}°
            </div>
          )}
        </div>

        {/* Rainfall */}
        <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg">
          <Droplets className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <div className="text-lg font-bold text-gray-900">
            {profile.annual_rainfall ? Math.round(profile.annual_rainfall) : '?'}mm
          </div>
          <div className="text-xs text-gray-500">{t('climate.annualRain', 'Annual Rain')}</div>
          {profile.dry_months_per_year && (
            <div className="text-[10px] text-gray-400 mt-1">
              {profile.dry_months_per_year} dry months
            </div>
          )}
        </div>

        {/* GDD */}
        <div className="text-center p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
          <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <div className="text-lg font-bold text-gray-900">
            {profile.annual_gdd || '?'}
          </div>
          <div className="text-xs text-gray-500">{t('climate.gdd', 'GDD/year')}</div>
          <div className="text-[10px] text-gray-400 mt-1">
            Base 10°C
          </div>
        </div>

        {/* Frost Days */}
        <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg">
          <Snowflake className="w-5 h-5 text-purple-500 mx-auto mb-1" />
          <div className="text-lg font-bold text-gray-900">
            {profile.avg_frost_days_per_year ?? '?'}
          </div>
          <div className="text-xs text-gray-500">{t('climate.frostDays', 'Frost Days')}</div>
          {profile.chilling_hours && (
            <div className="text-[10px] text-gray-400 mt-1">
              {profile.chilling_hours}h chilling
            </div>
          )}
        </div>
      </div>

      {/* Adjustment Factors */}
      <div className="px-4 pb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
            <Leaf className="w-3 h-3" />
            {t('climate.adjustments', 'DSS Adjustment Factors')}
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Irrigation</span>
              <span className={`font-medium ${profile.irrigation_factor < 1 ? 'text-orange-600' : 'text-green-600'}`}>
                {profile.irrigation_factor < 1 ? '↑ Earlier' : profile.irrigation_factor > 1 ? '↓ Later' : 'Normal'}
                ({profile.irrigation_factor.toFixed(2)}×)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">ET Multiplier</span>
              <span className={`font-medium ${profile.etc_multiplier > 1 ? 'text-orange-600' : 'text-green-600'}`}>
                {profile.etc_multiplier.toFixed(2)}×
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Frost Risk</span>
              <span className={`font-medium ${profile.frost_risk_factor > 1.2 ? 'text-red-600' : profile.frost_risk_factor < 0.8 ? 'text-green-600' : 'text-gray-600'}`}>
                {profile.frost_risk_factor > 1.2 ? '⚠️ High' : profile.frost_risk_factor < 0.8 ? '✓ Low' : 'Normal'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Pest Pressure</span>
              <span className={`font-medium ${profile.pest_pressure_factor > 1.2 ? 'text-orange-600' : 'text-green-600'}`}>
                {profile.pest_pressure_factor > 1.2 ? '↑ Higher' : 'Normal'}
              </span>
            </div>
          </div>
        </div>

        {/* Dormancy Period */}
        {profile.dormancy_start_month && profile.dormancy_end_month && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-gray-500 flex items-center gap-1">
              <Sun className="w-4 h-4" />
              {t('climate.dormancy', 'Dormancy')}:
            </span>
            <span className="font-medium text-gray-700">
              {getMonthName(profile.dormancy_start_month)} – {getMonthName(profile.dormancy_end_month)}
            </span>
          </div>
        )}
      </div>

      {/* Footer with data source */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        {getDataSourceBadge(profile.data_source, profile.confidence_score)}
        {profile.last_calculated && (
          <span className="text-[10px] text-gray-400">
            Updated: {new Date(profile.last_calculated).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  )
}

