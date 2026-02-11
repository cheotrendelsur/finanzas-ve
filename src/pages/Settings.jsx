import { useState, useEffect } from 'react';
import { User, DollarSign, Download, Shield, Fingerprint, X, RefreshCw, AlertCircle, Trash2, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { getTasas, crearTasa, getMovimientos, actualizarMovimiento } from '../supabaseClient';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { formatDateToDisplay, formatDateToShort, parseDateFromDB, formatDateForDB } from '../utils/formatters';
import { 
  getOfflineQueue, 
  getFailedQueue, 
  clearAllQueues, 
  clearFailedQueue,
  getLastSyncTime 
} from '../utils/offlineManager';

export default function Settings() {
  const { hideBottomNav, showNav } = useUI();
  const { user, biometricEnabled, enableBiometric, logout } = useAuth();
  const { online, pendingCount, failedCount, isSyncing, lastSyncResult, manualSync } = useOffline();
  
  const [showAddTasa, setShowAddTasa] = useState(false);
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [tasasRecientes, setTasasRecientes] = useState([]);
  const [formTasa, setFormTasa] = useState({
    fecha: new Date().toISOString().split('T')[0],
    valor: ''
  });
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [biometricMessage, setBiometricMessage] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    cargarTasas();
  }, []);

  const cargarTasas = async () => {
    const tasas = await getTasas();
    setTasasRecientes(tasas.slice(0, 10));
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

  const handleEnableBiometric = async () => {
    setBiometricMessage('');
    try {
      const success = await enableBiometric();
      if (success) {
        setBiometricMessage('✓ Huella registrada correctamente en este dispositivo');
        setTimeout(() => setBiometricMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error al registrar huella:', error);
      
      let errorMsg = '❌ Error al registrar huella: ';
      
      if (error.name === 'NotSupportedError') {
        errorMsg += 'Tu dispositivo no soporta autenticación biométrica.';
      } else if (error.name === 'NotAllowedError') {
        errorMsg += 'Permiso denegado. Verifica los ajustes de tu navegador.';
      } else if (error.name === 'SecurityError') {
        errorMsg += 'Esta función solo funciona en HTTPS. Si estás en desarrollo, usa localhost.';
      } else {
        errorMsg += error.message || 'Dispositivo incompatible o huella no configurada en el sistema.';
      }
      
      setBiometricMessage(errorMsg);
      setTimeout(() => setBiometricMessage(''), 8000);
    }
  };

  const handleExportCSV = async () => {
    const movimientos = await getMovimientos();
    
    const filtrados = movimientos.filter(m => {
      const fecha = new Date(m.fecha);
      return fecha.getFullYear() === selectedYear && (fecha.getMonth() + 1) === selectedMonth;
    });

    if (filtrados.length === 0) {
      alert('No hay movimientos para exportar en este periodo');
      return;
    }

    filtrados.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    const headers = [
      'Fecha',
      'Tipo',
      'Categoría',
      'Cuenta',
      'Moneda Original',
      'Monto Original',
      'Tasa Aplicada',
      'Monto USD Final'
    ];

    const rows = filtrados.map(m => [
      formatDateToShort(m.fecha),
      m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
      m.categoria?.nombre || 'Sin categoría',
      m.cuenta?.nombre || 'N/A',
      m.moneda_movimiento || 'USD',
      parseFloat(m.monto_original || 0).toFixed(2),
      m.tasa_aplicada ? parseFloat(m.tasa_aplicada).toFixed(2) : 'N/A',
      parseFloat(m.monto_usd_final || 0).toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const monthName = new Date(selectedYear, selectedMonth - 1).toLocaleDateString('es-VE', { month: 'long' });
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_Finanzas_${monthName}_${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRecalcularTasas = async () => {
    setLoading(true);
    setBiometricMessage('🔄 Procesando movimientos...');
    
    try {
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - 60);
      const fechaLimiteStr = fechaLimite.toISOString().split('T')[0];
      
      const todosMovimientos = await getMovimientos();
      
      const movimientosVES = todosMovimientos.filter(m => 
        m.moneda_movimiento === 'VES' && 
        m.fecha >= fechaLimiteStr
      );
      
      if (movimientosVES.length === 0) {
        setBiometricMessage('ℹ️ No hay movimientos VES en los últimos 60 días');
        setTimeout(() => setBiometricMessage(''), 3000);
        setLoading(false);
        return;
      }
      
      console.log(`📊 Procesando ${movimientosVES.length} movimientos VES de los últimos 60 días`);
      
      const tasas = await getTasas();
      const tasasPorFecha = {};
      tasas.forEach(t => {
        tasasPorFecha[t.fecha] = parseFloat(t.valor);
      });
      
      let actualizados = 0;
      let sinCambios = 0;
      const fechasFaltantesSet = new Set();
      
      for (const mov of movimientosVES) {
        const fechaObjetivo = calcularFechaObjetivo(mov.fecha);
        
        console.log(`📅 Movimiento ${mov.id}: Fecha original=${mov.fecha}, Fecha objetivo=${fechaObjetivo}`);
        
        const tasaCorrecta = tasasPorFecha[fechaObjetivo];
        
        if (tasaCorrecta) {
          const tasaActual = parseFloat(mov.tasa_aplicada) || 0;
          
          if (tasaActual !== tasaCorrecta || !mov.tasa_aplicada) {
            const montoUSD = parseFloat(mov.monto_original) / tasaCorrecta;
            
            await actualizarMovimiento(mov.id, {
              tasa_aplicada: tasaCorrecta,
              monto_usd_final: montoUSD
            });
            
            actualizados++;
            console.log(`✅ Movimiento ${mov.id} actualizado: ${tasaActual} → ${tasaCorrecta} (${fechaObjetivo})`);
          } else {
            sinCambios++;
            console.log(`⏭️ Movimiento ${mov.id} ya tiene la tasa correcta (${tasaCorrecta})`);
          }
        } else {
          fechasFaltantesSet.add(fechaObjetivo);
          console.log(`❌ Falta tasa para fecha objetivo: ${fechaObjetivo}`);
        }
      }
      
      let mensaje = `✓ Procesados ${movimientosVES.length} movimientos:\n`;
      mensaje += `  • ${actualizados} actualizados\n`;
      mensaje += `  • ${sinCambios} sin cambios (ya correctos)`;
      
      if (fechasFaltantesSet.size > 0) {
        const fechasFaltantes = Array.from(fechasFaltantesSet)
          .sort()
          .map(f => {
            const fecha = parseDateFromDB(f);
            const diaSemana = fecha.toLocaleDateString('es-VE', { weekday: 'long' });
            const fechaCorta = formatDateToShort(f);
            return `${diaSemana} ${fechaCorta}`;
          })
          .join(', ');
        mensaje += `\n\n⚠️ Faltan tasas para registrar en:\n${fechasFaltantes}`;
      }
      
      setBiometricMessage(mensaje);
      setTimeout(() => setBiometricMessage(''), 12000);
      
    } catch (error) {
      console.error('Error recalculando tasas:', error);
      setBiometricMessage('❌ Error al procesar tasas: ' + error.message);
      setTimeout(() => setBiometricMessage(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const calcularFechaObjetivo = (fechaStr) => {
    const fecha = parseDateFromDB(fechaStr);
    const diaSemana = fecha.getDay();
    
    let diasRetroceder = 0;
    
    if (diaSemana === 0) {
      diasRetroceder = 2;
    } else if (diaSemana === 6) {
      diasRetroceder = 1;
    }
    
    if (diasRetroceder > 0) {
      const fechaObjetivo = new Date(fecha);
      fechaObjetivo.setDate(fechaObjetivo.getDate() - diasRetroceder);
      return formatDateForDB(fechaObjetivo);
    }
    
    return fechaStr;
  };

  // ✅ NUEVAS FUNCIONES DE GESTIÓN DE SINCRONIZACIÓN

  const handleOpenSyncPanel = () => {
    hideBottomNav();
    setShowSyncPanel(true);
  };

  const handleCloseSyncPanel = () => {
    showNav();
    setShowSyncPanel(false);
    setSyncMessage('');
  };

  const handleManualSync = async () => {
    setSyncMessage('🔄 Sincronizando...');
    const result = await manualSync();
    
    if (result.success) {
      setSyncMessage(`✅ Sincronización exitosa: ${result.synced} operaciones sincronizadas`);
    } else {
      setSyncMessage(`❌ Error: ${result.message}`);
    }
    
    setTimeout(() => setSyncMessage(''), 5000);
  };

  const handleClearFailedQueue = () => {
    const confirmed = confirm(
      '¿Estás seguro de que deseas limpiar la cola de operaciones fallidas?\n\n' +
      'Estas operaciones se perderán permanentemente.'
    );
    
    if (confirmed) {
      clearFailedQueue();
      setSyncMessage('✅ Cola de fallidos limpiada');
      setTimeout(() => setSyncMessage(''), 3000);
    }
  };

  const handleClearAllQueues = () => {
    const confirmed = confirm(
      '⚠️ ADVERTENCIA: Esta acción eliminará TODAS las operaciones pendientes y fallidas.\n\n' +
      'Los datos que no se hayan sincronizado se perderán permanentemente.\n\n' +
      '¿Estás COMPLETAMENTE seguro?'
    );
    
    if (confirmed) {
      const doubleConfirm = confirm('Última confirmación: ¿Eliminar TODAS las colas?');
      if (doubleConfirm) {
        clearAllQueues();
        setSyncMessage('✅ Todas las colas limpiadas');
        setTimeout(() => setSyncMessage(''), 3000);
      }
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Nunca';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Si fue hace menos de 1 minuto
    if (diff < 60000) {
      return 'Hace unos segundos';
    }
    
    // Si fue hace menos de 1 hora
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    }
    
    // Si fue hoy
    if (date.toDateString() === now.toDateString()) {
      return `Hoy a las ${date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Formato completo
    return date.toLocaleString('es-VE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
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
    { value: 12, label: 'Diciembre' },
  ];

  const años = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="pb-20 px-4 pt-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Configuración</h1>

      {/* ✅ NUEVO: Panel de Estado de Sincronización */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              online ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <RefreshCw className={`w-5 h-5 ${
                online ? 'text-green-600' : 'text-red-600'
              } ${isSyncing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Sincronización</h2>
              <p className="text-sm text-gray-500">
                {online ? 'Conectado' : 'Sin conexión'}
              </p>
            </div>
          </div>
          {(pendingCount > 0 || failedCount > 0) && (
            <div className="flex gap-2">
              {pendingCount > 0 && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                  {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
                </span>
              )}
              {failedCount > 0 && (
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                  {failedCount} fallido{failedCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleOpenSyncPanel}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl font-medium active:scale-95 transition-transform"
        >
          📊 Ver Detalles de Sincronización
        </button>

        {lastSyncResult && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600">
              Última sincronización: {formatTimestamp(lastSyncResult.timestamp)}
            </p>
            {lastSyncResult.synced > 0 && (
              <p className="text-xs text-green-600 mt-1">
                ✓ {lastSyncResult.synced} operación{lastSyncResult.synced > 1 ? 'es' : ''} sincronizada{lastSyncResult.synced > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <Shield className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Seguridad</h2>
            <p className="text-sm text-gray-500">Autenticación biométrica</p>
          </div>
        </div>

        {biometricMessage && (
          <div className={`mb-4 p-4 rounded-xl ${
            biometricMessage.includes('✓')
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}>
            <p className="text-sm whitespace-pre-line">{biometricMessage}</p>
          </div>
        )}

        <button
          onClick={handleEnableBiometric}
          disabled={biometricEnabled}
          className={`w-full px-6 py-3 rounded-xl font-medium active:scale-95 transition-transform flex items-center justify-center gap-2 ${
            biometricEnabled
              ? 'bg-green-100 text-green-700 cursor-not-allowed'
              : 'bg-purple-600 text-white'
          }`}
        >
          <Fingerprint className="w-5 h-5" />
          {biometricEnabled ? '✓ Huella Activa en este Dispositivo' : 'Registrar Huella en este Dispositivo'}
        </button>

        <p className="text-xs text-gray-500 mt-3 text-center">
          {biometricEnabled 
            ? 'Puedes usar tu huella en el login' 
            : 'Activa tu huella para acceder más rápido'}
        </p>
      </div>

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

        <button
          onClick={handleRecalcularTasas}
          disabled={loading}
          className="w-full mt-3 px-6 py-3 bg-purple-600 text-white rounded-xl font-medium active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? 'Procesando...' : '🔄 Recalcular Tasas Faltantes'}
        </button>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-xs text-blue-800">
            <strong>💡 Lógica de Cierre de Mercado:</strong> Los movimientos de fin de semana (Sábado/Domingo) usarán automáticamente la tasa del Viernes anterior.
          </p>
        </div>

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
                    {formatDateToDisplay(tasa.fecha)}
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

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Download className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Exportar Datos</h2>
            <p className="text-sm text-gray-500">Descargar reporte mensual detallado en CSV</p>
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
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl font-medium active:scale-95 transition-transform"
        >
          📥 Descargar Reporte CSV
        </button>

        <p className="text-xs text-gray-500 mt-3 text-center">
          El reporte incluirá: Fecha, Tipo, Categoría, Cuenta, Moneda Original, Monto Original, Tasa Aplicada, Monto USD
        </p>
      </div>

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
          onClick={logout}
          className="w-full mt-4 px-6 py-3 bg-red-600 text-white rounded-xl font-medium active:scale-95 transition-transform"
        >
          Cerrar Sesión
        </button>
      </div>

      {/* ✅ NUEVO: Modal de Agregar Tasa */}
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

      {/* ✅ NUEVO: Modal de Panel de Sincronización */}
      {showSyncPanel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl p-6 pb-8 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Gestión de Sincronización</h2>
              <button
                onClick={handleCloseSyncPanel}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full active:scale-95 transition-transform"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {syncMessage && (
              <div className={`mb-4 p-4 rounded-xl ${
                syncMessage.includes('✅')
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}>
                <p className="text-sm">{syncMessage}</p>
              </div>
            )}

            {/* Estado Actual */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <CheckCircle className={`w-5 h-5 ${online ? 'text-green-600' : 'text-gray-400'}`} />
                Estado Actual
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Conexión</span>
                  <span className={`font-medium ${online ? 'text-green-600' : 'text-red-600'}`}>
                    {online ? '✓ Conectado' : '✗ Sin conexión'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Pendientes</span>
                  <span className="font-medium text-yellow-600">{pendingCount}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Fallidos</span>
                  <span className="font-medium text-red-600">{failedCount}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Último sync</span>
                  <span className="font-medium text-gray-800">
                    {formatTimestamp(getLastSyncTime())}
                  </span>
                </div>
              </div>
            </div>

            {/* Operaciones Pendientes */}
            {pendingCount > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  Operaciones Pendientes ({pendingCount})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {getOfflineQueue().map((op, index) => (
                    <div key={op.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {op.type === 'create' ? '➕ Crear' : op.type === 'update' ? '✏️ Actualizar' : '🗑️ Eliminar'}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {formatTimestamp(op.timestamp)}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 bg-yellow-200 text-yellow-800 rounded">
                          Intento {op.attempts}
                        </span>
                      </div>
                      {op.error && (
                        <p className="text-xs text-red-600 mt-2">Error: {op.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Operaciones Fallidas */}
            {failedCount > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  Operaciones Fallidas ({failedCount})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {getFailedQueue().map((op, index) => (
                    <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {op.type === 'create' ? '➕ Crear' : op.type === 'update' ? '✏️ Actualizar' : '🗑️ Eliminar'}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {formatTimestamp(op.timestamp)}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 bg-red-200 text-red-800 rounded">
                          Fallido
                        </span>
                      </div>
                      {op.error && (
                        <p className="text-xs text-red-600 mt-2">{op.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Acciones */}
            <div className="space-y-3">
              <button
                onClick={handleManualSync}
                disabled={isSyncing || !online || pendingCount === 0}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl font-medium active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Sincronizando...' : 'Reintentar Sincronización'}
              </button>

              {failedCount > 0 && (
                <button
                  onClick={handleClearFailedQueue}
                  className="w-full px-6 py-3 bg-orange-600 text-white rounded-xl font-medium active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" />
                  Limpiar Cola de Fallidos
                </button>
              )}

              {(pendingCount > 0 || failedCount > 0) && (
                <button
                  onClick={handleClearAllQueues}
                  className="w-full px-6 py-3 bg-red-600 text-white rounded-xl font-medium active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <AlertCircle className="w-5 h-5" />
                  Limpiar TODAS las Colas
                </button>
              )}
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-xs text-blue-800">
                <strong>💡 Nota:</strong> Las operaciones se sincronizan automáticamente cuando recuperas la conexión. El sistema reintenta con intervalos crecientes: 10s, 30s, 1min, 5min, 15min.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}