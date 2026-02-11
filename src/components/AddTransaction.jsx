import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { crearMovimiento, getCuentas, getCategorias, obtenerTasaParaFecha } from '../supabaseClient';
import { useUI } from '../context/UIContext';
import { useOffline } from '../context/OfflineContext';
import { saveDraft, loadDraft, clearDraft } from '../utils/offlineManager';

export default function AddTransaction({ tipo: tipoInicial = 'egreso', onClose, onSuccess }) {
// DESPUÉS:
const { showNav } = useUI();
const { online, updatePendingCount, performSync } = useOffline();
  
  const [cuentas, setCuentas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  
  const [form, setForm] = useState({
    tipo: tipoInicial,
    id_cuenta: '',
    id_categoria: '',
    monto_original: '',
    moneda: 'USD',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0],
    tasa_cambio: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [loadingTasa, setLoadingTasa] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [infoTasa, setInfoTasa] = useState('');

  useEffect(() => {
    // Cargar datos básicos
    const cachedCuentas = localStorage.getItem('offline_cuentas');
    const cachedCategorias = localStorage.getItem('offline_categorias');
    
    if (cachedCuentas) setCuentas(JSON.parse(cachedCuentas));
    if (cachedCategorias) setCategorias(JSON.parse(cachedCategorias));
    
    getCuentas().then(data => {
      if (data && data.length > 0) {
        setCuentas(data);
        localStorage.setItem('offline_cuentas', JSON.stringify(data));
      }
    }).catch(() => {});
    
    getCategorias().then(data => {
      if (data && data.length > 0) {
        setCategorias(data);
        localStorage.setItem('offline_categorias', JSON.stringify(data));
      }
    }).catch(() => {});
    
    // Cargar borrador específico del tipo
    const draftName = `draft_${form.tipo}`;
    const draft = loadDraft(draftName);
    
    if (draft && draft.tipo === form.tipo) {
      // Validación anti-BS
      if (draft.moneda === 'BS') {
        draft.moneda = 'VES';
      }
      
      setForm(draft);
      setMensaje('ℹ️ Borrador recuperado');
      setTimeout(() => setMensaje(''), 2000);
      
      // Si el borrador tiene moneda VES y fecha, buscar tasa automáticamente
      if (draft.moneda === 'VES' && draft.fecha) {
        buscarTasaAutomatica(draft.fecha);
      }
    }
  }, [form.tipo]);

  // Búsqueda automática de tasa al cambiar fecha o moneda
  useEffect(() => {
    // ✅ SOLO buscar si hay conexión Y la moneda es VES
    if (form.moneda === 'VES' && form.fecha && online) {
      buscarTasaAutomatica(form.fecha);
    } else if (form.moneda === 'VES' && !online) {
      // Si es VES pero no hay conexión, mostrar mensaje
      setInfoTasa('📵 Sin conexión. Ingresa la tasa manualmente.');
    }
  }, [form.fecha, form.moneda, online]); // ✅ AGREGAR 'online' como dependencia

  const buscarTasaAutomatica = async (fecha) => {
  // ✅ VERIFICACIÓN TEMPRANA: No buscar si estamos offline
  if (!online) {
    setInfoTasa('📵 Sin conexión. Ingresa la tasa manualmente.');
    setForm(prevForm => ({ ...prevForm, tasa_cambio: '' }));
    setLoadingTasa(false);
    return;
  }

  setLoadingTasa(true);
  setInfoTasa('🔍 Buscando tasa...');
  
  try {
    const resultadoTasa = await obtenerTasaParaFecha(fecha);
    
    if (resultadoTasa) {
      const newForm = { ...form, tasa_cambio: resultadoTasa.valor.toString() };
      setForm(newForm);
      
      if (resultadoTasa.esExacta) {
        setInfoTasa(`✅ Tasa exacta: ${resultadoTasa.valor} Bs/$ (${resultadoTasa.fecha})`);
      } else {
        setInfoTasa(`⚠️ Tasa más cercana: ${resultadoTasa.valor} Bs/$ (${resultadoTasa.fecha})`);
      }
      
      // Guardar en borrador
      const draftName = `draft_${newForm.tipo}`;
      saveDraft(draftName, newForm);
    } else {
      setInfoTasa('❌ No hay tasas registradas. Por favor ingresa una tasa manualmente.');
      setForm(prevForm => ({ ...prevForm, tasa_cambio: '' }));
    }
  } catch (error) {
    // ✅ CAPTURA DE ERRORES SIN CRASHEAR
    console.error('Error buscando tasa:', error);
    setInfoTasa('⚠️ Error buscando tasa. Ingrésala manualmente.');
    setForm(prevForm => ({ ...prevForm, tasa_cambio: '' }));
  } finally {
    setLoadingTasa(false);
  }
};

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
    
    // Guardar en borrador específico del tipo
    const draftName = `draft_${newForm.tipo}`;
    saveDraft(draftName, newForm);
    
    // Si cambió el tipo, limpiar categoría porque puede no estar disponible
    if (field === 'tipo') {
      newForm.id_categoria = '';
      setForm(newForm);
    }
    
    // Si cambió a VES manualmente, buscar tasa automáticamente
    if (field === 'moneda' && value === 'VES' && newForm.fecha) {
      buscarTasaAutomatica(newForm.fecha);
    }
    
    // Si cambió de VES a USD manualmente, limpiar tasa
    if (field === 'moneda' && value === 'USD') {
      setForm({ ...newForm, tasa_cambio: '' });
      setInfoTasa('');
    }
  };

  const categoriasDisponibles = categorias.filter(c => c.tipo === form.tipo);

  const handleSubmit = async () => {
  // Validaciones básicas
  if (!form.id_cuenta || !form.id_categoria || !form.monto_original) {
    setMensaje('Por favor completa todos los campos requeridos');
    return;
  }

  // ✅ VALIDACIÓN MEJORADA: Si es VES, debe tener tasa (online o offline)
  if (form.moneda === 'VES' && !form.tasa_cambio) {
    setMensaje('❌ Debes ingresar una tasa de cambio para movimientos en Bolívares');
    return;
  }

  // ✅ VALIDACIÓN: Si la tasa es inválida
  if (form.moneda === 'VES' && (isNaN(parseFloat(form.tasa_cambio)) || parseFloat(form.tasa_cambio) <= 0)) {
    setMensaje('❌ La tasa de cambio debe ser un número válido mayor que cero');
    return;
  }

  setLoading(true);

  try {
    let montoUSD = parseFloat(form.monto_original);

    if (form.moneda === 'VES' && form.tasa_cambio) {
      montoUSD = parseFloat(form.monto_original) / parseFloat(form.tasa_cambio);
    }

    const movimiento = {
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

    const result = await crearMovimiento(movimiento);

    if (result) {
      const draftName = `draft_${form.tipo}`;
      clearDraft(draftName);
      
      if (result.isOffline) {
        setMensaje('🔴 Guardado en dispositivo (Pendiente de sincronizar)');
        updatePendingCount();
        
        // Sincronización oportunista
        setTimeout(async () => {
          if (online) {
            console.log('🔄 Guardado offline pero hay conexión, intentando sincronizar...');
            await performSync(false);
          }
        }, 2000);
        
        setTimeout(() => {
          showNav();
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setMensaje('✓ Movimiento registrado correctamente');
        setTimeout(() => {
          showNav();
          onSuccess();
          onClose();
        }, 1000);
      }
    } else {
      setMensaje('Error: No se pudo guardar el movimiento');
    }
  } catch (error) {
    // ✅ CAPTURA DE ERRORES DE RED
    console.error('Error en submit:', error);
    
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      setMensaje('⚠️ Sin conexión. El movimiento se guardará localmente.');
      
      // Intentar guardar en cola offline manualmente
      setTimeout(() => {
        handleSubmit(); // Reintentar (ahora debería detectar offline)
      }, 500);
    } else {
      setMensaje('❌ Error inesperado: ' + error.message);
    }
  } finally {
    setLoading(false);
  }
};

  const handleCancel = () => {
    if (form.monto_original || form.descripcion) {
      const keep = confirm('¿Guardar borrador para continuar después?');
      if (!keep) {
        const draftName = `draft_${form.tipo}`;
        clearDraft(draftName);
      }
    }
    showNav();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl p-6 pb-8 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Nuevo Movimiento</h2>
          <button
            onClick={handleCancel}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full active:scale-95 transition-transform"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {!online && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-2">
            <span className="text-orange-600 text-sm font-medium">
              🔴 Sin conexión - Los datos se guardarán localmente
            </span>
          </div>
        )}

        {mensaje && (
          <div className={`mb-4 p-4 rounded-xl ${
            mensaje.includes('✓') || mensaje.includes('ℹ️')
              ? 'bg-green-50 text-green-800'
              : mensaje.includes('🔴')
              ? 'bg-orange-50 text-orange-800'
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
            className={`w-full py-4 rounded-xl font-semibold text-lg active:scale-98 transition-transform shadow-lg disabled:opacity-50 ${
              form.tipo === 'ingreso'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {loading ? 'Guardando...' : loadingTasa ? 'Cargando tasa...' : online ? '💾 Guardar Movimiento' : '🔴 Guardar Localmente'}
          </button>
        </div>
      </div>
    </div>
  );
}