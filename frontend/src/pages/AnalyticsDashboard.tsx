import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sprout, FlaskConical, DollarSign, TrendingUp, Euro, GitCompare } from 'lucide-react'
import { ProductionAnalytics } from '../components/analytics/ProductionAnalytics'
import { ProcessingAnalytics } from '../components/analytics/ProcessingAnalytics'
import { SalesAnalytics } from '../components/analytics/SalesAnalytics'
import { YieldTrendChart } from '../components/analytics/YieldTrendChart'
import { CostEfficiencyDashboard } from '../components/analytics/CostEfficiencyDashboard'
import { ParcelComparison } from '../components/analytics/ParcelComparison'
import { apiCall } from '../config'

interface Parcel {
    ID: number
    name: string
}

export default function AnalyticsDashboard() {
    const { t } = useTranslation()
    const [activeTab, setActiveTab] = useState<'production' | 'processing' | 'sales' | 'trends' | 'costs' | 'comparison'>('trends')
    const [parcels, setParcels] = useState<Parcel[]>([])
    const [selectedParcelId, setSelectedParcelId] = useState<number | null>(null)

    useEffect(() => {
        fetchParcels()
    }, [])

    const fetchParcels = async () => {
        try {
            const response = await apiCall('/parcels')
            const data: Parcel[] = await response.json()
            setParcels(data)
            if (data.length > 0 && !selectedParcelId) {
                setSelectedParcelId(data[0].ID)
            }
        } catch (error) {
            console.error('Failed to fetch parcels:', error)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('analytics.title')}</h1>
                    <p className="text-gray-500">Insights into your production, processing, and sales performance</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('trends')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'trends'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <TrendingUp size={16} />
                    {t('analytics.tabs.trends')}
                </button>
                <button
                    onClick={() => setActiveTab('costs')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'costs'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Euro size={16} />
                    {t('analytics.tabs.costs')}
                </button>
                <button
                    onClick={() => setActiveTab('comparison')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'comparison'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <GitCompare size={16} />
                    {t('analytics.tabs.comparison')}
                </button>
                <button
                    onClick={() => setActiveTab('production')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'production'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Sprout size={16} />
                    Production
                </button>
                <button
                    onClick={() => setActiveTab('processing')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'processing'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <FlaskConical size={16} />
                    Processing
                </button>
                <button
                    onClick={() => setActiveTab('sales')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'sales'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <DollarSign size={16} />
                    Sales
                </button>
            </div>

            {/* Content */}
            <div className="min-h-[500px]">
                {activeTab === 'trends' && (
                    <div className="space-y-4">
                        {/* Parcel Selector */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select Parcel
                            </label>
                            <select
                                value={selectedParcelId || ''}
                                onChange={(e) => setSelectedParcelId(Number(e.target.value))}
                                className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            >
                                {parcels.map((parcel) => (
                                    <option key={parcel.ID} value={parcel.ID}>
                                        {parcel.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Yield Trend Chart */}
                        {selectedParcelId && <YieldTrendChart parcelId={selectedParcelId} years={5} />}
                    </div>
                )}
                {activeTab === 'costs' && <CostEfficiencyDashboard />}
                {activeTab === 'comparison' && <ParcelComparison />}
                {activeTab === 'production' && <ProductionAnalytics />}
                {activeTab === 'processing' && <ProcessingAnalytics />}
                {activeTab === 'sales' && <SalesAnalytics />}
            </div>
        </div>
    )
}
