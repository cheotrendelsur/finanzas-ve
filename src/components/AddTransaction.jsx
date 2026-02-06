import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { crearMovimiento, getCuentas, getCategorias } from '../supabaseClient';
import { useUI } from '../context/UIContext';
import { useOffline } from '../context/OfflineContext';
import { saveDraft, loadDraft, clearDraft } from '../utils/offlineManager';

export default function AddTransaction({ onClose, onSuccess }) {
  const { showNav } = useUI();
  const { online, updatePendingCount } = useOffline();
  
  const [cuentas, setCuentas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  
  const [form, setForm] = useState({
    tipo: 'egreso',
    id_cuenta: '',
    id_categoria: '',
    monto_original: '',
    moneda_original: 'USD',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0],
    tasa_cambio_usada: '',
    monto_usd_final: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
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
    
    const draftName = `draft_${form.tipo}`;
    const draft = loadDraft(draftName);
    if (draft) {
      setForm(draft);
      setMensaje('ℹ️ Borrador recuperado');
      setTimeout(() => setMensaje(''), 2000);
    }
  }, []);

  const handleChange = (field, value) => {
    const newForm = { ...form, [field]: value };
    setForm(newForm);
    const draftName = `draft_${newForm.tipo}`;
    saveDraft(draftName, newForm);
  };

  const categoriasDisponibles = categorias.filter(c => c.tipo === form.tipo);

  const handleSubmit = async () => {
    if (!form.id_cuenta || !form.id_categoria || !form.monto_original) {
      setMensaje('Por favor completa todos los campos requeridos');
      return;
    }

    setLoading(true);

    let montoUSD = parseFloat(form.monto_original);

    if (form.moneda_original === 'BS' && form.tasa_cambio_usada) {
      montoUSD = parseFloat(form.monto_original) / parseFloat(form.tasa_cambio_usada);
    }

    const movimiento = {
      tipo: form.tipo,
      id_cuenta: form.id_cuenta,
      id_categoria: form.id_categoria,
      monto_original: parseFloat(form.monto_original),
      moneda_original: form.moneda_original,
      descripcion: form.descripcion || null,
      fecha: form.fecha,
      tasa_cambio_usada: form.tasa_cambio_usada ? parseFloat(form.tasa_cambio_usada) : null,
      monto_usd_final: montoUSD
    };

    const result = await crearMovimiento(movimiento);
    setLoading(false);

    if (result) {
      const draftName = `draft_${form.tipo}`;
      clearDraft(draftName);
      
      if (result.isOffline) {
        setMensaje('📴 Guardado en dispositivo (Pendiente de sincronizar)');
        updatePendingCount();
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
              📴 Sin conexión - Los datos se guardarán localmente
            </span>
          </div>
        )}

        {mensaje && (
          <div className={`mb-4 p-4 rounded-xl ${
            mensaje.includes('✓') || mensaje.includes('ℹ️')
              ? 'bg-green-50 text-green-800'
              : mensaje.includes('📴')
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
                value={form.moneda_original}
                onChange={(e) => handleChange('moneda_original', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base"
              >
                <option value="USD">USD ($)</option>
                <option value="BS">BS (Bs)</option>
              </select>
            </div>
          </div>

          {form.moneda_original === 'BS' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tasa de Cambio (Bs/$)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="Ej: 36.50"
                value={form.tasa_cambio_usada}
                onChange={(e) => handleChange('tasa_cambio_usada', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base"
              />
            </div>
          )}

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
            disabled={loading}
            className={`w-full py-4 rounded-xl font-semibold text-lg active:scale-98 transition-transform shadow-lg disabled:opacity-50 ${
              form.tipo === 'ingreso'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {loading ? 'Guardando...' : online ? '💾 Guardar Movimiento' : '📴 Guardar Localmente'}
          </button>
        </div>
      </div>
    </div>
  );
}