import { apiCall } from '../config'

export interface HarvestLog {
  ID?: number
  parcel_id: number
  date: string
  cultivar?: string
  quantity_kg: number
  quality?: string
  destination?: string
  lot_number?: string
  labor_hours?: number
  workers?: number
  harvest_method?: string
  cost?: number
  price_per_kg?: number
  revenue?: number
  maturity_index?: number
  notes?: string
  weather_at_harvest?: string
}

export interface YieldPrediction {
  ID?: number
  parcel_id: number
  year: number
  prediction_date?: string
  predicted_yield_kg: number
  predicted_yield_per_tree?: number
  confidence_level?: string
  method?: string
  actual_yield_kg?: number
  accuracy?: number
  notes?: string
  factors?: string
}

export interface YieldStats {
  parcel_id: number
  parcel_name: string
  year: number
  total_yield_kg: number
  yield_per_hectare: number
  yield_per_tree: number
  harvest_count: number
  average_quality: string
  total_revenue: number
  average_price_per_kg: number
}

export interface CostSummary {
  parcel_id: number
  parcel_name: string
  start_date: string
  end_date: string
  operations_cost: number
  harvest_cost: number
  treatment_cost: number
  irrigation_cost: number
  total_cost: number
  total_revenue: number
  net_profit: number
  roi: number
}

export const harvestService = {
  // Harvest Logs
  logHarvest: async (harvest: HarvestLog) => {
    const response = await apiCall('/harvests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(harvest),
    })
    if (!response.ok) throw new Error('Failed to log harvest')
    return response.json()
  },

  getHarvestHistory: async (parcelId: number, startDate?: string, endDate?: string) => {
    let query = `/harvests/${parcelId}`
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    if (params.toString()) query += `?${params.toString()}`

    const response = await apiCall(query)
    if (!response.ok) throw new Error('Failed to fetch harvest history')
    return response.json()
  },

  getAllHarvests: async (startDate?: string, endDate?: string, parcelId?: number) => {
    let query = '/harvests'
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    if (parcelId) params.append('parcel_id', parcelId.toString())
    if (params.toString()) query += `?${params.toString()}`

    const response = await apiCall(query)
    if (!response.ok) throw new Error('Failed to fetch all harvests')
    return response.json()
  },

  updateHarvest: async (id: number, updates: Partial<HarvestLog>) => {
    const response = await apiCall(`/harvests/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!response.ok) throw new Error('Failed to update harvest')
    return response.json()
  },

  deleteHarvest: async (id: number) => {
    const response = await apiCall(`/harvests/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('Failed to delete harvest')
    return response.json()
  },

  // Statistics
  getYieldStats: async (parcelId: number, year?: number) => {
    let query = `/yield/stats/${parcelId}`
    if (year) query += `?year=${year}`

    const response = await apiCall(query)
    if (!response.ok) throw new Error('Failed to fetch yield stats')
    return response.json()
  },

  getCostSummary: async (parcelId: number, startDate?: string, endDate?: string) => {
    let query = `/costs/summary/${parcelId}`
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    if (params.toString()) query += `?${params.toString()}`

    const response = await apiCall(query)
    if (!response.ok) throw new Error('Failed to fetch cost summary')
    return response.json()
  },

  // Predictions
  createPrediction: async (prediction: YieldPrediction) => {
    const response = await apiCall('/yield/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prediction),
    })
    if (!response.ok) throw new Error('Failed to create prediction')
    return response.json()
  },

  getPredictions: async (parcelId: number, year?: number) => {
    let query = `/yield/predictions/${parcelId}`
    if (year) query += `?year=${year}`

    const response = await apiCall(query)
    if (!response.ok) throw new Error('Failed to fetch predictions')
    return response.json()
  },

  generatePrediction: async (parcelId: number, year?: number, yearsBack: number = 5) => {
    let query = `/yield/predict/${parcelId}?years_back=${yearsBack}`
    if (year) query += `&year=${year}`

    const response = await apiCall(query, {
      method: 'POST',
    })
    if (!response.ok) throw new Error('Failed to generate prediction')
    return response.json()
  }
}
