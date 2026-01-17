import { useState, useEffect } from 'react';
import { User, DollarSign, Download, X, Check } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { getTasas, crearTasa, getMovimientos } from '../supabaseClient';
import { useUI } from '../context/UIContext';

export default function Settings() {
  const { hideBottomNav, showNav } = useUI();
  const [user, setUser] = useState(null);
  const [showAddTasa, setShowAddTasa] = useState(false);
  const [tasasRecientes, setTasasRecientes] = useState([]);
  const [formTasa, setFormTasa] = useState({
    fecha: new Date().toISOString().split('T')[0],
    valor: ''
  });
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  
  // Exportación CSV
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    checkUser();
    cargarTasas();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const cargarTasas = async () => {
    const tasas = await getTasas();
    setTasasRecientes(tasas.slice(0, 10));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleOpenAddTasa = () => {
    hideBottomNav();
    setShowAddTasa(true);
  };

  const handleCloseAddTasa = () => {
    showNav();
    setShowAddTasa(false);
    setFormTasa({
      fecha: new Date().toISOString().split('T')[0],
      valor: ''
    });
    setMensaje('');
  };

  const handleSubmitTasa = async () => {
    if (!formTasa.fecha || !formTasa.valor) {
      setMensaje('Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    const result = await crearTasa(formTasa.fecha, parseFloat(formTasa.valor));
    setLoading(false);

    if (result) {
      setMensaje('✓ Tasa agregada correctamente');
      await cargarTasas();
      setTimeout(() => {
        handleCloseAddTasa();
      }, 1500);
    } else {
      setMensaje('Error: Esta fecha ya tiene una tasa registrada');
    }
  };

  // Generar CSV
  const handleExportCSV = async () => {
    const movimientos = await getMovimientos();
    
    // Filtrar por mes y año
    const filtrados = movimientos.filter(m => {
      const fecha = new Date(m.fecha);
      return fecha.getFullYear() === selectedYear && (fecha.getMonth() + 1) === selectedMonth;
    });

    if (filtrados.length === 0) {
      alert('No hay movimientos para exportar en este periodo');
      return;
    }

    // Ordenar cronológicamente (más antiguo primero)
    filtrados.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    // Generar CSV
    const headers = ['Fecha', 'Tipo', 'Categoría', 'Cuenta', 'Monto USD'];
    const rows = filtrados.map(m => [
      new Date(m.fecha).toLocaleDateString('es-VE'),
      m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
      m.categoria?.nombre || 'Sin categoría',
      m.cuenta?.nombre || 'N/A',
      parseFloat(m.monto_usd_final).toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Descargar
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const monthName = new Date(selectedYear, selectedMonth - 1).toLocaleDateString('es-VE', { month: '2-digit' });
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_${monthName}_${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const meses = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ];

  const años = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="pb-20 px-4 pt-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">⚙️ Configuración</h1>

      {/* Gestión de Tasas */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Tasas de Cambio</h2>
              <p className="text-sm text-gray-500">Gestionar dólar paralelo</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenAddTasa}
          className="w-full mt-4 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium active:scale-95 transition-transform"
        >
          + Agregar Tasa del Día
        </button>

        {/* Tasas Recientes */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Tasas Recientes</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tasasRecientes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No hay tasas registradas</p>
            ) : (
              tasasRecientes.map((tasa, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-sm text-gray-600">
                    {new Date(tasa.fecha).toLocaleDateString('es-VE', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                  <span className="font-bold text-gray-900">
                    {parseFloat(tasa.valor).toFixed(2)} Bs/$
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Exportar Datos */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <Download className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Exportar Datos</h2>
            <p className="text-sm text-gray-500">Descargar reporte mensual en CSV</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-base font-medium"
          >
            {años.map(año => (
              <option key={año} value={año}>{año}</option>
            ))}
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-base font-medium"
          >
            {meses.map(mes => (
              <option key={mes.value} value={mes.value}>{mes.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleExportCSV}
          className="w-full px-6 py-3 bg-purple-600 text-white rounded-xl font-medium active:scale-95 transition-transform"
        >
          📥 Descargar Reporte CSV
        </button>

        <p className="text-xs text-gray-500 mt-3 text-center">
          El reporte incluirá todos los movimientos del mes seleccionado ordenados cronológicamente
        </p>
      </div>

      {/* Sección de Perfil - AL FINAL */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
            <User className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-500">Usuario</p>
            <p className="font-semibold text-gray-800">{user?.email || 'Cargando...'}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full mt-4 px-6 py-3 bg-red-600 text-white rounded-xl font-medium active:scale-95 transition-transform"
        >
          Cerrar Sesión
        </button>
      </div>

      {/* Modal Agregar Tasa */}
      {showAddTasa && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl p-6 pb-8 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Agregar Tasa</h2>
              <button
                onClick={handleCloseAddTasa}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha *
                </label>
                <input
                  type="date"
                  value={formTasa.fecha}
                  onChange={(e) => setFormTasa({ ...formTasa, fecha: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor (Bs/$) *
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="Ej: 587.89"
                  value={formTasa.valor}
                  onChange={(e) => setFormTasa({ ...formTasa, valor: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base text-2xl font-bold"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Ejemplo: Si el dólar está a 587.89 Bs, ingresa 587.89
                </p>
              </div>

              <button
                onClick={handleSubmitTasa}
                disabled={loading}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold text-lg active:scale-98 transition-transform shadow-lg disabled:opacity-50"
              >
                {loading ? 'Guardando...' : '💰 Guardar Tasa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}