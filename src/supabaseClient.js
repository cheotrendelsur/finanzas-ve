import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper para obtener tasa de cambio
export const getTasaCambio = async (fecha) => {
  try {
    const { data, error } = await supabase
      .from('tasas_cambio')
      .select('valor')
      .eq('fecha', fecha)
      .single();

    if (error) {
      console.error('Error obteniendo tasa:', error);
      return null;
    }
    return data?.valor || null;
  } catch (err) {
    console.error('Error en getTasaCambio:', err);
    return null;
  }
};

// Helper para calcular monto en USD
export const calcularMontoUSD = async (monto, moneda, fecha) => {
  if (moneda === 'USD') {
    return { montoUSD: parseFloat(monto), tasa: null };
  }
  
  const tasa = await getTasaCambio(fecha);
  if (!tasa) {
    return { montoUSD: 0, tasa: null, error: true };
  }
  
  return { 
    montoUSD: parseFloat(monto) / parseFloat(tasa), 
    tasa: parseFloat(tasa) 
  };
};

// Obtener todas las cuentas del usuario
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

// Crear nueva cuenta
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

// Obtener todos los movimientos
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

// Crear nuevo movimiento
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

// Obtener categorías
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

// Crear categorías por defecto para nuevo usuario
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