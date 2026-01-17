import { Home, BarChart3, Wallet, Settings } from 'lucide-react';
import { useUI } from '../context/UIContext';

export default function BottomNav({ currentView, setCurrentView }) {
  const { showBottomNav } = useUI();

  if (!showBottomNav) return null;

  const navItems = [
    { id: 'home', icon: Home, label: 'Inicio' },
    { id: 'analytics', icon: BarChart3, label: 'Análisis' },
    { id: 'accounts', icon: Wallet, label: 'Cuentas' },
    { id: 'settings', icon: Settings, label: 'Más' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map(({ id, icon: Icon, label }) => (
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
}