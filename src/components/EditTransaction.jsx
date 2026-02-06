import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { actualizarMovimiento, eliminarMovimiento } from '../supabaseClient';
import { useUI } from '../context/UIContext';

export default function EditTransaction({ movimiento, cuentas, categorias, onClose, onSuccess }) {
  const { showNav } = useUI();
  
  const [form, setForm] = useState({
    tipo: movimiento.tipo,
    id_cuenta: movimiento.id_cuenta,
    id_categoria: movimiento.id_categoria,
    monto_original: movimiento.monto_original,
    moneda_original: movimiento.moneda_original,
    descripcion: movimiento.descripcion || '',
    fecha: movimiento.fecha,
    tasa_cambio_usada: movimiento.tasa_cambio_usada || '',
  });
  
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');

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

    const cambios = {
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

    const result = await actualizarMovimiento(movimiento.id, cambios);
    setLoading(false);

    if (result) {
      setMensaje('✓ Movimiento actualizado correctamente');
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
              onClick={() => setForm({ ...form, tipo: 'ingreso' })}
              className={`py-3 rounded-lg font-medium transition-all active:scale-95 ${
                form.tipo === 'ingreso'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'text-gray-700'
              }`}
            >
              💰 Ingreso
            </button>
            <button
              onClick={() => setForm({ ...form, tipo: 'egreso' })}
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
              onChange={(e) => setForm({ ...form, id_cuenta: e.target.value })}
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
              onChange={(e) => setForm({ ...form, id_categoria: e.target.value })}
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
                onChange={(e) => setForm({ ...form, monto_original: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Moneda *
              </label>
              <select
                value={form.moneda_original}
                onChange={(e) => setForm({ ...form, moneda_original: e.target.value })}
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
                onChange={(e) => setForm({ ...form, tasa_cambio_usada: e.target.value })}
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
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción (Opcional)
            </label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Ej: Compra en supermercado"
              rows="3"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg active:scale-98 transition-transform shadow-lg disabled:opacity-50"
          >
            {loading ? 'Guardando...' : '💾 Guardar Cambios'}
          </button>

          <button
            onClick={handleDelete}
            disabled={loading}
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