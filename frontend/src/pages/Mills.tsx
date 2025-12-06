import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Truck, Droplets, FlaskConical, Wine, DollarSign, Plus } from 'lucide-react'
import { MillForm } from '../components/mills/MillForm'
import { MillList } from '../components/mills/MillList'
import { DeliveryForm } from '../components/mills/DeliveryForm'
import { DeliveryList } from '../components/mills/DeliveryList'
import { BatchForm } from '../components/mills/BatchForm'
import { BatchList } from '../components/mills/BatchList'
import { QualityForm } from '../components/mills/QualityForm'
import { QualityList } from '../components/mills/QualityList'
import { BottlingForm } from '../components/mills/BottlingForm'
import { BottlingList } from '../components/mills/BottlingList'
import { SalesForm } from '../components/mills/SalesForm'
import { SalesList } from '../components/mills/SalesList'
import { type Mill, type OliveDelivery, type OilBatch } from '../services/millService'

export default function Mills() {
    const { t } = useTranslation()
    const [activeTab, setActiveTab] = useState<'mills' | 'deliveries' | 'batches' | 'quality' | 'bottling' | 'sales'>('mills')
    const [showMillForm, setShowMillForm] = useState(false)
    const [editingMill, setEditingMill] = useState<Mill | undefined>(undefined)
    const [showDeliveryForm, setShowDeliveryForm] = useState(false)
    const [editingDelivery, setEditingDelivery] = useState<OliveDelivery | undefined>(undefined)
    const [showBatchForm, setShowBatchForm] = useState(false)
    const [editingBatch, setEditingBatch] = useState<OilBatch | undefined>(undefined)
    const [showQualityForm, setShowQualityForm] = useState(false)
    const [showBottlingForm, setShowBottlingForm] = useState(false)
    const [showSalesForm, setShowSalesForm] = useState(false)
    const [refreshTrigger, setRefreshTrigger] = useState(0)

    const tabs = [
        { id: 'mills', label: t('mills.tabs.mills'), icon: Building2 },
        { id: 'deliveries', label: t('mills.tabs.deliveries'), icon: Truck },
        { id: 'batches', label: t('mills.tabs.batches'), icon: Droplets },
        { id: 'quality', label: t('mills.tabs.quality'), icon: FlaskConical },
        { id: 'bottling', label: t('mills.tabs.bottling'), icon: Wine },
        { id: 'sales', label: t('mills.tabs.sales'), icon: DollarSign },
    ]

    const handleSuccess = () => {
        setShowMillForm(false)
        setEditingMill(undefined)
        setShowDeliveryForm(false)
        setEditingDelivery(undefined)
        setShowBatchForm(false)
        setEditingBatch(undefined)
        setShowQualityForm(false)
        setShowBottlingForm(false)
        setShowSalesForm(false)
        setRefreshTrigger(prev => prev + 1)
    }

    const handleEdit = (mill: Mill) => {
        setEditingMill(mill)
        setShowMillForm(true)
    }

    const handleAddMill = () => {
        setEditingMill(undefined)
        setShowMillForm(true)
    }

    const handleAddDelivery = () => {
        setEditingDelivery(undefined)
        setShowDeliveryForm(true)
    }

    const handleEditDelivery = (delivery: OliveDelivery) => {
        setEditingDelivery(delivery)
        setShowDeliveryForm(true)
    }

    const handleAddBatch = () => {
        setEditingBatch(undefined)
        setShowBatchForm(true)
    }

    const handleEditBatch = (batch: OilBatch) => {
        setEditingBatch(batch)
        setShowBatchForm(true)
    }

    const handleAddQuality = () => {
        setShowQualityForm(true)
    }

    const handleAddBottling = () => {
        setShowBottlingForm(true)
    }

    const handleAddSale = () => {
        setShowSalesForm(true)
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">{t('mills.title')}</h2>
                    <p className="text-gray-500">{t('mills.subtitle')}</p>
                </div>
                <button
                    onClick={activeTab === 'mills' ? handleAddMill : activeTab === 'deliveries' ? handleAddDelivery : activeTab === 'batches' ? handleAddBatch : activeTab === 'quality' ? handleAddQuality : activeTab === 'bottling' ? handleAddBottling : activeTab === 'sales' ? handleAddSale : undefined}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
                    disabled={activeTab !== 'mills' && activeTab !== 'deliveries' && activeTab !== 'batches' && activeTab !== 'quality' && activeTab !== 'bottling' && activeTab !== 'sales'}
                >
                    <Plus size={20} />
                    {activeTab === 'mills' && t('mills.add_mill')}
                    {activeTab === 'deliveries' && t('mills.record_delivery')}
                    {activeTab === 'batches' && t('mills.create_batch')}
                    {activeTab === 'quality' && t('mills.add_analysis')}
                    {activeTab === 'bottling' && t('mills.new_bottling')}
                    {activeTab === 'sales' && t('mills.record_sale')}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 overflow-x-auto">
                {tabs.map((tab) => {
                    const Icon = tab.icon
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.id
                                ? 'border-green-500 text-green-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <Icon size={18} />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {showMillForm ? (
                    <div className="max-w-4xl mx-auto">
                        <MillForm
                            onSuccess={handleSuccess}
                            onCancel={() => {
                                setShowMillForm(false)
                                setEditingMill(undefined)
                            }}
                            initialData={editingMill}
                        />
                    </div>
                ) : (
                    <>
                        {activeTab === 'mills' && (
                            <MillList
                                refreshTrigger={refreshTrigger}
                                onEdit={handleEdit}
                            />
                        )}

                        {activeTab === 'deliveries' && (
                            showDeliveryForm ? (
                                <div className="max-w-4xl mx-auto">
                                    <DeliveryForm
                                        onSuccess={handleSuccess}
                                        onCancel={() => {
                                            setShowDeliveryForm(false)
                                            setEditingDelivery(undefined)
                                        }}
                                        initialData={editingDelivery}
                                    />
                                </div>
                            ) : (
                                <DeliveryList
                                    refreshTrigger={refreshTrigger}
                                    onEdit={handleEditDelivery}
                                />
                            )
                        )}

                        {activeTab === 'batches' && (
                            showBatchForm ? (
                                <div className="max-w-4xl mx-auto">
                                    <BatchForm
                                        onSuccess={handleSuccess}
                                        onCancel={() => {
                                            setShowBatchForm(false)
                                            setEditingBatch(undefined)
                                        }}
                                        initialData={editingBatch}
                                    />
                                </div>
                            ) : (
                                <BatchList
                                    refreshTrigger={refreshTrigger}
                                    onEdit={handleEditBatch}
                                />
                            )
                        )}

                        {activeTab === 'quality' && (
                            showQualityForm ? (
                                <div className="max-w-4xl mx-auto">
                                    <QualityForm
                                        onSuccess={handleSuccess}
                                        onCancel={() => setShowQualityForm(false)}
                                    />
                                </div>
                            ) : (
                                <QualityList
                                    refreshTrigger={refreshTrigger}
                                />
                            )
                        )}

                        {activeTab === 'bottling' && (
                            showBottlingForm ? (
                                <div className="max-w-4xl mx-auto">
                                    <BottlingForm
                                        onSuccess={handleSuccess}
                                        onCancel={() => setShowBottlingForm(false)}
                                    />
                                </div>
                            ) : (
                                <BottlingList
                                    refreshTrigger={refreshTrigger}
                                />
                            )
                        )}

                        {activeTab === 'sales' && (
                            showSalesForm ? (
                                <div className="max-w-4xl mx-auto">
                                    <SalesForm
                                        onSuccess={handleSuccess}
                                        onCancel={() => setShowSalesForm(false)}
                                    />
                                </div>
                            ) : (
                                <SalesList
                                    refreshTrigger={refreshTrigger}
                                />
                            )
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
