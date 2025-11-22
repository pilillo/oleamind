import { useState } from 'react'
import { Plus, History, BarChart3, Sparkles } from 'lucide-react'
import { HarvestLogForm } from '../components/harvest/HarvestLogForm'
import { HarvestHistoryTable } from '../components/harvest/HarvestHistoryTable'
import { YieldStatsDashboard } from '../components/harvest/YieldStats'
import { YieldPredictionPanel } from '../components/harvest/YieldPrediction'
import { type HarvestLog } from '../services/harvestService'

export default function Harvest() {
    const [activeTab, setActiveTab] = useState<'stats' | 'log' | 'history' | 'predictions'>('stats')
    const [showLogForm, setShowLogForm] = useState(false)
    const [editingHarvest, setEditingHarvest] = useState<HarvestLog | undefined>(undefined)
    const [refreshTrigger, setRefreshTrigger] = useState(0)

    const handleSuccess = () => {
        setShowLogForm(false)
        setEditingHarvest(undefined)
        setRefreshTrigger(prev => prev + 1)
        setActiveTab('history')
    }

    const handleEdit = (harvest: HarvestLog) => {
        setEditingHarvest(harvest)
        setShowLogForm(true)
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Harvest Management</h2>
                    <p className="text-gray-500">Track harvests, analyze yields, and predict future production</p>
                </div>
                <button
                    onClick={() => {
                        setEditingHarvest(undefined)
                        setShowLogForm(true)
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                >
                    <Plus size={20} />
                    Log Harvest
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('stats')}
                    className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'stats'
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <BarChart3 size={18} />
                    Statistics
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'history'
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <History size={18} />
                    History
                </button>
                <button
                    onClick={() => setActiveTab('predictions')}
                    className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'predictions'
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Sparkles size={18} />
                    Predictions
                </button>
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {showLogForm ? (
                    <div className="max-w-3xl mx-auto">
                        <HarvestLogForm
                            onSuccess={handleSuccess}
                            onCancel={() => {
                                setShowLogForm(false)
                                setEditingHarvest(undefined)
                            }}
                            initialData={editingHarvest}
                        />
                    </div>
                ) : (
                    <>
                        {activeTab === 'stats' && <YieldStatsDashboard />}
                        {activeTab === 'history' && (
                            <HarvestHistoryTable
                                refreshTrigger={refreshTrigger}
                                onEdit={handleEdit}
                            />
                        )}
                        {activeTab === 'predictions' && <YieldPredictionPanel />}
                    </>
                )}
            </div>
        </div>
    )
}
