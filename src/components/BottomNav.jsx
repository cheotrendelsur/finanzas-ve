import { Home, BarChart3, Wallet, Settings } from 'lucide-react';
import { useUI } from '../context/UIContext';
import { useOffline } from '../context/OfflineContext';

export default function BottomNav({ currentView, setCurrentView }) {
  const { pendingCount, online } = useOffline();
  const { showBottomNav } = useUI();

  if (!showBottomNav) return null;

  const navItems = [
    { id: 'home', icon: Home, label: 'Inicio' },
    { id: 'analytics', icon: BarChart3, label: 'Análisis' },
    { id: 'accounts', icon: Wallet, label: 'Cuentas' },
    { id: 'settings', icon: Settings, label: 'Más' }
  ];

  return (
    <nav 
      className={`fixed bottom-0 left-0 right-0 z-50 transition-colors border-t ${
        !online 
          ? 'bg-orange-50 border-orange-300' 
          : 'bg-white border-gray-200'
      }`} 
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Aviso visual de Modo Offline */}
      {!online && (
        <div className="absolute -top-6 left-0 right-0 bg-orange-500 text-white text-[10px] font-bold text-center py-1 shadow-sm">
          Sin conexión - Guardando en dispositivo
        </div>
      )}

      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setCurrentView(id)}
            className={`relative flex flex-col items-center justify-center w-full h-full transition-all active:scale-95 ${
              currentView === id ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <div className="relative">
              <Icon className="w-6 h-6 mb-1" />
              
              {/* Badge de contador de pendientes (Solo en Settings) */}
              {id === 'settings' && pendingCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-red-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-pulse">
                  {pendingCount}
                </span>
              )}
            </div>
            
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}