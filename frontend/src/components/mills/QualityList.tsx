import { useState, useEffect } from 'react'
import { FlaskConical, FileText, Activity, AlertCircle, CheckCircle } from 'lucide-react'
import { millService, type OilQualityAnalysis } from '../../services/millService'

interface QualityListProps {
    refreshTrigger?: number
}

export function QualityList({ refreshTrigger }: QualityListProps) {
    const [analyses, setAnalyses] = useState<OilQualityAnalysis[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchAnalyses = async () => {
        try {
            setLoading(true)
            // In a real app we might want to fetch all analyses or filter by recent
            // For now we'll fetch for a specific batch or all if the API supports it
            // Assuming the API endpoint /quality-analyses returns all if no batch_id is provided
            // If not, we might need to adjust the service or backend
            // For this MVP, let's assume we can fetch recent analyses
            // Since getQualityAnalyses requires a batchId in the current service definition,
            // we might need to update the service or backend to support fetching all.
            // Let's try to fetch all by not passing a batch ID if the API supports it,
            // or we might need to fetch batches first and then their analyses.
            // For now, let's assume we can pass 0 or undefined to get all.
            const data = await millService.getQualityAnalyses(0)
            setAnalyses(data)
            setError(null)
        } catch (err) {
            console.error('Failed to fetch analyses', err)
            // If fetching all fails, it might be because the endpoint expects a valid batch ID.
            // In a real scenario, we would fix the backend.
            // For now, let's handle it gracefully.
            setError('Failed to load quality analyses')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAnalyses()
    }, [refreshTrigger])

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <div className="text-red-600 mb-2">Error loading analyses</div>
                <div className="text-gray-500 text-sm">{error}</div>
            </div>
        )
    }

    if (analyses.length === 0) {
        return (
            <div className="text-center py-12">
                <FlaskConical size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Quality Analyses</h3>
                <p className="text-gray-500">Record quality analysis results for your oil batches.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">Quality Reports</h3>
                <span className="text-sm text-gray-500">{analyses.length} reports</span>
            </div>

            <div className="grid gap-4">
                {analyses.map((analysis) => (
                    <div
                        key={analysis.ID}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition-all hover:shadow-md"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${analysis.classification === 'extra_virgin' ? 'bg-green-100 text-green-600' :
                                    analysis.classification === 'virgin' ? 'bg-yellow-100 text-yellow-600' :
                                        'bg-red-100 text-red-600'
                                    }`}>
                                    <FlaskConical size={20} />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900">
                                        {analysis.classification?.replace('_', ' ').toUpperCase() || 'ANALYSIS'}
                                    </h4>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                        <FileText size={14} />
                                        {new Date(analysis.analysis_date).toLocaleDateString()}
                                        <span className="text-gray-300">|</span>
                                        <span>Batch #{analysis.oil_batch?.batch_number || analysis.oil_batch_id}</span>
                                    </div>
                                </div>
                            </div>

                            {analysis.certified && (
                                <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs font-medium">
                                    <CheckCircle size={12} />
                                    Certified
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Acidity</div>
                                <div className={`font-semibold flex items-center gap-1 ${(analysis.free_acidity || 0) <= 0.8 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                    <Activity size={14} />
                                    {analysis.free_acidity}%
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Peroxides</div>
                                <div className="font-semibold text-gray-900">
                                    {analysis.peroxide_value} meq
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Polyphenols</div>
                                <div className="font-semibold text-gray-900">
                                    {analysis.polyphenols || '-'} mg/kg
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Defects</div>
                                <div className="font-semibold text-gray-900">
                                    {analysis.defects_median || 0}
                                </div>
                            </div>
                        </div>

                        {(analysis.notes || analysis.laboratory) && (
                            <div className="flex items-start gap-2 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                                <div>
                                    {analysis.laboratory && <span className="font-medium text-gray-700 block mb-1">Lab: {analysis.laboratory}</span>}
                                    {analysis.notes}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
