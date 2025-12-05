import React, { useState, useEffect } from 'react'
import { Save, X, Loader2, Wine } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { millService, type OilBottling, type OilBatch } from '../../services/millService'

interface BottlingFormProps {
    onSuccess: () => void
    onCancel: () => void
}

export function BottlingForm({ onSuccess, onCancel }: BottlingFormProps) {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(false)
    const [batches, setBatches] = useState<OilBatch[]>([])

    const [formData, setFormData] = useState<Partial<OilBottling>>({
        bottling_date: new Date().toISOString().split('T')[0],
        quantity_liters: 0,
        bottle_size: 0.75,
        bottles_count: 0,
        lot_number: `L${new Date().getFullYear()}${Math.floor(Math.random() * 1000)}`,
        label_type: 'standard',
        destination: 'retail',
        notes: ''
    })

    useEffect(() => {
        const fetchBatches = async () => {
            try {
                const data = await millService.getOilBatches()
                // Filter for batches that are stored (not sold or fully bottled)
                // For now, just show all
                setBatches(data)
            } catch (err) {
                console.error('Failed to fetch batches', err)
            }
        }
        fetchBatches()
    }, [])

    // Auto-calculate bottles count
    useEffect(() => {
        if (formData.quantity_liters && formData.bottle_size) {
            const count = Math.floor(formData.quantity_liters / formData.bottle_size)
            setFormData(prev => ({ ...prev, bottles_count: count }))
        }
    }, [formData.quantity_liters, formData.bottle_size])

    // Auto-set expiry date (18 months from bottling)
    useEffect(() => {
        if (formData.bottling_date) {
            const date = new Date(formData.bottling_date)
            date.setMonth(date.getMonth() + 18)
            setFormData(prev => ({ ...prev, expiry_date: date.toISOString().split('T')[0] }))
        }
    }, [formData.bottling_date])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await millService.createBottling(formData as OilBottling)
            toast.success('Bottling recorded successfully')
            onSuccess()
        } catch {
            toast.error('Failed to save bottling')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <Wine className="text-purple-600" size={24} />
                    <h3 className="text-lg font-semibold text-gray-800">Record Bottling</h3>
                </div>
                <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Source Batch */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Source Batch *</label>
                    <select
                        required
                        value={formData.oil_batch_id || ''}
                        onChange={e => setFormData({ ...formData, oil_batch_id: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                        <option value="">Select Batch</option>
                        {batches.map(batch => (
                            <option key={batch.ID} value={batch.ID}>
                                #{batch.batch_number} ({batch.quantity_liters}L available) - {batch.oil_type?.replace('_', ' ')}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Bottling Details */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bottling Date *</label>
                    <input
                        type="date"
                        required
                        value={formData.bottling_date?.split('T')[0]}
                        onChange={e => setFormData({ ...formData, bottling_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lot Number *</label>
                    <input
                        type="text"
                        required
                        value={formData.lot_number || ''}
                        onChange={e => setFormData({ ...formData, lot_number: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Quantity (Liters) *</label>
                    <input
                        type="number"
                        required
                        min="0"
                        step="0.1"
                        value={formData.quantity_liters || ''}
                        onChange={e => setFormData({ ...formData, quantity_liters: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bottle Size (Liters) *</label>
                    <select
                        required
                        value={formData.bottle_size || 0.75}
                        onChange={e => setFormData({ ...formData, bottle_size: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                        <option value="0.10">0.10 L (Sample)</option>
                        <option value="0.25">0.25 L</option>
                        <option value="0.50">0.50 L</option>
                        <option value="0.75">0.75 L</option>
                        <option value="1.00">1.00 L</option>
                        <option value="3.00">3.00 L (Tin)</option>
                        <option value="5.00">5.00 L (Tin)</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Number of Bottles</label>
                    <input
                        type="number"
                        readOnly
                        value={formData.bottles_count || 0}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                    <input
                        type="date"
                        value={formData.expiry_date?.split('T')[0] || ''}
                        onChange={e => setFormData({ ...formData, expiry_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Label Type</label>
                    <select
                        value={formData.label_type || 'standard'}
                        onChange={e => setFormData({ ...formData, label_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                        <option value="standard">Standard</option>
                        <option value="premium">Premium</option>
                        <option value="organic">Organic</option>
                        <option value="dop">DOP</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
                    <select
                        value={formData.destination || 'retail'}
                        onChange={e => setFormData({ ...formData, destination: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                        <option value="retail">Retail</option>
                        <option value="wholesale">Wholesale</option>
                        <option value="direct">Direct Sale</option>
                        <option value="export">Export</option>
                    </select>
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                        value={formData.notes || ''}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        placeholder="Additional notes..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Save Bottling
                </button>
            </div>
        </form>
    )
}
