/**
 * 🎯 SISTEMA DE GESTIÓN OFFLINE CON RETRY AUTOMÁTICO
 * 
 * Mejoras implementadas:
 * - Metadata de intentos y timestamps
 * - Clasificación de errores (temporal vs permanente)
 * - Cola de operaciones fallidas
 * - Sistema de backoff exponencial
 */

const OFFLINE_QUEUE_KEY = 'offline_queue';
const FAILED_QUEUE_KEY = 'offline_failed_queue';
const LAST_SYNC_KEY = 'offline_last_sync';
const SYNC_METADATA_KEY = 'offline_sync_metadata';

/**
 * Estructura de una operación en cola:
 * {
 *   id: string (UUID único)
 *   type: 'create' | 'update' | 'delete'
 *   table: 'movimientos' | 'cuentas' | etc.
 *   data: object (datos a guardar)
 *   timestamp: number (cuándo se creó)
 *   attempts: number (cuántos intentos llevamos)
 *   lastAttempt: number (timestamp del último intento)
 *   status: 'pending' | 'syncing' | 'error'
 *   error: string | null (último mensaje de error)
 * }
 */

/**
 * Genera un UUID simple para identificar operaciones
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Agrega una operación a la cola offline con metadata completa
 */
export const addToOfflineQueue = (operation) => {
  const queue = getOfflineQueue();
  
  const operationWithMetadata = {
    id: generateUUID(),
    ...operation,
    timestamp: Date.now(),
    attempts: 0,
    lastAttempt: null,
    status: 'pending',
    error: null
  };
  
  queue.push(operationWithMetadata);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  
  console.log('📥 Operación agregada a cola offline:', operationWithMetadata.id);
  return operationWithMetadata;
};

/**
 * Obtiene la cola de operaciones pendientes
 */
export const getOfflineQueue = () => {
  try {
    const queue = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('Error leyendo cola offline:', error);
    return [];
  }
};

/**
 * Elimina una operación específica de la cola
 */
export const removeFromOfflineQueue = (operationId) => {
  const queue = getOfflineQueue();
  const filtered = queue.filter(op => op.id !== operationId);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
  console.log('✅ Operación eliminada de cola:', operationId);
};

/**
 * Actualiza el estado de una operación en la cola
 */
export const updateOperationStatus = (operationId, updates) => {
  const queue = getOfflineQueue();
  const updated = queue.map(op => {
    if (op.id === operationId) {
      return { ...op, ...updates };
    }
    return op;
  });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
};

/**
 * Marca una operación como "intentando sincronizar"
 */
export const markAsAttempting = (operationId) => {
  updateOperationStatus(operationId, {
    status: 'syncing',
    attempts: getOfflineQueue().find(op => op.id === operationId).attempts + 1,
    lastAttempt: Date.now()
  });
};

/**
 * Marca una operación como fallida con error
 */
export const markAsFailed = (operationId, error) => {
  updateOperationStatus(operationId, {
    status: 'error',
    error: error.message || 'Error desconocido'
  });
  
  console.error('❌ Operación fallida:', operationId, error);
};

/**
 * Mueve una operación a la cola de fallidos permanentes
 */
export const moveToFailedQueue = (operation) => {
  const failedQueue = getFailedQueue();
  failedQueue.push({
    ...operation,
    movedToFailed: Date.now()
  });
  localStorage.setItem(FAILED_QUEUE_KEY, JSON.stringify(failedQueue));
  removeFromOfflineQueue(operation.id);
  
  console.warn('⚠️ Operación movida a fallidos permanentes:', operation.id);
};

/**
 * Obtiene la cola de operaciones fallidas permanentemente
 */
export const getFailedQueue = () => {
  try {
    const queue = localStorage.getItem(FAILED_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('Error leyendo cola de fallidos:', error);
    return [];
  }
};

/**
 * Limpia completamente la cola de fallidos (usar con precaución)
 */
export const clearFailedQueue = () => {
  localStorage.removeItem(FAILED_QUEUE_KEY);
  console.log('🗑️ Cola de fallidos limpiada');
};

/**
 * Limpia completamente todas las colas (usar con precaución)
 */
export const clearAllQueues = () => {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
  localStorage.removeItem(FAILED_QUEUE_KEY);
  localStorage.removeItem(SYNC_METADATA_KEY);
  console.log('🗑️ Todas las colas limpiadas');
};

/**
 * Clasifica un error como temporal o permanente
 */
export const classifyError = (error) => {
  const message = error.message?.toLowerCase() || '';
  const code = error.code || '';
  
  // Errores permanentes (no vale la pena reintentar)
  const permanentErrors = [
    'unique constraint',
    'foreign key constraint',
    'not null constraint',
    'validation',
    'invalid input',
    '400',
    '403',
    '404',
    '422'
  ];
  
  // Errores temporales (vale la pena reintentar)
  const temporalErrors = [
    'network',
    'timeout',
    'fetch',
    'connection',
    '500',
    '502',
    '503',
    '504'
  ];
  
  for (const errorType of permanentErrors) {
    if (message.includes(errorType) || code.includes(errorType)) {
      return 'permanent';
    }
  }
  
  for (const errorType of temporalErrors) {
    if (message.includes(errorType) || code.includes(errorType)) {
      return 'temporal';
    }
  }
  
  // Por defecto, considerarlo temporal (optimista)
  return 'temporal';
};

/**
 * Calcula el tiempo de espera para el próximo intento (backoff exponencial)
 * Intentos: 10s, 30s, 1min, 5min, 15min
 */
export const getRetryDelay = (attempts) => {
  const delays = [
    10 * 1000,      // 10 segundos
    30 * 1000,      // 30 segundos
    60 * 1000,      // 1 minuto
    5 * 60 * 1000,  // 5 minutos
    15 * 60 * 1000  // 15 minutos
  ];
  
  return delays[Math.min(attempts, delays.length - 1)];
};

/**
 * Verifica si una operación está lista para reintentar
 */
export const isReadyToRetry = (operation, maxAttempts = 5) => {
  // Si superó el máximo de intentos, no reintentar
  if (operation.attempts >= maxAttempts) {
    return false;
  }
  
  // Si nunca se ha intentado, está lista
  if (!operation.lastAttempt) {
    return true;
  }
  
  // Calcular si pasó suficiente tiempo desde el último intento
  const delay = getRetryDelay(operation.attempts);
  const timeSinceLastAttempt = Date.now() - operation.lastAttempt;
  
  return timeSinceLastAttempt >= delay;
};

/**
 * Guarda metadata de sincronización
 */
export const saveSyncMetadata = (metadata) => {
  localStorage.setItem(SYNC_METADATA_KEY, JSON.stringify({
    ...metadata,
    timestamp: Date.now()
  }));
};

/**
 * Obtiene metadata de sincronización
 */
export const getSyncMetadata = () => {
  try {
    const metadata = localStorage.getItem(SYNC_METADATA_KEY);
    return metadata ? JSON.parse(metadata) : null;
  } catch (error) {
    console.error('Error leyendo metadata de sync:', error);
    return null;
  }
};

/**
 * Guarda timestamp del último sync exitoso
 */
export const saveLastSyncTime = () => {
  localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
};

/**
 * Obtiene timestamp del último sync exitoso
 */
export const getLastSyncTime = () => {
  const timestamp = localStorage.getItem(LAST_SYNC_KEY);
  return timestamp ? parseInt(timestamp, 10) : null;
};

/**
 * Verifica si el navegador está online
 */
export const isOnline = () => {
  return navigator.onLine;
};

/**
 * Setup de listeners de conectividad
 */
export const setupOnlineListener = (callback) => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};

// ============= MANEJO DE BORRADORES =============

export const saveDraft = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error guardando borrador:', error);
  }
};

export const loadDraft = (key) => {
  try {
    const draft = localStorage.getItem(key);
    return draft ? JSON.parse(draft) : null;
  } catch (error) {
    console.error('Error cargando borrador:', error);
    return null;
  }
};

export const clearDraft = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error eliminando borrador:', error);
  }
};