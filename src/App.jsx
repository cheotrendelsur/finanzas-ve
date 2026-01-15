import { useState, useEffect } from 'react';
import { Home, TrendingUp, Wallet, MoreHorizontal, Plus, ArrowUpCircle, ArrowDownCircle, Search, X, Edit2, Trash2, DollarSign } from 'lucide-react';
import { 
  supabase, 
  getCuentas, 
  crearCuenta, 
  getMovimientos, 
  crearMovimiento,
  getCategorias,
  crearCategoriasDefault,
  calcularMontoUSD 
} from './supabaseClient';

export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [cuentas, setCuentas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user || null);
    
    if (session?.user) {
      await cargarDatos();
    }
    setLoading(false);
  };

  const cargarDatos = async () => {
    const [cuentasData, movimientosData, categoriasData] = await Promise.all([
      getCuentas(),
      getMovimientos(),
      getCategorias()
    ]);

    setCuentas(cuentasData);
    setMovimientos(movimientosData);
    
    if (categoriasData.length === 0) {
      const nuevasCategorias = await crearCategoriasDefault();
      setCategorias(nuevasCategorias);
    } else {
      setCategorias(categoriasData);
    }
  };

  const calcularSaldoTotal = () => {
    return cuentas.reduce((total, cuenta) => {
      const saldoCuenta = parseFloat(cuenta.saldo_inicial) || 0;
      if (cuenta.tipo_moneda === 'USD') {
        return total + saldoCuenta;
      }
      return total + (saldoCuenta / 587.89);
    }, 0);
  };

  const handleCrearCuenta = async (nuevaCuenta) => {
    const cuenta = await crearCuenta(nuevaCuenta);
    if (cuenta) {
      setCuentas([cuenta, ...cuentas]);
      setShowAccountForm(false);
    }
  };

  const handleCrearMovimiento = async (nuevoMovimiento) => {
    const movimiento = await crearMovimiento(nuevoMovimiento);
    if (movimiento) {
      await cargarDatos();
      setShowTransactionForm(false);
    }
  };

  const NavBar = () => (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom z-50">
      <div className="flex justify-around items-center h-16 px-2">
        {[
          { id: 'home', icon: Home, label: 'Inicio' },
          { id: 'movements', icon: TrendingUp, label: 'Movimientos' },
          { id: 'accounts', icon: Wallet, label: 'Cuentas' },
          { id: 'more', icon: MoreHorizontal, label: 'Más' }
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setCurrentView(id)}
            className={`flex flex-col items-center justify-center w-full h-full transition-all active:scale-95 ${
              currentView === id ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <Icon className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );

  const Dashboard = () => (
    <div className="pb-20 px-4 pt-6">
      <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-6 text-white shadow-lg mb-6">
        <p className="text-sm opacity-90 mb-2">Saldo Total Consolidado</p>
        <h1 className="text-4xl font-bold mb-4">
          ${calcularSaldoTotal().toFixed(2)}
        </h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowTransactionForm('ingreso')}
            className="flex-1 bg-white/20 backdrop-blur-sm rounded-xl py-3 flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <ArrowUpCircle className="w-5 h-5" />
            <span className="font-medium">Ingreso</span>
          </button>
          <button
            onClick={() => setShowTransactionForm('egreso')}
            className="flex-1 bg-white/20 backdrop-blur-sm rounded-xl py-3 flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <ArrowDownCircle className="w-5 h-5" />
            <span className="font-medium">Egreso</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800 px-2">Mis Cuentas</h2>
        {cuentas.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No tienes cuentas registradas</p>
            <button
              onClick={() => setShowAccountForm(true)}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg active:scale-95 transition-transform"
            >
              Crear Primera Cuenta
            </button>
          </div>
        ) : (
          cuentas.map(cuenta => (
            <div key={cuenta.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{cuenta.nombre}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {cuenta.tipo_moneda === 'USD' ? '$' : 'Bs. '}
                    {parseFloat(cuenta.saldo_inicial).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  cuenta.tipo_moneda === 'USD' ? 'bg-green-100' : 'bg-blue-100'
                }`}>
                  <DollarSign className={cuenta.tipo_moneda === 'USD' ? 'text-green-600' : 'text-blue-600'} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const Movements = () => {
    const filteredMovements = movimientos.filter(m =>
      m.descripcion?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="pb-20 px-4 pt-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar movimientos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base"
            />
          </div>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-3 text-gray-500 active:scale-95 transition-transform">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {filteredMovements.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No hay movimientos registrados</p>
            <p className="text-sm mt-2">Agrega tu primer ingreso o egreso</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMovements.map(mov => (
              <div key={mov.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{mov.descripcion}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(mov.fecha).toLocaleDateString('es-VE')} • {mov.cuenta?.nombre}
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
                  <div className="text-right">
                    <p className={`text-xl font-bold ${
                      mov.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {mov.tipo === 'ingreso' ? '+' : '-'}
                      {mov.moneda_movimiento === 'USD' ? '$' : 'Bs. '}
                      {parseFloat(mov.monto_original).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </p>
                    {mov.moneda_movimiento === 'VES' && mov.monto_usd_final > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        ≈ ${parseFloat(mov.monto_usd_final).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const Accounts = () => (
    <div className="pb-20 px-4 pt-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Mis Cuentas</h1>
        <button
          onClick={() => setShowAccountForm(true)}
          className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      </div>

      <div className="space-y-4">
        {cuentas.map(cuenta => (
          <div key={cuenta.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  cuenta.tipo_moneda === 'USD' ? 'bg-green-100' : 'bg-blue-100'
                }`}>
                  <DollarSign className={cuenta.tipo_moneda === 'USD' ? 'text-green-600' : 'text-blue-600'} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{cuenta.nombre}</h3>
                  <p className="text-sm text-gray-500">{cuenta.tipo_moneda}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg active:scale-95 transition-transform">
                  <Edit2 className="w-5 h-5" />
                </button>
                <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg active:scale-95 transition-transform">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Saldo Actual</p>
              <p className="text-2xl font-bold text-gray-900">
                {cuenta.tipo_moneda === 'USD' ? '$' : 'Bs. '}
                {parseFloat(cuenta.saldo_inicial).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const TransactionForm = ({ tipo }) => {
    const [formData, setFormData] = useState({
      fecha: new Date().toISOString().split('T')[0],
      descripcion: '',
      monto: '',
      id_cuenta: '',
      id_categoria: ''
    });
    const [alertaTasa, setAlertaTasa] = useState(false);

    const handleSubmit = async () => {
      if (!formData.id_cuenta || !formData.monto || !formData.descripcion) {
        alert('Por favor completa todos los campos requeridos');
        return;
      }

      const cuenta = cuentas.find(c => c.id === formData.id_cuenta);
      const resultado = await calcularMontoUSD(
        formData.monto, 
        cuenta.tipo_moneda, 
        formData.fecha
      );

      if (resultado.error) {
        setAlertaTasa(true);
        return;
      }

      const nuevoMovimiento = {
        fecha: formData.fecha,
        descripcion: formData.descripcion,
        tipo: tipo,
        monto_original: parseFloat(formData.monto),
        moneda_movimiento: cuenta.tipo_moneda,
        tasa_aplicada: resultado.tasa,
        monto_usd_final: resultado.montoUSD,
        id_cuenta: formData.id_cuenta,
        id_categoria: formData.id_categoria || null
      };

      await handleCrearMovimiento(nuevoMovimiento);
    };

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
        <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl p-6 pb-8 animate-slide-up max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Nuevo {tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
            </h2>
            <button
              onClick={() => setShowTransactionForm(false)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full active:scale-95 transition-transform"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {alertaTasa && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-sm text-yellow-800">
                ⚠️ No hay tasa de cambio disponible para esta fecha
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha *</label>
              <input
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Descripción *</label>
              <input
                type="text"
                placeholder="Ej: Pago de servicios"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cuenta *</label>
              <select
                value={formData.id_cuenta}
                onChange={(e) => setFormData({ ...formData, id_cuenta: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base bg-white"
              >
                <option value="">Seleccionar cuenta</option>
                {cuentas.map(cuenta => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.nombre} ({cuenta.tipo_moneda})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
              <select
                value={formData.id_categoria}
                onChange={(e) => setFormData({ ...formData, id_categoria: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base bg-white"
              >
                <option value="">Seleccionar categoría</option>
                {categorias.filter(c => c.tipo === tipo).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Monto *</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0.00"
                value={formData.monto}
                onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base"
              />
            </div>

            <button
              onClick={handleSubmit}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg active:scale-98 transition-transform shadow-lg"
            >
              Guardar {tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const AccountForm = () => {
    const [formData, setFormData] = useState({
      nombre: '',
      tipo_moneda: 'VES',
      saldo_inicial: ''
    });

    const handleSubmit = async () => {
      if (!formData.nombre || !formData.saldo_inicial) {
        alert('Por favor completa todos los campos');
        return;
      }

      const nuevaCuenta = {
        nombre: formData.nombre,
        tipo_moneda: formData.tipo_moneda,
        saldo_inicial: parseFloat(formData.saldo_inicial),
        icono: 'wallet'
      };
      
      await handleCrearCuenta(nuevaCuenta);
    };

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
        <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl p-6 pb-8 animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Nueva Cuenta</h2>
            <button
              onClick={() => setShowAccountForm(false)}
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
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base"
              />
            </div>

            <button
              onClick={handleSubmit}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg active:scale-98 transition-transform shadow-lg"
            >
              Crear Cuenta
            </button>
          </div>
        </div>
      </div>
    );
  };

  const Auth = () => {
    const [email, setEmail] = useState('');
    const [loadingAuth, setLoadingAuth] = useState(false);
    const [message, setMessage] = useState('');

    const handleLogin = async () => {
      setLoadingAuth(true);
      setMessage('');
      
      const { error } = await supabase.auth.signInWithOtp({ 
        email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      
      if (error) {
        setMessage('Error: ' + error.message);
      } else {
        setMessage('¡Revisa tu email! Te enviamos un enlace mágico para iniciar sesión.');
      }
      setLoadingAuth(false);
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <Wallet className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Finanzas VE</h1>
            <p className="text-gray-600">Gestión inteligente de tus finanzas</p>
          </div>

          <div className="space-y-4">
            <input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:outline-none text-base"
            />
            <button
              onClick={handleLogin}
              disabled={loadingAuth || !email}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-semibold text-lg active:scale-98 transition-transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingAuth ? 'Enviando...' : 'Iniciar Sesión'}
            </button>
          </div>

          {message && (
            <div className={`mt-4 p-4 rounded-xl ${
              message.includes('Error') 
                ? 'bg-red-50 text-red-800' 
                : 'bg-green-50 text-green-800'
            }`}>
              <p className="text-sm">{message}</p>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-gray-500">
            Recibirás un enlace mágico en tu email para acceder sin contraseña
          </p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom);
        }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>

      {currentView === 'home' && <Dashboard />}
      {currentView === 'movements' && <Movements />}
      {currentView === 'accounts' && <Accounts />}
      {currentView === 'more' && (
        <div className="pb-20 px-4 pt-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Configuración</h1>
          <div className="bg-white rounded-2xl p-4 mb-4">
            <p className="text-gray-600 mb-2">Usuario: {user?.email}</p>
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full mt-4 px-6 py-3 bg-red-600 text-white rounded-xl active:scale-95 transition-transform"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}

      {showTransactionForm && <TransactionForm tipo={showTransactionForm} />}
      {showAccountForm && <AccountForm />}
      
      <NavBar />
    </div>
  );
}