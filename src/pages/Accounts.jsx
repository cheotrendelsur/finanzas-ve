import { useState } from 'react';
import { Plus, Edit2, Trash2, DollarSign } from 'lucide-react';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import AddAccount from '../components/AddAccount';
import EditAccount from '../components/EditAccount';
import { supabase } from '../supabaseClient';

export default function Accounts({ cuentas, onRefresh }) {
  const { hideBottomNav } = useUI();
  const { requirePINForAction } = useAuth();
  
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  const handleOpenAdd = () => {
    hideBottomNav();
    setShowAddAccount(true);
  };

  const handleOpenEdit = (cuenta) => {
    hideBottomNav();
    setEditingAccount(cuenta);
  };

  const handleDelete = async (cuenta) => {
    // Requiere confirmación con PIN o biometría
    const confirmed = await requirePINForAction();
    
    if (!confirmed) {
      alert('Autenticación cancelada');
      return;
    }

    // Verificar si tiene movimientos
    const { data: movimientos } = await supabase
      .from('movimientos')
      .select('id')
      .eq('id_cuenta', cuenta.id)
      .limit(1);

    if (movimientos && movimientos.length > 0) {
      const deleteMovs = confirm(
        `La cuenta "${cuenta.nombre}" tiene movimientos asociados. ¿Eliminar cuenta Y todos sus movimientos?`
      );
      
      if (!deleteMovs) return;
    }

    // Eliminar cuenta
    const { error } = await supabase
      .from('cuentas')
      .delete()
      .eq('id', cuenta.id);

    if (error) {
      alert('Error al eliminar cuenta: ' + error.message);
    } else {
      onRefresh();
    }
  };

  return (
    <div className="pb-20 px-4 pt-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Mis Cuentas</h1>
        <button
          onClick={handleOpenAdd}
          className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      </div>

      {cuentas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <DollarSign className="w-10 h-10 text-gray-400" />
          </div>
          <p className="text-lg mb-2">No tienes cuentas registradas</p>
          <p className="text-sm">Toca el botón + para crear tu primera cuenta</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cuentas.map(cuenta => (
            <div key={cuenta.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    cuenta.tipo_moneda === 'USD' ? 'bg-green-100' : 'bg-blue-100'
                  }`}>
                    <DollarSign className={`w-6 h-6 ${
                      cuenta.tipo_moneda === 'USD' ? 'text-green-600' : 'text-blue-600'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{cuenta.nombre}</h3>
                    <p className="text-sm text-gray-500">{cuenta.tipo_moneda}</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenEdit(cuenta)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg active:scale-95 transition-transform"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(cuenta)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg active:scale-95 transition-transform"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Saldo Inicial</p>
                <p className="text-2xl font-bold text-gray-900">
                  {cuenta.tipo_moneda === 'USD' ? '$' : 'Bs. '}
                  {parseFloat(cuenta.saldo_inicial).toLocaleString('es-VE', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modales */}
      {showAddAccount && (
        <AddAccount
          onClose={() => setShowAddAccount(false)}
          onSuccess={onRefresh}
        />
      )}

      {editingAccount && (
        <EditAccount
          cuenta={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}