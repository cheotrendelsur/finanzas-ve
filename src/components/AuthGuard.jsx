import { useAuth } from '../context/AuthContext';
import PinScreen from './PinScreen';

export default function AuthGuard({ children }) {
  const { user, isUnlocked, loading } = useAuth();

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

  // Si no hay usuario autenticado, el componente padre (App.jsx) mostrará el login
  if (!user) {
    return null;
  }

  // Si hay usuario pero no está desbloqueado, mostrar pantalla de PIN
  if (!isUnlocked) {
    return <PinScreen />;
  }

  // Usuario autenticado y desbloqueado
  return children;
}