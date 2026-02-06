import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getMovimientos } from '../supabaseClient';

export default function Analytics() {
  // 🔥 AJUSTE: Valores por defecto cambiados a 'egreso' y 'mes'
  const [tipoFiltro, setTipoFiltro] = useState('egreso');
  const [modoFiltro, setModoFiltro] = useState('mes');
  const [añoSeleccionado, setAñoSeleccionado] = useState(new Date().getFullYear());
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth() + 1);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [movimientos, setMovimientos] = useState([]);
  const [dataPorCategoria, setDataPorCategoria] = useState([]);
  const [totalPeriodo, setTotalPeriodo] = useState(0);
  const [dataResumen, setDataResumen] = useState([]);

  useEffect(() => {
    cargarMovimientos();
  }, []);

  useEffect(() => {
    procesarDatos();
  }, [movimientos, tipoFiltro, modoFiltro, añoSeleccionado, mesSeleccionado, fechaInicio, fechaFin]);

  const cargarMovimientos = async () => {
    const movs = await getMovimientos();
    setMovimientos(movs);
  };

  const filtrarMovimientos = () => {
    let filtrados = movimientos.filter(m => m.tipo === tipoFiltro);

    if (modoFiltro === 'año') {
      filtrados = filtrados.filter(m => {
        const año = new Date(m.fecha).getFullYear();
        return año === añoSeleccionado;
      });
    } else if (modoFiltro === 'mes') {
      filtrados = filtrados.filter(m => {
        const fecha = new Date(m.fecha);
        return fecha.getFullYear() === añoSeleccionado && (fecha.getMonth() + 1) === mesSeleccionado;
      });
    } else if (modoFiltro === 'periodo' && fechaInicio && fechaFin) {
      filtrados = filtrados.filter(m => {
        const fecha = m.fecha;
        return fecha >= fechaInicio && fecha <= fechaFin;
      });
    }

    return filtrados;
  };

  const procesarDatos = () => {
    const filtrados = filtrarMovimientos();

    const porCategoria = {};
    filtrados.forEach(mov => {
      const categoriaNombre = mov.categoria?.nombre || 'Sin categoría';
      const categoriaColor = mov.categoria?.color || '#6366F1';
      const montoUSD = parseFloat(mov.monto_usd_final) || 0;

      if (!porCategoria[categoriaNombre]) {
        porCategoria[categoriaNombre] = {
          name: categoriaNombre,
          value: 0,
          color: categoriaColor
        };
      }
      porCategoria[categoriaNombre].value += montoUSD;
    });

    const dataCategoria = Object.values(porCategoria);
    const total = dataCategoria.reduce((sum, cat) => sum + cat.value, 0);

    dataCategoria.forEach(cat => {
      cat.percentage = total > 0 ? ((cat.value / total) * 100).toFixed(1) : 0;
    });

    setDataPorCategoria(dataCategoria);
    setTotalPeriodo(total);

    calcularResumen();
  };

  const calcularResumen = () => {
    let filtrados = [];
    
    if (modoFiltro === 'año') {
      filtrados = movimientos.filter(m => new Date(m.fecha).getFullYear() === añoSeleccionado);
    } else if (modoFiltro === 'mes') {
      filtrados = movimientos.filter(m => {
        const fecha = new Date(m.fecha);
        return fecha.getFullYear() === añoSeleccionado && (fecha.getMonth() + 1) === mesSeleccionado;
      });
    } else if (modoFiltro === 'periodo' && fechaInicio && fechaFin) {
      filtrados = movimientos.filter(m => {
        const fecha = m.fecha;
        return fecha >= fechaInicio && fecha <= fechaFin;
      });
    }

    const totalIngresos = filtrados
      .filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + (parseFloat(m.monto_usd_final) || 0), 0);

    const totalEgresos = filtrados
      .filter(m => m.tipo === 'egreso')
      .reduce((sum, m) => sum + (parseFloat(m.monto_usd_final) || 0), 0);

    const beneficioNeto = totalIngresos - totalEgresos;

    setDataResumen([
      { name: 'Ingresos', value: totalIngresos, fill: '#10B981' },
      { name: 'Egresos', value: totalEgresos, fill: '#EF4444' },
      { name: 'Neto', value: beneficioNeto, fill: beneficioNeto >= 0 ? '#10B981' : '#EF4444' }
    ]);
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

  const años = Array.from({ length: 78 }, (_, i) => 2023 + i);

  const getPeriodoLabel = () => {
    if (modoFiltro === 'año') return `Año ${añoSeleccionado}`;
    if (modoFiltro === 'mes') return `${meses.find(m => m.value === mesSeleccionado)?.label} ${añoSeleccionado}`;
    if (modoFiltro === 'periodo' && fechaInicio && fechaFin) {
      return `${new Date(fechaInicio).toLocaleDateString('es-VE')} - ${new Date(fechaFin).toLocaleDateString('es-VE')}`;
    }
    return '';
  };

  return (
    <div className="pb-20 px-4 pt-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">📊 Análisis Financiero</h1>

      <div className="space-y-4 mb-6">
        <div className="bg-gray-100 rounded-xl p-1 grid grid-cols-2 gap-1">
          <button
            onClick={() => setTipoFiltro('ingreso')}
            className={`py-3 rounded-lg font-medium transition-all active:scale-95 ${
              tipoFiltro === 'ingreso'
                ? 'bg-green-600 text-white shadow-md'
                : 'text-gray-700'
            }`}
          >
            💰 Ingresos
          </button>
          <button
            onClick={() => setTipoFiltro('egreso')}
            className={`py-3 rounded-lg font-medium transition-all active:scale-95 ${
              tipoFiltro === 'egreso'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-gray-700'
            }`}
          >
            💸 Egresos
          </button>
        </div>

        <select
          value={modoFiltro}
          onChange={(e) => setModoFiltro(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-base font-medium"
        >
          <option value="año">Por Año</option>
          <option value="mes">Por Mes</option>
          <option value="periodo">Por Periodo</option>
        </select>

        {modoFiltro === 'año' && (
          <select
            value={añoSeleccionado}
            onChange={(e) => setAñoSeleccionado(parseInt(e.target.value))}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-base font-medium"
          >
            {años.map(año => (
              <option key={año} value={año}>{año}</option>
            ))}
          </select>
        )}

        {modoFiltro === 'mes' && (
          <div className="grid grid-cols-2 gap-3">
            <select
              value={añoSeleccionado}
              onChange={(e) => setAñoSeleccionado(parseInt(e.target.value))}
              className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-base font-medium"
            >
              {años.map(año => (
                <option key={año} value={año}>{año}</option>
              ))}
            </select>

            <select
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(parseInt(e.target.value))}
              className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-base font-medium"
            >
              {meses.map(mes => (
                <option key={mes.value} value={mes.value}>{mes.label}</option>
              ))}
            </select>
          </div>
        )}

        {modoFiltro === 'periodo' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-base"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-base"
              />
            </div>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-6 text-white shadow-lg mb-6">
        <p className="text-sm opacity-90 mb-2">
          Total {tipoFiltro === 'ingreso' ? 'Ingresos' : 'Egresos'} - {getPeriodoLabel()}
        </p>
        <h2 className="text-5xl font-bold">${totalPeriodo.toFixed(2)}</h2>
        <p className="text-xs opacity-75 mt-1">USD</p>
      </div>

      {dataPorCategoria.length > 0 ? (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Distribución por Categoría</h3>
          
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={dataPorCategoria}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {dataPorCategoria.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-6 space-y-3">
            {dataPorCategoria.map((cat, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="font-semibold text-gray-800">{cat.name}</span>
                </div>
                
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">
                    ${cat.value.toFixed(2)}
                  </p>
                  <p className="text-sm font-medium text-gray-500">
                    {cat.percentage}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 text-center text-gray-400">
          <p className="text-lg">No hay datos para este periodo</p>
        </div>
      )}

      {dataResumen.length > 0 && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Resumen del Periodo</h3>
          
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dataResumen}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
              <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                {dataResumen.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {dataResumen.map((item, index) => (
              <div key={index} className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">{item.name}</p>
                <p className="text-lg font-bold" style={{ color: item.fill }}>
                  ${Math.abs(item.value).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}