import { createContext, useContext, useState, useEffect } from 'react';
import { isOnline, setupOnlineListener, syncOfflineData, getOfflineQueue } from '../utils/offlineManager';

const OfflineContext = createContext();

export const OfflineProvider = ({ children }) => {
  const [online, setOnline] = useState(isOnline());
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    updatePendingCount();
    
    if (isOnline() && getOfflineQueue().length > 0) {
      performSync();
    }
    
    const cleanup = setupOnlineListener(handleConnectivityChange);
    
    return cleanup;
  }, []);

  const updatePendingCount = () => {
    const queue = getOfflineQueue();
    setPendingCount(queue.length);
  };

  const handleConnectivityChange = async () => {
    const nowOnline = isOnline();
    setOnline(nowOnline);
    
    const currentQueue = getOfflineQueue();
    if (nowOnline && currentQueue.length > 0) {
      await performSync();
    }
  };

  const performSync = async () => {
    if (syncing) return;
    
    setSyncing(true);
    console.log('🔄 Iniciando sincronización automática...');
    
    try {
      const result = await syncOfflineData();
      
      if (result.success) {
        console.log(`✅ Sincronización exitosa: ${result.synced} operaciones`);
      } else {
        console.warn(`⚠️ Sincronización parcial: ${result.synced} exitosas, ${result.failed} fallidas`);
      }
      
      updatePendingCount();
    } catch (error) {
      console.error('❌ Error en sincronización:', error);
    } finally {
      setSyncing(false);
    }
  };

  const manualSync = async () => {
    if (!online) {
      alert('No hay conexión a internet');
      return false;
    }
    
    await performSync();
    return true;
  };

  return (
    <OfflineContext.Provider value={{
      online,
      syncing,
      pendingCount,
      manualSync,
      updatePendingCount
    }}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
};