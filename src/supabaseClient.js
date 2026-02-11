import { createClient } from '@supabase/supabase-js';
import { isOnline, addToOfflineQueue } from './utils/offlineManager';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
console.log("🔑 URL Supabase:", supabaseUrl);
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

// ✅ FUNCIÓN REFACTORIZADA CON TRIPLE PROTECCIÓN OFFLINE
export const crearMovimiento = async (movimiento) => {
  // Validación anti-BS
  if (movimiento.moneda_movimiento === 'BS') {
    console.warn('⚠️ Detectado valor "BS", convirtiendo a "VES"');
    movimiento.moneda_movimiento = 'VES';
  }
  
  const { data: { user } } = await supabase.auth.getUser();
  const payload = { ...movimiento, user_id: user?.id };
  
  // 🛡️ PROTECCIÓN 1: Verificación básica de navigator.onLine
  if (!isOnline()) {
    console.log('📵 PROTECCIÓN 1: Sin conexión detectada por navigator.onLine');
    const offlineOp = addToOfflineQueue({
      type: 'create',
      table: 'movimientos',
      data: payload
    });
    
    return {
      ...payload,
      id: offlineOp.id,
      isOffline: true,
      created_at: new Date().toISOString()
    };
  }
  
  // 🛡️ PROTECCIÓN 2: Try-catch para capturar "Failed to fetch"
  try {
    console.log('🔄 Intentando guardar en Supabase...');
    
    const { data, error } = await supabase
      .from('movimientos')
      .insert([payload])
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Movimiento guardado en Supabase exitosamente');
    return data;
    
  } catch (error) {
    console.error('❌ Error al intentar guardar en Supabase:', error.message);
    
    // 🛡️ PROTECCIÓN 3: Si falla por error de red, guardar offline automáticamente
    const isNetworkError = 
      error.message?.toLowerCase().includes('fetch') ||
      error.message?.toLowerCase().includes('network') ||
      error.message?.toLowerCase().includes('failed to fetch') ||
      error.code === 'PGRST301' ||
      !navigator.onLine;
    
    if (isNetworkError) {
      console.log('📵 PROTECCIÓN 3: Error de red detectado, guardando en cola offline...');
      
      const offlineOp = addToOfflineQueue({
        type: 'create',
        table: 'movimientos',
        data: payload
      });
      
      return {
        ...payload,
        id: offlineOp.id,
        isOffline: true,
        created_at: new Date().toISOString()
      };
    }
    
    // Si es otro tipo de error (validación, etc.), retornar null
    console.error('❌ Error no relacionado con red:', error);
    return null;
  }
};

export const actualizarMovimiento = async (id, cambios) => {
  // Validación anti-BS
  if (cambios.moneda_movimiento === 'BS') {
    console.warn('⚠️ Detectado valor "BS", convirtiendo a "VES"');
    cambios.moneda_movimiento = 'VES';
  }
  
  // 🛡️ PROTECCIÓN 1: Verificación básica
  if (!isOnline()) {
    console.log('📵 Sin conexión - Guardando actualización en cola offline');
    const offlineOp = addToOfflineQueue({
      type: 'update',
      table: 'movimientos',
      data: { id, changes: cambios }
    });
    
    return {
      id,
      ...cambios,
      isOffline: true
    };
  }
  
  // 🛡️ PROTECCIÓN 2 y 3: Try-catch
  try {
    const { data, error } = await supabase
      .from('movimientos')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
    
  } catch (error) {
    console.error('❌ Error actualizando movimiento:', error);
    
    const isNetworkError = 
      error.message?.toLowerCase().includes('fetch') ||
      error.message?.toLowerCase().includes('network') ||
      !navigator.onLine;
    
    if (isNetworkError) {
      console.log('📵 Error de red, guardando actualización offline...');
      
      const offlineOp = addToOfflineQueue({
        type: 'update',
        table: 'movimientos',
        data: { id, changes: cambios }
      });
      
      return {
        id,
        ...cambios,
        isOffline: true
      };
    }
    
    return null;
  }
};

export const eliminarMovimiento = async (id) => {
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
 * 🎯 BÚSQUEDA INTELIGENTE DE TASA (CON PROTECCIÓN OFFLINE)
 */
export const obtenerTasaParaFecha = async (fecha) => {
  // Protección: No buscar si estamos offline
  if (!isOnline()) {
    console.log('📵 Sin conexión - No se puede buscar tasa');
    return null;
  }

  try {
    console.log(`🔍 Buscando tasa para: ${fecha}`);
    
    // PASO 1: Tasa exacta
    const { data: tasaExacta, error: errorExacta } = await supabase
      .from('tasas_cambio')
      .select('valor, fecha')
      .eq('fecha', fecha)
      .single();
    
    if (!errorExacta && tasaExacta) {
      console.log(`✅ Tasa exacta: ${tasaExacta.valor}`);
      return {
        valor: parseFloat(tasaExacta.valor),
        fecha: tasaExacta.fecha,
        esExacta: true
      };
    }
    
    // PASO 2: Tasa anterior
    const { data: tasaAnterior } = await supabase
      .from('tasas_cambio')
      .select('valor, fecha')
      .lt('fecha', fecha)
      .order('fecha', { ascending: false })
      .limit(1)
      .single();
    
    if (tasaAnterior) {
      console.log(`✅ Tasa anterior: ${tasaAnterior.valor}`);
      return {
        valor: parseFloat(tasaAnterior.valor),
        fecha: tasaAnterior.fecha,
        esExacta: false
      };
    }
    
    // PASO 3: Cualquier tasa
    const { data: tasaReciente } = await supabase
      .from('tasas_cambio')
      .select('valor, fecha')
      .order('fecha', { ascending: false })
      .limit(1)
      .single();
    
    if (tasaReciente) {
      console.log(`✅ Tasa reciente: ${tasaReciente.valor}`);
      return {
        valor: parseFloat(tasaReciente.valor),
        fecha: tasaReciente.fecha,
        esExacta: false
      };
    }
    
    console.log('⚠️ No hay tasas en el sistema');
    return null;
    
  } catch (error) {
    // Manejo silencioso de errores de red
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      console.log('📵 Error de red al buscar tasa (esperado en offline)');
      return null;
    }
    
    console.error('❌ Error inesperado:', error);
    return null;
  }
};

// ==================== SINCRONIZACIÓN OFFLINE ====================

export const syncOfflineData = async (operations) => {
  if (!operations || operations.length === 0) {
    return { success: true, message: 'No hay operaciones', synced: 0 };
  }

  console.log(`🔄 Procesando ${operations.length} operaciones`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const operation of operations) {
    try {
      let type = operation.type;
      let table = operation.table;
      let data = operation.data;

      // Compatibilidad con formato legacy
      if (type === 'create_movimiento') {
        type = 'create';
        table = 'movimientos';
        data = operation.payload || operation.data;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (type === 'create') {
        if (table === 'movimientos') {
          const { error } = await supabase
            .from('movimientos')
            .insert([{ ...data, user_id: user?.id }]);
          if (error) throw error;
        } else if (table === 'cuentas') {
          const { error } = await supabase
            .from('cuentas')
            .insert([{ ...data, user_id: user?.id }]);
          if (error) throw error;
        }
      } else if (type === 'update') {
        const { id, changes } = data;
        if (table === 'movimientos') {
          const { error } = await supabase
            .from('movimientos')
            .update(changes)
            .eq('id', id);
          if (error) throw error;
        }
      } else if (type === 'delete') {
        const { id } = data;
        if (table === 'movimientos') {
          const { error } = await supabase
            .from('movimientos')
            .delete()
            .eq('id', id);
          if (error) throw error;
        }
      }

      successCount++;
      console.log(`✅ Operación ${operation.id} sincronizada`);

    } catch (error) {
      console.error(`❌ Error en operación ${operation.id}:`, error);
      errorCount++;
      errors.push({ operationId: operation.id, error: error.message });
      throw error;
    }
  }

  return {
    success: errorCount === 0,
    synced: successCount,
    errors: errorCount,
    errorDetails: errors,
    message: `${successCount} exitosas, ${errorCount} fallidas`
  };
};