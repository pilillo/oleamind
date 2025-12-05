import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Trees, TreeDeciduous, Map as MapIcon, Activity, AlertTriangle, Droplets, Clock, Cloud, Thermometer, MapPin, Calendar, Bug, Leaf, TrendingUp, TrendingDown } from 'lucide-react'
import { apiCall } from '../config'
import { useAuth } from '../contexts/AuthContext'

interface WeatherData {
  parcel_id: number
  temperature: number
  humidity: number
  et0: number
  rain_next_24h: number
}

interface Parcel {
  ID: number
  name: string
  area: number
  trees_count: number
}

interface InventoryItem {
  ID: number
  name: string
  quantity: number
  minimum_stock: number
}

interface Operation {
  ID: number
  type: string
  status: string
  date: string
  parcel_id: number
  CreatedAt?: string
}

interface ForecastSummary {
  parcel_id: number
  parcel_name: string
  alerts: string[]
  olive_fly_forecast: { date: string; days_ahead: number; risk_level: string; risk_trend: string }[]
  peacock_spot_forecast: { date: string; days_ahead: number; risk_level: string; risk_trend: string }[]
}

function Dashboard() {
  const { t } = useTranslation()
  const { loading: authLoading } = useAuth()
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [weatherData, setWeatherData] = useState<Map<number, WeatherData>>(new Map())
  const [irrigationData, setIrrigationData] = useState<Map<number, any>>(new Map())
  const [pestData, setPestData] = useState<Map<number, any[]>>(new Map())
  const [forecastData, setForecastData] = useState<Map<number, ForecastSummary>>(new Map())
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [operations, setOperations] = useState<Operation[]>([])

  useEffect(() => {
    // Don't fetch data until auth is loaded
    if (authLoading) return

    fetchParcelsAndWeather()
    fetchInventory()
    fetchOperations()
  }, [authLoading])

  const fetchParcelsAndWeather = async () => {
    try {
      const response = await apiCall('/parcels')
      const data = await response.json()
      if (Array.isArray(data)) {
        setParcels(data)

        // Fetch weather, irrigation, and pest data for all parcels
        const dataPromises = data.map(async (parcel: Parcel) => {
          try {
            const [weatherRes, irrigationRes, pestRes] = await Promise.all([
              apiCall(`/parcels/${parcel.ID}/weather`),
              apiCall(`/irrigation/recommendation/${parcel.ID}`),
              apiCall(`/pests/risk/${parcel.ID}`)
            ])

            const weather = await weatherRes.json()
            const irrigation = irrigationRes.ok ? await irrigationRes.json() : null
            const pests = pestRes.ok ? await pestRes.json() : null

            return { parcelId: parcel.ID, weather, irrigation, pests }
          } catch {
            return null
          }
        })

        const results = await Promise.all(dataPromises)
        const weatherMap = new Map()
        const irrigationMap = new Map()
        const pestMap = new Map()

        results.forEach(result => {
          if (result) {
            if (result.weather) {
              weatherMap.set(result.parcelId, result.weather)
            }
            if (result.irrigation) {
              irrigationMap.set(result.parcelId, result.irrigation)
            }
            if (result.pests) {
              pestMap.set(result.parcelId, result.pests)
            }
          }
        })

        setWeatherData(weatherMap)
        setIrrigationData(irrigationMap)
        setPestData(pestMap)

        // Fetch 7-day forecasts for all parcels (non-blocking)
        fetchForecasts(data)
      }
    } catch (err) {
      console.error('Failed to fetch parcels and weather', err)
    }
  }

  const fetchForecasts = async (parcels: Parcel[]) => {
    try {
      const forecastPromises = parcels.map(async (parcel: Parcel) => {
        try {
          const response = await apiCall(`/pests/risk-forecast/${parcel.ID}/summary`)
          if (response.ok) {
            const data = await response.json()
            return { parcelId: parcel.ID, forecast: data }
          }
          return null
        } catch {
          return null
        }
      })

      const results = await Promise.all(forecastPromises)
      const forecastMap = new Map<number, ForecastSummary>()

      results.forEach(result => {
        if (result && result.forecast) {
          forecastMap.set(result.parcelId, result.forecast)
        }
      })

      setForecastData(forecastMap)
    } catch (err) {
      console.error('Failed to fetch forecasts', err)
    }
  }

  const fetchInventory = async () => {
    try {
      const response = await apiCall('/inventory')
      const data = await response.json()
      if (Array.isArray(data)) {
        setInventory(data)
      }
    } catch (err) {
      console.error('Failed to fetch inventory', err)
    }
  }

  const fetchOperations = async () => {
    try {
      const response = await apiCall('/operations')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const data = await response.json()
      if (Array.isArray(data)) {
        setOperations(data)
      } else {
        setOperations([])
      }
    } catch (err) {
      setOperations([])
    }
  }

  // Calculate actionable insights - use irrigation recommendations
  const parcelsNeedingIrrigation = Array.from(irrigationData.values()).filter(
    (irrigation) => irrigation.should_irrigate
  ).length

  const criticalIrrigationParcels = Array.from(irrigationData.entries()).filter(
    ([_, irrigation]) => irrigation.should_irrigate && irrigation.urgency_level === 'critical'
  )

  // Calculate pest risk insights
  const criticalPestRisks = Array.from(pestData.entries()).flatMap(([parcelId, assessments]) => {
    if (!Array.isArray(assessments)) return []
    return assessments
      .filter(a => a.risk_level === 'critical' || a.risk_level === 'high')
      .map(a => ({ parcelId, assessment: a }))
  })

  const parcelsWithRain = Array.from(weatherData.entries()).filter(
    ([_, weather]) => weather.rain_next_24h > 0
  ).length

  const temps = Array.from(weatherData.values()).map(w => w.temperature).filter(t => t !== undefined)
  const minTemp = temps.length > 0 ? Math.min(...temps) : null
  const maxTemp = temps.length > 0 ? Math.max(...temps) : null

  // Calculate real stats
  const totalArea = parcels.reduce((sum, p) => sum + (p.area || 0), 0)
  const totalTrees = parcels.reduce((sum, p) => sum + (p.trees_count || 0), 0)

  // Low stock items
  const lowStockItems = inventory.filter(item => item.quantity <= item.minimum_stock)

  // Active operations (planned or in progress)
  const activeOperations = operations.filter(op => op.status === 'planned' || op.status === 'in_progress')
  const completedOperations = operations.filter(op => op.status === 'completed')

  // Recent operations (last 5, sorted by date)
  const recentOperations = [...operations]
    .sort((a, b) => {
      const dateA = new Date(a.date || a.CreatedAt || 0).getTime()
      const dateB = new Date(b.date || b.CreatedAt || 0).getTime()
      return dateB - dateA
    })
    .slice(0, 5)

  return (
    <div className="max-w-7xl mx-auto">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 text-sm font-medium">{t('dashboard.total_parcels')}</h3>
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <MapIcon size={20} />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{parcels.length}</p>
            <p className="text-sm text-gray-500 mt-1">{t('dashboard.orchards_managed')}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 text-sm font-medium">{t('dashboard.total_area')}</h3>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Trees size={20} />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">
              {totalArea > 0 ? totalArea.toFixed(1) : '0'}
              <span className="text-lg text-gray-400 font-normal"> ha</span>
            </p>
            <p className="text-sm text-gray-500 mt-1">{t('dashboard.olive_cultivation')}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 text-sm font-medium">{t('dashboard.total_trees')}</h3>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <TreeDeciduous size={20} />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">
              {totalTrees > 0 ? totalTrees.toLocaleString() : '0'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {totalTrees > 0 ? t(parcels.length !== 1 ? 'dashboard.across_parcels_plural' : 'dashboard.across_parcels', { count: parcels.length }) : t('dashboard.no_trees_recorded')}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 text-sm font-medium">{t('dashboard.operations')}</h3>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Activity size={20} />
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900">{activeOperations.length}</p>
              <p className="text-sm text-gray-500 mt-1">
                {activeOperations.length === 0 ? t('dashboard.no_active_tasks') :
                  activeOperations.length === 1 ? `1 ${t('dashboard.task_planned')}` : t('dashboard.tasks_planned')}
              </p>
            </div>
            {completedOperations.length > 0 && (
              <div className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                {completedOperations.length} {t('dashboard.completed')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weather Summary - Actionable Insights */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-6 text-gray-900 flex items-center gap-2">
            <Cloud size={20} className="text-gray-400" />
            {t('dashboard.weather_overview')}
          </h2>

          {parcels.length > 0 ? (
            <div className="space-y-4">
              {/* Summary stats */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="flex items-center gap-3 mb-2">
                  <MapPin className="text-blue-600" size={20} />
                  <span className="font-semibold text-blue-900">{parcels.length} {t('dashboard.parcels_monitored')}</span>
                </div>
                {minTemp !== null && maxTemp !== null && (
                  <p className="text-sm text-blue-700">
                    <Thermometer size={14} className="inline mr-1" />
                    {t('dashboard.temp_range')}: {minTemp.toFixed(1)}°C - {maxTemp.toFixed(1)}°C
                  </p>
                )}
              </div>

              {/* Rain forecast */}
              {parcelsWithRain > 0 ? (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                  <div className="flex items-start gap-3">
                    <Droplets size={20} className="text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900">
                        {t('dashboard.rain_expected')}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        {t(parcelsWithRain > 1 ? 'dashboard.parcels_expecting_rain_plural' : 'dashboard.parcels_expecting_rain', { count: parcelsWithRain })}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">💡 {t('dashboard.delay_pesticide')}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 p-4 rounded">
                  <p className="text-sm text-gray-600">
                    <Cloud size={16} className="inline mr-2" />
                    {t('dashboard.no_rain_forecast')}
                  </p>
                </div>
              )}

              {/* Irrigation needs */}
              {parcelsNeedingIrrigation > 0 ? (
                <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
                  <div className="flex items-start gap-3">
                    <Droplets size={20} className="text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">
                        {t('dashboard.irrigation_recommended')}
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        {t(parcelsNeedingIrrigation > 1 ? 'dashboard.parcels_high_et0_plural' : 'dashboard.parcels_high_et0', { count: parcelsNeedingIrrigation })}
                      </p>
                      <p className="text-xs text-amber-600 mt-1">💡 {t('dashboard.check_soil_moisture')}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 p-4 rounded">
                  <p className="text-sm text-green-700">
                    <Droplets size={16} className="inline mr-2" />
                    {t('dashboard.adequate_water')}
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center pt-2 border-t border-gray-100">
                {t('dashboard.view_detailed_weather')}
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Cloud size={48} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t('dashboard.no_parcels_yet')}</p>
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-6 text-gray-900 flex items-center gap-2">
            <Clock size={20} className="text-gray-400" />
            {t('dashboard.recent_activities')}
          </h2>
          {recentOperations.length > 0 ? (
            <div className="space-y-6">
              {recentOperations.map((op, idx) => {
                const parcelName = parcels.find(p => p.ID === op.parcel_id)?.name || `Parcel #${op.parcel_id}`
                const isLast = idx === recentOperations.length - 1

                // Handle date parsing more robustly
                let daysSince = 0
                let timeAgo = t('dashboard.today')
                try {
                  const opDate = new Date(op.date || op.CreatedAt || 0)
                  if (!isNaN(opDate.getTime())) {
                    daysSince = Math.floor((Date.now() - opDate.getTime()) / (1000 * 60 * 60 * 24))
                    timeAgo = daysSince === 0 ? t('dashboard.today') :
                      daysSince === 1 ? t('dashboard.yesterday') :
                        daysSince < 0 ? t('dashboard.upcoming') :
                          t('dashboard.days_ago', { count: daysSince })
                  }
                } catch {
                  // Silently handle date parsing errors
                }

                // Use explicit classes for Tailwind (dynamic classes don't work)
                let dotClass = 'bg-blue-100 ring-blue-500' // default planned
                if (op.status === 'completed') {
                  dotClass = 'bg-green-100 ring-green-500'
                } else if (op.status === 'cancelled') {
                  dotClass = 'bg-gray-100 ring-gray-500'
                }

                const typeLabel = op.type ? t(`operations.type_${op.type}`, op.type.replace('_', ' ')) : t('operations.type_other')
                const statusLabel = op.status === 'completed' ? t('operations.status_completed') :
                  op.status === 'cancelled' ? t('dashboard.cancelled') : t('dashboard.scheduled')

                return (
                  <div key={op.ID} className={`relative pl-6 border-l-2 border-gray-100 ${isLast ? '' : 'pb-2'}`}>
                    <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full ${dotClass} border-2 border-white`}></div>
                    <p className="text-sm font-medium text-gray-900 capitalize">{typeLabel} - {parcelName}</p>
                    <p className="text-xs text-gray-500 mt-1">{timeAgo} • {statusLabel}</p>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400">
              <Clock size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('dashboard.no_operations_logged')}</p>
              <p className="text-xs mt-1">{t('dashboard.start_tracking')}</p>
            </div>
          )}
        </div>

        {/* Alerts & Notifications */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-6 text-gray-900 flex items-center gap-2">
            <AlertTriangle size={20} className="text-gray-400" />
            {t('dashboard.alerts_notifications')}
          </h2>
          {lowStockItems.length > 0 || parcelsNeedingIrrigation > 0 ? (
            <div className="space-y-4">
              {/* Low stock alerts */}
              {lowStockItems.slice(0, 2).map(item => (
                <div key={item.ID} className="bg-amber-50 border border-amber-100 p-4 rounded-lg flex gap-4">
                  <div className="mt-1">
                    <AlertTriangle size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-amber-900">{t('dashboard.low_stock')}: {item.name}</p>
                    <p className="text-xs text-amber-700 mt-1">
                      {item.quantity} {item.name.toLowerCase().includes('fertilizer') || item.name.toLowerCase().includes('pesticide') ? 'kg' : 'units'} {t('dashboard.remaining')}.
                      {t('dashboard.minimum')}: {item.minimum_stock}
                    </p>
                  </div>
                </div>
              ))}

              {lowStockItems.length > 2 && (
                <div className="text-center">
                  <p className="text-xs text-gray-500">
                    {t(lowStockItems.length - 2 > 1 ? 'dashboard.more_low_stock_items_plural' : 'dashboard.more_low_stock_items', { count: lowStockItems.length - 2 })}
                  </p>
                </div>
              )}

              {/* Irrigation alerts - Critical first, then top 2 */}
              {criticalIrrigationParcels.length > 0 && criticalIrrigationParcels.slice(0, 2).map(([parcelId, irrigation]) => {
                const parcel = parcels.find(p => p.ID === parcelId)
                return (
                  <div key={parcelId} className="bg-red-50 border border-red-200 p-4 rounded-lg flex gap-4">
                    <div className="mt-1">
                      <AlertTriangle size={20} className="text-red-600" />
                    </div>
                    <div className="flex-grow">
                      <p className="text-sm font-bold text-red-900 uppercase tracking-wide">{t('dashboard.critical_irrigation_needed')}</p>
                      <p className="text-xs text-red-700 mt-1 font-medium">
                        {parcel?.name || `Parcel ${parcelId}`}: {irrigation.recommended_amount?.toFixed(1)} mm
                        ({irrigation.recommended_liters_tree?.toFixed(0)} L/tree)
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        {t('dashboard.water_stress')}: {irrigation.stress_level || 'severe'} • {t('dashboard.soil_moisture')}: {irrigation.soil_moisture_estimate?.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                )
              })}

              {parcelsNeedingIrrigation > criticalIrrigationParcels.length && (
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg flex gap-4">
                  <div className="mt-1">
                    <Droplets size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-amber-900">{t('dashboard.irrigation_recommended')}</p>
                    <p className="text-xs text-amber-700 mt-1">
                      {t((parcelsNeedingIrrigation - criticalIrrigationParcels.length) > 1 ? 'dashboard.more_parcels_need_irrigation_plural' : 'dashboard.more_parcels_need_irrigation', { count: parcelsNeedingIrrigation - criticalIrrigationParcels.length })}. {t('dashboard.check_parcels_page')}
                    </p>
                  </div>
                </div>
              )}

              {/* Pest Risk alerts - Critical/High only */}
              {criticalPestRisks.length > 0 && criticalPestRisks.slice(0, 2).map(({ parcelId, assessment }) => {
                const parcel = parcels.find(p => p.ID === parcelId)
                const isCritical = assessment.risk_level === 'critical'
                return (
                  <div key={`${parcelId}-${assessment.pest_type}`} className={`${isCritical ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'} border p-4 rounded-lg flex gap-4`}>
                    <div className="mt-1">
                      <AlertTriangle size={20} className={isCritical ? 'text-red-600' : 'text-orange-600'} />
                    </div>
                    <div className="flex-grow">
                      <p className={`text-sm font-bold uppercase tracking-wide ${isCritical ? 'text-red-900' : 'text-orange-900'}`}>
                        {isCritical ? t('dashboard.critical_pest_risk') : t('dashboard.high_pest_risk')}
                      </p>
                      <p className={`text-xs mt-1 font-medium ${isCritical ? 'text-red-700' : 'text-orange-700'}`}>
                        {parcel?.name || `Parcel ${parcelId}`}: {t(`pests.pests.${assessment.pest_type}`, assessment.pest_type)}
                      </p>
                      <p className={`text-xs mt-1 ${isCritical ? 'text-red-600' : 'text-orange-600'}`}>
                        {assessment.alert_message}
                      </p>
                    </div>
                  </div>
                )
              })}

              {/* No alerts message if only showing older alerts */}
              {lowStockItems.length === 0 && parcelsNeedingIrrigation === 0 && criticalPestRisks.length === 0 && (
                <div className="bg-green-50 border border-green-100 p-4 rounded-lg text-center">
                  <p className="text-sm font-medium text-green-800">✅ {t('dashboard.all_systems_good')}</p>
                  <p className="text-xs text-green-600 mt-1">{t('dashboard.no_urgent_actions')}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400">
              <AlertTriangle size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('dashboard.no_alerts')}</p>
              <p className="text-xs mt-1">{t('dashboard.all_systems_normal')}</p>
            </div>
          )}
        </div>

        {/* 7-Day Risk Forecast Overview */}
        {forecastData.size > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
              <Calendar size={20} className="text-gray-400" />
              {t('forecast.title')}
            </h2>
            <div className="space-y-3">
              {Array.from(forecastData.entries()).map(([parcelId, forecast]) => {
                const parcel = parcels.find(p => p.ID === parcelId)
                
                // Find the highest risk in the next 3 days
                const getHighestRisk = (forecastDays: { risk_level: string; days_ahead: number }[]) => {
                  const next3Days = forecastDays.filter(d => d.days_ahead <= 2)
                  const riskOrder = ['critical', 'high', 'moderate', 'low', 'none']
                  return next3Days.reduce((highest, day) => {
                    const currentIndex = riskOrder.indexOf(day.risk_level)
                    const highestIndex = riskOrder.indexOf(highest)
                    return currentIndex < highestIndex ? day.risk_level : highest
                  }, 'none')
                }

                const flyRisk = getHighestRisk(forecast.olive_fly_forecast)
                const spotRisk = getHighestRisk(forecast.peacock_spot_forecast)
                const hasHighRisk = flyRisk === 'critical' || flyRisk === 'high' || spotRisk === 'critical' || spotRisk === 'high'
                
                // Find if risk is increasing
                const flyTrend = forecast.olive_fly_forecast.find(d => d.days_ahead === 1)?.risk_trend
                const spotTrend = forecast.peacock_spot_forecast.find(d => d.days_ahead === 1)?.risk_trend

                const getRiskColor = (level: string) => {
                  switch (level) {
                    case 'critical': return 'bg-red-100 text-red-700 border-red-300'
                    case 'high': return 'bg-orange-100 text-orange-700 border-orange-300'
                    case 'moderate': return 'bg-amber-100 text-amber-700 border-amber-300'
                    case 'low': return 'bg-yellow-100 text-yellow-700 border-yellow-300'
                    default: return 'bg-green-100 text-green-700 border-green-300'
                  }
                }

                return (
                  <div 
                    key={parcelId} 
                    className={`p-3 rounded-lg border ${hasHighRisk ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-800">{parcel?.name || `Parcel ${parcelId}`}</h3>
                      {forecast.alerts.length > 0 && (
                        <span className="text-xs text-orange-600">{forecast.alerts.length} alert{forecast.alerts.length > 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <div className="flex gap-3">
                      {/* Olive Fly */}
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Bug size={12} className="text-amber-600" />
                          <span className="text-[10px] text-gray-500">{t('pests.pests.olive_fly')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getRiskColor(flyRisk)}`}>
                            {t(`pests.risk_levels.${flyRisk}`)}
                          </span>
                          {flyTrend === 'increasing' && <TrendingUp size={10} className="text-red-500" />}
                          {flyTrend === 'decreasing' && <TrendingDown size={10} className="text-green-500" />}
                        </div>
                      </div>
                      {/* Peacock Spot */}
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Leaf size={12} className="text-green-600" />
                          <span className="text-[10px] text-gray-500">{t('pests.pests.peacock_spot')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getRiskColor(spotRisk)}`}>
                            {t(`pests.risk_levels.${spotRisk}`)}
                          </span>
                          {spotTrend === 'increasing' && <TrendingUp size={10} className="text-red-500" />}
                          {spotTrend === 'decreasing' && <TrendingDown size={10} className="text-green-500" />}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-3">
              {t('forecast.peak_this_week')} • {t('dashboard.see_parcels_details')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard

