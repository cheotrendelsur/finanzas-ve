import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { syncOfflineData } from '../supabaseClient';
import { 
  getOfflineQueue, 
  getFailedQueue,
  isReadyToRetry,
  markAsAttempting,
  markAsFailed,
  moveToFailedQueue,
  classifyError,
  removeFromOfflineQueue,
  saveLastSyncTime,
  saveSyncMetadata,
  getSyncMetadata
} from '../utils/offlineManager';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const OfflineContext = createContext();

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline debe usarse dentro de OfflineProvider');
  }
  return context;
};

export const OfflineProvider = ({ children }) => {
  const { isOnline, verifyConnectivity } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  
  // Ref para el intervalo de retry automático
  const retryIntervalRef = useRef(null);
  const syncInProgressRef = useRef(false);

  /**
   * Actualiza los contadores de operaciones pendientes y fallidas
   */
  const updateCounts = useCallback(() => {
    const pending = getOfflineQueue().length;
    const failed = getFailedQueue().length;
    
    setPendingCount(pending);
    setFailedCount(failed);
    
    console.log(`📊 Contadores actualizados: ${pending} pendientes, ${failed} fallidos`);
  }, []);

  /**
   * 🎯 FUNCIÓN PRINCIPAL DE SINCRONIZACIÓN CON RETRY INTELIGENTE
   */
  const performSync = useCallback(async (isManual = false) => {
    // Evitar sincronizaciones concurrentes
    if (syncInProgressRef.current) {
      console.log('⏭️ Sincronización ya en progreso, saltando...');
      return { success: false, message: 'Sincronización en progreso' };
    }

    // Verificar conectividad real antes de intentar
    if (!isOnline) {
      console.log('📵 Sin conexión, saltando sincronización');
      return { success: false, message: 'Sin conexión a internet' };
    }

    const queue = getOfflineQueue();
    
    if (queue.length === 0) {
      console.log('✅ No hay operaciones pendientes');
      return { success: true, message: 'No hay operaciones pendientes', synced: 0 };
    }

    console.log(`🔄 Iniciando sincronización de ${queue.length} operaciones (${isManual ? 'MANUAL' : 'AUTOMÁTICA'})`);
    
    syncInProgressRef.current = true;
    setIsSyncing(true);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const errors = [];

    try {
      // Procesar cada operación individualmente
      for (const operation of queue) {
        // Verificar si está lista para reintentar
        if (!isReadyToRetry(operation)) {
          console.log(`⏭️ Operación ${operation.id} no lista para reintentar (intentos: ${operation.attempts})`);
          skippedCount++;
          continue;
        }

        try {
          console.log(`🔄 Procesando operación ${operation.id} (intento ${operation.attempts + 1})`);
          
          // Marcar como intentando
          markAsAttempting(operation.id);
          
          // Intentar sincronizar usando la función del supabaseClient
          const result = await syncOfflineData([operation]);
          
          if (result.success) {
            // Éxito: eliminar de la cola
            removeFromOfflineQueue(operation.id);
            successCount++;
            console.log(`✅ Operación ${operation.id} sincronizada exitosamente`);
          } else {
            throw new Error(result.message || 'Error desconocido');
          }
          
        } catch (error) {
          console.error(`❌ Error sincronizando operación ${operation.id}:`, error);
          errorCount++;
          errors.push({ id: operation.id, error: error.message });
          
          // Clasificar el error
          const errorType = classifyError(error);
          
          if (errorType === 'permanent' || operation.attempts >= 4) {
            // Error permanente o ya intentamos 5 veces: mover a fallidos
            console.warn(`⚠️ Moviendo operación ${operation.id} a fallidos (${errorType})`);
            moveToFailedQueue(operation);
          } else {
            // Error temporal: marcar como error y reintentar después
            markAsFailed(operation.id, error);
          }
        }

        // Pequeña pausa entre operaciones para no saturar
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Guardar resultado de esta sincronización
      const result = {
        timestamp: Date.now(),
        success: errorCount === 0,
        synced: successCount,
        errors: errorCount,
        skipped: skippedCount,
        total: queue.length,
        isManual
      };

      if (successCount > 0) {
        saveLastSyncTime();
      }

      saveSyncMetadata(result);
      setLastSyncResult(result);

      console.log(`✅ Sincronización completada: ${successCount} exitosas, ${errorCount} errores, ${skippedCount} saltadas`);

      return result;

    } catch (error) {
      console.error('❌ Error general en sincronización:', error);
      return {
        success: false,
        message: error.message,
        synced: successCount,
        errors: errorCount + 1
      };
    } finally {
      syncInProgressRef.current = false;
      setIsSyncing(false);
      updateCounts();
    }
  }, [isOnline, updateCounts]);

  /**
   * Sincronización manual (llamada por el usuario)
   */
  const manualSync = useCallback(async () => {
    // Primero verificar conectividad real
    const online = await verifyConnectivity();
    
    if (!online) {
      return { 
        success: false, 
        message: 'No se pudo establecer conexión con el servidor' 
      };
    }

    return await performSync(true);
  }, [performSync, verifyConnectivity]);

  /**
   * Setup del retry automático en background
   */
  useEffect(() => {
    // Limpiar intervalo anterior si existe
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
    }

    // Solo ejecutar retry automático si hay operaciones pendientes
    const queue = getOfflineQueue();
    
    if (queue.length > 0 && isOnline) {
      console.log('⏰ Configurando retry automático cada 15 segundos');
      
      retryIntervalRef.current = setInterval(async () => {
        const currentQueue = getOfflineQueue();
        
        // Si hay operaciones pendientes y estamos online
        if (currentQueue.length > 0 && isOnline && !syncInProgressRef.current) {
          // Verificar si hay alguna operación lista para reintentar
          const readyOperations = currentQueue.filter(op => isReadyToRetry(op));
          
          if (readyOperations.length > 0) {
            console.log(`🔄 Retry automático: ${readyOperations.length} operaciones listas`);
            await performSync(false);
          }
        }
      }, 15000); // Cada 15 segundos
    }

    return () => {
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
      }
    };
  }, [isOnline, performSync]);

  /**
   * Sincronización al recuperar conexión
   */
  useEffect(() => {
    const queue = getOfflineQueue();
    
    if (isOnline && queue.length > 0 && !syncInProgressRef.current) {
      console.log('🌐 Conexión recuperada, iniciando sincronización...');
      
      // Esperar 2 segundos para que la conexión se estabilice
      setTimeout(() => {
        performSync(false);
      }, 2000);
    }
  }, [isOnline, performSync]);

  /**
   * Actualizar contadores al montar
   */
  useEffect(() => {
    updateCounts();

    // Cargar último resultado de sincronización
    const metadata = getSyncMetadata();
    if (metadata) {
      setLastSyncResult(metadata);
    }
  }, [updateCounts]);

  /**
   * Sincronización oportunista cuando la app vuelve de background
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ App visible, verificando si hay pendientes...');
        
        updateCounts();
        
        const queue = getOfflineQueue();
        if (queue.length > 0 && isOnline && !syncInProgressRef.current) {
          setTimeout(() => {
            performSync(false);
          }, 1000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOnline, performSync, updateCounts]);

  const value = {
    online: isOnline,
    pendingCount,
    failedCount,
    isSyncing,
    lastSyncResult,
    updatePendingCount: updateCounts,
    manualSync,
    performSync
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};