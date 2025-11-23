import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Trees, TreeDeciduous, Map as MapIcon, Activity, AlertTriangle, Droplets, Clock, Cloud, Thermometer, MapPin } from 'lucide-react'
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

function Dashboard() {
  const { } = useTranslation()
  const { loading: authLoading } = useAuth()
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [weatherData, setWeatherData] = useState<Map<number, WeatherData>>(new Map())
  const [irrigationData, setIrrigationData] = useState<Map<number, any>>(new Map())
  const [pestData, setPestData] = useState<Map<number, any[]>>(new Map())
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
      }
    } catch (err) {
      console.error('Failed to fetch parcels and weather', err)
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
      console.log('📋 Raw operations response:', data)
      if (Array.isArray(data)) {
        console.log('✅ Operations fetched:', data.length, 'operations')
        if (data.length > 0) {
          console.log('First operation:', data[0])
        }
        setOperations(data)
      } else {
        console.warn('⚠️ Operations response is not an array:', data)
        setOperations([])
      }
    } catch (err) {
      console.error('❌ Failed to fetch operations:', err)
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
            <h3 className="text-gray-500 text-sm font-medium">Total Parcels</h3>
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <MapIcon size={20} />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{parcels.length}</p>
            <p className="text-sm text-gray-500 mt-1">Orchards managed</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 text-sm font-medium">Total Area</h3>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Trees size={20} />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">
              {totalArea > 0 ? totalArea.toFixed(1) : '0'}
              <span className="text-lg text-gray-400 font-normal"> ha</span>
            </p>
            <p className="text-sm text-gray-500 mt-1">Olive cultivation</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 text-sm font-medium">Total Trees</h3>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <TreeDeciduous size={20} />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">
              {totalTrees > 0 ? totalTrees.toLocaleString() : '0'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {totalTrees > 0 ? `Across ${parcels.length} parcel${parcels.length !== 1 ? 's' : ''}` : 'No trees recorded'}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 text-sm font-medium">Operations</h3>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Activity size={20} />
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900">{activeOperations.length}</p>
              <p className="text-sm text-gray-500 mt-1">
                {activeOperations.length === 0 ? 'No active tasks' :
                  activeOperations.length === 1 ? '1 task planned' : 'Tasks planned'}
              </p>
            </div>
            {completedOperations.length > 0 && (
              <div className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                {completedOperations.length} completed
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
            Weather Overview
          </h2>

          {parcels.length > 0 ? (
            <div className="space-y-4">
              {/* Summary stats */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="flex items-center gap-3 mb-2">
                  <MapPin className="text-blue-600" size={20} />
                  <span className="font-semibold text-blue-900">{parcels.length} Parcels Monitored</span>
                </div>
                {minTemp !== null && maxTemp !== null && (
                  <p className="text-sm text-blue-700">
                    <Thermometer size={14} className="inline mr-1" />
                    Temp range: {minTemp.toFixed(1)}°C - {maxTemp.toFixed(1)}°C
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
                        Rain Expected
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        {parcelsWithRain} parcel{parcelsWithRain > 1 ? 's' : ''} expecting rain in next 24h
                      </p>
                      <p className="text-xs text-blue-600 mt-1">💡 Delay pesticide applications</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 p-4 rounded">
                  <p className="text-sm text-gray-600">
                    <Cloud size={16} className="inline mr-2" />
                    No rain forecast for any parcels
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
                        Irrigation Recommended
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        {parcelsNeedingIrrigation} parcel{parcelsNeedingIrrigation > 1 ? 's' : ''} with high ET0 and no rain
                      </p>
                      <p className="text-xs text-amber-600 mt-1">💡 Check soil moisture levels</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 p-4 rounded">
                  <p className="text-sm text-green-700">
                    <Droplets size={16} className="inline mr-2" />
                    All parcels have adequate water conditions
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center pt-2 border-t border-gray-100">
                View detailed weather per parcel in the Parcels page
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Cloud size={48} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No parcels yet</p>
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-6 text-gray-900 flex items-center gap-2">
            <Clock size={20} className="text-gray-400" />
            Recent Activities
          </h2>
          {recentOperations.length > 0 ? (
            <div className="space-y-6">
              {recentOperations.map((op, idx) => {
                const parcelName = parcels.find(p => p.ID === op.parcel_id)?.name || `Parcel #${op.parcel_id}`
                const isLast = idx === recentOperations.length - 1

                // Handle date parsing more robustly
                let daysSince = 0
                let timeAgo = 'Today'
                try {
                  const opDate = new Date(op.date || op.CreatedAt || 0)
                  if (!isNaN(opDate.getTime())) {
                    daysSince = Math.floor((Date.now() - opDate.getTime()) / (1000 * 60 * 60 * 24))
                    timeAgo = daysSince === 0 ? 'Today' :
                      daysSince === 1 ? 'Yesterday' :
                        daysSince < 0 ? 'Upcoming' :
                          `${daysSince} days ago`
                  }
                } catch (e) {
                  console.error('Date parsing error:', e, op)
                }

                // Use explicit classes for Tailwind (dynamic classes don't work)
                let dotClass = 'bg-blue-100 ring-blue-500' // default planned
                if (op.status === 'completed') {
                  dotClass = 'bg-green-100 ring-green-500'
                } else if (op.status === 'cancelled') {
                  dotClass = 'bg-gray-100 ring-gray-500'
                }

                const typeLabel = op.type ? op.type.replace('_', ' ') : 'Activity'
                const statusLabel = op.status === 'completed' ? 'Completed' :
                  op.status === 'cancelled' ? 'Cancelled' : 'Scheduled'

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
              <p className="text-sm">No operations logged yet</p>
              <p className="text-xs mt-1">Start tracking your orchard activities</p>
            </div>
          )}
        </div>

        {/* Alerts & Notifications */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-6 text-gray-900 flex items-center gap-2">
            <AlertTriangle size={20} className="text-gray-400" />
            Alerts & Notifications
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
                    <p className="text-sm font-medium text-amber-900">Low stock: {item.name}</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Only {item.quantity} {item.name.toLowerCase().includes('fertilizer') || item.name.toLowerCase().includes('pesticide') ? 'kg' : 'units'} remaining.
                      Minimum: {item.minimum_stock}
                    </p>
                  </div>
                </div>
              ))}

              {lowStockItems.length > 2 && (
                <div className="text-center">
                  <p className="text-xs text-gray-500">
                    + {lowStockItems.length - 2} more low stock item{lowStockItems.length - 2 > 1 ? 's' : ''}
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
                      <p className="text-sm font-bold text-red-900 uppercase tracking-wide">Critical Irrigation Needed</p>
                      <p className="text-xs text-red-700 mt-1 font-medium">
                        {parcel?.name || `Parcel ${parcelId}`}: {irrigation.recommended_amount?.toFixed(1)} mm
                        ({irrigation.recommended_liters_tree?.toFixed(0)} L/tree)
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        Water stress: {irrigation.stress_level || 'severe'} • Soil moisture: {irrigation.soil_moisture_estimate?.toFixed(0)}%
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
                    <p className="text-sm font-medium text-amber-900">Irrigation Recommended</p>
                    <p className="text-xs text-amber-700 mt-1">
                      {parcelsNeedingIrrigation - criticalIrrigationParcels.length} more parcel{parcelsNeedingIrrigation - criticalIrrigationParcels.length > 1 ? 's' : ''} need{parcelsNeedingIrrigation - criticalIrrigationParcels.length === 1 ? 's' : ''} irrigation. Check Parcels page for details.
                    </p>
                  </div>
                </div>
              )}

              {/* Pest Risk alerts - Critical/High only */}
              {criticalPestRisks.length > 0 && criticalPestRisks.slice(0, 2).map(({ parcelId, assessment }) => {
                const parcel = parcels.find(p => p.ID === parcelId)
                const pestNameMap: any = {
                  'olive_fly': 'Olive Fruit Fly',
                  'peacock_spot': 'Peacock Spot',
                  'verticillium': 'Verticillium Wilt',
                  'olive_knot': 'Olive Knot',
                  'anthracnose': 'Anthracnose'
                }
                const isCritical = assessment.risk_level === 'critical'
                return (
                  <div key={`${parcelId}-${assessment.pest_type}`} className={`${isCritical ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'} border p-4 rounded-lg flex gap-4`}>
                    <div className="mt-1">
                      <AlertTriangle size={20} className={isCritical ? 'text-red-600' : 'text-orange-600'} />
                    </div>
                    <div className="flex-grow">
                      <p className={`text-sm font-bold uppercase tracking-wide ${isCritical ? 'text-red-900' : 'text-orange-900'}`}>
                        {isCritical ? 'Critical' : 'High'} Pest Risk
                      </p>
                      <p className={`text-xs mt-1 font-medium ${isCritical ? 'text-red-700' : 'text-orange-700'}`}>
                        {parcel?.name || `Parcel ${parcelId}`}: {pestNameMap[assessment.pest_type] || assessment.pest_type}
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
                  <p className="text-sm font-medium text-green-800">✅ All systems good</p>
                  <p className="text-xs text-green-600 mt-1">No urgent actions needed</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400">
              <AlertTriangle size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No alerts at this time</p>
              <p className="text-xs mt-1">All systems operating normally</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard

