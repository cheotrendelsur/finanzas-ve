import { supabase } from '../supabaseClient';

const OFFLINE_QUEUE_KEY = 'offline_queue';
const DRAFT_PREFIX = 'draft_';

// ==================== GESTIÓN DE COLA OFFLINE ====================

export const addToOfflineQueue = (operation) => {
  const queue = getOfflineQueue();
  const newOperation = {
    id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    ...operation
  };
  queue.push(newOperation);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  return newOperation;
};

export const getOfflineQueue = () => {
  try {
    const queue = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('Error reading offline queue:', error);
    return [];
  }
};

export const removeFromOfflineQueue = (operationId) => {
  const queue = getOfflineQueue();
  const filtered = queue.filter(op => op.id !== operationId);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
};

export const clearOfflineQueue = () => {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
};

// ==================== SINCRONIZACIÓN ====================

export const syncOfflineData = async () => {
  const queue = getOfflineQueue();
  
  if (queue.length === 0) {
    return { success: true, synced: 0, failed: 0 };
  }

  console.log(`🔄 Sincronizando ${queue.length} operaciones pendientes...`);
  
  let synced = 0;
  let failed = 0;
  const failedOperations = [];

  for (const operation of queue) {
    try {
      if (operation.type === 'create_movimiento') {
        const { data, error } = await supabase
          .from('movimientos')
          .insert([operation.payload])
          .select()
          .single();
        
        if (error) throw error;
        
        removeFromOfflineQueue(operation.id);
        synced++;
        console.log(`✅ Movimiento sincronizado: ${operation.id}`);
      }
      // Aquí se pueden agregar más tipos de operaciones en el futuro
    } catch (error) {
      console.error(`❌ Error sincronizando ${operation.id}:`, error);
      failed++;
      failedOperations.push(operation);
    }
  }

  return { success: failed === 0, synced, failed, failedOperations };
};

// ==================== BORRADORES DE FORMULARIOS ====================

export const saveDraft = (formName, data) => {
  try {
    const key = `${DRAFT_PREFIX}${formName}`;
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Error saving draft:', error);
  }
};

export const loadDraft = (formName) => {
  try {
    const key = `${DRAFT_PREFIX}${formName}`;
    const draft = localStorage.getItem(key);
    if (draft) {
      const parsed = JSON.parse(draft);
      // Verificar que el borrador no tenga más de 24 horas
      const age = Date.now() - new Date(parsed.timestamp).getTime();
      if (age < 24 * 60 * 60 * 1000) {
        return parsed.data;
      } else {
        // Borrador muy antiguo, eliminarlo
        clearDraft(formName);
      }
    }
    return null;
  } catch (error) {
    console.error('Error loading draft:', error);
    return null;
  }
};

export const clearDraft = (formName) => {
  try {
    const key = `${DRAFT_PREFIX}${formName}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing draft:', error);
  }
};

// ==================== DETECCIÓN DE CONECTIVIDAD ====================

export const isOnline = () => {
  return navigator.onLine;
};

export const setupOnlineListener = (callback) => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};