import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';

/**
 * 🎯 HOOK DE DETECCIÓN CONFIABLE DE CONECTIVIDAD (VERSIÓN OPTIMIZADA)
 * 
 * Mejoras:
 * - Reduce intentos cuando está offline para evitar spam de errores
 * - Captura errores silenciosamente (son esperados cuando no hay conexión)
 * - Polling adaptativo: más frecuente cuando detecta cambios, menos cuando está estable
 */
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);
  
  // Refs para controlar el comportamiento
  const verificationInProgressRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);
  const pollingIntervalRef = useRef(null);

  /**
   * Verifica conectividad real haciendo un ping a Supabase
   * Versión silenciosa: no loggea errores esperados
   */
  const verifyConnectivity = useCallback(async (silent = false) => {
    // Evitar verificaciones concurrentes
    if (verificationInProgressRef.current) {
      return isOnline;
    }

    verificationInProgressRef.current = true;
    setIsVerifying(true);
    
    try {
      // Timeout corto para fallar rápido
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const { error } = await supabase
        .from('movimientos')
        .select('id')
        .limit(1)
        .abortSignal(controller.signal);
      
      clearTimeout(timeoutId);
      
      const online = !error;
      
      // Solo loggear cambios de estado o cuando se solicite explícitamente
      if (online !== isOnline || !silent) {
        console.log(`🌐 Conectividad: ${online ? 'ONLINE ✅' : 'OFFLINE 📵'}`);
      }
      
      setIsOnline(online);
      setLastCheck(Date.now());
      
      // Resetear contador de fallos si tuvo éxito
      if (online) {
        consecutiveFailuresRef.current = 0;
      }
      
      return online;
      
    } catch (error) {
      // Solo loggear si es un error inesperado (no de red)
      if (!silent && error.name !== 'AbortError' && !error.message.includes('fetch')) {
        console.warn('⚠️ Error verificando conectividad:', error.message);
      }
      
      setIsOnline(false);
      setLastCheck(Date.now());
      consecutiveFailuresRef.current++;
      
      return false;
      
    } finally {
      verificationInProgressRef.current = false;
      setIsVerifying(false);
    }
  }, [isOnline]);

  /**
   * Handler para eventos de conectividad del navegador
   */
  const handleConnectivityChange = useCallback(() => {
    const browserOnline = navigator.onLine;
    
    console.log(`📡 Evento de conectividad del navegador: ${browserOnline ? 'online' : 'offline'}`);
    
    // Actualizar estado inmediatamente
    setIsOnline(browserOnline);
    
    // Si el navegador dice que estamos online, verificar realmente después de un segundo
    if (browserOnline) {
      setTimeout(() => {
        verifyConnectivity(false); // No silencioso, queremos ver el log de recuperación
      }, 1000);
    } else {
      // Si está offline, resetear contador
      consecutiveFailuresRef.current = 0;
    }
  }, [verifyConnectivity]);

  /**
   * Setup de polling inteligente
   * - Cuando está online: verifica cada 60 segundos
   * - Cuando está offline: verifica cada 30 segundos (menos agresivo)
   * - Después de 3 fallos consecutivos: reduce a cada 60 segundos
   */
  useEffect(() => {
    // Limpiar intervalo anterior
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Determinar intervalo según el estado
    let interval;
    
    if (isOnline) {
      // Online: verificar cada 60 segundos (mantenimiento)
      interval = 60000;
    } else if (consecutiveFailuresRef.current >= 3) {
      // Offline con múltiples fallos: reducir frecuencia a 60 segundos
      interval = 60000;
    } else {
      // Offline reciente: intentar cada 30 segundos
      interval = 30000;
    }

    console.log(`⏰ Configurando polling cada ${interval / 1000}s (estado: ${isOnline ? 'online' : 'offline'})`);

    pollingIntervalRef.current = setInterval(() => {
      // Verificación silenciosa (no loggear errores esperados)
      verifyConnectivity(true);
    }, interval);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [isOnline, verifyConnectivity]);

  /**
   * Setup inicial y event listeners
   */
  useEffect(() => {
    // Verificación inicial (silenciosa)
    verifyConnectivity(true);

    // Setup de event listeners
    window.addEventListener('online', handleConnectivityChange);
    window.addEventListener('offline', handleConnectivityChange);

    return () => {
      window.removeEventListener('online', handleConnectivityChange);
      window.removeEventListener('offline', handleConnectivityChange);
    };
  }, [handleConnectivityChange, verifyConnectivity]);

  /**
   * Handler para cuando la app vuelve de background
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ App visible, verificando conectividad...');
        
        // Verificación no silenciosa cuando volvemos a la app
        setTimeout(() => {
          verifyConnectivity(false);
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [verifyConnectivity]);

  return {
    isOnline,
    isVerifying,
    lastCheck,
    verifyConnectivity: () => verifyConnectivity(false) // Exponer versión no silenciosa para uso manual
  };
};
