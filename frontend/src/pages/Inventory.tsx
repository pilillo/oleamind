import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiCall } from '../config'
import { Package, AlertTriangle, Calendar, DollarSign, Filter, Search, Plus, Edit2, Trash2, X } from 'lucide-react'

interface InventoryItem {
  ID: number
  name: string
  category: string
  quantity: number
  unit: string
  minimum_stock: number
  cost_per_unit: number
  supplier: string
  expiry_date: string | null
  farm_id: number
  CreatedAt: string
  UpdatedAt: string
}

function Inventory() {
  const { t } = useTranslation()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    category: 'fertilizers',
    quantity: 0,
    unit: 'kg',
    minimum_stock: 0,
    cost_per_unit: 0,
    supplier: '',
    expiry_date: '',
  })

  useEffect(() => {
    fetchInventory()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [inventory, searchTerm, categoryFilter, showLowStockOnly])

  const fetchInventory = async () => {
    try {
      const response = await apiCall(`/inventory`)
      const data = await response.json()
      if (Array.isArray(data)) {
        setInventory(data)
      }
    } catch (err) {
      console.error('Failed to fetch inventory', err)
    }
  }

  const applyFilters = () => {
    let filtered = [...inventory]

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter)
    }

    // Low stock filter
    if (showLowStockOnly) {
      filtered = filtered.filter(item => item.quantity < item.minimum_stock)
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredInventory(filtered)
  }

  const handleSubmit = async () => {
    try {
      const payload = {
        ...formData,
        expiry_date: formData.expiry_date || null,
        farm_id: 1,
      }

      const endpoint = editingItem
        ? `/inventory/${editingItem.ID}`
        : `/inventory`

      const response = await apiCall(endpoint, {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        fetchInventory()
        closeModal()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to save item'}`)
      }
    } catch (err) {
      console.error(err)
      alert('Failed to save item')
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('inventory.delete_confirm'))) return

    try {
      const response = await apiCall(`/inventory/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchInventory()
      } else {
        alert('Failed to delete item')
      }
    } catch (err) {
      console.error(err)
      alert('Failed to delete item')
    }
  }

  const openAddModal = () => {
    setEditingItem(null)
    setFormData({
      name: '',
      category: 'fertilizers',
      quantity: 0,
      unit: 'kg',
      minimum_stock: 0,
      cost_per_unit: 0,
      supplier: '',
      expiry_date: '',
    })
    setShowModal(true)
  }

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      minimum_stock: item.minimum_stock,
      cost_per_unit: item.cost_per_unit,
      supplier: item.supplier || '',
      expiry_date: item.expiry_date ? item.expiry_date.split('T')[0] : '',
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingItem(null)
  }

  const categories = [
    { value: 'fertilizers', label: t('inventory.filter_fertilizers'), icon: '🌱', color: 'green' },
    { value: 'pesticides', label: t('inventory.filter_pesticides'), icon: '🐛', color: 'red' },
    { value: 'biological', label: t('inventory.filter_biological'), icon: '🦠', color: 'purple' },
    { value: 'irrigation', label: t('inventory.filter_irrigation'), icon: '💧', color: 'blue' },
    { value: 'tools', label: t('inventory.filter_tools'), icon: '🔧', color: 'gray' },
  ]

  const totalValue = filteredInventory.reduce((sum, item) => sum + (item.quantity * item.cost_per_unit), 0)

  const isLowStock = (item: InventoryItem) => item.quantity < item.minimum_stock
  const isExpiringSoon = (item: InventoryItem) => {
    if (!item.expiry_date) return false
    const daysUntilExpiry = Math.floor((new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30
  }
  const isExpired = (item: InventoryItem) => {
    if (!item.expiry_date) return false
    return new Date(item.expiry_date) < new Date()
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Package size={32} className="text-green-600" />
            {t('inventory.title')}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {filteredInventory.length} {t('inventory.items_found')} • {t('inventory.total_value')}: €{totalValue.toFixed(2)}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-green-600 hover:bg-green-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus size={20} />
          {t('inventory.add_item')}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t('inventory.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <Filter size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">{t('inventory.filter_all')}</option>
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Low Stock Toggle */}
          <div className="flex items-center gap-3 px-4 py-2 border border-gray-300 rounded-lg bg-white">
            <input
              type="checkbox"
              id="lowStockFilter"
              checked={showLowStockOnly}
              onChange={(e) => setShowLowStockOnly(e.target.checked)}
              className="w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            />
            <label htmlFor="lowStockFilter" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2">
              <AlertTriangle size={16} className="text-orange-500" />
              {t('inventory.low_stock')}
            </label>
          </div>
        </div>
      </div>

      {/* Inventory Grid */}
      {filteredInventory.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Package size={64} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">{t('inventory.no_items')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInventory.map((item) => {
            const category = categories.find((c) => c.value === item.category) || categories[4]
            const lowStock = isLowStock(item)
            const expiringSoon = isExpiringSoon(item)
            const expired = isExpired(item)

            return (
              <div
                key={item.ID}
                className={`bg-white rounded-lg shadow-sm border-2 p-5 transition-all hover:shadow-md ${lowStock ? 'border-red-400' : expired ? 'border-gray-400' : 'border-gray-200'
                  }`}
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{category.icon}</span>
                      <h3 className="font-semibold text-gray-900 text-lg">{item.name}</h3>
                    </div>
                    <p className="text-xs text-gray-500">{category.label}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(item)}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                      title={t('inventory.edit')}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.ID)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      title={t('inventory.delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {lowStock && (
                    <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                      <AlertTriangle size={12} />
                      {t('inventory.low_stock')}
                    </span>
                  )}
                  {expired && (
                    <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                      <Calendar size={12} />
                      {t('inventory.expired')}
                    </span>
                  )}
                  {expiringSoon && !expired && (
                    <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                      <Calendar size={12} />
                      {t('inventory.expiring_soon')}
                    </span>
                  )}
                  {!lowStock && !expired && !expiringSoon && (
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                      {t('inventory.in_stock')}
                    </span>
                  )}
                </div>

                {/* Quantity */}
                <div className="mb-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">{item.quantity}</span>
                    <span className="text-lg text-gray-500">{item.unit}</span>
                  </div>
                  {item.minimum_stock > 0 && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{t('inventory.minimum_stock')}</span>
                        <span>{item.minimum_stock} {item.unit}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${lowStock ? 'bg-red-500' : 'bg-green-500'
                            }`}
                          style={{ width: `${Math.min((item.quantity / item.minimum_stock) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm border-t border-gray-100 pt-3">
                  {item.cost_per_unit > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 flex items-center gap-1">
                        <DollarSign size={14} />
                        {t('inventory.cost_per_unit')}
                      </span>
                      <span className="font-medium text-gray-900">€{item.cost_per_unit.toFixed(2)}</span>
                    </div>
                  )}
                  {item.supplier && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('inventory.supplier')}</span>
                      <span className="font-medium text-gray-900">{item.supplier}</span>
                    </div>
                  )}
                  {item.expiry_date && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Calendar size={14} />
                        {t('inventory.expiry_date')}
                      </span>
                      <span className={`font-medium ${expired ? 'text-red-600' : expiringSoon ? 'text-yellow-600' : 'text-gray-900'}`}>
                        {new Date(item.expiry_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {item.cost_per_unit > 0 && (
                    <div className="flex justify-between pt-2 border-t border-gray-100">
                      <span className="text-gray-700 font-medium">{t('inventory.total_value')}</span>
                      <span className="font-bold text-green-600">€{(item.quantity * item.cost_per_unit).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingItem ? t('inventory.edit_item') : t('inventory.add_new_item')}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('inventory.name')} *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('inventory.category')} *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('inventory.supplier')}
                  </label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('inventory.quantity')} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('inventory.unit')} *
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="kg">kg</option>
                    <option value="L">L</option>
                    <option value="units">units</option>
                    <option value="g">g</option>
                    <option value="mL">mL</option>
                    <option value="tons">tons</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('inventory.minimum_stock')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.minimum_stock}
                    onChange={(e) => setFormData({ ...formData, minimum_stock: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('inventory.cost_per_unit')} (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost_per_unit}
                    onChange={(e) => setFormData({ ...formData, cost_per_unit: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('inventory.expiry_date')}
                  </label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleSubmit}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg transition-colors font-medium"
              >
                {t('inventory.save')}
              </button>
              <button
                onClick={closeModal}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 rounded-lg transition-colors font-medium"
              >
                {t('inventory.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Inventory
