import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { getMovimientosByCuenta, calcularSaldoActual, getCategorias } from '../supabaseClient';
import { useExchangeRate } from '../context/ExchangeRateContext';
import { useUI } from '../context/UIContext';
import AddTransaction from '../components/AddTransaction';

export default function AccountDetails({ cuenta, cuentas, onBack, onRefresh }) {
  const { getExchangeRate } = useExchangeRate();
  const { hideBottomNav } = useUI();
  
  const [movimientos, setMovimientos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [saldoActual, setSaldoActual] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingMovimiento, setEditingMovimiento] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, [cuenta]);

  const cargarDatos = async () => {
    setLoading(true);
    const [movs, cats] = await Promise.all([
      getMovimientosByCuenta(cuenta.id),
      getCategorias()
    ]);
    
    setMovimientos(movs);
    setCategorias(cats);
    
    const saldo = await calcularSaldoActual(cuenta.id);
    setSaldoActual(saldo);
    
    setLoading(false);
  };

  const handleMovimientoClick = (movimiento) => {
    hideBottomNav();
    setEditingMovimiento(movimiento);
  };

  const handleCloseEdit = () => {
    setEditingMovimiento(null);
    cargarDatos();
    onRefresh?.();
  };

  const formatearMonto = (monto, moneda) => {
    const simbolo = moneda === 'USD' ? '$' : 'Bs. ';
    return simbolo + parseFloat(monto).toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const calcularEquivalenteUSD = (montoVES, tasa) => {
    if (!tasa) return 0;
    return parseFloat(montoVES) / parseFloat(tasa);
  };

  return (
    <div className="pb-20 px-4 pt-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">{cuenta.nombre}</h1>
          <p className="text-sm text-gray-500">{cuenta.tipo_moneda}</p>
        </div>
      </div>

      {/* Saldo Actual */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-6 text-white shadow-lg mb-6">
        <p className="text-sm opacity-90 mb-2">Saldo Actual</p>
        <h2 className="text-4xl font-bold">
          {formatearMonto(saldoActual, cuenta.tipo_moneda)}
        </h2>
      </div>

      {/* Lista de Movimientos */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-800 px-2 mb-4">
          Historial de Movimientos
          <span className="text-sm font-normal text-gray-500 ml-2">(Click para editar)</span>
        </h3>
        
        {loading ? (
          <div className="text-center py-8 text-gray-400">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p>Cargando...</p>
          </div>
        ) : movimientos.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No hay movimientos en esta cuenta</p>
            <p className="text-sm mt-2">Los movimientos aparecerán aquí</p>
          </div>
        ) : (
          movimientos.map(mov => {
            const esIngreso = mov.tipo === 'ingreso';
            const montoUSD = mov.moneda_movimiento === 'VES' 
              ? calcularEquivalenteUSD(mov.monto_original, mov.tasa_aplicada)
              : parseFloat(mov.monto_original);

            return (
              <button
                key={mov.id}
                onClick={() => handleMovimientoClick(mov)}
                className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-blue-300 active:scale-98 transition-all text-left"
              >
                <div className="flex items-start justify-between">
                  {/* Lado Izquierdo */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {esIngreso ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      )}
                      <p className="font-semibold text-gray-800">
                        {mov.categoria?.nombre || mov.descripcion || (esIngreso ? 'Ingreso' : 'Egreso')}
                      </p>
                    </div>
                    <p className="text-sm text-gray-500">
                      {new Date(mov.fecha).toLocaleDateString('es-VE', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                    {mov.categoria && (
                      <span
                        className="inline-block mt-2 px-2 py-1 rounded-lg text-xs font-medium"
                        style={{
                          backgroundColor: `${mov.categoria.color}20`,
                          color: mov.categoria.color
                        }}
                      >
                        {mov.categoria.nombre}
                      </span>
                    )}
                  </div>

                  {/* Lado Derecho - Montos con Lógica Condicional */}
                  <div className="text-right ml-4">
                    {mov.moneda_movimiento === 'VES' ? (
                      <>
                        {/* Caso A: Movimiento en VES */}
                        <p className={`text-xl font-bold ${
                          esIngreso ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {esIngreso ? '+' : '-'}
                          {formatearMonto(mov.monto_original, 'VES')}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          ≈ ${montoUSD.toFixed(2)}
                        </p>
                      </>
                    ) : (
                      <>
                        {/* Caso B: Movimiento en USD */}
                        <p className={`text-xl font-bold ${
                          esIngreso ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {esIngreso ? '+' : '-'}
                          {formatearMonto(mov.monto_original, 'USD')}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Modal de Edición */}
      {editingMovimiento && (
        <AddTransaction
          tipo={editingMovimiento.tipo}
          cuentas={cuentas}
          categorias={categorias}
          onClose={handleCloseEdit}
          onSuccess={handleCloseEdit}
          editMode={true}
          movimientoData={editingMovimiento}
        />
      )}
    </div>
  );
}