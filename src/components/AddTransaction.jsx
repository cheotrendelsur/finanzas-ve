import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useUI } from '../context/UIContext';
import { useExchangeRate } from '../context/ExchangeRateContext';
import { crearMovimiento, actualizarMovimiento } from '../supabaseClient';

export default function AddTransaction({ 
  tipo, 
  cuentas, 
  categorias, 
  onClose, 
  onSuccess,
  editMode = false,
  movimientoData = null 
}) {
  const { showNav } = useUI();
  const { getExchangeRate } = useExchangeRate();
  
  const [formData, setFormData] = useState({
    fecha: editMode ? movimientoData?.fecha : new Date().toISOString().split('T')[0],
    monto: editMode ? movimientoData?.monto_original : '',
    id_cuenta: editMode ? movimientoData?.id_cuenta : '',
    id_categoria: editMode ? movimientoData?.id_categoria : ''
  });
  
  const [alertaTasa, setAlertaTasa] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Validación en tiempo real
  useEffect(() => {
    validateForm();
  }, [formData]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.id_cuenta) {
      newErrors.cuenta = 'Selecciona una cuenta';
    }
    
    if (!formData.id_categoria) {
      newErrors.categoria = 'Selecciona una categoría';
    }
    
    if (!formData.monto || parseFloat(formData.monto) <= 0) {
      newErrors.monto = 'Ingresa un monto válido';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = () => {
    return formData.id_cuenta && 
           formData.id_categoria && 
           formData.monto && 
           parseFloat(formData.monto) > 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    const cuenta = cuentas.find(c => c.id === formData.id_cuenta);
    
    let tasa_aplicada = null;
    let monto_usd_final = parseFloat(formData.monto);

    if (cuenta.tipo_moneda === 'VES') {
      const rateResult = await getExchangeRate(formData.fecha);
      
      if (rateResult.isFallback || !rateResult.isExact) {
        setAlertaTasa(`Usando tasa del ${rateResult.fecha} (${rateResult.valor.toFixed(2)} Bs/$)`);
      }

      tasa_aplicada = rateResult.valor;
      monto_usd_final = parseFloat(formData.monto) / rateResult.valor;
    }

    const movimientoPayload = {
      fecha: formData.fecha,
      tipo: tipo,
      monto_original: parseFloat(formData.monto),
      moneda_movimiento: cuenta.tipo_moneda,
      tasa_aplicada,
      monto_usd_final,
      id_cuenta: formData.id_cuenta,
      id_categoria: formData.id_categoria,
      descripcion: categorias.find(c => c.id === formData.id_categoria)?.nombre || tipo
    };

    let result;
    if (editMode && movimientoData) {
      result = await actualizarMovimiento(movimientoData.id, movimientoPayload);
    } else {
      result = await crearMovimiento(movimientoPayload);
    }
    
    setLoading(false);

    if (result) {
      showNav();
      onSuccess?.();
      onClose();
    }
  };

  const handleClose = () => {
    showNav();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl p-6 pb-8 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {editMode ? '✏️ Editar' : (tipo === 'ingreso' ? '💰 Nuevo Ingreso' : '💸 Nuevo Egreso')}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full active:scale-95 transition-transform"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Alerta de Validación */}
        {!isFormValid() && Object.keys(errors).length > 0 && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 mb-1">Completa los campos requeridos:</p>
              <ul className="text-sm text-red-700 space-y-1">
                {Object.values(errors).map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {alertaTasa && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <p className="text-sm text-yellow-800">⚠️ {alertaTasa}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha *</label>
            <input
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cuenta *
              {errors.cuenta && <span className="text-red-600 ml-2">({errors.cuenta})</span>}
            </label>
            <select
              value={formData.id_cuenta}
              onChange={(e) => setFormData({ ...formData, id_cuenta: e.target.value })}
              className={`w-full px-4 py-3 rounded-xl border focus:border-blue-500 focus:outline-none text-base bg-white ${
                errors.cuenta ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
            >
              <option value="">Seleccionar cuenta</option>
              {cuentas.map(cuenta => (
                <option key={cuenta.id} value={cuenta.id}>
                  {cuenta.nombre} ({cuenta.tipo_moneda})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoría *
              {errors.categoria && <span className="text-red-600 ml-2">({errors.categoria})</span>}
            </label>
            <select
              value={formData.id_categoria}
              onChange={(e) => setFormData({ ...formData, id_categoria: e.target.value })}
              className={`w-full px-4 py-3 rounded-xl border focus:border-blue-500 focus:outline-none text-base bg-white ${
                errors.categoria ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
            >
              <option value="">Seleccionar categoría</option>
              {categorias.filter(c => c.tipo === tipo).map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monto *
              {errors.monto && <span className="text-red-600 ml-2">({errors.monto})</span>}
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.00"
              value={formData.monto}
              onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
              className={`w-full px-4 py-3 rounded-xl border focus:border-blue-500 focus:outline-none text-base text-2xl font-bold ${
                errors.monto ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !isFormValid()}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all shadow-lg ${
              isFormValid() && !loading
                ? `${tipo === 'ingreso' ? 'bg-green-600' : 'bg-red-600'} text-white active:scale-98`
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? 'Guardando...' : (editMode ? 'Actualizar' : `Guardar ${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}`)}
          </button>
        </div>
      </div>
    </div>
  );
}