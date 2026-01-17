import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useUI } from '../context/UIContext';
import { actualizarCuenta, calcularSaldoActual } from '../supabaseClient';
import { supabase } from '../supabaseClient';

export default function EditAccount({ cuenta, onClose, onSuccess }) {
  const { showNav } = useUI();
  const [saldoActualReal, setSaldoActualReal] = useState(0);
  const [formData, setFormData] = useState({
    nombre: cuenta.nombre,
    tipo_moneda: cuenta.tipo_moneda,
    saldo_actual_input: 0 // Este es el que el usuario editará
  });
  const [loading, setLoading] = useState(true);
  const [loadingSave, setLoadingSave] = useState(false);

  useEffect(() => {
    cargarSaldoActual();
  }, [cuenta]);

  const cargarSaldoActual = async () => {
    setLoading(true);
    const saldoActual = await calcularSaldoActual(cuenta.id);
    setSaldoActualReal(saldoActual);
    setFormData(prev => ({
      ...prev,
      saldo_actual_input: saldoActual
    }));
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.nombre || formData.saldo_actual_input === '') {
      alert('Por favor completa todos los campos');
      return;
    }

    setLoadingSave(true);

    // LÓGICA INVERSA: Calcular cuánto cambió el saldo
    // 1. Obtener total de movimientos
    const { data: movimientos } = await supabase
      .from('movimientos')
      .select('tipo, monto_original')
      .eq('id_cuenta', cuenta.id);

    const totalMovimientos = (movimientos || []).reduce((sum, mov) => {
      return sum + (mov.tipo === 'ingreso' ? parseFloat(mov.monto_original) : -parseFloat(mov.monto_original));
    }, 0);

    // 2. Calcular nuevo saldo_inicial
    // Fórmula: saldo_inicial = saldo_actual_deseado - total_movimientos
    const nuevoSaldoInicial = parseFloat(formData.saldo_actual_input) - totalMovimientos;

    // 3. Actualizar en base de datos
    const result = await actualizarCuenta(cuenta.id, {
      nombre: formData.nombre,
      tipo_moneda: formData.tipo_moneda,
      saldo_inicial: nuevoSaldoInicial
    });
    
    setLoadingSave(false);

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
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl p-6 pb-8 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Editar Cuenta</h2>
          <button
            onClick={handleClose}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full active:scale-95 transition-transform"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-600">Cargando...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de la cuenta *
              </label>
              <input
                type="text"
                placeholder="Ej: Banesco, Zelle, Efectivo"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Moneda *</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo_moneda: 'VES' })}
                  className={`py-3 rounded-xl font-medium transition-all active:scale-95 ${
                    formData.tipo_moneda === 'VES'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Bolívares (VES)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo_moneda: 'USD' })}
                  className={`py-3 rounded-xl font-medium transition-all active:scale-95 ${
                    formData.tipo_moneda === 'USD'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Dólares (USD)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Saldo Actual Real *
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Este es tu saldo actual en el banco/billetera (hoy)
              </p>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0.00"
                value={formData.saldo_actual_input}
                onChange={(e) => setFormData({ ...formData, saldo_actual_input: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base text-2xl font-bold"
              />
              <p className="text-xs text-gray-400 mt-2">
                💡 Ingresa el saldo que tienes realmente hoy. El sistema ajustará automáticamente el saldo inicial.
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loadingSave}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg active:scale-98 transition-transform shadow-lg disabled:opacity-50"
            >
              {loadingSave ? 'Actualizando...' : 'Actualizar Cuenta'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}