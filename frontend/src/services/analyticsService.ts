import { harvestService } from './harvestService'
import { millService } from './millService'

// Types for Analytics Data
export interface MonthlyProduction {
    month: string
    quantity: number
}

export interface CultivarYield {
    cultivar: string
    quantity: number
    percentage: number
}

export interface ProcessingEfficiency {
    date: string
    olives_milled: number
    oil_produced: number
    yield_percentage: number
}

export interface QualityDistribution {
    classification: string
    count: number
    percentage: number
}

export interface SalesTrend {
    month: string
    revenue: number
    volume: number
}

export const analyticsService = {
    // Production Analytics (Harvests)
    getProductionTrends: async (): Promise<MonthlyProduction[]> => {
        try {
            const logs = await harvestService.getAllHarvests()
            // Aggregate by month
            const monthlyData: Record<string, number> = {}

            logs.forEach((log: any) => {
                const date = new Date(log.harvest_date)
                const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' })
                monthlyData[monthKey] = (monthlyData[monthKey] || 0) + log.quantity_kg
            })

            return Object.entries(monthlyData).map(([month, quantity]) => ({
                month,
                quantity
            })).sort((a: any, b: any) => new Date(a.month).getTime() - new Date(b.month).getTime())
        } catch (error) {
            console.error('Error fetching production trends:', error)
            return []
        }
    },

    getCultivarYields: async (): Promise<CultivarYield[]> => {
        try {
            const logs = await harvestService.getAllHarvests()
            const totalQuantity = logs.reduce((sum: number, log: any) => sum + log.quantity_kg, 0)
            const cultivarData: Record<string, number> = {}

            logs.forEach((log: any) => {
                const cultivar = log.cultivar || 'Unknown'
                cultivarData[cultivar] = (cultivarData[cultivar] || 0) + log.quantity_kg
            })

            return Object.entries(cultivarData).map(([cultivar, quantity]) => ({
                cultivar,
                quantity,
                percentage: totalQuantity > 0 ? (quantity / totalQuantity) * 100 : 0
            })).sort((a: any, b: any) => b.quantity - a.quantity)
        } catch (error) {
            console.error('Error fetching cultivar yields:', error)
            return []
        }
    },

    // Processing Analytics (Milling)
    getProcessingEfficiency: async (): Promise<ProcessingEfficiency[]> => {
        try {
            const batches = await millService.getOilBatches()
            // In a real app, we'd link batches to deliveries to get input weight
            // For now, we'll simulate or use available fields if any
            // Assuming batches have yield_percentage or we can derive it

            return batches.map((batch: any) => ({
                date: batch.production_date,
                olives_milled: (batch.quantity_liters / (batch.yield_percentage || 0.15)), // Estimate input if missing
                oil_produced: batch.quantity_liters,
                yield_percentage: batch.yield_percentage || 0
            })).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
        } catch (error) {
            console.error('Error fetching processing efficiency:', error)
            return []
        }
    },

    getQualityDistribution: async (): Promise<QualityDistribution[]> => {
        try {
            // We can use analyses or batches if analyses are linked
            // Let's use analyses for more detail if available, or batches for classification
            const analyses = await millService.getQualityAnalyses(0) // 0 for all

            const distribution: Record<string, number> = {}
            let total = 0

            if (analyses.length > 0) {
                analyses.forEach((analysis: any) => {
                    const cls = analysis.classification || 'Unclassified'
                    distribution[cls] = (distribution[cls] || 0) + 1
                    total++
                })
            } else {
                // Fallback to batches if no analyses
                const batches = await millService.getOilBatches()
                batches.forEach((batch: any) => {
                    const cls = batch.oil_type || 'Unclassified'
                    distribution[cls] = (distribution[cls] || 0) + 1
                    total++
                })
            }

            return Object.entries(distribution).map(([classification, count]) => ({
                classification: classification.replace('_', ' ').toUpperCase(),
                count,
                percentage: total > 0 ? (count / total) * 100 : 0
            }))
        } catch (error) {
            console.error('Error fetching quality distribution:', error)
            return []
        }
    },

    // Sales Analytics
    getSalesTrends: async (): Promise<SalesTrend[]> => {
        try {
            const sales = await millService.getSales()
            const monthlyData: Record<string, { revenue: number, volume: number }> = {}

            sales.forEach((sale: any) => {
                const date = new Date(sale.sale_date)
                const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' })

                if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = { revenue: 0, volume: 0 }
                }

                monthlyData[monthKey].revenue += sale.total_amount
                monthlyData[monthKey].volume += sale.quantity_liters
            })

            return Object.entries(monthlyData).map(([month, data]) => ({
                month,
                revenue: data.revenue,
                volume: data.volume
            })).sort((a: any, b: any) => new Date(a.month).getTime() - new Date(b.month).getTime())
        } catch (error) {
            console.error('Error fetching sales trends:', error)
            return []
        }
    }
}
