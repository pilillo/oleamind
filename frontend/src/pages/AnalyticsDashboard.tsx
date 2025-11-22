import { useState } from 'react'
import { Sprout, FlaskConical, DollarSign } from 'lucide-react'
import { ProductionAnalytics } from '../components/analytics/ProductionAnalytics'
import { ProcessingAnalytics } from '../components/analytics/ProcessingAnalytics'
import { SalesAnalytics } from '../components/analytics/SalesAnalytics'

export default function AnalyticsDashboard() {
    const [activeTab, setActiveTab] = useState<'production' | 'processing' | 'sales'>('production')

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Analytics & Reporting</h1>
                    <p className="text-gray-500">Insights into your production, processing, and sales performance</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
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
                {activeTab === 'production' && <ProductionAnalytics />}
                {activeTab === 'processing' && <ProcessingAnalytics />}
                {activeTab === 'sales' && <SalesAnalytics />}
            </div>
        </div>
    )
}
