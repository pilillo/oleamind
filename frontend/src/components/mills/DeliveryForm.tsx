import React, { useState, useEffect } from 'react'
import { Save, X, Loader2, Truck } from 'lucide-react'
import { millService, type OliveDelivery, type Mill } from '../../services/millService'
import { apiCall } from '../../config'

interface DeliveryFormProps {
    onSuccess: () => void
    onCancel: () => void
    initialData?: OliveDelivery
}

export function DeliveryForm({ onSuccess, onCancel, initialData }: DeliveryFormProps) {
    const [loading, setLoading] = useState(false)
    const [mills, setMills] = useState<Mill[]>([])
    const [parcels, setParcels] = useState<any[]>([])

    const [formData, setFormData] = useState<Partial<OliveDelivery>>({
        delivery_date: new Date().toISOString().split('T')[0],
        quantity_kg: 0,
        quality: 'good',
        processing_type: 'immediate',
        cultivar: '',
        temperature: 0,
        notes: '',
        ...initialData
    })

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [millsData, parcelsRes] = await Promise.all([
                    millService.getMills(true),
                    apiCall('/parcels')
                ])

                setMills(millsData)

                if (parcelsRes.ok) {
                    const parcelsData = await parcelsRes.json()
                    setParcels(parcelsData)
                }
            } catch (err) {
                console.error('Failed to fetch form data', err)
            }
        }
        fetchData()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            if (initialData?.ID) {
                await millService.updateDelivery(initialData.ID, formData)
            } else {
                await millService.createDelivery(formData as OliveDelivery)
            }
            onSuccess()
        } catch (err) {
            console.error('Failed to save delivery', err)
            alert('Failed to save delivery')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <Truck className="text-blue-600" size={24} />
                    <h3 className="text-lg font-semibold text-gray-800">
                        {initialData ? 'Edit Delivery' : 'Record Delivery'}
                    </h3>
                </div>
                <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Date & Mill Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date *</label>
                    <input
                        type="date"
                        required
                        value={formData.delivery_date?.split('T')[0]}
                        onChange={e => setFormData({ ...formData, delivery_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Destination Mill *</label>
                    <select
                        required
                        value={formData.mill_id || ''}
                        onChange={e => setFormData({ ...formData, mill_id: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Select Mill</option>
                        {mills.map(mill => (
                            <option key={mill.ID} value={mill.ID}>{mill.name}</option>
                        ))}
                    </select>
                </div>

                {/* Parcel & Cultivar */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Source Parcel *</label>
                    <select
                        required
                        value={formData.parcel_id || ''}
                        onChange={e => setFormData({ ...formData, parcel_id: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Select Parcel</option>
                        {parcels.map(parcel => (
                            <option key={parcel.ID} value={parcel.ID}>{parcel.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cultivar</label>
                    <input
                        type="text"
                        value={formData.cultivar || ''}
                        onChange={e => setFormData({ ...formData, cultivar: e.target.value })}
                        placeholder="e.g. Frantoio"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Quantity & Quality */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (kg) *</label>
                    <input
                        type="number"
                        required
                        min="0"
                        step="0.1"
                        value={formData.quantity_kg || ''}
                        onChange={e => setFormData({ ...formData, quantity_kg: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quality Assessment</label>
                    <select
                        value={formData.quality || 'good'}
                        onChange={e => setFormData({ ...formData, quality: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="excellent">Excellent</option>
                        <option value="good">Good</option>
                        <option value="fair">Fair</option>
                        <option value="poor">Poor</option>
                    </select>
                </div>

                {/* Processing Details */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Processing Type</label>
                    <select
                        value={formData.processing_type || 'immediate'}
                        onChange={e => setFormData({ ...formData, processing_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="immediate">Immediate</option>
                        <option value="stored">Stored</option>
                        <option value="specific_batch">Specific Batch</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (°C)</label>
                    <input
                        type="number"
                        step="0.1"
                        value={formData.temperature || ''}
                        onChange={e => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                        placeholder="e.g. 24.5"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                        value={formData.notes || ''}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        placeholder="Additional notes..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {initialData ? 'Update Delivery' : 'Record Delivery'}
                </button>
            </div>
        </form>
    )
}
