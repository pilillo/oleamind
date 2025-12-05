import { useState, useEffect } from 'react'
import { Sparkles, BrainCircuit } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { harvestService, type YieldPrediction } from '../../services/harvestService'
import { apiCall } from '../../config'

export function YieldPredictionPanel() {
    const { t } = useTranslation()
    const [predictions, setPredictions] = useState<YieldPrediction[]>([])
    const [loading, setLoading] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [parcels, setParcels] = useState<any[]>([])
    const [selectedParcelId, setSelectedParcelId] = useState<number | ''>('')
    const [year, setYear] = useState(new Date().getFullYear() + 1)

    useEffect(() => {
        fetchParcels()
    }, [])

    useEffect(() => {
        if (selectedParcelId) {
            fetchPredictions()
        }
    }, [selectedParcelId, year])

    const fetchParcels = async () => {
        try {
            const response = await apiCall('/parcels')
            if (!response.ok) {
                throw new Error('Failed to fetch parcels')
            }
            const data = await response.json()
            setParcels(data)
            if (data.length > 0) {
                setSelectedParcelId(data[0].ID)
            }
        } catch (err) {
            console.error('Failed to fetch parcels', err)
        }
    }

    const fetchPredictions = async () => {
        if (!selectedParcelId) return
        setLoading(true)
        try {
            const data = await harvestService.getPredictions(Number(selectedParcelId), year)
            setPredictions(data)
        } catch (err) {
            console.error('Failed to fetch predictions', err)
        } finally {
            setLoading(false)
        }
    }

    const handleGeneratePrediction = async () => {
        if (!selectedParcelId) return
        setGenerating(true)
        try {
            await harvestService.generatePrediction(Number(selectedParcelId), year)
            fetchPredictions()
            toast.success(t('harvest.prediction.generated_success'))
        } catch {
            toast.error(t('harvest.prediction.generate_failed'))
        } finally {
            setGenerating(false)
        }
    }

    if (!selectedParcelId) return null

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <select
                        value={selectedParcelId}
                        onChange={e => setSelectedParcelId(Number(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                    >
                        {parcels.map(p => (
                            <option key={p.ID} value={p.ID}>{p.name}</option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={e => setYear(Number(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                    >
                        {[...Array(3)].map((_, i) => {
                            const y = new Date().getFullYear() + i
                            return <option key={y} value={y}>{y}</option>
                        })}
                    </select>
                </div>

                <button
                    onClick={handleGeneratePrediction}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                    {generating ? <BrainCircuit className="animate-pulse" size={18} /> : <Sparkles size={18} />}
                    {t('harvest.prediction.generate')}
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {loading ? (
                    <div className="text-center py-8 text-gray-500">{t('harvest.prediction.loading')}</div>
                ) : predictions.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        {t('harvest.prediction.no_predictions')}
                    </div>
                ) : (
                    predictions.map(pred => (
                        <div key={pred.ID} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full capitalize">
                                        {pred.method?.replace('_', ' ')}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        {t('harvest.prediction.generated_on')} {pred.prediction_date ? new Date(pred.prediction_date).toLocaleDateString() : '-'}
                                    </span>
                                </div>
                                <h4 className="text-lg font-semibold text-gray-900 mb-1">
                                    {t('harvest.prediction.predicted_yield')}: {pred.predicted_yield_kg.toLocaleString()} kg
                                </h4>
                                <p className="text-sm text-gray-500">
                                    {t('harvest.prediction.confidence_level')}: <span className="font-medium text-gray-700 capitalize">{pred.confidence_level}</span>
                                </p>
                            </div>

                            <div className="flex items-center gap-8">
                                <div className="text-center">
                                    <div className="text-sm text-gray-500 mb-1">{t('harvest.prediction.per_tree')}</div>
                                    <div className="font-semibold text-gray-900">{pred.predicted_yield_per_tree?.toFixed(1)} kg</div>
                                </div>
                                {pred.actual_yield_kg ? (
                                    <div className="text-center">
                                        <div className="text-sm text-gray-500 mb-1">{t('harvest.prediction.accuracy')}</div>
                                        <div className={`font-semibold ${(pred.accuracy || 0) > 90 ? 'text-green-600' :
                                            (pred.accuracy || 0) > 70 ? 'text-blue-600' : 'text-yellow-600'
                                            }`}>
                                            {pred.accuracy?.toFixed(1)}%
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center opacity-50">
                                        <div className="text-sm text-gray-500 mb-1">{t('harvest.prediction.accuracy')}</div>
                                        <div className="font-semibold text-gray-400">-</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
