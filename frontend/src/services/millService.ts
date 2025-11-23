import { apiCall } from '../config'

// ===== Mill Types =====

export interface Mill {
  ID?: number
  name: string
  address?: string
  city?: string
  region?: string
  country?: string
  phone?: string
  email?: string
  contact_person?: string
  mill_type?: string // traditional, continuous, cooperative
  capacity?: number // kg/hour
  certified_organic?: boolean
  certified_dop?: boolean
  certified_igp?: boolean
  notes?: string
  active?: boolean
}

export interface OliveDelivery {
  ID?: number
  mill_id: number
  mill?: Mill
  harvest_log_id?: number
  delivery_date: string
  parcel_id: number
  parcel?: any // Parcel type from parcels service
  cultivar?: string
  quantity_kg: number
  containers_count?: number
  delivery_number?: string
  processing_type?: string // immediate, stored, specific_batch
  quality?: string // excellent, good, fair, poor
  temperature?: number // °C
  damaged_fruit?: number // %
  foreign_matter?: number // %
  processed_date?: string
  notes?: string
}

export interface OilBatch {
  ID?: number
  mill_id: number
  mill?: Mill
  batch_number: string
  production_date: string
  oil_type?: string // extra_virgin, virgin, lampante
  processing_method?: string // cold_extraction, continuous, traditional
  extraction_temp?: number // °C
  monocultivar?: boolean
  cultivar?: string
  quantity_liters: number
  yield_percentage?: number
  storage_location?: string
  status?: string // stored, bottled, sold
  notes?: string
}

export interface OilBatchSource {
  oil_batch_id: number
  olive_delivery_id: number
  quantity_kg: number
  contribution_pct: number
}

export interface OilQualityAnalysis {
  ID?: number
  oil_batch_id: number
  oil_batch?: OilBatch
  analysis_date: string
  laboratory?: string

  // Chemical parameters (EU Regulation 2568/91)
  free_acidity?: number // %
  peroxide_value?: number // meq O2/kg
  k232?: number // UV absorption
  k270?: number // UV absorption
  delta_k?: number // ΔK

  // Organoleptic parameters
  fruity_median?: number // 0-10 scale
  bitter_median?: number // 0-10 scale
  pungent_median?: number // 0-10 scale
  defects_median?: number // 0-10 scale

  // Additional quality indicators
  polyphenols?: number // mg/kg
  tocopherols?: number // mg/kg

  // Classification
  classification?: string // extra_virgin, virgin, lampante, defective
  certified?: boolean
  notes?: string
  analysis_report?: string
}

export interface OilBottling {
  ID?: number
  oil_batch_id: number
  oil_batch?: OilBatch
  bottling_date: string
  quantity_liters: number
  bottle_size?: number // liters per bottle
  bottles_count?: number
  lot_number?: string
  label_type?: string // standard, premium, organic, dop
  expiry_date?: string
  destination?: string // wholesale, retail, direct, export
  cost?: number
  notes?: string
}

export interface OilSale {
  ID?: number
  oil_batch_id?: number
  oil_batch?: OilBatch
  bottling_id?: number
  bottling?: OilBottling
  sale_date: string
  customer?: string
  quantity_liters: number
  price_per_liter: number
  total_amount: number
  payment_method?: string // cash, transfer, card, credit
  payment_status?: string // pending, paid, partial
  invoice_number?: string
  notes?: string
}

export interface ProductionStats {
  year: number
  total_batches: number
  total_liters: number
  evoo_liters: number
  evoo_percentage: number
  average_yield_pct: number
}

// ===== Mill Service =====

export const millService = {
  // ===== Mill Management =====
  createMill: async (mill: Mill) => {
    const response = await apiCall('/mills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mill),
    })
    if (!response.ok) throw new Error('Failed to create mill')
    return response.json()
  },

  getMills: async (activeOnly: boolean = true) => {
    const params = new URLSearchParams()
    if (activeOnly) params.append('active_only', 'true')

    const query = params.toString() ? `/mills?${params.toString()}` : '/mills'
    const response = await apiCall(query)
    if (!response.ok) throw new Error('Failed to fetch mills')
    return response.json()
  },

  getMill: async (millId: number) => {
    const response = await apiCall(`/mills/${millId}`)
    if (!response.ok) throw new Error('Failed to fetch mill')
    return response.json()
  },

  updateMill: async (millId: number, updates: Partial<Mill>) => {
    const response = await apiCall(`/mills/${millId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!response.ok) throw new Error('Failed to update mill')
    return response.json()
  },

  deleteMill: async (millId: number) => {
    const response = await apiCall(`/mills/${millId}`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('Failed to delete mill')
    return response.json()
  },

  // ===== Delivery Management =====
  createDelivery: async (delivery: OliveDelivery) => {
    const response = await apiCall('/deliveries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(delivery),
    })
    if (!response.ok) throw new Error('Failed to create delivery')
    return response.json()
  },

  getDeliveries: async (millId?: number, parcelId?: number, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (millId) params.append('mill_id', millId.toString())
    if (parcelId) params.append('parcel_id', parcelId.toString())
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)

    const query = params.toString() ? `/deliveries?${params.toString()}` : '/deliveries'
    const response = await apiCall(query)
    if (!response.ok) throw new Error('Failed to fetch deliveries')
    return response.json()
  },

  updateDelivery: async (deliveryId: number, updates: Partial<OliveDelivery>) => {
    const response = await apiCall(`/deliveries/${deliveryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!response.ok) throw new Error('Failed to update delivery')
    return response.json()
  },

  deleteDelivery: async (deliveryId: number) => {
    const response = await apiCall(`/deliveries/${deliveryId}`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('Failed to delete delivery')
    return response.json()
  },

  // ===== Oil Batch Management =====
  createOilBatch: async (batch: OilBatch, sourceDeliveryIds: number[]) => {
    const payload = {
      batch,
      source_delivery_ids: sourceDeliveryIds,
    }

    console.log('Sending payload:', JSON.stringify(payload, null, 2))

    const response = await apiCall('/oil-batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    
    if (!response.ok) {
      let errorMessage = 'Failed to create oil batch'
      try {
        const errorData = await response.json()
        console.error('Backend error response:', errorData)
        errorMessage = errorData.error || errorMessage
      } catch (e) {
        console.error('Failed to parse error response:', e)
        errorMessage = `HTTP ${response.status}: ${response.statusText}`
      }
      throw new Error(errorMessage)
    }
    return response.json()
  },

  getOilBatches: async (millId?: number, status?: string) => {
    const params = new URLSearchParams()
    if (millId) params.append('mill_id', millId.toString())
    if (status) params.append('status', status)

    const query = params.toString() ? `/oil-batches?${params.toString()}` : '/oil-batches'
    const response = await apiCall(query)
    if (!response.ok) throw new Error('Failed to fetch oil batches')
    return response.json()
  },

  getOilBatch: async (batchId: number) => {
    const response = await apiCall(`/oil-batches/${batchId}`)
    if (!response.ok) throw new Error('Failed to fetch oil batch')
    return response.json()
  },

  updateOilBatch: async (batchId: number, updates: Partial<OilBatch>) => {
    const response = await apiCall(`/oil-batches/${batchId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!response.ok) throw new Error('Failed to update oil batch')
    return response.json()
  },

  getBatchTraceability: async (batchId: number) => {
    const response = await apiCall(`/oil-batches/traceability/${batchId}`)
    if (!response.ok) throw new Error('Failed to fetch batch traceability')
    return response.json()
  },

  // ===== Quality Analysis =====
  createQualityAnalysis: async (analysis: OilQualityAnalysis) => {
    const response = await apiCall('/quality-analyses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(analysis),
    })
    if (!response.ok) throw new Error('Failed to create quality analysis')
    return response.json()
  },

  getQualityAnalyses: async (batchId: number) => {
    const response = await apiCall(`/quality-analyses/${batchId}`)
    if (!response.ok) throw new Error('Failed to fetch quality analyses')
    return response.json()
  },

  // ===== Bottling Management =====
  createBottling: async (bottling: OilBottling) => {
    const response = await apiCall('/bottlings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bottling),
    })
    if (!response.ok) throw new Error('Failed to create bottling')
    return response.json()
  },

  getBottlings: async (batchId?: number) => {
    const params = new URLSearchParams()
    if (batchId) params.append('batch_id', batchId.toString())

    const query = params.toString() ? `/bottlings?${params.toString()}` : '/bottlings'
    const response = await apiCall(query)
    if (!response.ok) throw new Error('Failed to fetch bottlings')
    return response.json()
  },

  // ===== Sales Management =====
  createSale: async (sale: OilSale) => {
    const response = await apiCall('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sale),
    })
    if (!response.ok) throw new Error('Failed to create sale')
    return response.json()
  },

  getSales: async (startDate?: string, endDate?: string, batchId?: number) => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    if (batchId) params.append('batch_id', batchId.toString())

    const query = params.toString() ? `/sales?${params.toString()}` : '/sales'
    const response = await apiCall(query)
    if (!response.ok) throw new Error('Failed to fetch sales')
    return response.json()
  },

  updateSale: async (saleId: number, updates: Partial<OilSale>) => {
    const response = await apiCall(`/sales/${saleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!response.ok) throw new Error('Failed to update sale')
    return response.json()
  },

  // ===== Production Statistics =====
  getProductionStats: async (millId?: number, year?: number) => {
    const params = new URLSearchParams()
    if (millId) params.append('mill_id', millId.toString())
    if (year) params.append('year', year.toString())

    const query = params.toString() ? `/production/stats?${params.toString()}` : '/production/stats'
    const response = await apiCall(query)
    if (!response.ok) throw new Error('Failed to fetch production stats')
    return response.json()
  },
}
