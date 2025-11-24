import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap, LayersControl, ImageOverlay, useMapEvents } from 'react-leaflet'
// @ts-ignore
import { EditControl } from 'react-leaflet-draw'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw' // Ensure L.Draw is attached to L
import { TreeDeciduous, MapPin, Ruler, Calendar, Trash2, Edit2, Save, X, Plus, Satellite, Cloud, AlertCircle, MousePointerClick, Trees, Droplets, Wind, Thermometer } from 'lucide-react'
import { apiCall } from '../config'
import { useAuth } from '../contexts/AuthContext'
import { SatelliteInsights } from '../components/satellite/SatelliteInsights'

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
      console.log('Map clicked:', { enabled, latlng: e.latlng })
      if (enabled) {
        console.log('Calling onMapClick callback')
        onMapClick(e.latlng)
      } else {
        console.log('Not calling onMapClick - enabled is false')
      }
    }
  })

  // Change cursor when in drawing mode
  useEffect(() => {
    console.log('MapClickHandler cursor effect:', { enabled })
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
  const [irrigationData, setIrrigationData] = useState<any>(null)
  const [pestData, setPestData] = useState<any>(null)
  const [showInfoPanel, setShowInfoPanel] = useState(true)
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
    setIrrigationData(null)
    setPestData(null)

    // Automatically fetch NDVI data for this parcel
    processSatellite(parcel.ID)

    // Fetch weather data for this parcel
    fetchWeather(parcel.ID)

    // Fetch irrigation recommendation for this parcel
    fetchIrrigation(parcel.ID)

    // Fetch pest risk for this parcel
    fetchPestRisk(parcel.ID)

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

  const fetchIrrigation = async (parcelId: number) => {
    try {
      const response = await apiCall(`/irrigation/recommendation/${parcelId}`)
      const data = await response.json()
      setIrrigationData(data)
    } catch (err) {
      console.error('Failed to fetch irrigation recommendation for parcel', parcelId, err)
    }
  }

  const fetchPestRisk = async (parcelId: number) => {
    try {
      const response = await apiCall(`/pests/risk/${parcelId}`)
      const data = await response.json()
      setPestData(data)
    } catch (err) {
      console.error('Failed to fetch pest risk for parcel', parcelId, err)
    }
  }

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
      alert('Please select a farm')
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
        console.error('Failed to create parcel:', error)
        alert(`Failed to create parcel: ${error.error || 'Unknown error'}`)
      }
    } catch (err) {
      console.error('Error creating parcel:', err)
      alert('Failed to create parcel. Check console for details.')
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

    console.log('=== handleUpdateParcel called ===')
    console.log('editVarieties:', editVarieties)

    // Clean up varieties for submission and auto-calculate tree_count from geometry
    const varietiesToSubmit = editVarieties.map(v => ({
      ...v,
      tree_count: v.geojson ? getTreeCount(v.geojson) : 0,  // Auto-calculate from geometry
      area: parseFloat(v.area) || 0
    }))

    console.log('varietiesToSubmit:', varietiesToSubmit)

    const payload = {
      ...selectedParcel,
      name: editName,
      area: parseFloat(editArea) || 0,
      trees_count: parseInt(editTrees) || 0,
      varieties: varietiesToSubmit
    }

    console.log('Sending payload to backend:', JSON.stringify(payload, null, 2))

    try {
      const response = await apiCall(`/parcels/${selectedParcel.ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const updatedParcel = await response.json()
        console.log('Backend returned updated parcel:', updatedParcel)
        console.log('Updated parcel varieties:', updatedParcel.varieties)
        setParcels(parcels.map(p => p.ID === updatedParcel.ID ? updatedParcel : p))
        setSelectedParcel(updatedParcel)
        setIsEditing(false)
        setDrawingVarietyIndex(null) // Reset drawing mode
      } else {
        const errorText = await response.text()
        console.error('Save failed:', errorText)
        alert('Failed to update parcel: ' + errorText)
      }
    } catch (err) {
      console.error('Error updating parcel:', err)
      alert('Failed to update parcel')
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
        alert('Failed to delete parcel')
      }
    } catch (err) {
      console.error('Error deleting parcel:', err)
      alert('Failed to delete parcel')
    }
  }

  const processSatellite = async (parcelId: number) => {
    try {
      // setShowSatellite(true)
      console.log('Processing NDVI for parcel:', parcelId)

      const response = await apiCall(`/parcels/${parcelId}/satellite`, {
        method: 'POST',
      })
      const data = await response.json()
      console.log('NDVI Response:', {
        status: data.status,
        is_cached: data.is_cached,
        is_stale: data.is_stale,
        refreshing: data.refreshing,
        pixels: data.pixels_count,
        hasImage: !!data.ndvi_image,
        imageLength: data.ndvi_image?.length
      })

      if (data.status === 'success') {
        setNdviData({ ...data, parcelId })
        setSatelliteLastUpdated(Date.now())
        console.log('NDVI data set:', { parcelId, hasImage: !!data.ndvi_image })

        // No alert popup - data is displayed in the panel automatically
      } else {
        console.error(`NDVI Error: ${data.message}`)
        // Only show alert on actual error (not on normal operations)
      }
    } catch (err) {
      console.error('NDVI Error:', err)
      // Silent failure - user will see no NDVI data in panel
    } finally {
      // setShowSatellite(false)
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
    console.log('startDrawingForVariety called:', { index, currentDrawingIndex: drawingVarietyIndex })
    console.log('Current editVarieties:', editVarieties)
    console.log('Variety at index:', editVarieties[index])

    // Toggle drawing mode - if already drawing for this variety, exit
    if (drawingVarietyIndex === index) {
      console.log('Exiting drawing mode')
      setDrawingVarietyIndex(null)
    } else {
      console.log('Entering drawing mode for variety index:', index)
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
    console.log('handleMapClick called:', { drawingVarietyIndex, latlng })

    if (drawingVarietyIndex === null) {
      console.log('Ignoring click - not in drawing mode')
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
          alert('⚠️ Trees can only be placed inside the parcel boundary')
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

    console.log('Tree placed at:', { drawingVarietyIndex, latlng, pointGeometry })

    // Use functional setState to ensure we have the latest state
    setEditVarieties(prevVarieties => {
      const newVarieties = [...prevVarieties]
      const currentVariety = newVarieties[drawingVarietyIndex]

      console.log('Current variety before update:', currentVariety)

      // If there's already geometry, we need to combine them
      if (currentVariety.geojson) {
        const existingGeojson = typeof currentVariety.geojson === 'string'
          ? JSON.parse(currentVariety.geojson)
          : currentVariety.geojson

        console.log('Existing geometry:', existingGeojson)

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

      console.log('Updated varieties:', newVarieties)
      console.log('Updated variety geometry:', newVarieties[drawingVarietyIndex].geojson)
      return newVarieties
    })
  }, [drawingVarietyIndex, selectedParcel])  // Removed isPointInPolygon as it's a stable function

  const clearVarietyGeometry = (index: number) => {
    console.log('clearVarietyGeometry called:', { index, currentVarieties: editVarieties })
    const newVarieties = [...editVarieties]
    // Add a timestamp to force re-render
    newVarieties[index] = {
      ...newVarieties[index],
      geojson: null,
      _cleared: Date.now() // Force unique key generation
    }
    console.log('After clearing:', newVarieties)
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

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full shadow-xl z-10">
        <div className="p-5 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <MapPin size={18} className="text-green-600" />
              Parcels
            </h2>
            <span className="bg-white px-2 py-1 rounded-md text-xs font-medium text-gray-500 border border-gray-200 shadow-sm">
              {parcels.length}
            </span>
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
            <LayersControl.BaseLayer name="Satellite (Esri)">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={20}
                maxNativeZoom={18}
                attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite with Labels">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution='&copy; Esri'
                maxZoom={19}
              />
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                attribution='&copy; Esri'
                maxZoom={19}
              />
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

        {selectedParcel && showInfoPanel && (
          <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm p-5 rounded-xl shadow-2xl w-96 z-[1000] max-h-[calc(100vh-120px)] overflow-y-auto border border-gray-100 transition-all duration-300">
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

            {!isEditing && (
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
              </div>
            )}

            {/* Satellite Insights Section */}
            {!isEditing && selectedParcel && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <SatelliteInsights parcelId={selectedParcel.ID} lastUpdated={satelliteLastUpdated} />
              </div>
            )}

            {/* NDVI Section */}
            {ndviData && ndviData.parcelId === selectedParcel.ID && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2">
                    <Satellite size={16} className="text-indigo-600" />
                    NDVI Analysis
                  </h4>
                  <div className="flex gap-2">
                    {ndviData.is_cached && (
                      <span className={`text-[10px] px-2 py-1 rounded-full font-medium border ${ndviData.is_stale
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-green-50 text-green-700 border-green-200'
                        }`}>
                        {ndviData.is_stale ? '⚠️ Cached (Stale)' : '✅ Cached'}
                      </span>
                    )}
                    {ndviData.refreshing && (
                      <span className="text-[10px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 animate-pulse font-medium">
                        🔄 Updating...
                      </span>
                    )}
                  </div>
                </div>

                {/* Satellite Acquisition Date */}
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 p-4 rounded-xl mb-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mt-2 -mr-2 w-16 h-16 bg-white opacity-20 rounded-full blur-xl"></div>
                  <div className="flex items-center relative z-10">
                    <div className="mr-3 bg-white p-2 rounded-lg shadow-sm text-indigo-600">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider mb-0.5">
                        Acquisition Date
                      </div>
                      <div className="text-lg font-bold text-gray-900 leading-tight">
                        {new Date(ndviData.product_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                      <div className="text-xs text-indigo-600/80 mt-1 flex items-center gap-1">
                        <Cloud size={10} /> Cloud Cover: {ndviData.cloud_cover?.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-600">Health Assessment</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${ndviData.ndvi_mean < 0.3 ? 'bg-red-100 text-red-800' :
                      ndviData.ndvi_mean < 0.5 ? 'bg-yellow-100 text-yellow-800' :
                        ndviData.ndvi_mean < 0.7 ? 'bg-green-100 text-green-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                      {
                        ndviData.ndvi_mean < 0.3 ? 'Poor' :
                          ndviData.ndvi_mean < 0.5 ? 'Moderate' :
                            ndviData.ndvi_mean < 0.7 ? 'Good' : 'Excellent'
                      }
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm text-gray-500">Mean NDVI</span>
                      <span className="text-2xl font-mono font-bold text-gray-900">{ndviData.ndvi_mean?.toFixed(3)}</span>
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

              </div>
            )}

            {/* Weather Section */}
            {!isEditing && weatherData && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2">
                    <Cloud size={16} className="text-blue-600" />
                    Weather Conditions
                  </h4>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                    Live Data
                  </span>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">
                        {weatherData.precipitation > 0 ? '🌧️' :
                          weatherData.temperature < 5 ? '❄️' :
                            weatherData.temperature > 30 ? '🌡️' : '☀️'}
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-gray-900">
                          {weatherData.temperature?.toFixed(1)}°C
                        </div>
                        <div className="text-xs text-blue-600">
                          Current temperature
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Droplets size={14} className="text-blue-500" />
                      <span className="text-xs text-gray-500 font-medium">Humidity</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{weatherData.humidity}%</div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Wind size={14} className="text-gray-500" />
                      <span className="text-xs text-gray-500 font-medium">Wind</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{weatherData.wind_speed?.toFixed(1)} km/h</div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Thermometer size={14} className="text-orange-500" />
                      <span className="text-xs text-gray-500 font-medium">ET0</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{weatherData.et0?.toFixed(1) || 'N/A'} <span className="text-xs font-normal text-gray-500">mm/day</span></div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Cloud size={14} className="text-blue-500" />
                      <span className="text-xs text-gray-500 font-medium">24h Rain</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{weatherData.rain_next_24h?.toFixed(1) || '0'} <span className="text-xs font-normal text-gray-500">mm</span></div>
                  </div>
                </div>

                {/* Actionable insights */}
                <div className="mt-3 space-y-2">
                  {weatherData.et0 > 3 && weatherData.rain_next_24h < 5 && (
                    <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded">
                      <p className="text-xs font-semibold text-amber-900 flex items-center gap-1">
                        <Droplets size={12} /> Irrigation Recommended
                      </p>
                      <p className="text-[10px] text-amber-700 mt-1">
                        High evapotranspiration with no rain forecast
                      </p>
                    </div>
                  )}

                  {weatherData.rain_next_24h > 5 && (
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                      <p className="text-xs font-semibold text-blue-900 flex items-center gap-1">
                        <Cloud size={12} /> Rain Expected
                      </p>
                      <p className="text-[10px] text-blue-700 mt-1">
                        Delay pesticide applications
                      </p>
                    </div>
                  )}

                  {weatherData.temperature < 5 && (
                    <div className="bg-purple-50 border-l-4 border-purple-400 p-3 rounded">
                      <p className="text-xs font-semibold text-purple-900">❄️ Frost Risk</p>
                      <p className="text-[10px] text-purple-700 mt-1">
                        Monitor for frost damage
                      </p>
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-gray-400 text-center mt-3 pt-2 border-t border-gray-100">
                  Updated: {new Date(weatherData.fetched_at).toLocaleString()}
                </p>
              </div>
            )}

            {/* Irrigation Section */}
            {!isEditing && irrigationData && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2">
                    <Droplets size={16} className="text-cyan-600" />
                    Irrigation Recommendation
                  </h4>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-medium border ${irrigationData.should_irrigate
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-green-50 text-green-700 border-green-200'
                    }`}>
                    {irrigationData.should_irrigate ? '💧 Action Needed' : '✅ Adequate'}
                  </span>
                </div>

                {/* Main recommendation */}
                {irrigationData.should_irrigate ? (
                  <div className={`border-l-4 rounded-lg p-4 mb-3 ${irrigationData.urgency_level === 'critical' ? 'bg-red-50 border-red-400' :
                    irrigationData.urgency_level === 'high' ? 'bg-orange-50 border-orange-400' :
                      irrigationData.urgency_level === 'medium' ? 'bg-amber-50 border-amber-400' :
                        'bg-yellow-50 border-yellow-400'
                    }`}>
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">💧</div>
                      <div className="flex-grow">
                        <p className={`text-sm font-bold uppercase tracking-wide mb-2 ${irrigationData.urgency_level === 'critical' ? 'text-red-900' :
                          irrigationData.urgency_level === 'high' ? 'text-orange-900' :
                            irrigationData.urgency_level === 'medium' ? 'text-amber-900' :
                              'text-yellow-900'
                          }`}>
                          Irrigation Needed ({irrigationData.urgency_level} Priority)
                        </p>
                        <div className="space-y-1">
                          <p className="text-lg font-bold text-gray-900">
                            {irrigationData.recommended_amount?.toFixed(1)} mm
                          </p>
                          <p className="text-xs text-gray-600">
                            ≈ {irrigationData.recommended_liters_tree?.toFixed(0)} L/tree
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">✅</div>
                      <div>
                        <p className="text-sm font-semibold text-green-900">No Irrigation Needed</p>
                        <p className="text-xs text-green-700 mt-1">
                          Soil moisture is adequate. Next irrigation: {new Date(irrigationData.next_irrigation_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Water status grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Droplets size={14} className="text-blue-500" />
                      <span className="text-xs text-gray-500 font-medium">Soil Moisture</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {irrigationData.soil_moisture_estimate?.toFixed(0)}%
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle size={14} className={
                        irrigationData.stress_level === 'severe' ? 'text-red-500' :
                          irrigationData.stress_level === 'moderate' ? 'text-orange-500' :
                            irrigationData.stress_level === 'mild' ? 'text-yellow-500' :
                              'text-green-500'
                      } />
                      <span className="text-xs text-gray-500 font-medium">Water Stress</span>
                    </div>
                    <div className="text-sm font-bold text-gray-900 capitalize">
                      {irrigationData.stress_level || 'None'}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TreeDeciduous size={14} className="text-green-500" />
                      <span className="text-xs text-gray-500 font-medium">Growth Stage</span>
                    </div>
                    <div className="text-sm font-bold text-gray-900 capitalize">
                      {irrigationData.growth_stage?.replace('_', ' ') || 'N/A'}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar size={14} className="text-gray-500" />
                      <span className="text-xs text-gray-500 font-medium">Next Irrigation</span>
                    </div>
                    <div className="text-xs font-bold text-gray-900">
                      {new Date(irrigationData.next_irrigation_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-gray-400 text-center mt-3 pt-2 border-t border-gray-100">
                  Calculated: {new Date(irrigationData.calculation_date).toLocaleString()}
                </p>
              </div>
            )}

            {/* Pest Control Section */}
            {!isEditing && pestData && Array.isArray(pestData) && pestData.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2">
                    <AlertCircle size={16} className="text-red-600" />
                    Sanitary Status
                  </h4>
                </div>

                {pestData.map((assessment: any) => {
                  const riskColorMap: any = {
                    'critical': { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-900', badge: 'bg-red-100 text-red-700 border-red-300' },
                    'high': { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-900', badge: 'bg-orange-100 text-orange-700 border-orange-300' },
                    'moderate': { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-900', badge: 'bg-amber-100 text-amber-700 border-amber-300' },
                    'low': { bg: 'bg-yellow-50', border: 'border-yellow-400', text: 'text-yellow-900', badge: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
                    'none': { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-900', badge: 'bg-green-100 text-green-700 border-green-300' }
                  }

                  const colors = riskColorMap[assessment.risk_level] || riskColorMap['none']

                  const pestNameMap: any = {
                    'olive_fly': 'Olive Fruit Fly',
                    'peacock_spot': 'Peacock Spot',
                    'verticillium': 'Verticillium Wilt',
                    'olive_knot': 'Olive Knot',
                    'anthracnose': 'Anthracnose'
                  }

                  return (
                    <div key={assessment.pest_type} className={`${colors.bg} border ${colors.border} rounded-lg p-4 mb-3`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h5 className={`text-sm font-bold ${colors.text}`}>
                            {pestNameMap[assessment.pest_type] || assessment.pest_type}
                          </h5>
                          <p className="text-[10px] text-gray-600 mt-1">
                            Risk Score: {assessment.risk_score?.toFixed(0)}/100
                          </p>
                        </div>
                        <span className={`text-[10px] px-2 py-1 rounded-full font-medium border ${colors.badge} uppercase tracking-wide`}>
                          {assessment.risk_level}
                        </span>
                      </div>

                      <div className={`text-xs ${colors.text} mt-2 leading-relaxed`}>
                        {assessment.alert_message}
                      </div>

                      {assessment.risk_level !== 'none' && assessment.risk_level !== 'low' && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-[10px] font-semibold text-gray-700 mb-1">Quick Actions:</p>
                          <ul className="text-[10px] text-gray-600 space-y-1">
                            {assessment.pest_type === 'olive_fly' && (
                              <>
                                <li>• Check McPhail traps</li>
                                <li>• Monitor fruit for punctures</li>
                                {assessment.risk_level === 'critical' && <li>• Apply treatment immediately</li>}
                              </>
                            )}
                            {assessment.pest_type === 'peacock_spot' && (
                              <>
                                <li>• Inspect leaves for spots</li>
                                <li>• Prepare copper fungicides</li>
                                {assessment.risk_level === 'critical' && <li>• Apply preventive treatment</li>}
                              </>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )
                })}

                <p className="text-[10px] text-gray-400 text-center mt-3">
                  Based on current weather conditions
                </p>
              </div>
            )}

          </div>
        )}

        {/* Toggle button to reopen panel if closed */}
        {selectedParcel && !showInfoPanel && (
          <button
            onClick={() => setShowInfoPanel(true)}
            className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow-lg hover:bg-gray-50 z-[1000]"
            title="Show parcel info"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default Parcels

