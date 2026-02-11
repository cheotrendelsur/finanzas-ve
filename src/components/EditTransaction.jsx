import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { actualizarMovimiento, eliminarMovimiento, obtenerTasaParaFecha } from '../supabaseClient';
import { useUI } from '../context/UIContext';
import { useOffline } from '../context/OfflineContext';

export default function EditTransaction({ movimiento, cuentas, categorias, onClose, onSuccess }) {
  const { showNav } = useUI();
  const { online, updatePendingCount, performSync } = useOffline();
  
  const [form, setForm] = useState({
    tipo: movimiento.tipo,
    id_cuenta: movimiento.id_cuenta,
    id_categoria: movimiento.id_categoria,
    monto_original: movimiento.monto_original,
    moneda: movimiento.moneda_movimiento === 'BS' ? 'VES' : (movimiento.moneda_movimiento || 'USD'),
    descripcion: movimiento.descripcion || '',
    fecha: movimiento.fecha,
    tasa_cambio: movimiento.tasa_aplicada || '',
  });
  
  const [loading, setLoading] = useState(false);
  const [loadingTasa, setLoadingTasa] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [infoTasa, setInfoTasa] = useState('');

  // Búsqueda automática de tasa al cambiar fecha o moneda
  useEffect(() => {
    if (form.moneda === 'VES' && form.fecha) {
      buscarTasaAutomatica(form.fecha);
    }
  }, [form.fecha, form.moneda]);

  const buscarTasaAutomatica = async (fecha) => {
    setLoadingTasa(true);
    setInfoTasa('🔍 Buscando tasa...');
    
    const resultadoTasa = await obtenerTasaParaFecha(fecha);
    
    if (resultadoTasa) {
      setForm(prevForm => ({
        ...prevForm,
        tasa_cambio: resultadoTasa.valor.toString()
      }));
      
      if (resultadoTasa.esExacta) {
        setInfoTasa(`✅ Tasa exacta: ${resultadoTasa.valor} Bs/$ (${resultadoTasa.fecha})`);
      } else {
        setInfoTasa(`⚠️ Tasa más cercana: ${resultadoTasa.valor} Bs/$ (${resultadoTasa.fecha})`);
      }
    } else {
      setInfoTasa('❌ No hay tasas registradas. Por favor ingresa una tasa manualmente.');
      setForm(prevForm => ({ ...prevForm, tasa_cambio: '' }));
    }
    
    setLoadingTasa(false);
  };

  const categoriasDisponibles = categorias.filter(c => c.tipo === form.tipo);

  const handleChange = (field, value) => {
    // Validación anti-BS en tiempo real
    if (field === 'moneda' && value === 'BS') {
      value = 'VES';
    }
    
    let newForm = { ...form, [field]: value };
    
    // ✅ NUEVA LÓGICA: Si cambia la cuenta, actualizar moneda automáticamente
    if (field === 'id_cuenta') {
      const cuentaSeleccionada = cuentas.find(c => c.id === value);
      if (cuentaSeleccionada) {
        newForm.moneda = cuentaSeleccionada.tipo_moneda;
        
        // Si la cuenta es VES, disparar búsqueda de tasa
        if (cuentaSeleccionada.tipo_moneda === 'VES' && newForm.fecha) {
          // La búsqueda se disparará automáticamente por el useEffect
          setInfoTasa('🔍 Detectada cuenta en Bolívares, buscando tasa...');
        } else if (cuentaSeleccionada.tipo_moneda === 'USD') {
          // Si es USD, limpiar tasa
          newForm.tasa_cambio = '';
          setInfoTasa('');
        }
      }
    }
    
    setForm(newForm);
    
    // Si cambió el tipo, limpiar categoría porque puede no estar disponible
    if (field === 'tipo') {
      setForm(prevForm => ({ ...prevForm, id_categoria: '' }));
    }
    
    // Si cambió a VES manualmente, buscar tasa automáticamente
    if (field === 'moneda' && value === 'VES' && form.fecha) {
      buscarTasaAutomatica(form.fecha);
    }
    
    // Si cambió de VES a USD manualmente, limpiar tasa
    if (field === 'moneda' && value === 'USD') {
      setForm(prevForm => ({ ...prevForm, tasa_cambio: '' }));
      setInfoTasa('');
    }
  };

  const handleSubmit = async () => {
    // Validaciones básicas
    if (!form.id_cuenta || !form.id_categoria || !form.monto_original) {
      setMensaje('Por favor completa todos los campos requeridos');
      return;
    }

    // Validación crítica - Si es VES, debe tener tasa
    if (form.moneda === 'VES' && !form.tasa_cambio) {
      setMensaje('❌ Error: No se pudo obtener una tasa de cambio para esta fecha. Ingresa una manualmente.');
      return;
    }

    setLoading(true);

    let montoUSD = parseFloat(form.monto_original);

    // Si la moneda es VES, calcular equivalente en USD
    if (form.moneda === 'VES' && form.tasa_cambio) {
      montoUSD = parseFloat(form.monto_original) / parseFloat(form.tasa_cambio);
    }

    // Estructura final estandarizada
    const cambios = {
      tipo: form.tipo,
      id_cuenta: form.id_cuenta,
      id_categoria: form.id_categoria,
      monto_original: parseFloat(form.monto_original),
      moneda_movimiento: form.moneda === 'BS' ? 'VES' : form.moneda,
      descripcion: form.descripcion || null,
      fecha: form.fecha,
      tasa_aplicada: form.tasa_cambio ? parseFloat(form.tasa_cambio) : null,
      monto_usd_final: montoUSD
    };

    const result = await actualizarMovimiento(movimiento.id, cambios);
    setLoading(false);

    if (result) {
      // ✅ NUEVA LÓGICA: Verificar si fue offline
      if (result.isOffline) {
        setMensaje('🔴 Cambios guardados en dispositivo (Pendiente de sincronizar)');
        updatePendingCount();
        
        // Sincronización oportunista
        setTimeout(async () => {
          if (online) {
            console.log('🔄 Actualización offline pero hay conexión, intentando sincronizar...');
            await performSync(false);
          }
        }, 2000);
      } else {
        setMensaje('✓ Movimiento actualizado correctamente');
      }
      
      setTimeout(() => {
        showNav();
        onSuccess();
        onClose();
      }, 1000);
    } else {
      setMensaje('Error: No se pudo actualizar el movimiento');
    }
  };

  const handleDelete = async () => {
    const confirmado = confirm('¿Estás seguro de que deseas eliminar este movimiento? Esta acción no se puede deshacer.');
    
    if (!confirmado) return;

    setLoading(true);
    const success = await eliminarMovimiento(movimiento.id);
    setLoading(false);

    if (success) {
      setMensaje('✓ Movimiento eliminado correctamente');
      setTimeout(() => {
        showNav();
        onSuccess();
        onClose();
      }, 1000);
    } else {
      setMensaje('Error: No se pudo eliminar el movimiento');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl p-6 pb-8 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Editar Movimiento</h2>
          <button
            onClick={() => { showNav(); onClose(); }}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full active:scale-95 transition-transform"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {mensaje && (
          <div className={`mb-4 p-4 rounded-xl ${
            mensaje.includes('✓')
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}>
            <p className="text-sm">{mensaje}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="bg-gray-100 rounded-xl p-1 grid grid-cols-2 gap-1">
            <button
              onClick={() => handleChange('tipo', 'ingreso')}
              className={`py-3 rounded-lg font-medium transition-all active:scale-95 ${
                form.tipo === 'ingreso'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'text-gray-700'
              }`}
            >
              💰 Ingreso
            </button>
            <button
              onClick={() => handleChange('tipo', 'egreso')}
              className={`py-3 rounded-lg font-medium transition-all active:scale-95 ${
                form.tipo === 'egreso'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-gray-700'
              }`}
            >
              💸 Egreso
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cuenta *
            </label>
            <select
              value={form.id_cuenta}
              onChange={(e) => handleChange('id_cuenta', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base"
            >
              <option value="">Selecciona una cuenta</option>
              {cuentas.map(cuenta => (
                <option key={cuenta.id} value={cuenta.id}>
                  {cuenta.nombre} ({cuenta.tipo_moneda})
                </option>
              ))}
            </select>
            {/* ✅ NUEVO: Indicador visual de moneda auto-seleccionada */}
            {form.id_cuenta && (
              <p className="text-xs text-blue-600 mt-1">
                💡 Moneda establecida automáticamente: {form.moneda === 'VES' ? 'Bolívares (Bs)' : 'Dólares ($)'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoría *
            </label>
            <select
              value={form.id_categoria}
              onChange={(e) => handleChange('id_categoria', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base"
            >
              <option value="">Selecciona una categoría</option>
              {categoriasDisponibles.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto *
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0.00"
                value={form.monto_original}
                onChange={(e) => handleChange('monto_original', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Moneda *
              </label>
              <select
                value={form.moneda}
                onChange={(e) => handleChange('moneda', e.target.value)}
                disabled={!!form.id_cuenta} // ✅ NUEVO: Deshabilitar si ya hay cuenta seleccionada
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="USD">USD ($)</option>
                <option value="VES">BS (Bs)</option>
              </select>
              {/* ✅ NUEVO: Texto explicativo */}
              {form.id_cuenta && (
                <p className="text-xs text-gray-500 mt-1">
                  Moneda bloqueada según la cuenta
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha *
            </label>
            <input
              type="date"
              value={form.fecha} 
              onChange={(e) => handleChange('fecha', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base"
            />
          </div>

          {form.moneda === 'VES' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tasa de Cambio (Bs/$) *
              </label>
              
              {infoTasa && (
                <div className={`mb-2 p-2 rounded-lg text-xs ${
                  infoTasa.includes('✅') 
                    ? 'bg-green-50 text-green-700'
                    : infoTasa.includes('⚠️')
                    ? 'bg-yellow-50 text-yellow-700'
                    : infoTasa.includes('🔍')
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-red-50 text-red-700'
                }`}>
                  {infoTasa}
                </div>
              )}
              
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="Ej: 36.50"
                value={form.tasa_cambio}
                onChange={(e) => handleChange('tasa_cambio', e.target.value)}
                disabled={loadingTasa}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 La tasa se busca automáticamente según la fecha
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción (Opcional)
            </label>
            <textarea
              value={form.descripcion}
              onChange={(e) => handleChange('descripcion', e.target.value)}
              placeholder="Ej: Compra en supermercado"
              rows="3"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || loadingTasa}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg active:scale-98 transition-transform shadow-lg disabled:opacity-50"
          >
            {loading ? 'Guardando...' : loadingTasa ? 'Cargando tasa...' : '💾 Guardar Cambios'}
          </button>

          <button
            onClick={handleDelete}
            disabled={loading || loadingTasa}
            className="w-full bg-red-600 text-white py-4 rounded-xl font-semibold text-lg active:scale-98 transition-transform shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-5 h-5" />
            {loading ? 'Eliminando...' : 'Eliminar Movimiento'}
          </button>
        </div>
      </div>
    </div>
  );
}