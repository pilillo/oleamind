import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap, LayersControl, ImageOverlay, useMapEvents, LayerGroup } from 'react-leaflet'
// @ts-ignore
import { EditControl } from 'react-leaflet-draw'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw' // Ensure L.Draw is attached to L
import { TreeDeciduous, MapPin, Ruler, Trash2, Edit2, Save, X, Plus, Satellite, Cloud, MousePointerClick, Trees, Droplets, Wind, Thermometer, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiCall } from '../config'
import { useAuth } from '../contexts/AuthContext'
import { SatelliteInsights } from '../components/satellite/SatelliteInsights'
import { RiskForecastPanel } from '../components/pests/RiskForecastPanel'
import { ClimateProfileCard } from '../components/climate/ClimateProfileCard'
import { WeatherAdvisoryPanel } from '../components/weather/WeatherAdvisoryPanel'

// Helper function to convert month number to name
const getMonthName = (month: number): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[month - 1] || 'Unknown'
}

// Component to handle map zoom to bounds
function MapController({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap()

  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [100, 100],
        maxZoom: 18  // Prevent zooming in too close
      })
    }
  }, [bounds, map])

  return null
}

// Component to handle programmatic drawing
function DrawingManager({ isCreating, onCreated }: { isCreating: boolean, onCreated: (e: any) => void }) {
  const map = useMap()
  const drawHandlerRef = useRef<any>(null)

  useEffect(() => {
    if (isCreating) {
      // Initialize drawing tool
      // @ts-ignore - L.Draw types might be missing
      drawHandlerRef.current = new L.Draw.Polygon(map, {
        shapeOptions: {
          color: '#3b82f6',
          weight: 3,
          fillOpacity: 0.3
        },
        // allowIntersection: false, // Removing this as it can cause issues with drawing
        showArea: true
      })

      drawHandlerRef.current.enable()

      const handleCreated = (e: any) => {
        // Pass the event to parent handler
        onCreated(e)
        // Disable drawing after first polygon
        if (drawHandlerRef.current) {
          drawHandlerRef.current.disable()
        }
      }

      map.on(L.Draw.Event.CREATED, handleCreated)

      return () => {
        map.off(L.Draw.Event.CREATED, handleCreated)
        if (drawHandlerRef.current) {
          drawHandlerRef.current.disable()
        }
      }
    } else {
      if (drawHandlerRef.current) {
        drawHandlerRef.current.disable()
      }
    }
  }, [isCreating, map, onCreated])

  return null
}

// Component to handle map clicks for tree positioning
function MapClickHandler({ onMapClick, enabled }: { onMapClick: (latlng: L.LatLng) => void, enabled: boolean }) {
  const map = useMapEvents({
    click: (e) => {
      if (enabled) {
        onMapClick(e.latlng)
      }
    }
  })

  // Change cursor when in drawing mode
  useEffect(() => {
    if (map) {
      const container = map.getContainer()
      if (enabled) {
        container.style.cursor = 'crosshair'
      } else {
        container.style.cursor = ''
      }
    }
  }, [enabled, map])

  return null
}

function Parcels() {
  const { user } = useAuth()
  const [parcels, setParcels] = useState<any[]>([])
  const [selectedParcel, setSelectedParcel] = useState<any>(null)
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null)
  const [ndviData, setNdviData] = useState<any>(null)
  const [showNdviLayer, setShowNdviLayer] = useState(true)
  const [selectedSatelliteIndex, setSelectedSatelliteIndex] = useState<'ndvi' | 'ndwi' | 'ndmi' | 'evi'>('ndvi')
  const [weatherData, setWeatherData] = useState<any>(null)
  const [satelliteLastUpdated, setSatelliteLastUpdated] = useState<number>(0)
  // Irrigation and pest data now handled by unified Weather Advisory
  // const [irrigationData, setIrrigationData] = useState<any>(null)
  // const [pestData, setPestData] = useState<any>(null)
  const [climateProfile, setClimateProfile] = useState<any>(null)
  const [climateLoading, setClimateLoading] = useState(false)
  const [showInfoPanel, setShowInfoPanel] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'operations' | 'monitoring'>('operations')
  
  // Right sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(400)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  
  // Left sidebar state
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false)
  
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editArea, setEditArea] = useState('')
  const [editTrees, setEditTrees] = useState('')
  // New state for varieties
  const [editVarieties, setEditVarieties] = useState<any[]>([])
  // Drawing mode state
  const [drawingVarietyIndex, setDrawingVarietyIndex] = useState<number | null>(null)
  // New Parcel Creation State
  const [isCreating, setIsCreating] = useState(false)
  const [newParcelGeometry, setNewParcelGeometry] = useState<any>(null)
  const [newParcelName, setNewParcelName] = useState('')
  const [newParcelArea, setNewParcelArea] = useState('')
  const [newParcelTrees, setNewParcelTrees] = useState('')
  const [selectedFarmId, setSelectedFarmId] = useState<number>(0)

  // Get user's accessible farms
  const userFarms = user?.farms || []

  // Set default farm when farms are loaded
  useEffect(() => {
    if (userFarms.length > 0 && selectedFarmId === 0) {
      setSelectedFarmId(userFarms[0].id)
    }
  }, [userFarms, selectedFarmId])

  useEffect(() => {
    fetchParcels()
  }, [])

  // Update edit fields when selectedParcel changes
  useEffect(() => {
    if (selectedParcel) {
      setEditName(selectedParcel.name || '')
      setEditArea(selectedParcel.area || '')
      setEditTrees(selectedParcel.trees_count || '')
      setEditVarieties(selectedParcel.varieties || [])
      setIsEditing(false)
      setDrawingVarietyIndex(null) // Reset drawing mode
    }
  }, [selectedParcel])

  // Auto-sum trees when varieties change in edit mode
  useEffect(() => {
    if (isEditing) {
      // If we have varieties, sum their trees
      if (editVarieties.length > 0) {
        const totalTrees = editVarieties.reduce((sum, v) => {
          // Prefer the calculated count from geometry if available
          const geoCount = v.geojson ? getTreeCount(v.geojson) : 0
          // Fallback to manual count if no geometry (though we removed manual input)
          // But wait, 'tree_count' in state is just a number/string. 
          // We should prioritize geometry count.
          return sum + geoCount
        }, 0)
        setEditTrees(totalTrees.toString())
      }
    }
  }, [editVarieties, isEditing])

  const fetchParcels = async () => {
    try {
      const response = await apiCall(`/parcels`)
      const data = await response.json()
      if (Array.isArray(data)) {
        setParcels(data)

        // Calculate bounds for all parcels
        if (data.length > 0) {
          const bounds = L.latLngBounds([])
          data.forEach((parcel: any) => {
            if (parcel.geojson) {
              const geojson = typeof parcel.geojson === 'string'
                ? JSON.parse(parcel.geojson)
                : parcel.geojson
              const layer = L.geoJSON(geojson)
              bounds.extend(layer.getBounds())
            }
          })
          setMapBounds(bounds)
        }
      }
    } catch (err) {
      console.error('Failed to fetch parcels', err)
    }
  }

  const zoomToParcel = (parcel: any) => {
    setSelectedParcel(parcel)
    setShowInfoPanel(true) // Show panel when selecting a parcel

    // Clear old data to prevent showing wrong data
    setNdviData(null)
    setWeatherData(null)
    setClimateProfile(null)

    // Automatically fetch NDVI data for this parcel
    processSatellite(parcel.ID)

    // Fetch weather data for this parcel
    fetchWeather(parcel.ID)

    // Fetch climate profile for this parcel
    fetchClimateProfile(parcel.ID)
    
    // Note: Irrigation and pest data now handled by WeatherAdvisoryPanel component

    if (parcel.geojson) {
      try {
        const geojson = typeof parcel.geojson === 'string'
          ? JSON.parse(parcel.geojson)
          : parcel.geojson
        const layer = L.geoJSON(geojson)
        setMapBounds(layer.getBounds())
      } catch (e) {
        console.error('Failed to parse GeoJSON', e)
      }
    }
  }

  const fetchWeather = async (parcelId: number) => {
    try {
      const response = await apiCall(`/parcels/${parcelId}/weather`)
      const data = await response.json()
      setWeatherData(data)
    } catch (err) {
      console.error('Failed to fetch weather for parcel', parcelId, err)
    }
  }

  // fetchIrrigation removed - now handled by WeatherAdvisoryPanel

  const fetchClimateProfile = async (parcelId: number) => {
    setClimateLoading(true)
    try {
      const response = await apiCall(`/climate/${parcelId}`)
      if (response.ok) {
        const data = await response.json()
        setClimateProfile(data)
      } else {
        setClimateProfile(null)
      }
    } catch (err) {
      console.error('Failed to fetch climate profile for parcel', parcelId, err)
      setClimateProfile(null)
    } finally {
      setClimateLoading(false)
    }
  }

  const refreshClimateProfile = async (parcelId: number) => {
    setClimateLoading(true)
    try {
      const response = await apiCall(`/climate/${parcelId}/refresh`, { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        setClimateProfile(data.profile)
      }
    } catch (err) {
      console.error('Failed to refresh climate profile', err)
    } finally {
      setClimateLoading(false)
    }
  }

  // fetchPestRisk removed - now handled by RiskForecastPanel

  const _onCreated = useCallback((e: any) => {
    const layer = e.layer
    const geojsonFeature = layer.toGeoJSON()
    const geometry = geojsonFeature.geometry

    // Calculate Area
    let areaHa = ''
    try {
      const latlngs = layer.getLatLngs()
      if (latlngs && latlngs.length > 0) {
        // @ts-ignore
        const areaSqMeters = L.GeometryUtil.geodesicArea(latlngs[0])
        areaHa = (areaSqMeters / 10000).toFixed(2)
      }
    } catch (err) {
      console.error("Error calculating area:", err)
    }

    // Instead of saving immediately, open the modal
    setNewParcelGeometry(geometry)
    setNewParcelName(`Parcel ${parcels.length + 1}`)
    setNewParcelArea(areaHa)
    setNewParcelTrees('')

    // Remove the layer from the map so we don't have duplicates when we save/cancel
    // With DrawingManager, we don't need to remove from FeatureGroup ref, but we might
    // need to ensure the map doesn't keep it if L.Draw adds it automatically.
    if (layer && layer._map) {
      layer._map.removeLayer(layer)
    }
  }, [parcels.length])

  const handleSaveNewParcel = async () => {
    if (!newParcelGeometry) return

    // Validate farm selection
    if (selectedFarmId === 0) {
      toast.error('Please select a farm')
      return
    }

    try {
      const response = await apiCall(`/parcels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newParcelName,
          farm_id: selectedFarmId,
          geojson: newParcelGeometry,
          area: parseFloat(newParcelArea) || 0,
          trees_count: parseInt(newParcelTrees) || 0,
        }),
      })

      if (response.ok) {
        await fetchParcels()
        // Reset creation state
        setNewParcelGeometry(null)
        setIsCreating(false)
        setNewParcelName('')
        setNewParcelArea('')
        setNewParcelTrees('')
        // Reset to first farm
        if (userFarms.length > 0) {
          setSelectedFarmId(userFarms[0].id)
        }
      } else {
        const error = await response.json()
        toast.error(`Failed to create parcel: ${error.error || 'Unknown error'}`)
      }
    } catch {
      toast.error('Failed to create parcel')
    }
  }

  const handleCancelCreation = () => {
    setNewParcelGeometry(null)
    setIsCreating(false)
    setNewParcelName('')
    setNewParcelArea('')
    setNewParcelTrees('')
    // Reset to first farm
    if (userFarms.length > 0) {
      setSelectedFarmId(userFarms[0].id)
    }
  }

  const handleUpdateParcel = async () => {
    if (!selectedParcel) return

    // Clean up varieties for submission and auto-calculate tree_count from geometry
    const varietiesToSubmit = editVarieties.map(v => ({
      ...v,
      tree_count: v.geojson ? getTreeCount(v.geojson) : 0,  // Auto-calculate from geometry
      area: parseFloat(v.area) || 0
    }))

    const payload = {
      ...selectedParcel,
      name: editName,
      area: parseFloat(editArea) || 0,
      trees_count: parseInt(editTrees) || 0,
      varieties: varietiesToSubmit
    }

    try {
      const response = await apiCall(`/parcels/${selectedParcel.ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const updatedParcel = await response.json()
        setParcels(parcels.map(p => p.ID === updatedParcel.ID ? updatedParcel : p))
        setSelectedParcel(updatedParcel)
        setIsEditing(false)
        setDrawingVarietyIndex(null) // Reset drawing mode
      } else {
        const errorText = await response.text()
        toast.error('Failed to update parcel: ' + errorText)
      }
    } catch {
      toast.error('Failed to update parcel')
    }
  }

  const handleDeleteParcel = async () => {
    if (!selectedParcel || !window.confirm('Are you sure you want to delete this parcel?')) return

    try {
      const response = await apiCall(`/parcels/${selectedParcel.ID}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setParcels(parcels.filter(p => p.ID !== selectedParcel.ID))
        setSelectedParcel(null)
        setShowInfoPanel(false)
        setNdviData(null)
      } else {
        toast.error('Failed to delete parcel')
      }
    } catch {
      toast.error('Failed to delete parcel')
    }
  }

  const processSatellite = async (parcelId: number) => {
    try {
      const response = await apiCall(`/parcels/${parcelId}/satellite`, {
        method: 'POST',
      })
      const data = await response.json()

      if (data.status === 'success') {
        setNdviData({ ...data, parcelId })
        setSatelliteLastUpdated(Date.now())
        // Data is displayed in the panel automatically
      }
    } catch {
      // Silent failure - user will see no NDVI data in panel
    }
  }

  const handleAddVariety = () => {
    const newIndex = editVarieties.length
    setEditVarieties([...editVarieties, { cultivar: '', tree_count: 0, area: 0, planting_date: '', location: '' }])
    // Automatically enter drawing mode for the new variety
    setDrawingVarietyIndex(newIndex)
  }

  const handleRemoveVariety = (index: number) => {
    const newVarieties = [...editVarieties]
    newVarieties.splice(index, 1)
    setEditVarieties(newVarieties)
  }

  const handleVarietyChange = (index: number, field: string, value: any) => {
    const newVarieties = [...editVarieties]
    newVarieties[index] = { ...newVarieties[index], [field]: value }
    setEditVarieties(newVarieties)
  }

  const startDrawingForVariety = (index: number) => {
    // Toggle drawing mode - if already drawing for this variety, exit
    if (drawingVarietyIndex === index) {
      setDrawingVarietyIndex(null)
    } else {
      setDrawingVarietyIndex(index)
    }
  }

  // Helper function: Point-in-polygon algorithm (ray casting)
  const isPointInPolygon = (point: L.LatLng, polygon: L.LatLng[]): boolean => {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lat, yi = polygon[i].lng
      const xj = polygon[j].lat, yj = polygon[j].lng

      const intersect = ((yi > point.lng) !== (yj > point.lng))
        && (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  const handleMapClick = useCallback((latlng: L.LatLng) => {
    if (drawingVarietyIndex === null) {
      return
    }

    // Validate that the clicked point is inside the parcel boundary
    if (selectedParcel && selectedParcel.geojson) {
      try {
        const parcelGeojson = typeof selectedParcel.geojson === 'string'
          ? JSON.parse(selectedParcel.geojson)
          : selectedParcel.geojson

        // Extract polygon coordinates from GeoJSON
        let isInside = false
        if (parcelGeojson.type === 'Polygon') {
          const coords = parcelGeojson.coordinates[0] // Outer ring
          const polygonLatLngs = coords.map((c: number[]) => L.latLng(c[1], c[0]))
          isInside = isPointInPolygon(latlng, polygonLatLngs)
        }

        if (!isInside) {
          toast.error('Trees can only be placed inside the parcel boundary')
          return
        }
      } catch (e) {
        console.error('Error validating point location:', e)
      }
    }

    // Create a Point geometry from the clicked location
    const pointGeometry = {
      type: 'Point',
      coordinates: [latlng.lng, latlng.lat]
    }

    // Use functional setState to ensure we have the latest state
    setEditVarieties(prevVarieties => {
      const newVarieties = [...prevVarieties]
      const currentVariety = newVarieties[drawingVarietyIndex]

      // If there's already geometry, we need to combine them
      if (currentVariety.geojson) {
        const existingGeojson = typeof currentVariety.geojson === 'string'
          ? JSON.parse(currentVariety.geojson)
          : currentVariety.geojson

        // Create or update GeometryCollection
        if (existingGeojson.type === 'GeometryCollection') {
          // Don't mutate! Create a new GeometryCollection
          newVarieties[drawingVarietyIndex] = {
            ...currentVariety,
            geojson: {
              type: 'GeometryCollection',
              geometries: [...existingGeojson.geometries, pointGeometry]
            }
          }
        } else if (existingGeojson.type === 'Point') {
          // Convert single Point to GeometryCollection
          newVarieties[drawingVarietyIndex] = {
            ...currentVariety,
            geojson: {
              type: 'GeometryCollection',
              geometries: [existingGeojson, pointGeometry]
            }
          }
        } else {
          // Existing geometry is polygon or something else, add to collection
          newVarieties[drawingVarietyIndex] = {
            ...currentVariety,
            geojson: {
              type: 'GeometryCollection',
              geometries: [existingGeojson, pointGeometry]
            }
          }
        }
      } else {
        // First geometry for this variety
        newVarieties[drawingVarietyIndex] = {
          ...currentVariety,
          geojson: pointGeometry
        }
      }

      return newVarieties
    })
  }, [drawingVarietyIndex, selectedParcel])

  const clearVarietyGeometry = (index: number) => {
    const newVarieties = [...editVarieties]
    // Add a timestamp to force re-render
    newVarieties[index] = {
      ...newVarieties[index],
      geojson: null,
      _cleared: Date.now() // Force unique key generation
    }
    setEditVarieties(newVarieties)
  }

  const getTreeCount = (geojson: any) => {
    if (!geojson) return 0
    const parsed = typeof geojson === 'string' ? JSON.parse(geojson) : geojson
    if (parsed.type === 'Point') return 1
    if (parsed.type === 'GeometryCollection') {
      // Only count Points as trees, ignore Polygons (zones)
      return parsed.geometries.filter((g: any) => g.type === 'Point').length
    }
    return 0
  }

  // Resize handlers for right sidebar
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      // Clamp between 320px and 600px
      setSidebarWidth(Math.min(600, Math.max(320, newWidth)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    // Set cursor globally during resize
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev)
  }, [])

  return (
    <div className="h-full flex">
      {/* Left Sidebar - Parcel List */}
      <div 
        className={`bg-white border-r border-gray-200 flex flex-col h-full shadow-xl z-10 transition-all duration-300 ${
          isLeftSidebarCollapsed ? 'w-14' : 'w-80'
        }`}
      >
        {/* Collapsed View */}
        {isLeftSidebarCollapsed ? (
          <div className="flex flex-col items-center py-4 h-full">
            <button
              onClick={() => setIsLeftSidebarCollapsed(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors mb-4"
              title="Expand sidebar"
            >
              <ChevronRight size={20} className="text-gray-600" />
            </button>
            
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-col items-center">
                <MapPin size={18} className="text-green-600 mb-1" />
                <span className="text-xs font-bold text-gray-700">{parcels.length}</span>
              </div>
              
              <button
                onClick={() => {
                  setIsLeftSidebarCollapsed(false)
                  setIsCreating(!isCreating)
                  setSelectedParcel(null)
                  setShowInfoPanel(false)
                }}
                className={`p-2 rounded-lg transition-all ${isCreating
                  ? 'bg-gray-200 text-gray-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
                }`}
                title={isCreating ? 'Cancel' : 'Add Parcel'}
              >
                {isCreating ? <X size={16} /> : <Plus size={16} />}
              </button>
            </div>
            
            {/* Mini parcel indicators */}
            <div className="flex-1 overflow-y-auto mt-4 w-full px-2">
              {parcels.map((parcel: any) => (
                <button
                  key={parcel.ID}
                  onClick={() => zoomToParcel(parcel)}
                  className={`w-full p-2 mb-1 rounded-lg transition-all ${
                    selectedParcel?.ID === parcel.ID
                      ? 'bg-green-100 border-2 border-green-500'
                      : 'hover:bg-gray-100 border-2 border-transparent'
                  }`}
                  title={parcel.name}
                >
                  <div className={`w-2 h-2 rounded-full mx-auto ${
                    selectedParcel?.ID === parcel.ID ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Expanded View */
          <>
            <div className="p-5 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <MapPin size={18} className="text-green-600" />
                  Parcels
                </h2>
                <div className="flex items-center gap-2">
                  <span className="bg-white px-2 py-1 rounded-md text-xs font-medium text-gray-500 border border-gray-200 shadow-sm">
                    {parcels.length}
                  </span>
                  <button
                    onClick={() => setIsLeftSidebarCollapsed(true)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                    title="Collapse sidebar"
                  >
                    <ChevronLeft size={18} className="text-gray-500" />
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsCreating(!isCreating)
                  setSelectedParcel(null) // Deselect any parcel
                  setShowInfoPanel(false)
                }}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isCreating
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-green-600 text-white hover:bg-green-700 shadow-sm hover:shadow'
                }`}
              >
                {isCreating ? (
                  <>
                    <X size={16} /> Cancel Creation
                  </>
                ) : (
                  <>
                    <Plus size={16} /> Add New Parcel
                  </>
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
              {isCreating && !newParcelGeometry && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center animate-pulse">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <MousePointerClick size={20} className="text-blue-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-blue-800 mb-1">Draw on Map</h3>
                  <p className="text-xs text-blue-600">
                    Use the drawing tools on the map to outline your new parcel.
                  </p>
                </div>
              )}

              {parcels.map((parcel: any) => (
                <div
                  key={parcel.ID}
                  onClick={() => zoomToParcel(parcel)}
                  className={`group relative p-4 rounded-xl cursor-pointer transition-all duration-200 border ${selectedParcel?.ID === parcel.ID
                    ? 'bg-white border-green-500 shadow-md ring-1 ring-green-500/20'
                    : 'bg-white border-gray-200 hover:border-green-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className={`font-semibold text-sm ${selectedParcel?.ID === parcel.ID ? 'text-green-700' : 'text-gray-700 group-hover:text-green-600'}`}>
                      {parcel.name}
                    </h3>
                    {parcel.geojson && <span className="flex h-2 w-2 rounded-full bg-green-500"></span>}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Ruler size={12} />
                      <span>{parcel.area ? `${parcel.area.toFixed(2)} ha` : '-'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TreeDeciduous size={12} />
                      <span>{parcel.trees_count || 0} trees</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Map */}
      <div className="flex-grow relative">
        <MapContainer center={[41.9028, 12.4964]} zoom={6} maxZoom={20} style={{ height: '100%', width: '100%' }}>
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="OpenStreetMap">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'
                maxZoom={19}
                maxNativeZoom={19}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite with Labels">
              <LayerGroup>
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                  maxZoom={20}
                  maxNativeZoom={18}
                />
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                  attribution='&copy; Esri'
                  maxZoom={19}
                />
              </LayerGroup>
            </LayersControl.BaseLayer>
          </LayersControl>
          <MapController bounds={mapBounds} />

          {/* Map click handler for tree positioning */}
          <MapClickHandler
            onMapClick={handleMapClick}
            enabled={drawingVarietyIndex !== null}
          />

          {/* Main parcel drawing control - only active when creating a parcel AND NOT drawing variety geometries */}
          {isCreating && drawingVarietyIndex === null && (
            <DrawingManager isCreating={isCreating} onCreated={_onCreated} />
          )}

          {parcels.map((parcel: any) => {
            if (parcel.geojson) {
              try {
                const geojson = typeof parcel.geojson === 'string'
                  ? JSON.parse(parcel.geojson)
                  : parcel.geojson

                // Check if this parcel has NDVI data
                const hasNdviOverlay = ndviData &&
                  ndviData.parcelId === parcel.ID &&
                  ndviData.ndvi_image

                return (
                  <React.Fragment key={parcel.ID}>
                    <GeoJSON
                      data={geojson}
                      style={() => ({
                        color: selectedParcel?.ID === parcel.ID ? '#22c55e' : '#3b82f6',
                        fillColor: hasNdviOverlay ? 'transparent' : (selectedParcel?.ID === parcel.ID ? '#86efac' : '#93c5fd'),
                        fillOpacity: hasNdviOverlay ? 0 : 0.4,
                        weight: 3
                      })}
                      eventHandlers={{
                        click: () => zoomToParcel(parcel)
                      }}
                    />

                    {/* Render variety geometries for this parcel */}
                    {/* Display existing varieties from saved parcel (only when NOT editing) */}
                    {!isEditing && selectedParcel?.ID === parcel.ID && parcel.varieties && parcel.varieties.map((variety: any, vIdx: number) => {
                      if (variety.geojson) {
                        try {
                          const varietyGeojson = typeof variety.geojson === 'string'
                            ? JSON.parse(variety.geojson)
                            : variety.geojson

                          // Generate a color based on variety index
                          const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']
                          const color = colors[vIdx % colors.length]

                          // Create unique key for re-rendering
                          const treeCount = getTreeCount(variety.geojson)
                          const uniqueKey = `variety-${variety.ID || vIdx}-trees-${treeCount}`

                          return (
                            <GeoJSON
                              key={uniqueKey}
                              data={varietyGeojson}
                              pointToLayer={(_feature, latlng) => {
                                return L.circleMarker(latlng, {
                                  radius: 6,
                                  fillColor: color,
                                  color: '#fff',
                                  weight: 2,
                                  opacity: 1,
                                  fillOpacity: 0.8
                                })
                              }}
                              style={() => ({
                                color: color,
                                fillColor: color,
                                fillOpacity: 0.3,
                                weight: 2
                              })}
                            />
                          )
                        } catch (e) {
                          console.error('Failed to parse variety GeoJSON', e)
                        }
                      }
                      return null
                    })}

                    {/* Render edit-mode variety geometries */}
                    {isEditing && selectedParcel?.ID === parcel.ID && editVarieties.map((variety: any, vIdx: number) => {
                      const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']
                      const color = colors[vIdx % colors.length]

                      // Create a unique key that changes when geometry is cleared
                      const treeCount = variety.geojson ? getTreeCount(variety.geojson) : 0
                      const clearedMarker = variety._cleared || 0
                      const uniqueKey = `edit-variety-${vIdx}-trees-${treeCount}-cleared-${clearedMarker}`

                      // Only render if there's geometry
                      if (!variety.geojson) {
                        // Return null but with a key to ensure React knows to unmount previous layer
                        return <React.Fragment key={uniqueKey} />
                      }

                      try {
                        const varietyGeojson = typeof variety.geojson === 'string'
                          ? JSON.parse(variety.geojson)
                          : variety.geojson

                        return (
                          <GeoJSON
                            key={uniqueKey}
                            data={varietyGeojson}
                            pointToLayer={(_feature, latlng) => {
                              return L.circleMarker(latlng, {
                                radius: 6,
                                fillColor: color,
                                color: '#fff',
                                weight: 2,
                                opacity: 1,
                                fillOpacity: 0.8
                              })
                            }}
                            style={() => ({
                              color: color,
                              fillColor: color,
                              fillOpacity: 0.3,
                              weight: 2
                            })}
                          />
                        )
                      } catch (e) {
                        console.error('Failed to parse edit variety GeoJSON', e)
                        return <React.Fragment key={uniqueKey} />
                      }
                    })}

                    {/* Hide NDVI overlay when drawing variety geometries or when user toggles it off */}
                    {hasNdviOverlay && showNdviLayer && drawingVarietyIndex === null && (() => {
                      // Use exact image bounds from backend if available to fix alignment issues
                      // Otherwise fallback to parcel bounds
                      let imageBounds: L.LatLngBoundsExpression

                      if (ndviData.image_bounds) {
                        // Backend returns [min_lon, min_lat, max_lon, max_lat]
                        // Leaflet expects [[min_lat, min_lon], [max_lat, max_lon]]
                        const [minLon, minLat, maxLon, maxLat] = ndviData.image_bounds
                        imageBounds = [[minLat, minLon], [maxLat, maxLon]]
                      } else {
                        const layer = L.geoJSON(geojson)
                        imageBounds = layer.getBounds()
                      }

                      return (
                        <ImageOverlay
                          url={selectedSatelliteIndex === 'ndvi' ? ndviData.ndvi_image :
                            selectedSatelliteIndex === 'ndwi' ? ndviData.ndwi_image :
                              selectedSatelliteIndex === 'ndmi' ? ndviData.ndmi_image :
                                ndviData.evi_image}
                          bounds={imageBounds}
                          opacity={0.7}
                          zIndex={1000}
                        />
                      )
                    })()}
                  </React.Fragment>
                )
              } catch (e) {
                console.error('Failed to parse GeoJSON', e)
              }
            }
            return null
          })}
        </MapContainer>

        {/* NDVI Date Badge & Toggle - Only visible when the relevant parcel is selected */}
        {ndviData && ndviData.ndvi_image && selectedParcel && ndviData.parcelId === selectedParcel.ID && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3 z-[1000]">
            <div className="bg-indigo-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              <span className="text-sm">📡</span>
              <div className="text-sm font-semibold">
                Satellite Image: {new Date(ndviData.product_date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </div>
              <span className="text-xs opacity-80">
                ({ndviData.satellite})
              </span>
            </div>

            {/* Layer Controls */}
            <div className="bg-white rounded-full shadow-lg flex items-center p-1 gap-1">
              {(['ndvi', 'ndwi', 'ndmi', 'evi'] as const).map((index) => (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedSatelliteIndex(index)
                    setShowNdviLayer(true)
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${showNdviLayer && selectedSatelliteIndex === index
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  {index.toUpperCase()}
                </button>
              ))}

              <div className="w-px h-4 bg-gray-300 mx-1"></div>

              <button
                onClick={() => setShowNdviLayer(!showNdviLayer)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${!showNdviLayer
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
                  }`}
                title={showNdviLayer ? 'Hide Layer' : 'Show Layer'}
              >
                {showNdviLayer ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>
        )}

        {/* New Parcel Creation Modal */}
        {newParcelGeometry && (
          <div className="absolute top-4 right-4 bg-white p-5 rounded-xl shadow-2xl w-80 z-[2000] border border-gray-200">
            <div className="flex items-center gap-2 mb-4 text-green-700">
              <MapPin size={20} />
              <h3 className="font-bold text-lg">New Parcel Details</h3>
            </div>

            <div className="space-y-3">
              {/* Farm Selection - only show if user has multiple farms */}
              {userFarms.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Farm <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedFarmId}
                    onChange={(e) => setSelectedFarmId(parseInt(e.target.value))}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    {userFarms.map((farm) => (
                      <option key={farm.id} value={farm.id}>
                        {farm.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                <input
                  type="text"
                  value={newParcelName}
                  onChange={(e) => setNewParcelName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="e.g. North Field"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Estimated Area (ha)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newParcelArea}
                  onChange={(e) => setNewParcelArea(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Estimated Trees</label>
                <input
                  type="number"
                  value={newParcelTrees}
                  onChange={(e) => setNewParcelTrees(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveNewParcel}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 shadow-sm transition-colors"
              >
                Create Parcel
              </button>
              <button
                onClick={handleCancelCreation}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Toggle button to reopen sidebar if collapsed and parcel is selected */}
        {selectedParcel && isSidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="absolute top-1/2 right-0 -translate-y-1/2 bg-white border border-gray-200 border-r-0 p-2 rounded-l-lg shadow-lg hover:bg-gray-50 z-[1000] transition-all"
            title="Expand panel"
          >
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
        )}
      </div>

      {/* Right Sidebar - Info Panel */}
      {selectedParcel && !isSidebarCollapsed && (
        <div 
          ref={sidebarRef}
          className="h-full bg-white border-l border-gray-200 flex flex-col relative transition-all duration-300"
          style={{ width: sidebarWidth, minWidth: 320, maxWidth: 600 }}
        >
          {/* Resize Handle */}
          <div
            onMouseDown={handleResizeStart}
            className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors z-10 ${isResizing ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-300'}`}
          />
          
          {/* Collapse Toggle Button */}
          <button
            onClick={toggleSidebar}
            className="absolute -left-3 top-4 bg-white border border-gray-200 p-1 rounded-full shadow-md hover:bg-gray-50 z-20 transition-all"
            title="Collapse panel"
          >
            <ChevronRight size={16} className="text-gray-600" />
          </button>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="flex justify-between items-start mb-4">
              {isEditing ? (
                <div className="flex-grow mr-2 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Parcel Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                      placeholder="Enter name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Area (ha)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={editArea}
                          readOnly
                          className="w-full border border-gray-200 rounded-lg pl-3 pr-2 py-2 text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                          title="Area is automatically calculated from the parcel polygon"
                        />
                        <span className="absolute right-3 top-2 text-gray-400 text-xs">📐 auto</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Trees</label>
                      <input
                        type="number"
                        value={editTrees}
                        onChange={(e) => setEditTrees(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4 mt-2">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-xs font-bold text-gray-700 flex items-center gap-1">
                        <TreeDeciduous size={14} />
                        Varieties & Layout
                      </label>
                      <button
                        onClick={handleAddVariety}
                        className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-100 font-medium flex items-center gap-1 transition-colors"
                      >
                        <Plus size={12} /> Add
                      </button>
                    </div>

                    <div className="space-y-3">
                      {editVarieties.map((variety, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm text-xs hover:border-gray-300 transition-colors">
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2 flex-grow">
                              <span className="font-mono font-medium text-gray-400 bg-gray-50 px-1.5 rounded">#{idx + 1}</span>
                              <input
                                placeholder="Variety name (e.g. Picual)"
                                value={variety.cultivar}
                                onChange={(e) => handleVarietyChange(idx, 'cultivar', e.target.value)}
                                className="flex-grow border-b border-gray-200 focus:border-green-500 px-1 py-1 text-sm outline-none bg-transparent"
                                autoFocus={drawingVarietyIndex === idx}
                              />
                            </div>
                            <button
                              onClick={() => handleRemoveVariety(idx)}
                              className="text-gray-400 hover:text-red-500 ml-2 transition-colors"
                              title="Remove variety"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                            {drawingVarietyIndex === idx ? (
                              <div className="flex items-center gap-2 w-full justify-between animate-pulse">
                                <span className="text-xs text-green-700 flex items-center gap-1 font-medium">
                                  <MousePointerClick size={12} />
                                  Click map to place trees
                                </span>
                                <button
                                  onClick={() => setDrawingVarietyIndex(null)}
                                  className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-md hover:bg-green-600 font-medium shadow-sm"
                                >
                                  Done
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 w-full justify-between">
                                <button
                                  onClick={() => startDrawingForVariety(idx)}
                                  className="text-xs bg-white text-indigo-600 px-3 py-1.5 rounded-md border border-gray-200 hover:border-indigo-300 hover:text-indigo-700 font-medium flex items-center gap-1 transition-all shadow-sm"
                                >
                                  <MapPin size={12} /> Draw
                                </button>
                                {variety.geojson && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 font-medium">
                                      {getTreeCount(variety.geojson)} trees
                                    </span>
                                    <button
                                      onClick={() => clearVarietyGeometry(idx)}
                                      className="text-xs text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                                      title="Clear all trees"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {editVarieties.length === 0 && (
                        <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                          <TreeDeciduous className="mx-auto text-gray-300 mb-2" size={24} />
                          <p className="text-xs text-gray-500">No varieties added yet.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-3 mt-6 pt-4 border-t border-gray-100">
                    <button
                      onClick={handleUpdateParcel}
                      className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 shadow-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <Save size={16} /> Save Changes
                    </button>
                    <button
                      onClick={() => {
                        if (selectedParcel) {
                          setEditName(selectedParcel.name || '')
                          setEditArea(selectedParcel.area || '')
                          setEditTrees(selectedParcel.trees_count || '')
                          setEditVarieties(selectedParcel.varieties || [])
                        }
                        setIsEditing(false)
                        setDrawingVarietyIndex(null)
                      }}
                      className="flex-1 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 border border-gray-300 shadow-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-grow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-gray-900 text-xl">{selectedParcel.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium border border-green-200">
                          ID: {selectedParcel.ID}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="text-gray-500 hover:text-indigo-600 p-1.5 rounded-md hover:bg-indigo-50 transition-colors"
                        title="Edit Parcel"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={handleDeleteParcel}
                        className="text-gray-500 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                        title="Delete Parcel"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!isEditing && (
                <button
                  onClick={() => setShowInfoPanel(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded transition-colors"
                  title="Close panel"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Tab Navigation - only shown in view mode */}
            {!isEditing && (
              <div className="flex border-b border-gray-200 mb-4">
                {[
                  { id: 'overview', icon: '📊', label: 'Overview' },
                  { id: 'operations', icon: '🎯', label: 'Operations' },
                  { id: 'monitoring', icon: '📈', label: 'Monitoring' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-sm font-medium transition-all border-b-2 ${activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Overview Tab Content */}
            {!isEditing && activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div>
                    <div className="flex items-center gap-1 text-gray-500 mb-1">
                      <Ruler size={14} />
                      <span className="text-xs font-medium uppercase tracking-wider">Area</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{selectedParcel.area ? `${selectedParcel.area.toFixed(2)} ha` : '-'}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-gray-500 mb-1">
                      <TreeDeciduous size={14} />
                      <span className="text-xs font-medium uppercase tracking-wider">Trees</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{selectedParcel.trees_count || '-'}</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <Trees size={16} className="text-green-600" />
                    Varieties & Layout
                  </h4>
                  {selectedParcel.varieties && selectedParcel.varieties.length > 0 ? (
                    <div className="space-y-2">
                      {selectedParcel.varieties.map((v: any, i: number) => {
                        const treeCount = v.geojson ? getTreeCount(v.geojson) : 0
                        return (
                          <div key={i} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex justify-between items-center hover:border-green-200 transition-colors">
                            <div>
                              <span className="font-semibold text-gray-800 block">{v.cultivar || 'Unknown'}</span>
                              <span className="text-xs text-gray-500">Planted: {v.planting_date || 'N/A'}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-100">
                                {treeCount} trees
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                      <p className="text-sm text-gray-500 italic">No varieties recorded</p>
                    </div>
                  )}
                </div>

                {/* Climate Context */}
                {climateProfile && (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-4">
                    <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <Cloud size={16} className="text-blue-600" />
                      Climate Context
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {climateProfile.climate_type && (
                        <span className="px-3 py-1.5 bg-white rounded-full text-sm font-medium text-blue-700 border border-blue-200 shadow-sm">
                          {climateProfile.climate_type === 'Csa' ? 'Hot-Summer Mediterranean' :
                           climateProfile.climate_type === 'Csb' ? 'Warm-Summer Mediterranean' :
                           climateProfile.climate_type === 'BSh' ? 'Hot Semi-Arid' :
                           climateProfile.climate_type}
                        </span>
                      )}
                      {climateProfile.is_dormant ? (
                        <span className="px-3 py-1.5 bg-purple-100 rounded-full text-sm font-medium text-purple-700 border border-purple-200 shadow-sm">
                          🌙 Dormant Season
                        </span>
                      ) : (
                        <span className="px-3 py-1.5 bg-green-100 rounded-full text-sm font-medium text-green-700 border border-green-200 shadow-sm">
                          🌱 Active Growing
                        </span>
                      )}
                      {climateProfile.olive_suitability_score && (
                        <span className={`px-3 py-1.5 rounded-full text-sm font-medium border shadow-sm ${
                          climateProfile.olive_suitability_score >= 80 ? 'bg-green-100 text-green-700 border-green-200' :
                          climateProfile.olive_suitability_score >= 60 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                          'bg-orange-100 text-orange-700 border-orange-200'
                        }`}>
                          🫒 Suitability: {Math.round(climateProfile.olive_suitability_score)}%
                        </span>
                      )}
                    </div>
                    {climateProfile.dormancy_start_month && climateProfile.dormancy_end_month && (
                      <p className="text-xs text-gray-600 mt-3">
                        Dormancy: {getMonthName(climateProfile.dormancy_start_month)} – {getMonthName(climateProfile.dormancy_end_month)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Operations Tab Content - Unified Recommendations */}
            {!isEditing && activeTab === 'operations' && selectedParcel && (
              <div className="space-y-6">
                {/* Weather Advisory - Single Source of Truth for Recommendations */}
                <WeatherAdvisoryPanel parcelId={selectedParcel.ID} />

                {/* 7-Day Pest Risk Forecast */}
                <RiskForecastPanel parcelId={selectedParcel.ID} />
              </div>
            )}

            {/* Monitoring Tab Content - Raw Data Display */}
            {!isEditing && activeTab === 'monitoring' && selectedParcel && (
              <div className="space-y-6">
                {/* Current Weather Data - No Advice, Just Data */}
                {weatherData && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2">
                          <Cloud size={16} className="text-blue-600" />
                          Current Weather
                        </h4>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-white text-blue-700 border border-blue-200 font-medium">
                          {new Date(weatherData.fetched_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="text-4xl">
                          {weatherData.precipitation > 0 ? '🌧️' :
                            weatherData.temperature < 5 ? '❄️' :
                              weatherData.temperature > 30 ? '🌡️' : '☀️'}
                        </div>
                        <div>
                          <div className="text-3xl font-bold text-gray-900">
                            {weatherData.temperature?.toFixed(1)}°C
                          </div>
                          <div className="text-xs text-gray-500">Current temperature</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="text-center p-2 bg-gray-50 rounded-lg">
                          <Droplets size={14} className="text-blue-500 mx-auto mb-1" />
                          <div className="text-sm font-bold">{weatherData.humidity}%</div>
                          <div className="text-[10px] text-gray-500">Humidity</div>
                        </div>
                        <div className="text-center p-2 bg-gray-50 rounded-lg">
                          <Wind size={14} className="text-gray-500 mx-auto mb-1" />
                          <div className="text-sm font-bold">{weatherData.wind_speed?.toFixed(1)}</div>
                          <div className="text-[10px] text-gray-500">km/h</div>
                        </div>
                        <div className="text-center p-2 bg-gray-50 rounded-lg">
                          <Thermometer size={14} className="text-orange-500 mx-auto mb-1" />
                          <div className="text-sm font-bold">{weatherData.et0?.toFixed(1) || 'N/A'}</div>
                          <div className="text-[10px] text-gray-500">ET0 mm/d</div>
                        </div>
                        <div className="text-center p-2 bg-gray-50 rounded-lg">
                          <Cloud size={14} className="text-blue-400 mx-auto mb-1" />
                          <div className="text-sm font-bold">{weatherData.rain_next_24h?.toFixed(1) || '0'}</div>
                          <div className="text-[10px] text-gray-500">24h rain</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Satellite Insights - Data Only */}
                <SatelliteInsights parcelId={selectedParcel.ID} lastUpdated={satelliteLastUpdated} />

                {/* NDVI Visualization */}
                {ndviData && ndviData.parcelId === selectedParcel.ID && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Satellite size={16} className="text-indigo-600" />
                        <span className="text-sm font-semibold text-gray-700">NDVI Analysis</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        {ndviData.is_cached && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${ndviData.is_stale
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-green-50 text-green-700 border-green-200'
                            }`}>
                            {ndviData.is_stale ? '⚠️ Stale' : '✅ Fresh'}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-500">
                          {new Date(ndviData.product_date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm text-gray-500">Mean NDVI</span>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-mono font-bold text-gray-900">{ndviData.ndvi_mean?.toFixed(3)}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${ndviData.ndvi_mean < 0.3 ? 'bg-red-100 text-red-800' :
                            ndviData.ndvi_mean < 0.5 ? 'bg-yellow-100 text-yellow-800' :
                              ndviData.ndvi_mean < 0.7 ? 'bg-green-100 text-green-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                            {ndviData.ndvi_mean < 0.3 ? 'Poor' :
                              ndviData.ndvi_mean < 0.5 ? 'Moderate' :
                                ndviData.ndvi_mean < 0.7 ? 'Good' : 'Excellent'}
                          </span>
                        </div>
                      </div>
                      {ndviData.ndvi_image && (
                        <div className="relative rounded-lg overflow-hidden border border-gray-100">
                          <img
                            src={ndviData.ndvi_image}
                            alt="NDVI Preview"
                            className="w-full h-32 object-cover"
                            style={{ imageRendering: 'pixelated' }}
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm px-2 py-1 text-[10px] text-white flex justify-between">
                            <span>Min: {ndviData.ndvi_min?.toFixed(2)}</span>
                            <span>Max: {ndviData.ndvi_max?.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Climate Profile - Detailed Analysis */}
                <ClimateProfileCard 
                  profile={climateProfile} 
                  loading={climateLoading}
                  onRefresh={() => refreshClimateProfile(selectedParcel.ID)}
                />
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}

export default Parcels

