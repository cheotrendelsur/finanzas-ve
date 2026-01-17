import { useState } from 'react';
import { X } from 'lucide-react';
import { useUI } from '../context/UIContext';
import { crearCuenta } from '../supabaseClient';

export default function AddAccount({ onClose, onSuccess }) {
  const { showNav } = useUI();
  const [formData, setFormData] = useState({
    nombre: '',
    tipo_moneda: 'VES',
    saldo_inicial: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!formData.nombre || !formData.saldo_inicial) {
      alert('Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    const nuevaCuenta = {
      nombre: formData.nombre,
      tipo_moneda: formData.tipo_moneda,
      saldo_inicial: parseFloat(formData.saldo_inicial),
      icono: 'wallet'
    };
    
    const result = await crearCuenta(nuevaCuenta);
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
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl p-6 pb-8 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Nueva Cuenta</h2>
          <button
            onClick={handleClose}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full active:scale-95 transition-transform"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre de la cuenta *</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Saldo Inicial *</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.00"
              value={formData.saldo_inicial}
              onChange={(e) => setFormData({ ...formData, saldo_inicial: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base text-2xl font-bold"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg active:scale-98 transition-transform shadow-lg disabled:opacity-50"
          >
            {loading ? 'Creando...' : 'Crear Cuenta'}
          </button>
        </div>
      </div>
    </div>
  );
}