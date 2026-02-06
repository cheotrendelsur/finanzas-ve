import { useState, useEffect } from 'react';
import { Wallet } from 'lucide-react';
import { supabase, getCuentas, getMovimientos, getCategorias, crearCategoriasDefault } from './supabaseClient';
import { UIProvider } from './context/UIContext';
import { ExchangeRateProvider } from './context/ExchangeRateContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthGuard from './components/AuthGuard';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import AccountDetails from './pages/AccountDetails';
import Analytics from './pages/Analytics';
import Accounts from './pages/Accounts';
import Settings from './pages/Settings';
import { OfflineProvider } from './context/OfflineContext';

function AppContent() {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState('home');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [cuentas, setCuentas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      cargarDatos();
    }
  }, [user]);

  const cargarDatos = async () => {
    setLoading(true);
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
    setLoading(false);
  };

  const handleCuentaClick = (cuenta) => {
    setSelectedAccount(cuenta);
    setCurrentView('account-details');
  };

  const handleBackFromAccount = () => {
    setSelectedAccount(null);
    setCurrentView('home');
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-purple-800 px-4">
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
              onKeyPress={(e) => e.key === 'Enter' && !loadingAuth && email && handleLogin()}
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

  if (!user) {
    return <Auth />;
  }

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
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* Renderizado condicional de vistas */}
      {currentView === 'home' && (
        <Home
          cuentas={cuentas}
          categorias={categorias}
          onCuentaClick={handleCuentaClick}
          onRefresh={cargarDatos}
        />
      )}

      {currentView === 'account-details' && selectedAccount && (
        <AccountDetails
          cuenta={selectedAccount}
          cuentas={cuentas}
          onBack={handleBackFromAccount}
          onRefresh={cargarDatos}
        />
      )}

      {currentView === 'analytics' && <Analytics />}

      {currentView === 'accounts' && (
        <Accounts
          cuentas={cuentas}
          onRefresh={cargarDatos}
        />
      )}

      {currentView === 'settings' && <Settings />}

      {/* Navegación Inferior */}
      <BottomNav 
        currentView={currentView === 'account-details' ? 'accounts' : currentView} 
        setCurrentView={setCurrentView} 
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGuard>
        <OfflineProvider>
          <UIProvider>
            <ExchangeRateProvider>
              <AppContent />
            </ExchangeRateProvider>
          </UIProvider>
        </OfflineProvider>
      </AuthGuard>
    </AuthProvider>
  );
}