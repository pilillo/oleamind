import { useState, useEffect } from 'react'
import { Edit2, Trash2, Filter, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { harvestService, type HarvestLog } from '../../services/harvestService'

interface HarvestHistoryTableProps {
    refreshTrigger: number
    onEdit: (harvest: HarvestLog) => void
}

export function HarvestHistoryTable({ refreshTrigger, onEdit }: HarvestHistoryTableProps) {
    const { t } = useTranslation()
    const [harvests, setHarvests] = useState<HarvestLog[]>([])
    const [loading, setLoading] = useState(true)
    const [startDate, setStartDate] = useState(
        new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]
    )
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

    useEffect(() => {
        fetchHarvests()
    }, [refreshTrigger, startDate, endDate])

    const fetchHarvests = async () => {
        setLoading(true)
        try {
            const data = await harvestService.getAllHarvests(startDate, endDate)
            setHarvests(data)
        } catch (err) {
            console.error('Failed to fetch harvests', err)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!window.confirm(t('harvest.delete_confirm'))) return
        try {
            await harvestService.deleteHarvest(id)
            fetchHarvests()
            toast.success(t('harvest.deleted_success'))
        } catch {
            toast.error(t('harvest.delete_failed'))
        }
    }

    const exportCSV = () => {
        const headers = ['Date', 'Parcel ID', 'Quantity (kg)', 'Quality', 'Cultivar', 'Method', 'Cost']
        const csvContent = [
            headers.join(','),
            ...harvests.map(h => [
                h.date,
                h.parcel_id,
                h.quantity_kg,
                h.quality,
                h.cultivar || '',
                h.harvest_method || '',
                h.cost || 0
            ].join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `harvest_export_${startDate}_${endDate}.csv`
        link.click()
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 justify-between items-center bg-gray-50">
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{t('harvest.filters')}:</span>
                    <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                </div>
                <button
                    onClick={exportCSV}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                    <Download size={16} />
                    {t('harvest.export_csv')}
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3">{t('harvest.date')}</th>
                            <th className="px-6 py-3">{t('harvest.parcel')}</th>
                            <th className="px-6 py-3">{t('harvest.quantity_kg')}</th>
                            <th className="px-6 py-3">{t('harvest.quality')}</th>
                            <th className="px-6 py-3">{t('harvest.cultivar')}</th>
                            <th className="px-6 py-3">{t('harvest.method')}</th>
                            <th className="px-6 py-3 text-right">{t('harvest.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                    {t('harvest.loading_history')}
                                </td>
                            </tr>
                        ) : harvests.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                    {t('harvest.no_logs_found')}
                                </td>
                            </tr>
                        ) : (
                            harvests.map(harvest => (
                                <tr key={harvest.ID} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-3 text-gray-900">{harvest.date}</td>
                                    <td className="px-6 py-3 text-gray-600">#{harvest.parcel_id}</td>
                                    <td className="px-6 py-3 font-medium text-gray-900">{harvest.quantity_kg.toLocaleString()}</td>
                                    <td className="px-6 py-3">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                      ${harvest.quality === 'excellent' ? 'bg-green-100 text-green-800' :
                                                harvest.quality === 'good' ? 'bg-blue-100 text-blue-800' :
                                                    harvest.quality === 'fair' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-red-100 text-red-800'}`}>
                                            {harvest.quality}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-gray-600">{harvest.cultivar || '-'}</td>
                                    <td className="px-6 py-3 text-gray-600 capitalize">{harvest.harvest_method}</td>
                                    <td className="px-6 py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => onEdit(harvest)}
                                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => harvest.ID && handleDelete(harvest.ID)}
                                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
