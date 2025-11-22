import React, { useState, useEffect } from 'react'
import { Save, X, Loader2 } from 'lucide-react'
import { harvestService, type HarvestLog } from '../../services/harvestService'
import { API_URL } from '../../config'

interface HarvestLogFormProps {
    onSuccess: () => void
    onCancel: () => void
    initialData?: HarvestLog
}

export function HarvestLogForm({ onSuccess, onCancel, initialData }: HarvestLogFormProps) {
    const [loading, setLoading] = useState(false)
    const [parcels, setParcels] = useState<any[]>([])
    const [formData, setFormData] = useState<Partial<HarvestLog>>(() => {
        const defaults = {
            date: new Date().toISOString().split('T')[0],
            quantity_kg: 0,
            quality: 'good',
            harvest_method: 'manual',
            workers: 0,
            labor_hours: 0,
            cost: 0,
        }

        if (!initialData) return defaults

        // Ensure all numeric fields are valid numbers
        return {
            ...defaults,
            ...initialData,
            quantity_kg: typeof initialData.quantity_kg === 'number' && !isNaN(initialData.quantity_kg) ? initialData.quantity_kg : 0,
            workers: typeof initialData.workers === 'number' && !isNaN(initialData.workers) ? initialData.workers : 0,
            labor_hours: typeof initialData.labor_hours === 'number' && !isNaN(initialData.labor_hours) ? initialData.labor_hours : 0,
            cost: typeof initialData.cost === 'number' && !isNaN(initialData.cost) ? initialData.cost : 0,
        }
    })

    useEffect(() => {
        fetchParcels()
    }, [])

    const fetchParcels = async () => {
        try {
            const response = await fetch(`${API_URL}/parcels`)
            const data = await response.json()
            setParcels(data)
            // Set default parcel if none selected and parcels exist
            if (!formData.parcel_id && data.length > 0) {
                setFormData(prev => ({ ...prev, parcel_id: data[0].ID }))
            }
        } catch (err) {
            console.error('Failed to fetch parcels', err)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            if (initialData?.ID) {
                await harvestService.updateHarvest(initialData.ID, formData)
            } else {
                await harvestService.logHarvest(formData as HarvestLog)
            }
            onSuccess()
        } catch (err) {
            console.error('Failed to save harvest log', err)
            alert('Failed to save harvest log')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                    {initialData ? 'Edit Harvest Log' : 'Log New Harvest'}
                </h3>
                <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                        type="date"
                        required
                        value={formData.date}
                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parcel</label>
                    <select
                        required
                        value={formData.parcel_id || ''}
                        onChange={e => setFormData({ ...formData, parcel_id: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                        <option value="">Select Parcel</option>
                        {parcels.map(p => (
                            <option key={p.ID} value={p.ID}>{p.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (kg)</label>
                    <input
                        type="number"
                        required
                        min="0"
                        step="0.1"
                        value={formData.quantity_kg || ''}
                        onChange={e => {
                            const value = e.target.value
                            setFormData({ ...formData, quantity_kg: value === '' ? 0 : parseFloat(value) || 0 })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quality</label>
                    <select
                        value={formData.quality}
                        onChange={e => setFormData({ ...formData, quality: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                        <option value="excellent">Excellent</option>
                        <option value="good">Good</option>
                        <option value="fair">Fair</option>
                        <option value="poor">Poor</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cultivar</label>
                    <input
                        type="text"
                        value={formData.cultivar || ''}
                        onChange={e => setFormData({ ...formData, cultivar: e.target.value })}
                        placeholder="e.g. Frantoio"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Harvest Method</label>
                    <select
                        value={formData.harvest_method}
                        onChange={e => setFormData({ ...formData, harvest_method: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                        <option value="manual">Manual</option>
                        <option value="mechanical">Mechanical</option>
                        <option value="mixed">Mixed</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Workers</label>
                    <input
                        type="number"
                        min="0"
                        value={formData.workers || ''}
                        onChange={e => {
                            const value = e.target.value
                            setFormData({ ...formData, workers: value === '' ? 0 : parseInt(value) || 0 })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Labor Hours</label>
                    <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.labor_hours || ''}
                        onChange={e => {
                            const value = e.target.value
                            setFormData({ ...formData, labor_hours: value === '' ? 0 : parseFloat(value) || 0 })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Cost (€)</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.cost || ''}
                        onChange={e => {
                            const value = e.target.value
                            setFormData({ ...formData, cost: value === '' ? 0 : parseFloat(value) || 0 })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                        value={formData.notes || ''}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Save Harvest Log
                </button>
            </div>
        </form>
    )
}
