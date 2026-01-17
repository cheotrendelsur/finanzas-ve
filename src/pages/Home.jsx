import { useState, useEffect } from 'react';
import { ArrowUpCircle, ArrowDownCircle, Wallet, DollarSign } from 'lucide-react';
import { useUI } from '../context/UIContext';
import { useExchangeRate } from '../context/ExchangeRateContext';
import { getCuentas, calcularSaldoActual } from '../supabaseClient';
import AddTransaction from '../components/AddTransaction';

export default function Home({ cuentas, categorias, onCuentaClick, onRefresh }) {
  const { hideBottomNav } = useUI();
  const { getLatestRate } = useExchangeRate();
  
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [tasaActual, setTasaActual] = useState(null);
  const [saldosCuentas, setSaldosCuentas] = useState({});

  useEffect(() => {
    cargarDatos();
  }, [cuentas]);

  const cargarDatos = async () => {
    const rate = await getLatestRate();
    setTasaActual(rate.valor);

    // Calcular saldos actuales de cada cuenta
    const saldos = {};
    for (const cuenta of cuentas) {
      saldos[cuenta.id] = await calcularSaldoActual(cuenta.id);
    }
    setSaldosCuentas(saldos);
  };

  const calcularSaldoTotalUSD = () => {
    return cuentas.reduce((total, cuenta) => {
      const saldoCuenta = saldosCuentas[cuenta.id] || cuenta.saldo_inicial;
      if (cuenta.tipo_moneda === 'USD') {
        return total + parseFloat(saldoCuenta);
      }
      return total + (parseFloat(saldoCuenta) / (tasaActual || 587.89));
    }, 0);
  };

  const convertirAUSD = (monto, moneda) => {
    if (moneda === 'USD') return parseFloat(monto);
    return parseFloat(monto) / (tasaActual || 587.89);
  };

  const handleOpenTransaction = (tipo) => {
    hideBottomNav();
    setShowTransactionForm(tipo);
  };

  return (
    <div className="pb-20 px-4 pt-6">
      {/* Header con Saldo Total */}
      <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-purple-700 rounded-3xl p-6 text-white shadow-xl mb-6">
        <p className="text-sm opacity-90 mb-2">Saldo Total Consolidado</p>
        <h1 className="text-5xl font-bold mb-1">
          ${calcularSaldoTotalUSD().toFixed(2)}
        </h1>
        <p className="text-xs opacity-75">USD</p>
        
        {/* Botones de Acción */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => handleOpenTransaction('ingreso')}
            className="flex-1 bg-white/20 backdrop-blur-sm rounded-xl py-3 flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <ArrowUpCircle className="w-5 h-5" />
            <span className="font-medium">Ingreso</span>
          </button>
          <button
            onClick={() => handleOpenTransaction('egreso')}
            className="flex-1 bg-white/20 backdrop-blur-sm rounded-xl py-3 flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <ArrowDownCircle className="w-5 h-5" />
            <span className="font-medium">Egreso</span>
          </button>
        </div>
      </div>

      {/* Sección de Cuentas - SIN BOTÓN DE AGREGAR */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800 px-2 mb-4">Mis Cuentas</h2>

        {cuentas.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Wallet className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No tienes cuentas registradas</p>
            <p className="text-sm mt-2">Ve a la sección "Cuentas" para crear una</p>
          </div>
        ) : (
          cuentas.map(cuenta => {
            const saldoActual = saldosCuentas[cuenta.id] || cuenta.saldo_inicial;
            const equivalenteUSD = convertirAUSD(saldoActual, cuenta.tipo_moneda);
            
            return (
              <button
                key={cuenta.id}
                onClick={() => onCuentaClick(cuenta)}
                className="w-full bg-white rounded-2xl p-5 shadow-sm border border-gray-100 active:scale-98 transition-transform text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        cuenta.tipo_moneda === 'USD' ? 'bg-green-100' : 'bg-blue-100'
                      }`}>
                        <DollarSign className={`w-5 h-5 ${
                          cuenta.tipo_moneda === 'USD' ? 'text-green-600' : 'text-blue-600'
                        }`} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{cuenta.nombre}</p>
                        <p className="text-xs text-gray-500">{cuenta.tipo_moneda}</p>
                      </div>
                    </div>
                    
                    {/* Saldo en moneda original */}
                    <p className="text-3xl font-bold text-gray-900">
                      {cuenta.tipo_moneda === 'USD' ? '$' : 'Bs. '}
                      {parseFloat(saldoActual).toLocaleString('es-VE', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </p>
                    
                    {/* Equivalente en USD (solo para VES) */}
                    {cuenta.tipo_moneda === 'VES' && (
                      <p className="text-sm text-gray-400 mt-1">
                        ≈ ${equivalenteUSD.toFixed(2)} USD
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Modal de Transacción */}
      {showTransactionForm && (
        <AddTransaction
          tipo={showTransactionForm}
          cuentas={cuentas}
          categorias={categorias}
          onClose={() => setShowTransactionForm(false)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}