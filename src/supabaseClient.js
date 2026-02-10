import { createClient } from '@supabase/supabase-js';
import { isOnline, addToOfflineQueue } from './utils/offlineManager';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
console.log("🔍 URL Supabase:", supabaseUrl);
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

// ✅ FUNCIÓN REFACTORIZADA: Crear movimiento con validación anti-BS y soporte offline
export const crearMovimiento = async (movimiento) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  // ✅ VALIDACIÓN CRÍTICA: Asegurar que NUNCA se envíe 'BS' a la base de datos
  if (movimiento.moneda_movimiento === 'BS') {
    console.warn('⚠️ Detectado valor "BS" en moneda_movimiento, convirtiendo a "VES"');
    movimiento.moneda_movimiento = 'VES';
  }
  
  const payload = { ...movimiento, user_id: user?.id };
  
  // Si no hay conexión, guardar en cola offline
  if (!isOnline()) {
    console.log('🔴 Sin conexión - Guardando en cola offline');
    const offlineOp = addToOfflineQueue({
      type: 'create_movimiento',
      payload
    });
    
    // Retornar un objeto "temporal" para actualizar la UI optimistamente
    return {
      ...payload,
      id: offlineOp.id,
      isOffline: true,
      created_at: new Date().toISOString()
    };
  }
  
  // Si hay conexión, guardar normalmente
  const { data, error } = await supabase
    .from('movimientos')
    .insert([payload])
    .select()
    .single();
  
  if (error) {
    console.error('Error creando movimiento:', error);
    return null;
  }
  return data;
};

export const actualizarMovimiento = async (id, cambios) => {
  // ✅ VALIDACIÓN CRÍTICA: Asegurar que NUNCA se envíe 'BS' a la base de datos
  if (cambios.moneda_movimiento === 'BS') {
    console.warn('⚠️ Detectado valor "BS" en moneda_movimiento, convirtiendo a "VES"');
    cambios.moneda_movimiento = 'VES';
  }
  
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

// ✅ FUNCIÓN: Eliminar movimiento
export const eliminarMovimiento = async (id) => {
  // No permitir eliminar movimientos offline (que empiezan con "offline_")
  if (typeof id === 'string' && id.startsWith('offline_')) {
    alert('No se pueden eliminar movimientos pendientes de sincronizar');
    return false;
  }
  
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

/**
 * 🎯 TAREA 1: BÚSQUEDA INTELIGENTE DE TASA DE CAMBIO
 * Busca la tasa de cambio para una fecha específica con lógica de fallback
 * 
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @returns {Object|null} { valor: number, fecha: string, esExacta: boolean } o null
 */
export const obtenerTasaParaFecha = async (fecha) => {
  try {
    console.log(`🔍 Buscando tasa para fecha: ${fecha}`);
    
    // PASO 1: Buscar tasa exacta para la fecha
    const { data: tasaExacta, error: errorExacta } = await supabase
      .from('tasas_cambio')
      .select('valor, fecha')
      .eq('fecha', fecha)
      .single();
    
    if (!errorExacta && tasaExacta) {
      console.log(`✅ Tasa exacta encontrada: ${tasaExacta.valor} (${tasaExacta.fecha})`);
      return {
        valor: parseFloat(tasaExacta.valor),
        fecha: tasaExacta.fecha,
        esExacta: true
      };
    }
    
    // PASO 2: No hay tasa exacta, buscar la más reciente ANTERIOR
    console.log(`⚠️ No hay tasa exacta, buscando anterior más cercana...`);
    
    const { data: tasaAnterior, error: errorAnterior } = await supabase
      .from('tasas_cambio')
      .select('valor, fecha')
      .lt('fecha', fecha)
      .order('fecha', { ascending: false })
      .limit(1)
      .single();
    
    if (!errorAnterior && tasaAnterior) {
      console.log(`✅ Tasa anterior encontrada: ${tasaAnterior.valor} (${tasaAnterior.fecha})`);
      return {
        valor: parseFloat(tasaAnterior.valor),
        fecha: tasaAnterior.fecha,
        esExacta: false
      };
    }
    
    // PASO 3: No hay tasas anteriores, buscar cualquier tasa (la más reciente disponible)
    console.log(`⚠️ No hay tasas anteriores, buscando la más reciente disponible...`);
    
    const { data: tasaReciente, error: errorReciente } = await supabase
      .from('tasas_cambio')
      .select('valor, fecha')
      .order('fecha', { ascending: false })
      .limit(1)
      .single();
    
    if (!errorReciente && tasaReciente) {
      console.log(`✅ Tasa reciente encontrada: ${tasaReciente.valor} (${tasaReciente.fecha})`);
      return {
        valor: parseFloat(tasaReciente.valor),
        fecha: tasaReciente.fecha,
        esExacta: false
      };
    }
    
    // PASO 4: No hay ninguna tasa en el sistema
    console.error('❌ No se encontró ninguna tasa en el sistema');
    return null;
    
  } catch (error) {
    console.error('❌ Error en obtenerTasaParaFecha:', error);
    return null;
  }
};