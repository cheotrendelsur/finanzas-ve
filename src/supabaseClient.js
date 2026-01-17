import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ==================== CUENTAS ====================

export const getCuentas = async () => {
  const { data, error } = await supabase
    .from('cuentas')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error obteniendo cuentas:', error);
    return [];
  }
  return data || [];
};

export const getCuentaById = async (id) => {
  const { data, error } = await supabase
    .from('cuentas')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('Error obteniendo cuenta:', error);
    return null;
  }
  return data;
};

export const crearCuenta = async (cuenta) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('cuentas')
    .insert([{ ...cuenta, user_id: user?.id }])
    .select()
    .single();
  
  if (error) {
    console.error('Error creando cuenta:', error);
    return null;
  }
  return data;
};

export const actualizarCuenta = async (id, cambios) => {
  const { data, error } = await supabase
    .from('cuentas')
    .update(cambios)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error actualizando cuenta:', error);
    return null;
  }
  return data;
};

// Calcular saldo actual de una cuenta (saldo_inicial + movimientos)
export const calcularSaldoActual = async (cuentaId) => {
  const cuenta = await getCuentaById(cuentaId);
  if (!cuenta) return 0;

  const { data: movimientos } = await supabase
    .from('movimientos')
    .select('tipo, monto_original')
    .eq('id_cuenta', cuentaId);

  const totalMovimientos = (movimientos || []).reduce((sum, mov) => {
    return sum + (mov.tipo === 'ingreso' ? parseFloat(mov.monto_original) : -parseFloat(mov.monto_original));
  }, 0);

  return parseFloat(cuenta.saldo_inicial) + totalMovimientos;
};

// ==================== MOVIMIENTOS ====================

export const getMovimientos = async () => {
  const { data, error } = await supabase
    .from('movimientos')
    .select(`
      *,
      cuenta:cuentas(nombre, tipo_moneda),
      categoria:categorias(nombre, color)
    `)
    .order('fecha', { ascending: false });
  
  if (error) {
    console.error('Error obteniendo movimientos:', error);
    return [];
  }
  return data || [];
};

export const getMovimientosByCuenta = async (cuentaId) => {
  const { data, error } = await supabase
    .from('movimientos')
    .select(`
      *,
      categoria:categorias(nombre, color)
    `)
    .eq('id_cuenta', cuentaId)
    .order('fecha', { ascending: false });
  
  if (error) {
    console.error('Error obteniendo movimientos:', error);
    return [];
  }
  return data || [];
};

export const crearMovimiento = async (movimiento) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('movimientos')
    .insert([{ ...movimiento, user_id: user?.id }])
    .select()
    .single();
  
  if (error) {
    console.error('Error creando movimiento:', error);
    return null;
  }
  return data;
};

export const actualizarMovimiento = async (id, cambios) => {
  const { data, error } = await supabase
    .from('movimientos')
    .update(cambios)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error actualizando movimiento:', error);
    return null;
  }
  return data;
};

export const eliminarMovimiento = async (id) => {
  const { error } = await supabase
    .from('movimientos')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error eliminando movimiento:', error);
    return false;
  }
  return true;
};

// ==================== CATEGORÍAS ====================

export const getCategorias = async () => {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .order('nombre');
  
  if (error) {
    console.error('Error obteniendo categorías:', error);
    return [];
  }
  return data || [];
};

export const crearCategoriasDefault = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  const categoriasDefault = [
    { nombre: 'Salario', tipo: 'ingreso', color: '#10B981', user_id: user?.id },
    { nombre: 'Freelance', tipo: 'ingreso', color: '#3B82F6', user_id: user?.id },
    { nombre: 'Inversiones', tipo: 'ingreso', color: '#8B5CF6', user_id: user?.id },
    { nombre: 'Comida', tipo: 'egreso', color: '#EF4444', user_id: user?.id },
    { nombre: 'Transporte', tipo: 'egreso', color: '#F59E0B', user_id: user?.id },
    { nombre: 'Servicios', tipo: 'egreso', color: '#EC4899', user_id: user?.id },
    { nombre: 'Entretenimiento', tipo: 'egreso', color: '#6366F1', user_id: user?.id },
    { nombre: 'Salud', tipo: 'egreso', color: '#14B8A6', user_id: user?.id },
  ];
  
  const { data, error } = await supabase
    .from('categorias')
    .insert(categoriasDefault)
    .select();
  
  if (error) {
    console.error('Error creando categorías:', error);
    return [];
  }
  return data;
};

// ==================== TASAS DE CAMBIO ====================

export const getTasas = async () => {
  const { data, error } = await supabase
    .from('tasas_cambio')
    .select('*')
    .order('fecha', { ascending: false });
  
  if (error) {
    console.error('Error obteniendo tasas:', error);
    return [];
  }
  return data || [];
};

export const crearTasa = async (fecha, valor) => {
  const { data, error } = await supabase
    .from('tasas_cambio')
    .insert([{ fecha, valor }])
    .select()
    .single();
  
  if (error) {
    console.error('Error creando tasa:', error);
    return null;
  }
  return data;
};