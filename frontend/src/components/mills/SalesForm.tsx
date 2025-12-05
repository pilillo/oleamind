import React, { useState, useEffect } from 'react'
import { Save, X, Loader2, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { millService, type OilSale, type OilBatch } from '../../services/millService'

interface SalesFormProps {
    onSuccess: () => void
    onCancel: () => void
}

export function SalesForm({ onSuccess, onCancel }: SalesFormProps) {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(false)
    const [batches, setBatches] = useState<OilBatch[]>([])

    const [formData, setFormData] = useState<Partial<OilSale>>({
        sale_date: new Date().toISOString().split('T')[0],
        customer: '',
        quantity_liters: 0,
        price_per_liter: 0,
        total_amount: 0,
        payment_method: 'cash',
        payment_status: 'paid',
        invoice_number: `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
        notes: ''
    })

    useEffect(() => {
        const fetchBatches = async () => {
            try {
                const data = await millService.getOilBatches()
                // In a real app, filter for batches with available quantity
                setBatches(data)
            } catch (err) {
                console.error('Failed to fetch batches', err)
            }
        }
        fetchBatches()
    }, [])

    // Auto-calculate total amount
    useEffect(() => {
        if (formData.quantity_liters && formData.price_per_liter) {
            const total = formData.quantity_liters * formData.price_per_liter
            setFormData(prev => ({ ...prev, total_amount: parseFloat(total.toFixed(2)) }))
        }
    }, [formData.quantity_liters, formData.price_per_liter])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await millService.createSale(formData as OilSale)
            toast.success('Sale recorded successfully')
            onSuccess()
        } catch {
            toast.error('Failed to save sale')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <DollarSign className="text-green-600" size={24} />
                    <h3 className="text-lg font-semibold text-gray-800">Record Sale</h3>
                </div>
                <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sale Details */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sale Date *</label>
                    <input
                        type="date"
                        required
                        value={formData.sale_date?.split('T')[0]}
                        onChange={e => setFormData({ ...formData, sale_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                    <input
                        type="text"
                        value={formData.invoice_number || ''}
                        onChange={e => setFormData({ ...formData, invoice_number: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                    <input
                        type="text"
                        required
                        value={formData.customer || ''}
                        onChange={e => setFormData({ ...formData, customer: e.target.value })}
                        placeholder="e.g. John Doe or Restaurant Name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                {/* Source Batch (Optional - can sell general stock) */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Source Batch (Optional)</label>
                    <select
                        value={formData.oil_batch_id || ''}
                        onChange={e => setFormData({ ...formData, oil_batch_id: e.target.value ? parseInt(e.target.value) : undefined })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                        <option value="">General Stock</option>
                        {batches.map(batch => (
                            <option key={batch.ID} value={batch.ID}>
                                #{batch.batch_number} ({batch.quantity_liters}L available)
                            </option>
                        ))}
                    </select>
                </div>

                {/* Pricing */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (Liters) *</label>
                    <input
                        type="number"
                        required
                        min="0"
                        step="0.1"
                        value={formData.quantity_liters || ''}
                        onChange={e => setFormData({ ...formData, quantity_liters: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price per Liter (€) *</label>
                    <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={formData.price_per_liter || ''}
                        onChange={e => setFormData({ ...formData, price_per_liter: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount (€)</label>
                    <input
                        type="number"
                        readOnly
                        value={formData.total_amount || 0}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-green-700"
                    />
                </div>

                {/* Payment */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                    <select
                        value={formData.payment_method || 'cash'}
                        onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="transfer">Bank Transfer</option>
                        <option value="credit">Credit</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                    <select
                        value={formData.payment_status || 'paid'}
                        onChange={e => setFormData({ ...formData, payment_status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                        <option value="paid">Paid</option>
                        <option value="pending">Pending</option>
                        <option value="partial">Partial</option>
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
                    Record Sale
                </button>
            </div>
        </form>
    )
}
