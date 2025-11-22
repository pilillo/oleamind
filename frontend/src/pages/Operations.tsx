import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiCall } from '../config'
import { Clipboard, Plus, Edit2, Trash2, X, DollarSign, Clock, Users, Wrench, Search, Filter } from 'lucide-react'

interface Operation {
  ID: number
  type: string
  category: string
  date: string
  description: string
  parcel_id: number
  parcel: {
    ID: number
    name: string
  }
  product_name: string
  active_agent: string
  quantity: number
  unit: string
  labor_hours: number
  workers: number
  equipment: string
  cost: number
  status: string
  notes: string
  CreatedAt: string
  UpdatedAt: string
}

interface Parcel {
  ID: number
  name: string
}

function Operations() {
  const { t } = useTranslation()
  const [operations, setOperations] = useState<Operation[]>([])
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [filteredOperations, setFilteredOperations] = useState<Operation[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingOperation, setEditingOperation] = useState<Operation | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [parcelFilter, setParcelFilter] = useState('all')

  const [formData, setFormData] = useState({
    type: 'pruning',
    category: 'maintenance',
    date: new Date().toISOString().split('T')[0],
    description: '',
    parcel_id: 0,
    product_name: '',
    active_agent: '',
    quantity: 0,
    unit: 'L',
    labor_hours: 0,
    workers: 1,
    equipment: '',
    cost: 0,
    status: 'completed',
    notes: '',
  })

  useEffect(() => {
    fetchOperations()
    fetchParcels()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [operations, searchTerm, typeFilter, statusFilter, parcelFilter])

  const fetchOperations = async () => {
    try {
      const response = await apiCall(`/operations`)
      const data = await response.json()
      if (Array.isArray(data)) {
        console.log('✅ Operations page fetched:', data.length, 'operations')
        setOperations(data)
      }
    } catch (err) {
      console.error('Failed to fetch operations', err)
    }
  }

  const fetchParcels = async () => {
    try {
      const response = await apiCall(`/parcels`)
      const data = await response.json()
      if (Array.isArray(data)) {
        setParcels(data)
      }
    } catch (err) {
      console.error('Failed to fetch parcels', err)
    }
  }

  const applyFilters = () => {
    let filtered = [...operations]

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(op => op.type === typeFilter)
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(op => op.status === statusFilter)
    }

    // Parcel filter
    if (parcelFilter !== 'all') {
      filtered = filtered.filter(op => op.parcel_id.toString() === parcelFilter)
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(op =>
        op.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.equipment?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.parcel?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredOperations(filtered)
  }

  const handleSubmit = async () => {
    try {
      const payload = {
        ...formData,
        farm_id: 1,
      }

      const endpoint = editingOperation
        ? `/operations/${editingOperation.ID}`
        : `/operations`

      const response = await apiCall(endpoint, {
        method: editingOperation ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        fetchOperations()
        closeModal()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to save operation'}`)
      }
    } catch (err) {
      console.error(err)
      alert('Failed to save operation')
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('operations.delete_confirm'))) return

    try {
      const response = await apiCall(`/operations/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchOperations()
      } else {
        alert('Failed to delete operation')
      }
    } catch (err) {
      console.error(err)
      alert('Failed to delete operation')
    }
  }

  const openAddModal = () => {
    setEditingOperation(null)
    setFormData({
      type: 'pruning',
      category: 'maintenance',
      date: new Date().toISOString().split('T')[0],
      description: '',
      parcel_id: parcels.length > 0 ? parcels[0].ID : 0,
      product_name: '',
      active_agent: '',
      quantity: 0,
      unit: 'L',
      labor_hours: 0,
      workers: 1,
      equipment: '',
      cost: 0,
      status: 'completed',
      notes: '',
    })
    setShowModal(true)
  }

  const openEditModal = (operation: Operation) => {
    setEditingOperation(operation)
    setFormData({
      type: operation.type,
      category: operation.category,
      date: operation.date.split('T')[0],
      description: operation.description || '',
      parcel_id: operation.parcel_id,
      product_name: operation.product_name || '',
      active_agent: operation.active_agent || '',
      quantity: operation.quantity || 0,
      unit: operation.unit || 'L',
      labor_hours: operation.labor_hours || 0,
      workers: operation.workers || 1,
      equipment: operation.equipment || '',
      cost: operation.cost || 0,
      status: operation.status,
      notes: operation.notes || '',
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingOperation(null)
  }

  const operationTypes = [
    { value: 'pruning', label: t('operations.type_pruning'), icon: '✂️', category: 'maintenance' },
    { value: 'fertilization', label: t('operations.type_fertilization'), icon: '🌱', category: 'fertilization' },
    { value: 'irrigation', label: t('operations.type_irrigation'), icon: '💧', category: 'maintenance' },
    { value: 'pest_control', label: t('operations.type_pest_control'), icon: '🐛', category: 'phytosanitary' },
    { value: 'harvest', label: t('operations.type_harvest'), icon: '🫒', category: 'harvest' },
    { value: 'other', label: t('operations.type_other'), icon: '📋', category: 'maintenance' },
  ]

  const statusTypes = [
    { value: 'planned', label: t('operations.status_planned'), color: 'blue' },
    { value: 'completed', label: t('operations.status_completed'), color: 'green' },
    { value: 'cancelled', label: t('operations.status_cancelled'), color: 'gray' },
  ]

  const totalCost = filteredOperations.reduce((sum, op) => sum + (op.cost || 0), 0)

  const getTypeInfo = (type: string) => operationTypes.find(t => t.value === type) || operationTypes[5]
  const getStatusInfo = (status: string) => statusTypes.find(s => s.value === status) || statusTypes[0]

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Clipboard size={32} className="text-green-600" />
            {t('operations.title')}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {filteredOperations.length} {t('operations.operations_found')} • {t('operations.total_cost')}: €{totalCost.toFixed(2)}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-green-600 hover:bg-green-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus size={20} />
          {t('operations.add_operation')}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t('operations.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Type Filter */}
          <div className="relative">
            <Filter size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">{t('operations.filter_all')}</option>
              {operationTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.icon} {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">{t('operations.filter_all')}</option>
              {statusTypes.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {/* Parcel Filter */}
          <div className="relative">
            <Filter size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={parcelFilter}
              onChange={(e) => setParcelFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">{t('operations.filter_all')}</option>
              {parcels.map((parcel) => (
                <option key={parcel.ID} value={parcel.ID.toString()}>
                  {parcel.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Operations List */}
      {filteredOperations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Clipboard size={64} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">{t('operations.no_operations')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOperations.map((operation) => {
            const typeInfo = getTypeInfo(operation.type)
            const statusInfo = getStatusInfo(operation.status)

            return (
              <div
                key={operation.ID}
                className={`bg-white rounded-lg shadow-sm border-2 p-5 transition-all hover:shadow-md ${statusInfo.color === 'green' ? 'border-green-200' :
                  statusInfo.color === 'blue' ? 'border-blue-200' : 'border-gray-200'
                  }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{typeInfo.icon}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">{typeInfo.label}</h3>
                        <p className="text-sm text-gray-500">
                          {operation.parcel?.name || `Parcel #${operation.parcel_id}`} •
                          {new Date(operation.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {operation.description && (
                      <p className="text-sm text-gray-700 mb-3">{operation.description}</p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      {operation.product_name && (
                        <div>
                          <span className="text-gray-500 block text-xs">{t('operations.product_name')}</span>
                          <span className="font-medium text-gray-900">{operation.product_name}</span>
                        </div>
                      )}
                      {operation.quantity > 0 && (
                        <div>
                          <span className="text-gray-500 block text-xs">{t('operations.quantity')}</span>
                          <span className="font-medium text-gray-900">{operation.quantity} {operation.unit}</span>
                        </div>
                      )}
                      {operation.labor_hours > 0 && (
                        <div>
                          <span className="text-gray-500 block text-xs flex items-center gap-1">
                            <Clock size={12} />
                            {t('operations.labor_hours')}
                          </span>
                          <span className="font-medium text-gray-900">{operation.labor_hours}h</span>
                        </div>
                      )}
                      {operation.workers > 0 && (
                        <div>
                          <span className="text-gray-500 block text-xs flex items-center gap-1">
                            <Users size={12} />
                            {t('operations.workers')}
                          </span>
                          <span className="font-medium text-gray-900">{operation.workers}</span>
                        </div>
                      )}
                      {operation.equipment && (
                        <div>
                          <span className="text-gray-500 block text-xs flex items-center gap-1">
                            <Wrench size={12} />
                            {t('operations.equipment')}
                          </span>
                          <span className="font-medium text-gray-900">{operation.equipment}</span>
                        </div>
                      )}
                      {operation.cost > 0 && (
                        <div>
                          <span className="text-gray-500 block text-xs flex items-center gap-1">
                            <DollarSign size={12} />
                            {t('operations.cost')}
                          </span>
                          <span className="font-bold text-green-600">€{operation.cost.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2 ml-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color === 'green' ? 'bg-green-100 text-green-800' :
                        statusInfo.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}
                    >
                      {statusInfo.label}
                    </span>
                    <button
                      onClick={() => openEditModal(operation)}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                      title={t('operations.edit')}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(operation.ID)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      title={t('operations.delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingOperation ? t('operations.edit_operation') : t('operations.add_new_operation')}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('operations.type')} *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => {
                      const selectedType = operationTypes.find(t => t.value === e.target.value)
                      setFormData({
                        ...formData,
                        type: e.target.value,
                        category: selectedType?.category || 'maintenance'
                      })
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {operationTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('operations.date')} *
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('operations.parcel')} *
                  </label>
                  <select
                    value={formData.parcel_id}
                    onChange={(e) => setFormData({ ...formData, parcel_id: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {parcels.map((parcel) => (
                      <option key={parcel.ID} value={parcel.ID}>
                        {parcel.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('operations.status')} *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {statusTypes.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('operations.description')}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                {/* Phytosanitary/Product fields */}
                {(formData.category === 'phytosanitary' || formData.category === 'fertilization') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('operations.product_name')}
                      </label>
                      <input
                        type="text"
                        value={formData.product_name}
                        onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('operations.active_agent')}
                      </label>
                      <input
                        type="text"
                        value={formData.active_agent}
                        onChange={(e) => setFormData({ ...formData, active_agent: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('operations.quantity')}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('operations.unit')}
                      </label>
                      <select
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="L">L</option>
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="mL">mL</option>
                        <option value="units">units</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Labor fields */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('operations.labor_hours')}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.labor_hours}
                    onChange={(e) => setFormData({ ...formData, labor_hours: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('operations.workers')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.workers}
                    onChange={(e) => setFormData({ ...formData, workers: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('operations.equipment')}
                  </label>
                  <input
                    type="text"
                    value={formData.equipment}
                    onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('operations.cost')} (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('operations.notes')}
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
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
                {t('operations.save')}
              </button>
              <button
                onClick={closeModal}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 rounded-lg transition-colors font-medium"
              >
                {t('operations.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Operations
