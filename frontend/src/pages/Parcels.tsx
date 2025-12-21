import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap, LayersControl, ImageOverlay, useMapEvents, LayerGroup, Marker, Polygon } from 'react-leaflet'
// @ts-ignore
import { EditControl } from 'react-leaflet-draw'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw' // Ensure L.Draw is attached to L
import { TreeDeciduous, MapPin, Ruler, Trash2, Edit2, Save, X, Plus, Satellite, Cloud, MousePointerClick, Trees, Droplets, Wind, Thermometer, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiCall } from '../config'
import { useAuth } from '../contexts/AuthContext'
import { SatelliteInsights } from '../components/satellite/SatelliteInsights'
import { RiskForecastPanel } from '../components/pests/RiskForecastPanel'
import { ClimateProfileCard } from '../components/climate/ClimateProfileCard'
import { WeatherAdvisoryPanel } from '../components/weather/WeatherAdvisoryPanel'
import jsPDF from 'jspdf'
import { useTranslation } from 'react-i18next'

// Helper function to convert month number to name
const getMonthName = (month: number): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[month - 1] || 'Unknown'
}

// Variety colors for consistent styling
const VARIETY_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']

// SVG symbol paths for different variety markers
const VARIETY_SYMBOLS = [
  // Circle
  (color: string) => `<circle cx="12" cy="12" r="8" fill="${color}" stroke="white" stroke-width="2"/>`,
  // Square
  (color: string) => `<rect x="4" y="4" width="16" height="16" fill="${color}" stroke="white" stroke-width="2"/>`,
  // Triangle
  (color: string) => `<polygon points="12,2 22,20 2,20" fill="${color}" stroke="white" stroke-width="2"/>`,
  // Diamond
  (color: string) => `<polygon points="12,2 22,12 12,22 2,12" fill="${color}" stroke="white" stroke-width="2"/>`,
  // Star
  (color: string) => `<polygon points="12,2 15,9 22,9 17,14 19,22 12,17 5,22 7,14 2,9 9,9" fill="${color}" stroke="white" stroke-width="1.5"/>`,
  // Pentagon
  (color: string) => `<polygon points="12,2 22,9 19,20 5,20 2,9" fill="${color}" stroke="white" stroke-width="2"/>`
]

// Generate initials from cultivar name
const getVarietyInitials = (cultivarName: string): string => {
  if (!cultivarName) return ''

  const words = cultivarName.trim().split(/\s+/)

  if (words.length === 1) {
    // Single word: take first 2 characters
    return words[0].substring(0, 2).toUpperCase()
  } else if (words.length === 2) {
    // Two words: first letter of each
    return (words[0][0] + words[1][0]).toUpperCase()
  } else {
    // Three or more words: handle special cases like "di", "de", etc.
    const skipWords = ['di', 'de', 'del', 'della', 'da', 'delle', 'dei']
    const significantWords = words.filter(w => !skipWords.includes(w.toLowerCase()))

    if (significantWords.length >= 2) {
      // Use first letter of first word + first letter of last significant word
      return (significantWords[0][0] + significantWords[significantWords.length - 1][0]).toUpperCase()
    } else if (significantWords.length === 1) {
      // Only one significant word: take first 2 letters
      return significantWords[0].substring(0, 2).toUpperCase()
    } else {
      // Fallback: first two letters of first word
      return words[0].substring(0, 2).toUpperCase()
    }
  }
}

// Create Leaflet divIcon for variety markers with unique symbols and initials
const createVarietyIcon = (varietyIndex: number, cultivarName: string = '') => {
  const color = VARIETY_COLORS[varietyIndex % VARIETY_COLORS.length]
  const symbolFn = VARIETY_SYMBOLS[varietyIndex % VARIETY_SYMBOLS.length]
  const initials = getVarietyInitials(cultivarName)

  // Create SVG with symbol and text label centered on top with semi-transparent background
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      ${symbolFn(color)}
      ${initials ? `
        <rect x="7" y="8.5" width="10" height="9" rx="2" 
              fill="#333" 
              fill-opacity="0.65"/>
        <text x="12" y="15" 
              text-anchor="middle" 
              font-size="9" 
              font-weight="bold" 
              fill="white" 
              font-family="Inter, Arial, sans-serif">
          ${initials}
        </text>
      ` : ''}
    </svg>
  `

  return L.divIcon({
    html: svg,
    className: 'variety-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  })
}

// Component to handle map zoom to bounds
function MapController({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap()
  const previousBoundsRef = useRef<L.LatLngBounds | null>(null)
  const rafIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (bounds && bounds.isValid()) {
      // Only zoom if bounds actually changed significantly
      const prev = previousBoundsRef.current
      if (!prev || !prev.equals(bounds, 0.0001)) {
        // Cancel any pending animation frame
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current)
        }

        // Use requestAnimationFrame to batch DOM updates and reduce forced reflows
        rafIdRef.current = requestAnimationFrame(() => {
          map.fitBounds(bounds, {
            padding: [100, 100],
            maxZoom: 18  // Prevent zooming in too close
          })
          previousBoundsRef.current = bounds
          rafIdRef.current = null
        })
      }
    }

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
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

// Component for draggable markers
function DraggableMarker({ position, icon, opacity = 1, scale = 1, zIndex = 100, onDragEnd, onRemove }: {
  position: L.LatLng,
  icon: L.Icon | L.DivIcon,
  opacity?: number,
  scale?: number,
  zIndex?: number,
  onDragEnd: (latlng: L.LatLng) => void,
  onRemove?: () => void
}) {
  const [currentPosition, setCurrentPosition] = useState(position)
  const wasDraggedRef = useRef(false)

  useEffect(() => {
    setCurrentPosition(position)
  }, [position])

  return (
    <Marker
      position={currentPosition}
      icon={icon}
      draggable={true}
      opacity={opacity}
      zIndexOffset={zIndex}
      eventHandlers={{
        dragstart: () => {
          wasDraggedRef.current = false
        },
        drag: () => {
          wasDraggedRef.current = true
        },
        dragend: (e) => {
          const marker = e.target as L.Marker
          const newLatLng = marker.getLatLng()
          setCurrentPosition(newLatLng)
          onDragEnd(newLatLng)
          // Reset after a short delay to allow click event to check
          setTimeout(() => {
            wasDraggedRef.current = false
          }, 100)
        },
        click: (e) => {
          // Remove marker on click if onRemove handler is provided and marker wasn't dragged
          if (onRemove && !wasDraggedRef.current) {
            e.originalEvent.stopPropagation() // Prevent map click
            onRemove()
          }
          wasDraggedRef.current = false
        },
        add: (e) => {
          // Apply scale transform
          if (scale !== 1) {
            const marker = e.target as L.Marker
            const el = marker.getElement()
            if (el) {
              el.style.transform = el.style.transform + ` scale(${scale})`
            }
          }
        }
      }}
    />
  )
}

// Component for editing polygon vertices using direct Leaflet manipulation (no re-renders during drag)
function EditablePolygon({
  geojson,
  onGeometryChange,
  color = '#22c55e',
  onMinVerticesWarning
}: {
  geojson: any,
  onGeometryChange: (newGeojson: any, areaHa: number) => void,
  color?: string,
  onMinVerticesWarning?: () => void
}) {
  const map = useMap()
  const polygonRef = useRef<L.Polygon | null>(null)
  const vertexMarkersRef = useRef<L.Marker[]>([])
  const midpointMarkersRef = useRef<L.Marker[]>([])
  const coordsRef = useRef<[number, number][]>([])

  // Parse the geojson if it's a string
  const parsedGeojson = useMemo(() =>
    typeof geojson === 'string' ? JSON.parse(geojson) : geojson
    , [geojson])

  // Extract coordinates from polygon
  const extractCoordinates = useCallback((geo: any): [number, number][] => {
    if (geo.type === 'Polygon') {
      return geo.coordinates[0].slice(0, -1)
    } else if (geo.type === 'Feature' && geo.geometry.type === 'Polygon') {
      return geo.geometry.coordinates[0].slice(0, -1)
    }
    return []
  }, [])

  // Helper to propagate geometry change
  const propagateChange = useCallback(() => {
    const closedCoords = [...coordsRef.current, coordsRef.current[0]]

    let newGeojson: any
    if (parsedGeojson.type === 'Polygon') {
      newGeojson = { type: 'Polygon', coordinates: [closedCoords] }
    } else if (parsedGeojson.type === 'Feature') {
      newGeojson = {
        ...parsedGeojson,
        geometry: { type: 'Polygon', coordinates: [closedCoords] }
      }
    } else {
      newGeojson = { type: 'Polygon', coordinates: [closedCoords] }
    }

    // Calculate area
    const latlngs = coordsRef.current.map(c => L.latLng(c[1], c[0]))
    let areaHa = 0
    try {
      // @ts-ignore
      const areaSqMeters = L.GeometryUtil.geodesicArea(latlngs)
      areaHa = areaSqMeters / 10000
    } catch (err) {
      console.error('Error calculating area:', err)
    }

    onGeometryChange(newGeojson, areaHa)
  }, [parsedGeojson, onGeometryChange])

  // Rebuild all markers (called after add/remove vertex)
  const rebuildMarkers = useCallback(() => {
    // Clear existing markers
    vertexMarkersRef.current.forEach(m => m.remove())
    midpointMarkersRef.current.forEach(m => m.remove())
    vertexMarkersRef.current = []
    midpointMarkersRef.current = []

    const polygon = polygonRef.current
    if (!polygon) return

    const coords = coordsRef.current

    // Update polygon
    const latLngs = coords.map(c => L.latLng(c[1], c[0]))
    polygon.setLatLngs(latLngs)

    // Create vertex markers
    const vertexMarkers: L.Marker[] = []
    coords.forEach((coord, index) => {
      const vertexIcon = L.divIcon({
        html: `<div style="
          width: 14px;
          height: 14px;
          background: white;
          border: 3px solid ${color};
          border-radius: 50%;
          cursor: move;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>`,
        className: 'vertex-marker',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      })

      const marker = L.marker([coord[1], coord[0]], {
        icon: vertexIcon,
        draggable: true
      }).addTo(map)

      // Handle drag
      marker.on('drag', () => {
        const newLatLng = marker.getLatLng()
        coordsRef.current[index] = [newLatLng.lng, newLatLng.lat]
        const newLatLngs = coordsRef.current.map(c => L.latLng(c[1], c[0]))
        polygon.setLatLngs(newLatLngs)
        // Update midpoints during drag
        updateMidpointPositions()
      })

      // Handle drag end
      marker.on('dragend', () => {
        propagateChange()
      })

      // Right-click to remove vertex
      marker.on('contextmenu', (e) => {
        L.DomEvent.stopPropagation(e as L.LeafletEvent)
        if (coordsRef.current.length <= 3) {
          onMinVerticesWarning?.()
          return
        }
        // Remove this vertex
        coordsRef.current.splice(index, 1)
        propagateChange()
        rebuildMarkers()
      })

      vertexMarkers.push(marker)
    })
    vertexMarkersRef.current = vertexMarkers

    // Create midpoint markers
    createMidpointMarkers()
  }, [map, color, propagateChange, onMinVerticesWarning])

  // Update midpoint positions (called during vertex drag)
  const updateMidpointPositions = useCallback(() => {
    const coords = coordsRef.current
    midpointMarkersRef.current.forEach((marker, i) => {
      const nextIndex = (i + 1) % coords.length
      const midLat = (coords[i][1] + coords[nextIndex][1]) / 2
      const midLng = (coords[i][0] + coords[nextIndex][0]) / 2
      marker.setLatLng([midLat, midLng])
    })
  }, [])

  // Create midpoint markers
  const createMidpointMarkers = useCallback(() => {
    const coords = coordsRef.current
    const midpointMarkers: L.Marker[] = []

    coords.forEach((coord, index) => {
      const nextIndex = (index + 1) % coords.length
      const nextCoord = coords[nextIndex]

      const midLat = (coord[1] + nextCoord[1]) / 2
      const midLng = (coord[0] + nextCoord[0]) / 2

      const midpointIcon = L.divIcon({
        html: `<div style="
          width: 10px;
          height: 10px;
          background: ${color};
          opacity: 0.5;
          border: 2px solid white;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        "></div>`,
        className: 'midpoint-marker',
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      })

      const marker = L.marker([midLat, midLng], {
        icon: midpointIcon,
        draggable: false
      }).addTo(map)

      // Click to add vertex
      marker.on('click', () => {
        // Insert new vertex after current index
        coordsRef.current.splice(index + 1, 0, [midLng, midLat])
        propagateChange()
        rebuildMarkers()
      })

      midpointMarkers.push(marker)
    })

    midpointMarkersRef.current = midpointMarkers
  }, [map, color, propagateChange, rebuildMarkers])

  // Create and manage Leaflet elements directly
  useEffect(() => {
    const coords = extractCoordinates(parsedGeojson)
    coordsRef.current = coords

    // Create polygon
    const latLngs = coords.map(c => L.latLng(c[1], c[0]))
    const polygon = L.polygon(latLngs, {
      color: color,
      fillColor: color,
      fillOpacity: 0.2,
      weight: 2,
      dashArray: '5, 5'
    }).addTo(map)
    polygonRef.current = polygon

    // Build markers
    rebuildMarkers()

    // Cleanup
    return () => {
      polygon.remove()
      vertexMarkersRef.current.forEach(m => m.remove())
      midpointMarkersRef.current.forEach(m => m.remove())
    }
  }, [map, parsedGeojson, extractCoordinates, color, rebuildMarkers])

  // This component renders nothing - all rendering is done via Leaflet directly
  return null
}



function Parcels() {

  const { t } = useTranslation()
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

  // PDF export state
  const [isExportingPDF, setIsExportingPDF] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editArea, setEditArea] = useState('')
  const [editTrees, setEditTrees] = useState('')
  // New state for varieties
  const [editVarieties, setEditVarieties] = useState<any[]>([])
  // State for edited parcel geometry (for vertex editing)
  const [editGeometry, setEditGeometry] = useState<any>(null)
  // Drawing mode state
  const [drawingVarietyIndex, setDrawingVarietyIndex] = useState<number | null>(null)
  // Deleting plants mode state
  const [deletingPlantIndex, setDeletingPlantIndex] = useState<number | null>(null)
  // Highlighted variety for visualization
  const [highlightedVarietyIndex, setHighlightedVarietyIndex] = useState<number | null>(null)
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
      // Initialize editGeometry with current parcel geometry
      setEditGeometry(selectedParcel.geojson || null)
      setIsEditing(false)
      setDrawingVarietyIndex(null) // Reset drawing mode
      setDeletingPlantIndex(null) // Reset deleting mode
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
    setHighlightedVarietyIndex(null) // Reset variety highlight when selecting new parcel

    // Clear old data to prevent showing wrong data
    setNdviData(null)
    setWeatherData(null)
    setClimateProfile(null)

    // Try to fetch cached satellite data first (GET)
    // Only process new data (POST) if explicit save happens
    fetchLatestSatellite(parcel.ID)

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
        // Log error details for debugging
        const errorText = await response.text().catch(() => 'Unable to read error response')
        console.warn(`Failed to fetch climate profile for parcel ${parcelId}:`, response.status, errorText)
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

  // Helper function to convert hex color to RGB
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return { r, g, b }
  }

  // PDF Export function for parcel with varieties - draws geometry directly
  const exportParcelPDF = async () => {
    if (!selectedParcel) {
      toast.error('Please select a parcel first')
      return
    }

    if (!selectedParcel.geojson) {
      toast.error('Parcel has no geometry defined')
      return
    }

    setIsExportingPDF(true)
    toast.loading('Generating PDF...', { id: 'pdf-export' })

    try {
      // Parse parcel geometry
      const parcelGeojson = typeof selectedParcel.geojson === 'string'
        ? JSON.parse(selectedParcel.geojson)
        : selectedParcel.geojson

      // Get all coordinates from the parcel polygon
      let allCoords: [number, number][] = []

      const extractCoords = (geometry: any) => {
        if (geometry.type === 'Polygon') {
          return geometry.coordinates[0] // Outer ring
        } else if (geometry.type === 'MultiPolygon') {
          return geometry.coordinates.flat(2)
        } else if (geometry.type === 'Feature') {
          return extractCoords(geometry.geometry)
        } else if (geometry.type === 'FeatureCollection') {
          return geometry.features.flatMap((f: any) => extractCoords(f))
        }
        return []
      }

      allCoords = extractCoords(parcelGeojson)

      // Also collect tree coordinates from varieties
      const varietyTrees: { coords: [number, number][], varietyIdx: number }[] = []
      if (selectedParcel.varieties) {
        selectedParcel.varieties.forEach((variety: any, idx: number) => {
          if (variety.geojson) {
            const varGeojson = typeof variety.geojson === 'string'
              ? JSON.parse(variety.geojson)
              : variety.geojson

            const treeCoords: [number, number][] = []
            const extractPoints = (geom: any) => {
              if (geom.type === 'Point') {
                treeCoords.push(geom.coordinates)
              } else if (geom.type === 'MultiPoint') {
                geom.coordinates.forEach((c: [number, number]) => treeCoords.push(c))
              } else if (geom.type === 'Feature') {
                extractPoints(geom.geometry)
              } else if (geom.type === 'FeatureCollection') {
                geom.features.forEach((f: any) => extractPoints(f))
              } else if (geom.type === 'GeometryCollection') {
                geom.geometries.forEach((g: any) => extractPoints(g))
              }
            }
            extractPoints(varGeojson)
            if (treeCoords.length > 0) {
              varietyTrees.push({ coords: treeCoords, varietyIdx: idx })
              allCoords = allCoords.concat(treeCoords)
            }
          }
        })
      }

      if (allCoords.length === 0) {
        throw new Error('No coordinates found in parcel geometry')
      }

      // Calculate bounds
      const lngs = allCoords.map(c => c[0])
      const lats = allCoords.map(c => c[1])
      const minLng = Math.min(...lngs)
      const maxLng = Math.max(...lngs)
      const minLat = Math.min(...lats)
      const maxLat = Math.max(...lats)

      // Create PDF (A4 landscape)
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 15

      // Add title
      pdf.setFontSize(20)
      pdf.setFont('helvetica', 'bold')
      pdf.text(`Parcella: ${selectedParcel.name}`, margin, margin + 5)

      // Add parcel info
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      const infoY = margin + 12
      pdf.text(`${t('parcels.area')}: ${selectedParcel.area ? selectedParcel.area.toFixed(2) : '-'} ha`, margin, infoY)
      pdf.text(`${t('parcels.total_trees')}: ${selectedParcel.trees_count || '-'}`, margin + 50, infoY)
      pdf.text(`${t('parcels.generated')}: ${new Date().toLocaleDateString()}`, margin + 110, infoY)

      // Map area dimensions
      const mapAreaWidth = pageWidth - margin * 2 - 75
      const mapAreaHeight = pageHeight - margin * 2 - 25
      const mapAreaX = margin
      const mapAreaY = margin + 18

      // Draw map background
      pdf.setFillColor(240, 245, 240) // Light green background
      pdf.rect(mapAreaX, mapAreaY, mapAreaWidth, mapAreaHeight, 'F')

      // Calculate scale to fit parcel in map area with padding
      const padding = 10
      const geoWidth = maxLng - minLng
      const geoHeight = maxLat - minLat

      // Maintain aspect ratio
      const scaleX = (mapAreaWidth - padding * 2) / geoWidth
      const scaleY = (mapAreaHeight - padding * 2) / geoHeight
      const scale = Math.min(scaleX, scaleY)

      // Calculate offset to center the geometry
      const scaledWidth = geoWidth * scale
      const scaledHeight = geoHeight * scale
      const offsetX = mapAreaX + (mapAreaWidth - scaledWidth) / 2
      const offsetY = mapAreaY + (mapAreaHeight - scaledHeight) / 2

      // Function to convert geo coordinates to PDF coordinates
      const geoToPdf = (lng: number, lat: number): { x: number, y: number } => {
        // Note: Y is inverted because PDF Y grows downward, but lat grows upward
        const x = offsetX + (lng - minLng) * scale
        const y = offsetY + scaledHeight - (lat - minLat) * scale
        return { x, y }
      }

      // Draw parcel boundary with distinctive style
      pdf.setDrawColor(34, 85, 51) // Dark green border
      pdf.setFillColor(200, 230, 200) // Light green fill
      pdf.setLineWidth(1.5)

      // Get polygon coordinates
      let polygonCoords: [number, number][] = []
      if (parcelGeojson.type === 'Polygon') {
        polygonCoords = parcelGeojson.coordinates[0]
      } else if (parcelGeojson.type === 'Feature' && parcelGeojson.geometry.type === 'Polygon') {
        polygonCoords = parcelGeojson.geometry.coordinates[0]
      } else if (parcelGeojson.type === 'FeatureCollection') {
        // Find the first polygon feature
        const polyFeature = parcelGeojson.features.find((f: any) =>
          f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
        )
        if (polyFeature && polyFeature.geometry.type === 'Polygon') {
          polygonCoords = polyFeature.geometry.coordinates[0]
        }
      }

      if (polygonCoords.length > 0) {
        // Build polygon path
        const points: { x: number, y: number }[] = polygonCoords.map(c => geoToPdf(c[0], c[1]))

        // Draw polygon outline
        pdf.setLineWidth(2)
        pdf.setDrawColor(34, 85, 51)

        // Draw polygon manually
        for (let i = 0; i < points.length; i++) {
          const current = points[i]
          const next = points[(i + 1) % points.length]
          pdf.line(current.x, current.y, next.x, next.y)
        }
      }

      // Draw variety trees with unique symbols and initials
      varietyTrees.forEach(({ coords, varietyIdx }) => {
        const color = VARIETY_COLORS[varietyIdx % VARIETY_COLORS.length]
        const rgb = hexToRgb(color)
        const variety = selectedParcel.varieties[varietyIdx]
        const initials = getVarietyInitials(variety?.cultivar || '')

        pdf.setFillColor(rgb.r, rgb.g, rgb.b)
        pdf.setDrawColor(255, 255, 255)
        pdf.setLineWidth(0.3)

        coords.forEach(coord => {
          const pos = geoToPdf(coord[0], coord[1])
          const symbolSize = 3 // Increased from 1.5 to 3mm for better visibility

          // Ensure fill color is set before drawing each symbol
          pdf.setFillColor(rgb.r, rgb.g, rgb.b)
          pdf.setDrawColor(255, 255, 255)

          switch (varietyIdx % 6) {
            case 0: // Circle
              pdf.circle(pos.x, pos.y, symbolSize, 'FD')
              break
            case 1: // Square
              pdf.rect(pos.x - symbolSize, pos.y - symbolSize, symbolSize * 2, symbolSize * 2, 'FD')
              break
            case 2: // Triangle (pointing up)
              pdf.triangle(
                pos.x, pos.y - symbolSize * 1.2,
                pos.x - symbolSize, pos.y + symbolSize * 0.8,
                pos.x + symbolSize, pos.y + symbolSize * 0.8,
                'FD'
              )
              break
            case 3: // Diamond (two triangles)
              pdf.triangle(pos.x, pos.y - symbolSize, pos.x - symbolSize, pos.y, pos.x, pos.y + symbolSize, 'FD')
              pdf.setFillColor(rgb.r, rgb.g, rgb.b) // Reset color
              pdf.triangle(pos.x, pos.y - symbolSize, pos.x + symbolSize, pos.y, pos.x, pos.y + symbolSize, 'FD')
              break
            case 4: // Double circle (ring)
              pdf.circle(pos.x, pos.y, symbolSize * 1.2, 'FD')
              pdf.setFillColor(255, 255, 255)
              pdf.circle(pos.x, pos.y, symbolSize * 0.6, 'F')
              pdf.setFillColor(rgb.r, rgb.g, rgb.b)
              pdf.circle(pos.x, pos.y, symbolSize * 0.3, 'F')
              break
            case 5: // Hexagon
              pdf.triangle(pos.x - symbolSize, pos.y, pos.x - symbolSize * 0.5, pos.y - symbolSize * 0.9, pos.x + symbolSize * 0.5, pos.y - symbolSize * 0.9, 'FD')
              pdf.setFillColor(rgb.r, rgb.g, rgb.b)
              pdf.triangle(pos.x - symbolSize, pos.y, pos.x + symbolSize * 0.5, pos.y - symbolSize * 0.9, pos.x + symbolSize, pos.y, 'FD')
              pdf.setFillColor(rgb.r, rgb.g, rgb.b)
              pdf.triangle(pos.x - symbolSize, pos.y, pos.x + symbolSize, pos.y, pos.x + symbolSize * 0.5, pos.y + symbolSize * 0.9, 'FD')
              pdf.setFillColor(rgb.r, rgb.g, rgb.b)
              pdf.triangle(pos.x - symbolSize, pos.y, pos.x + symbolSize * 0.5, pos.y + symbolSize * 0.9, pos.x - symbolSize * 0.5, pos.y + symbolSize * 0.9, 'FD')
              break
          }

          // Add initials on top of symbol with semi-transparent background
          if (initials) {
            // Draw semi-transparent background (scaled with symbol)
            const bgWidth = symbolSize * 1.6
            const bgHeight = symbolSize * 1.1
            pdf.setFillColor(51, 51, 51) // #333
            pdf.setGState(pdf.GState({ opacity: 0.65 }))
            pdf.roundedRect(pos.x - bgWidth / 2, pos.y - bgHeight / 2, bgWidth, bgHeight, 0.3, 0.3, 'F')
            pdf.setGState(pdf.GState({ opacity: 1.0 }))

            // Draw initials text (increased from 2.5 to 6)
            pdf.setFontSize(6)
            pdf.setFont('helvetica', 'bold')
            pdf.setTextColor(255, 255, 255)
            const textWidth = pdf.getTextWidth(initials)
            pdf.text(initials, pos.x - textWidth / 2, pos.y + 1)
            pdf.setTextColor(0, 0, 0)
            pdf.setFont('helvetica', 'normal')
          }
        })
      })

      // Draw map border
      pdf.setDrawColor(100, 100, 100)
      pdf.setLineWidth(0.5)
      pdf.rect(mapAreaX, mapAreaY, mapAreaWidth, mapAreaHeight)

      // Add scale indicator on the map (bottom left corner)
      const scaleBarY = mapAreaY + mapAreaHeight - 10
      const scaleBarX = mapAreaX + 10

      // Calculate scale using center latitude for better accuracy
      const centerLat = (minLat + maxLat) / 2
      // Meters per degree of longitude at this latitude
      const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180)
      // Real-world width represented by the scaled geometry
      const realWorldWidthMeters = geoWidth * metersPerDegreeLng
      // Meters per mm on PDF
      const metersPerMm = realWorldWidthMeters / scaledWidth

      // Choose a nice round number for scale bar
      const rawDistance = metersPerMm * 40 // approximate distance for 40mm bar
      let niceDistance: number
      let scaleBarWidth: number

      // Round to nice values: 1, 2, 5, 10, 20, 50, 100, 200, 500, etc.
      const magnitude = Math.pow(10, Math.floor(Math.log10(rawDistance)))
      const normalized = rawDistance / magnitude
      if (normalized < 1.5) niceDistance = 1 * magnitude
      else if (normalized < 3.5) niceDistance = 2 * magnitude
      else if (normalized < 7.5) niceDistance = 5 * magnitude
      else niceDistance = 10 * magnitude

      // Calculate actual bar width for the nice distance
      scaleBarWidth = niceDistance / metersPerMm

      // Draw scale bar with improved visibility
      pdf.setDrawColor(0, 0, 0)
      pdf.setFillColor(255, 255, 255)
      pdf.setLineWidth(0.8)

      // White background rectangle for visibility with border
      pdf.rect(scaleBarX - 3, scaleBarY - 8, scaleBarWidth + 6, 16, 'FD')

      // Scale bar line (black and white segments for better visibility)
      pdf.setLineWidth(3)
      pdf.setDrawColor(0, 0, 0)
      pdf.line(scaleBarX, scaleBarY, scaleBarX + scaleBarWidth, scaleBarY)

      // Alternating black and white segments
      const segments = 4
      const segmentWidth = scaleBarWidth / segments
      for (let i = 0; i < segments; i++) {
        if (i % 2 === 0) {
          pdf.setFillColor(0, 0, 0)
        } else {
          pdf.setFillColor(255, 255, 255)
        }
        pdf.rect(scaleBarX + i * segmentWidth, scaleBarY - 1.5, segmentWidth, 3, 'F')
      }

      // End caps
      pdf.setLineWidth(1.5)
      pdf.setDrawColor(0, 0, 0)
      pdf.line(scaleBarX, scaleBarY - 4, scaleBarX, scaleBarY + 4)
      pdf.line(scaleBarX + scaleBarWidth, scaleBarY - 4, scaleBarX + scaleBarWidth, scaleBarY + 4)

      // Format distance text
      let distanceText: string
      if (niceDistance >= 1000) {
        distanceText = `${niceDistance / 1000} km`
      } else {
        distanceText = `${niceDistance} m`
      }

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(0, 0, 0)
      const scaleTextWidth = pdf.getTextWidth(distanceText)
      pdf.text(distanceText, scaleBarX + scaleBarWidth / 2 - scaleTextWidth / 2, scaleBarY + 7)
      pdf.setFont('helvetica', 'normal')

      // Add legend on the right side
      const legendX = mapAreaX + mapAreaWidth + 8
      const legendY = mapAreaY

      // Legend title
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.text(t('parcels.legend'), legendX, legendY + 5)

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      let currentY = legendY + 15

      // Draw parcel boundary symbol in legend
      pdf.setDrawColor(34, 85, 51)
      pdf.setFillColor(220, 237, 220)
      pdf.setLineWidth(1.5)
      pdf.rect(legendX, currentY - 3, 12, 8, 'FD')
      pdf.text(t('parcels.parcel_boundary'), legendX + 16, currentY + 2)
      currentY += 14

      // Varieties section with multi-column layout and pagination support
      if (selectedParcel.varieties && selectedParcel.varieties.length > 0) {
        const varieties = selectedParcel.varieties
        const varietyHeight = 14 // Height per variety entry
        const maxEntriesInSidebar = Math.floor((pageHeight - currentY - 10) / varietyHeight)

        // Check if we need to create a separate legend page
        const needsSeparatePage = varieties.length > maxEntriesInSidebar

        if (needsSeparatePage) {
          // Add reference on first page
          pdf.setFont('helvetica', 'bold')
          pdf.text(`${t('parcels.variety')}:`, legendX, currentY)
          pdf.setFont('helvetica', 'italic')
          pdf.setFontSize(8)
          pdf.text('(vedi pagina successiva)', legendX, currentY + 5)

          // Create new page for legend
          pdf.addPage()
          pdf.setFontSize(16)
          pdf.setFont('helvetica', 'bold')
          pdf.text(`${t('parcels.variety_legend')} - ${selectedParcel.name}`, margin, margin + 5)

          // Calculate columns layout
          const columnWidth = 90
          const columnsPerPage = Math.floor((pageWidth - margin * 2) / columnWidth)
          const entriesPerColumn = Math.floor((pageHeight - margin * 2 - 20) / varietyHeight)

          let currentColumn = 0
          let currentRow = 0
          let currentPageY = margin + 15

          pdf.setFontSize(9)
          pdf.setFont('helvetica', 'normal')

          varieties.forEach((variety: any, idx: number) => {
            // Check if we need a new page
            if (currentRow >= entriesPerColumn) {
              currentRow = 0
              currentColumn++

              if (currentColumn >= columnsPerPage) {
                pdf.addPage()
                currentColumn = 0
                currentPageY = margin + 15
              }
            }

            const columnX = margin + currentColumn * columnWidth
            const entryY = currentPageY + currentRow * varietyHeight

            // Draw symbol with initials
            const color = VARIETY_COLORS[idx % VARIETY_COLORS.length]
            const rgb = hexToRgb(color)
            const initials = getVarietyInitials(variety.cultivar || '')
            const treeCount = variety.geojson ? getTreeCount(variety.geojson) : 0

            pdf.setFillColor(rgb.r, rgb.g, rgb.b)
            pdf.setDrawColor(255, 255, 255)
            pdf.setLineWidth(0.3)

            const symbolX = columnX + 5
            const symbolY = entryY
            const legendSymbolSize = 4 // Larger for visibility

            // Ensure colors are set before drawing
            pdf.setFillColor(rgb.r, rgb.g, rgb.b)
            pdf.setDrawColor(255, 255, 255)

            switch (idx % 6) {
              case 0: // Circle
                pdf.circle(symbolX, symbolY, legendSymbolSize, 'FD')
                break
              case 1: // Square
                pdf.rect(symbolX - legendSymbolSize, symbolY - legendSymbolSize, legendSymbolSize * 2, legendSymbolSize * 2, 'FD')
                break
              case 2: // Triangle
                pdf.triangle(
                  symbolX, symbolY - legendSymbolSize * 1.2,
                  symbolX - legendSymbolSize, symbolY + legendSymbolSize * 0.8,
                  symbolX + legendSymbolSize, symbolY + legendSymbolSize * 0.8,
                  'FD'
                )
                break
              case 3: // Diamond
                pdf.triangle(symbolX, symbolY - legendSymbolSize, symbolX - legendSymbolSize, symbolY, symbolX, symbolY + legendSymbolSize, 'FD')
                pdf.setFillColor(rgb.r, rgb.g, rgb.b)
                pdf.triangle(symbolX, symbolY - legendSymbolSize, symbolX + legendSymbolSize, symbolY, symbolX, symbolY + legendSymbolSize, 'FD')
                break
              case 4: // Double circle (ring)
                pdf.circle(symbolX, symbolY, legendSymbolSize * 1.2, 'FD')
                pdf.setFillColor(255, 255, 255)
                pdf.circle(symbolX, symbolY, legendSymbolSize * 0.6, 'F')
                pdf.setFillColor(rgb.r, rgb.g, rgb.b)
                pdf.circle(symbolX, symbolY, legendSymbolSize * 0.3, 'F')
                break
              case 5: // Hexagon (using triangles)
                pdf.triangle(symbolX - legendSymbolSize, symbolY, symbolX - legendSymbolSize * 0.5, symbolY - legendSymbolSize * 0.9, symbolX + legendSymbolSize * 0.5, symbolY - legendSymbolSize * 0.9, 'FD')
                pdf.setFillColor(rgb.r, rgb.g, rgb.b)
                pdf.triangle(symbolX - legendSymbolSize, symbolY, symbolX + legendSymbolSize * 0.5, symbolY - legendSymbolSize * 0.9, symbolX + legendSymbolSize, symbolY, 'FD')
                pdf.setFillColor(rgb.r, rgb.g, rgb.b)
                pdf.triangle(symbolX - legendSymbolSize, symbolY, symbolX + legendSymbolSize, symbolY, symbolX + legendSymbolSize * 0.5, symbolY + legendSymbolSize * 0.9, 'FD')
                pdf.setFillColor(rgb.r, rgb.g, rgb.b)
                pdf.triangle(symbolX - legendSymbolSize, symbolY, symbolX + legendSymbolSize * 0.5, symbolY + legendSymbolSize * 0.9, symbolX - legendSymbolSize * 0.5, symbolY + legendSymbolSize * 0.9, 'FD')
                break
            }

            // Add initials with semi-transparent background
            if (initials) {
              const bgW = legendSymbolSize * 1.8
              const bgH = legendSymbolSize * 1.2
              pdf.setFillColor(51, 51, 51)
              pdf.setGState(pdf.GState({ opacity: 0.65 }))
              pdf.roundedRect(symbolX - bgW / 2, symbolY - bgH / 2, bgW, bgH, 0.4, 0.4, 'F')
              pdf.setGState(pdf.GState({ opacity: 1.0 }))

              pdf.setFontSize(6)
              pdf.setFont('helvetica', 'bold')
              pdf.setTextColor(255, 255, 255)
              const textWidth = pdf.getTextWidth(initials)
              pdf.text(initials, symbolX - textWidth / 2, symbolY + 1)
              pdf.setTextColor(0, 0, 0)
              pdf.setFont('helvetica', 'normal')
              pdf.setFontSize(9)
            }

            // Add variety name and tree count
            const varietyName = variety.cultivar || `${t('parcels.variety')} ${idx + 1}`
            pdf.text(varietyName, columnX + 12, entryY + 1)
            pdf.setFontSize(7)
            pdf.setTextColor(100, 100, 100)
            pdf.text(`(${treeCount} ${t('parcels.tree_count')})`, columnX + 12, entryY + 5)
            pdf.setFontSize(9)
            pdf.setTextColor(0, 0, 0)

            currentRow++
          })
        } else {
          // Fit in sidebar - original single column layout
          pdf.setFont('helvetica', 'bold')
          pdf.text(`${t('parcels.variety')}:`, legendX, currentY)
          currentY += 10

          pdf.setFont('helvetica', 'normal')
          varieties.forEach((variety: any, idx: number) => {
            const color = VARIETY_COLORS[idx % VARIETY_COLORS.length]
            const rgb = hexToRgb(color)
            const initials = getVarietyInitials(variety.cultivar || '')
            const treeCount = variety.geojson ? getTreeCount(variety.geojson) : 0

            pdf.setFillColor(rgb.r, rgb.g, rgb.b)
            pdf.setDrawColor(255, 255, 255)
            pdf.setLineWidth(0.3)

            const symbolX = legendX + 5
            const symbolY = currentY
            const legendSymbolSize = 4 // Larger for visibility

            // Ensure colors are set before drawing
            pdf.setFillColor(rgb.r, rgb.g, rgb.b)
            pdf.setDrawColor(255, 255, 255)

            switch (idx % 6) {
              case 0: // Circle
                pdf.circle(symbolX, symbolY, legendSymbolSize, 'FD')
                break
              case 1: // Square
                pdf.rect(symbolX - legendSymbolSize, symbolY - legendSymbolSize, legendSymbolSize * 2, legendSymbolSize * 2, 'FD')
                break
              case 2: // Triangle
                pdf.triangle(
                  symbolX, symbolY - legendSymbolSize * 1.2,
                  symbolX - legendSymbolSize, symbolY + legendSymbolSize * 0.8,
                  symbolX + legendSymbolSize, symbolY + legendSymbolSize * 0.8,
                  'FD'
                )
                break
              case 3: // Diamond
                pdf.triangle(symbolX, symbolY - legendSymbolSize, symbolX - legendSymbolSize, symbolY, symbolX, symbolY + legendSymbolSize, 'FD')
                pdf.setFillColor(rgb.r, rgb.g, rgb.b)
                pdf.triangle(symbolX, symbolY - legendSymbolSize, symbolX + legendSymbolSize, symbolY, symbolX, symbolY + legendSymbolSize, 'FD')
                break
              case 4: // Double circle (ring)
                pdf.circle(symbolX, symbolY, legendSymbolSize * 1.2, 'FD')
                pdf.setFillColor(255, 255, 255)
                pdf.circle(symbolX, symbolY, legendSymbolSize * 0.6, 'F')
                pdf.setFillColor(rgb.r, rgb.g, rgb.b)
                pdf.circle(symbolX, symbolY, legendSymbolSize * 0.3, 'F')
                break
              case 5: // Hexagon (using triangles)
                pdf.triangle(symbolX - legendSymbolSize, symbolY, symbolX - legendSymbolSize * 0.5, symbolY - legendSymbolSize * 0.9, symbolX + legendSymbolSize * 0.5, symbolY - legendSymbolSize * 0.9, 'FD')
                pdf.setFillColor(rgb.r, rgb.g, rgb.b)
                pdf.triangle(symbolX - legendSymbolSize, symbolY, symbolX + legendSymbolSize * 0.5, symbolY - legendSymbolSize * 0.9, symbolX + legendSymbolSize, symbolY, 'FD')
                pdf.setFillColor(rgb.r, rgb.g, rgb.b)
                pdf.triangle(symbolX - legendSymbolSize, symbolY, symbolX + legendSymbolSize, symbolY, symbolX + legendSymbolSize * 0.5, symbolY + legendSymbolSize * 0.9, 'FD')
                pdf.setFillColor(rgb.r, rgb.g, rgb.b)
                pdf.triangle(symbolX - legendSymbolSize, symbolY, symbolX + legendSymbolSize * 0.5, symbolY + legendSymbolSize * 0.9, symbolX - legendSymbolSize * 0.5, symbolY + legendSymbolSize * 0.9, 'FD')
                break
            }

            // Add initials with semi-transparent background
            if (initials) {
              const bgW = legendSymbolSize * 1.8
              const bgH = legendSymbolSize * 1.2
              pdf.setFillColor(51, 51, 51)
              pdf.setGState(pdf.GState({ opacity: 0.65 }))
              pdf.roundedRect(symbolX - bgW / 2, symbolY - bgH / 2, bgW, bgH, 0.4, 0.4, 'F')
              pdf.setGState(pdf.GState({ opacity: 1.0 }))

              pdf.setFontSize(6)
              pdf.setFont('helvetica', 'bold')
              pdf.setTextColor(255, 255, 255)
              const textWidth = pdf.getTextWidth(initials)
              pdf.text(initials, symbolX - textWidth / 2, symbolY + 1)
              pdf.setTextColor(0, 0, 0)
              pdf.setFont('helvetica', 'normal')
              pdf.setFontSize(9)
            }

            // Reset colors after initials to ensure proper symbol colors
            pdf.setFillColor(rgb.r, rgb.g, rgb.b)
            pdf.setDrawColor(255, 255, 255)

            const varietyName = variety.cultivar || `${t('parcels.variety')} ${idx + 1}`
            pdf.text(varietyName, legendX + 12, currentY + 1)
            pdf.setFontSize(7)
            pdf.setTextColor(100, 100, 100)
            pdf.text(`(${treeCount} ${t('parcels.tree_count')})`, legendX + 12, currentY + 5)
            pdf.setFontSize(9)
            pdf.setTextColor(0, 0, 0)

            currentY += 14
          })
        }
      } else {
        pdf.text(t('parcels.no_varieties_recorded'), legendX, currentY)
      }

      // Save the PDF
      pdf.save(`${selectedParcel.name.replace(/\s+/g, '_')}_mappa_parcella.pdf`)
      toast.success('PDF exported successfully!', { id: 'pdf-export' })
    } catch (error) {
      console.error('Failed to export PDF:', error)
      toast.error('Failed to export PDF', { id: 'pdf-export' })
    } finally {
      setIsExportingPDF(false)
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

  // Handle geometry change from EditablePolygon
  const handleGeometryChange = useCallback((newGeojson: any, areaHa: number) => {
    setEditGeometry(newGeojson)
    setEditArea(areaHa.toFixed(2))
  }, [])

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
      varieties: varietiesToSubmit,
      // Include edited geometry if it was modified
      geojson: editGeometry || selectedParcel.geojson
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
        setDeletingPlantIndex(null) // Reset deleting mode
        // If geometry changed, trigger satellite update
        // We delay this slightly to let the UI settle and avoid rapid updates
        if (editGeometry) {
          setTimeout(() => {
            processSatellite(updatedParcel.ID)
            toast.loading("Updating satellite data...", { duration: 2000 })
          }, 2000)
        }
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

  const fetchLatestSatellite = async (parcelId: number) => {
    try {
      // Use the new GET endpoint to fetch cached data
      const response = await apiCall(`/satellite/${parcelId}/latest`, {
        method: 'GET',
      })

      if (response.ok) {
        const json = await response.json()

        if (json.data) {
          const rawData = json.data

          // Parse image_bounds if it's a string
          let imageBounds = rawData.image_bounds
          if (typeof imageBounds === 'string') {
            try {
              imageBounds = JSON.parse(imageBounds)
            } catch (e) {
              console.error('Failed to parse image_bounds', e)
            }
          }

          // Map model fields to UI expected fields (ProcessSatellite response structure)
          // The model uses 'image_base64' for NDVI, but UI expects 'ndvi_image'
          const formattedData = {
            ...rawData,
            parcelId,
            ndvi_image: rawData.image_base64 || rawData.ndvi_image, // Fallback
            image_bounds: imageBounds,
            product_date: rawData.product_date,
            // Ensure other indices are present (model keys match UI expectations for these usually)
            ndwi_image: rawData.ndwi_image,
            ndmi_image: rawData.ndmi_image,
            evi_image: rawData.evi_image
          }

          setNdviData(formattedData)
        }
      } else if (response.status === 404) {
        // No cache exists - this is expected for new parcels or cleared cache
        // Trigger initial process/download
        await processSatellite(parcelId)
      }
    } catch (err) {
      console.error('Error fetching satellite data:', err)
      // safe fail - no data available or error
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
        toast.success("Satellite data updated")
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
      setDeletingPlantIndex(null) // Exit delete mode when entering draw mode
    }
  }

  const startDeletingPlants = (index: number) => {
    // Toggle delete mode - if already deleting for this variety, exit
    if (deletingPlantIndex === index) {
      setDeletingPlantIndex(null)
    } else {
      setDeletingPlantIndex(index)
      setDrawingVarietyIndex(null) // Exit draw mode when entering delete mode
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

  const removePlantPoint = useCallback((varietyIndex: number, geometryIndex: number) => {
    setEditVarieties(prevVarieties => {
      const newVarieties = [...prevVarieties]
      const currentVariety = newVarieties[varietyIndex]

      if (!currentVariety.geojson) return newVarieties

      const existingGeojson = typeof currentVariety.geojson === 'string'
        ? JSON.parse(currentVariety.geojson)
        : currentVariety.geojson

      if (existingGeojson.type === 'Point') {
        // Single point - remove it completely
        newVarieties[varietyIndex] = {
          ...currentVariety,
          geojson: null
        }
      } else if (existingGeojson.type === 'GeometryCollection') {
        // Remove the point at the specific geometry index
        const updatedGeometries = existingGeojson.geometries.filter((geom: any, idx: number) => {
          // Keep all geometries except the Point at geometryIndex
          return !(idx === geometryIndex && geom.type === 'Point')
        })

        // If no geometries left, set to null, otherwise update
        if (updatedGeometries.length === 0) {
          newVarieties[varietyIndex] = {
            ...currentVariety,
            geojson: null
          }
        } else if (updatedGeometries.length === 1) {
          // If only one geometry left, simplify to that geometry
          newVarieties[varietyIndex] = {
            ...currentVariety,
            geojson: updatedGeometries[0]
          }
        } else {
          newVarieties[varietyIndex] = {
            ...currentVariety,
            geojson: {
              type: 'GeometryCollection',
              geometries: updatedGeometries
            }
          }
        }
      }

      return newVarieties
    })
  }, [])

  const handleMarkerDragEnd = useCallback((varietyIndex: number, geometryIndex: number, newLatLng: L.LatLng) => {
    // Validate that the new position is inside the parcel boundary
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
          isInside = isPointInPolygon(newLatLng, polygonLatLngs)
        }

        if (!isInside) {
          toast.error('Trees can only be placed inside the parcel boundary')
          return
        }
      } catch (e) {
        console.error('Error validating point location:', e)
      }
    }

    // Update the specific point in the variety geometry
    setEditVarieties(prevVarieties => {
      const newVarieties = [...prevVarieties]
      const currentVariety = newVarieties[varietyIndex]

      if (!currentVariety.geojson) return newVarieties

      const existingGeojson = typeof currentVariety.geojson === 'string'
        ? JSON.parse(currentVariety.geojson)
        : currentVariety.geojson

      const updatedPoint = {
        type: 'Point',
        coordinates: [newLatLng.lng, newLatLng.lat]
      }

      if (existingGeojson.type === 'Point') {
        // Single point - replace it
        newVarieties[varietyIndex] = {
          ...currentVariety,
          geojson: updatedPoint
        }
      } else if (existingGeojson.type === 'GeometryCollection') {
        // Update the point at the specific geometry index
        const updatedGeometries = existingGeojson.geometries.map((geom: any, idx: number) => {
          if (idx === geometryIndex && geom.type === 'Point') {
            return updatedPoint
          }
          return geom
        })

        newVarieties[varietyIndex] = {
          ...currentVariety,
          geojson: {
            type: 'GeometryCollection',
            geometries: updatedGeometries
          }
        }
      }

      return newVarieties
    })
  }, [selectedParcel])

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

    let rafId: number | null = null
    let pendingWidth: number | null = null

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      // Clamp between 320px and 600px
      const clampedWidth = Math.min(600, Math.max(320, newWidth))

      // Store pending width
      pendingWidth = clampedWidth

      // Use requestAnimationFrame to batch DOM updates and reduce forced reflows
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          if (pendingWidth !== null) {
            setSidebarWidth(pendingWidth)
            pendingWidth = null
          }
          rafId = null
        })
      }
    }

    const handleMouseUp = () => {
      // Apply any pending width update before stopping
      if (pendingWidth !== null) {
        setSidebarWidth(pendingWidth)
        pendingWidth = null
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp)
    // Set cursor globally during resize
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [isResizing])

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev)
  }, [])

  return (
    <div className="h-full flex">
      {/* Left Sidebar - Parcel List */}
      <div
        className={`bg-white border-r border-gray-200 flex flex-col h-full shadow-xl z-10 transition-all duration-300 ${isLeftSidebarCollapsed ? 'w-14' : 'w-80'
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
                  className={`w-full p-2 mb-1 rounded-lg transition-all ${selectedParcel?.ID === parcel.ID
                    ? 'bg-green-100 border-2 border-green-500'
                    : 'hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  title={parcel.name}
                >
                  <div className={`w-2 h-2 rounded-full mx-auto ${selectedParcel?.ID === parcel.ID ? 'bg-green-500' : 'bg-gray-400'
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
            <LayersControl.BaseLayer name="OpenStreetMap">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'
                maxZoom={19}
                maxNativeZoom={19}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer checked name="Satellite with Labels">
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
                    {/* Show EditablePolygon when editing the selected parcel */}
                    {isEditing && selectedParcel?.ID === parcel.ID && editGeometry ? (
                      <EditablePolygon
                        geojson={editGeometry}
                        onGeometryChange={handleGeometryChange}
                        color="#22c55e"
                        onMinVerticesWarning={() => toast.error(t('parcels.min_vertices_warning'))}
                      />
                    ) : (
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
                    )}


                    {/* Render variety geometries for this parcel */}
                    {/* Display existing varieties from saved parcel (only when NOT editing) */}
                    {!isEditing && selectedParcel?.ID === parcel.ID && parcel.varieties && parcel.varieties.map((variety: any, vIdx: number) => {
                      if (variety.geojson) {
                        try {
                          const varietyGeojson = typeof variety.geojson === 'string'
                            ? JSON.parse(variety.geojson)
                            : variety.geojson

                          // Generate a color based on variety index
                          const color = VARIETY_COLORS[vIdx % VARIETY_COLORS.length]

                          // Determine highlight state
                          const isHighlighted = highlightedVarietyIndex === vIdx
                          const hasHighlight = highlightedVarietyIndex !== null
                          const isDimmed = hasHighlight && !isHighlighted

                          // Create unique key for re-rendering (include highlight state)
                          const treeCount = getTreeCount(variety.geojson)
                          const uniqueKey = `variety-${variety.ID || vIdx}-trees-${treeCount}-hl-${highlightedVarietyIndex}`

                          // Create variety icon with unique symbol
                          const varietyIcon = createVarietyIcon(vIdx, variety.cultivar)

                          // Only use opacity for highlighting/dimming - no scaling to avoid zoom issues
                          const opacity = isDimmed ? 0.4 : 1

                          return (
                            <GeoJSON
                              key={uniqueKey}
                              data={varietyGeojson}
                              pointToLayer={(_feature, latlng) => {
                                const marker = L.marker(latlng, {
                                  icon: varietyIcon,
                                  opacity: opacity
                                })
                                // Set z-index for highlighting without scaling
                                marker.on('add', () => {
                                  const el = marker.getElement()
                                  if (el) {
                                    el.style.zIndex = isHighlighted ? '1000' : '100'
                                  }
                                })
                                return marker
                              }}
                              style={() => ({
                                color: color,
                                fillColor: color,
                                fillOpacity: isDimmed ? 0.1 : (isHighlighted ? 0.5 : 0.3),
                                weight: isHighlighted ? 3 : 2,
                                opacity: isDimmed ? 0.3 : 1
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
                      const color = VARIETY_COLORS[vIdx % VARIETY_COLORS.length]

                      // Determine selection state (similar to highlight state in normal view)
                      // Include both drawing mode and delete mode
                      const isSelected = drawingVarietyIndex === vIdx || deletingPlantIndex === vIdx
                      const hasSelection = drawingVarietyIndex !== null || deletingPlantIndex !== null
                      const isDimmed = hasSelection && !isSelected

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

                        // Create variety icon with unique symbol
                        const varietyIcon = createVarietyIcon(vIdx, variety.cultivar)

                        // Only use opacity for selection/dimming - no scaling to avoid zoom issues
                        const opacity = isDimmed ? 0.4 : 1

                        // Extract points with their actual indices in GeometryCollection
                        const points: Array<{ latlng: L.LatLng, geometryIndex: number }> = []

                        if (varietyGeojson.type === 'Point') {
                          points.push({
                            latlng: L.latLng(varietyGeojson.coordinates[1], varietyGeojson.coordinates[0]),
                            geometryIndex: 0
                          })
                        } else if (varietyGeojson.type === 'GeometryCollection') {
                          varietyGeojson.geometries.forEach((geom: any, idx: number) => {
                            if (geom.type === 'Point') {
                              points.push({
                                latlng: L.latLng(geom.coordinates[1], geom.coordinates[0]),
                                geometryIndex: idx
                              })
                            }
                          })
                        }

                        return (
                          <React.Fragment key={uniqueKey}>
                            {/* Render polygons if any */}
                            {varietyGeojson.type === 'Polygon' && (
                              <GeoJSON
                                data={varietyGeojson}
                                style={() => ({
                                  color: color,
                                  fillColor: color,
                                  fillOpacity: isDimmed ? 0.1 : (isSelected ? 0.5 : 0.3),
                                  weight: isSelected ? 3 : 2,
                                  opacity: isDimmed ? 0.3 : 1
                                })}
                              />
                            )}
                            {varietyGeojson.type === 'GeometryCollection' && varietyGeojson.geometries.map((geom: any, idx: number) => {
                              if (geom.type === 'Polygon') {
                                return (
                                  <GeoJSON
                                    key={`polygon-${idx}`}
                                    data={geom}
                                    style={() => ({
                                      color: color,
                                      fillColor: color,
                                      fillOpacity: isDimmed ? 0.1 : (isSelected ? 0.5 : 0.3),
                                      weight: isSelected ? 3 : 2,
                                      opacity: isDimmed ? 0.3 : 1
                                    })}
                                  />
                                )
                              }
                              return null
                            })}

                            {/* Render draggable markers for points */}
                            {points.map(({ latlng, geometryIndex }) => (
                              <DraggableMarker
                                key={`marker-${vIdx}-${geometryIndex}`}
                                position={latlng}
                                icon={varietyIcon}
                                opacity={opacity}
                                scale={1}
                                zIndex={isSelected ? 1000 : 100}
                                onDragEnd={(newLatLng) => handleMarkerDragEnd(vIdx, geometryIndex, newLatLng)}
                                onRemove={deletingPlantIndex === vIdx ? () => removePlantPoint(vIdx, geometryIndex) : undefined}
                              />
                            ))}
                          </React.Fragment>
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
                  {/* Vertex editing hint */}
                  <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                    <span className="font-medium">✏️ {t('parcels.vertex_editing_hint')}</span>
                  </div>
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
                      {editVarieties.map((variety, idx) => {
                        const isSelected = drawingVarietyIndex === idx
                        return (
                          <div
                            key={idx}
                            className={`bg-white p-3 rounded-lg border shadow-sm text-xs transition-colors ${isSelected
                              ? 'border-green-500 bg-green-50 shadow-md'
                              : 'border-gray-200 hover:border-gray-300'
                              }`}
                          >
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
                              ) : deletingPlantIndex === idx ? (
                                <div className="flex items-center gap-2 w-full justify-between animate-pulse">
                                  <span className="text-xs text-red-700 flex items-center gap-1 font-medium">
                                    <Trash2 size={12} />
                                    Click plants to delete
                                  </span>
                                  <button
                                    onClick={() => setDeletingPlantIndex(null)}
                                    className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-md hover:bg-red-600 font-medium shadow-sm"
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
                                        onClick={() => startDeletingPlants(idx)}
                                        className={`text-xs p-1 rounded transition-colors ${deletingPlantIndex === idx
                                          ? 'text-red-600 bg-red-100'
                                          : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                          }`}
                                        title="Delete individual plants"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
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
                        setDeletingPlantIndex(null)
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
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                      <Trees size={16} className="text-green-600" />
                      Varieties & Layout
                    </h4>
                    {selectedParcel.varieties && selectedParcel.varieties.length > 0 && (
                      <button
                        onClick={exportParcelPDF}
                        disabled={isExportingPDF}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      >
                        <FileText size={14} />
                        {isExportingPDF ? 'Exporting...' : 'Export PDF'}
                      </button>
                    )}
                  </div>
                  {selectedParcel.varieties && selectedParcel.varieties.length > 0 ? (
                    <div className="space-y-2">
                      {selectedParcel.varieties.map((v: any, i: number) => {
                        const treeCount = v.geojson ? getTreeCount(v.geojson) : 0
                        const color = VARIETY_COLORS[i % VARIETY_COLORS.length]
                        const symbolFn = VARIETY_SYMBOLS[i % VARIETY_SYMBOLS.length]
                        const isHighlighted = highlightedVarietyIndex === i
                        return (
                          <div
                            key={i}
                            className={`p-3 rounded-lg border shadow-sm flex justify-between items-center cursor-pointer transition-all duration-200 ${isHighlighted
                              ? 'bg-gray-100 ring-2 ring-offset-1'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                              }`}
                            style={isHighlighted ? { borderColor: color, outlineColor: color } : {}}
                            onClick={() => setHighlightedVarietyIndex(isHighlighted ? null : i)}
                          >
                            <div className="flex items-center gap-3">
                              {/* Variety symbol */}
                              <div
                                className="w-6 h-6 flex-shrink-0"
                                dangerouslySetInnerHTML={{
                                  __html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${symbolFn(color)}</svg>`
                                }}
                              />
                              <div>
                                <span className="font-semibold text-gray-800 block">{v.cultivar || 'Unknown'}</span>
                                <span className="text-xs text-gray-500">Planted: {v.planting_date || 'N/A'}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-100">
                                {treeCount} trees
                              </span>
                            </div>
                          </div>
                        )
                      })}
                      {highlightedVarietyIndex !== null && (
                        <button
                          onClick={() => setHighlightedVarietyIndex(null)}
                          className="w-full text-xs text-gray-500 hover:text-gray-700 py-1 transition-colors"
                        >
                          Clear highlight
                        </button>
                      )}
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
                        <span className={`px-3 py-1.5 rounded-full text-sm font-medium border shadow-sm ${climateProfile.olive_suitability_score >= 80 ? 'bg-green-100 text-green-700 border-green-200' :
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

