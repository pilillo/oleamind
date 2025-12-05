import React, { useState, useEffect } from 'react'
import { Save, X, Loader2, FlaskConical } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { millService, type OilQualityAnalysis, type OilBatch } from '../../services/millService'

interface QualityFormProps {
    onSuccess: () => void
    onCancel: () => void
}

export function QualityForm({ onSuccess, onCancel }: QualityFormProps) {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(false)
    const [batches, setBatches] = useState<OilBatch[]>([])

    const [formData, setFormData] = useState<Partial<OilQualityAnalysis>>({
        analysis_date: new Date().toISOString().split('T')[0],
        laboratory: '',
        free_acidity: 0,
        peroxide_value: 0,
        k232: 0,
        k270: 0,
        delta_k: 0,
        fruity_median: 0,
        bitter_median: 0,
        pungent_median: 0,
        defects_median: 0,
        polyphenols: 0,
        tocopherols: 0,
        classification: 'extra_virgin',
        certified: false,
        notes: ''
    })

    useEffect(() => {
        const fetchBatches = async () => {
            try {
                const data = await millService.getOilBatches()
                setBatches(data)
            } catch (err) {
                console.error('Failed to fetch batches', err)
            }
        }
        fetchBatches()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await millService.createQualityAnalysis(formData as OilQualityAnalysis)
            toast.success('Quality analysis saved successfully')
            onSuccess()
        } catch {
            toast.error('Failed to save analysis')
        } finally {
            setLoading(false)
        }
    }

    // Simple auto-classification logic
    useEffect(() => {
        const acidity = formData.free_acidity || 0
        const defects = formData.defects_median || 0
        const fruity = formData.fruity_median || 0

        let classification = 'lampante'
        if (defects === 0 && fruity > 0) {
            if (acidity <= 0.8) classification = 'extra_virgin'
            else if (acidity <= 2.0) classification = 'virgin'
        } else if (acidity <= 2.0) {
            classification = 'virgin'
        }

        setFormData(prev => ({ ...prev, classification }))
    }, [formData.free_acidity, formData.defects_median, formData.fruity_median])

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <FlaskConical className="text-purple-600" size={24} />
                    <h3 className="text-lg font-semibold text-gray-800">Record Quality Analysis</h3>
                </div>
                <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Batch *</label>
                    <select
                        required
                        value={formData.oil_batch_id || ''}
                        onChange={e => setFormData({ ...formData, oil_batch_id: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                        <option value="">Select Batch</option>
                        {batches.map(batch => (
                            <option key={batch.ID} value={batch.ID}>
                                #{batch.batch_number} ({batch.quantity_liters}L)
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Analysis Date *</label>
                    <input
                        type="date"
                        required
                        value={formData.analysis_date?.split('T')[0]}
                        onChange={e => setFormData({ ...formData, analysis_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Laboratory</label>
                    <input
                        type="text"
                        value={formData.laboratory || ''}
                        onChange={e => setFormData({ ...formData, laboratory: e.target.value })}
                        placeholder="Lab Name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>

                {/* Chemical Parameters */}
                <div className="md:col-span-2">
                    <h4 className="font-medium text-gray-900 mb-3 pb-2 border-b">Chemical Parameters</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Free Acidity (%)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.free_acidity || ''}
                                onChange={e => setFormData({ ...formData, free_acidity: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Peroxides (meq O2/kg)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formData.peroxide_value || ''}
                                onChange={e => setFormData({ ...formData, peroxide_value: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">K232</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.k232 || ''}
                                onChange={e => setFormData({ ...formData, k232: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">K270</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.k270 || ''}
                                onChange={e => setFormData({ ...formData, k270: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Organoleptic Parameters */}
                <div className="md:col-span-2">
                    <h4 className="font-medium text-gray-900 mb-3 pb-2 border-b">Organoleptic Assessment (0-10)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Fruity</label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="10"
                                value={formData.fruity_median || ''}
                                onChange={e => setFormData({ ...formData, fruity_median: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Bitter</label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="10"
                                value={formData.bitter_median || ''}
                                onChange={e => setFormData({ ...formData, bitter_median: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Pungent</label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="10"
                                value={formData.pungent_median || ''}
                                onChange={e => setFormData({ ...formData, pungent_median: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Defects</label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="10"
                                value={formData.defects_median || ''}
                                onChange={e => setFormData({ ...formData, defects_median: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Classification & Certification */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Classification</label>
                    <select
                        value={formData.classification || 'extra_virgin'}
                        onChange={e => setFormData({ ...formData, classification: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                        <option value="extra_virgin">Extra Virgin</option>
                        <option value="virgin">Virgin</option>
                        <option value="lampante">Lampante</option>
                        <option value="defective">Defective</option>
                    </select>
                </div>

                <div className="flex items-center">
                    <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer w-full">
                        <input
                            type="checkbox"
                            checked={formData.certified || false}
                            onChange={e => setFormData({ ...formData, certified: e.target.checked })}
                            className="text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium">Official Certification</span>
                    </label>
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
                    Save Analysis
                </button>
            </div>
        </form>
    )
}
