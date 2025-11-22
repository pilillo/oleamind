import { useState, useEffect } from 'react'
import { DollarSign, Calendar, User, CreditCard } from 'lucide-react'
import { millService, type OilSale } from '../../services/millService'

interface SalesListProps {
    refreshTrigger?: number
}

export function SalesList({ refreshTrigger }: SalesListProps) {
    const [sales, setSales] = useState<OilSale[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchSales = async () => {
        try {
            setLoading(true)
            const data = await millService.getSales()
            setSales(data)
            setError(null)
        } catch (err) {
            console.error('Failed to fetch sales', err)
            setError('Failed to load sales records')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchSales()
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
                <div className="text-red-600 mb-2">Error loading sales</div>
                <div className="text-gray-500 text-sm">{error}</div>
            </div>
        )
    }

    if (sales.length === 0) {
        return (
            <div className="text-center py-12">
                <DollarSign size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Sales Recorded</h3>
                <p className="text-gray-500">Record your first oil sale to track revenue.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">Sales History</h3>
                <span className="text-sm text-gray-500">{sales.length} records</span>
            </div>

            <div className="grid gap-4">
                {sales.map((sale) => (
                    <div
                        key={sale.ID}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition-all hover:shadow-md"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-green-50 text-green-600">
                                    <DollarSign size={20} />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900">
                                        Sale #{sale.invoice_number || sale.ID}
                                    </h4>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                        <Calendar size={14} />
                                        {new Date(sale.sale_date).toLocaleDateString()}
                                        <span className="text-gray-300">|</span>
                                        <User size={14} />
                                        {sale.customer}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-lg text-green-600">
                                    €{sale.total_amount.toFixed(2)}
                                </div>
                                <div className="text-sm text-gray-500">
                                    €{sale.price_per_liter.toFixed(2)} / L
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Quantity</div>
                                <div className="font-semibold text-gray-900">
                                    {sale.quantity_liters} L
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Payment</div>
                                <div className="font-semibold text-gray-900 capitalize flex items-center gap-1">
                                    <CreditCard size={14} className="text-gray-400" />
                                    {sale.payment_method || 'Cash'}
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Status</div>
                                <div className={`font-semibold capitalize ${sale.payment_status === 'paid' ? 'text-green-600' : 'text-amber-600'
                                    }`}>
                                    {sale.payment_status || 'Pending'}
                                </div>
                            </div>
                        </div>

                        {sale.notes && (
                            <div className="mt-4 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                                {sale.notes}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
