import React, { useState, useEffect } from 'react'
import { Save, X, Loader2, Droplets } from 'lucide-react'
import { millService, type OilBatch, type Mill, type OliveDelivery } from '../../services/millService'

interface BatchFormProps {
    onSuccess: () => void
    onCancel: () => void
    initialData?: OilBatch
}

export function BatchForm({ onSuccess, onCancel, initialData }: BatchFormProps) {
    const [loading, setLoading] = useState(false)
    const [mills, setMills] = useState<Mill[]>([])
    const [deliveries, setDeliveries] = useState<OliveDelivery[]>([])
    const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<number[]>([])

    const [formData, setFormData] = useState<Partial<OilBatch>>({
        batch_number: `BATCH-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
        production_date: new Date().toISOString().split('T')[0],
        quantity_liters: 0,
        oil_type: 'extra_virgin',
        processing_method: 'continuous',
        extraction_temp: 24,
        monocultivar: false,
        cultivar: '',
        storage_location: '',
        status: 'stored',
        notes: '',
        ...initialData
    })

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [millsData, deliveriesData] = await Promise.all([
                    millService.getMills(true),
                    millService.getDeliveries() // Ideally filter for unprocessed deliveries
                ])
                setMills(millsData)
                setDeliveries(deliveriesData)
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
                await millService.updateOilBatch(initialData.ID, formData)
            } else {
                await millService.createOilBatch(formData as OilBatch, selectedDeliveryIds)
            }
            onSuccess()
        } catch (err) {
            console.error('Failed to save batch', err)
            alert('Failed to save batch')
        } finally {
            setLoading(false)
        }
    }

    const toggleDelivery = (id: number) => {
        setSelectedDeliveryIds(prev =>
            prev.includes(id) ? prev.filter(dId => dId !== id) : [...prev, id]
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <Droplets className="text-amber-600" size={24} />
                    <h3 className="text-lg font-semibold text-gray-800">
                        {initialData ? 'Edit Oil Batch' : 'Create Oil Batch'}
                    </h3>
                </div>
                <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number *</label>
                    <input
                        type="text"
                        required
                        value={formData.batch_number || ''}
                        onChange={e => setFormData({ ...formData, batch_number: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Production Date *</label>
                    <input
                        type="date"
                        required
                        value={formData.production_date?.split('T')[0]}
                        onChange={e => setFormData({ ...formData, production_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mill *</label>
                    <select
                        required
                        value={formData.mill_id || ''}
                        onChange={e => setFormData({ ...formData, mill_id: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    >
                        <option value="">Select Mill</option>
                        {mills.map(mill => (
                            <option key={mill.ID} value={mill.ID}>{mill.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (Liters) *</label>
                    <input
                        type="number"
                        required
                        min="0"
                        step="0.1"
                        value={formData.quantity_liters || ''}
                        onChange={e => setFormData({ ...formData, quantity_liters: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                </div>

                {/* Technical Details */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Oil Type</label>
                    <select
                        value={formData.oil_type || 'extra_virgin'}
                        onChange={e => setFormData({ ...formData, oil_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    >
                        <option value="extra_virgin">Extra Virgin</option>
                        <option value="virgin">Virgin</option>
                        <option value="lampante">Lampante</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Processing Method</label>
                    <select
                        value={formData.processing_method || 'continuous'}
                        onChange={e => setFormData({ ...formData, processing_method: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    >
                        <option value="cold_extraction">Cold Extraction</option>
                        <option value="continuous">Continuous Cycle</option>
                        <option value="traditional">Traditional Press</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Extraction Temp (°C)</label>
                    <input
                        type="number"
                        step="0.1"
                        value={formData.extraction_temp || ''}
                        onChange={e => setFormData({ ...formData, extraction_temp: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Storage Location</label>
                    <input
                        type="text"
                        value={formData.storage_location || ''}
                        onChange={e => setFormData({ ...formData, storage_location: e.target.value })}
                        placeholder="e.g. Tank 3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                </div>

                {/* Source Deliveries Selection - Only for new batches */}
                {!initialData && (
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Source Deliveries</label>
                        <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto p-2">
                            {deliveries.length === 0 ? (
                                <p className="text-sm text-gray-500 p-2">No deliveries available.</p>
                            ) : (
                                <div className="space-y-2">
                                    {deliveries.map(delivery => (
                                        <label key={delivery.ID} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedDeliveryIds.includes(delivery.ID!)}
                                                onChange={() => toggleDelivery(delivery.ID!)}
                                                className="text-amber-600 focus:ring-amber-500"
                                            />
                                            <div className="flex-1">
                                                <div className="flex justify-between">
                                                    <span className="font-medium text-sm">#{delivery.delivery_number || delivery.ID}</span>
                                                    <span className="text-sm text-gray-500">{delivery.quantity_kg} kg</span>
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {new Date(delivery.delivery_date).toLocaleDateString()} - {delivery.cultivar || 'Mixed'}
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Select deliveries processed in this batch.</p>
                    </div>
                )}

                {/* Notes */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                        value={formData.notes || ''}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        placeholder="Additional notes..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
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
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {initialData ? 'Update Batch' : 'Create Batch'}
                </button>
            </div>
        </form>
    )
}
