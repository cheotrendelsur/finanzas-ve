import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasPIN, setHasPIN] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
    
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (!session?.user) {
        // Si no hay usuario, limpiar todo
        setIsUnlocked(false);
        sessionStorage.removeItem('isUnlocked');
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      
      if (session?.user) {
        await loadPINSettings(session.user.id);
        
        // PERSISTENCIA: Si ya estaba desbloqueado en esta sesión (refresh), mantenerlo
        const wasUnlocked = sessionStorage.getItem('isUnlocked') === 'true';
        if (wasUnlocked) {
          setIsUnlocked(true);
        }
      }
    } catch (error) {
      console.error('Error checking user:', error);
      setUser(null);
    } finally {
      // SIEMPRE pasar loading a false
      setLoading(false);
    }
  };

  const loadPINSettings = async (userId) => {
    try {
      const storedPIN = localStorage.getItem(`pin_${userId}`);
      const biometricSetting = localStorage.getItem(`biometric_${userId}`);
      
      setHasPIN(!!storedPIN);
      setBiometricEnabled(biometricSetting === 'true');
    } catch (error) {
      console.error('Error loading PIN settings:', error);
    }
  };

  // Crear PIN
  const createPIN = async (pin) => {
    if (!user) return false;
    
    try {
      const hashedPIN = btoa(pin);
      localStorage.setItem(`pin_${user.id}`, hashedPIN);
      setHasPIN(true);
      setIsUnlocked(true);
      
      // Persistir estado desbloqueado en sessionStorage
      sessionStorage.setItem('isUnlocked', 'true');
      return true;
    } catch (error) {
      console.error('Error creating PIN:', error);
      return false;
    }
  };

  // Validar PIN
  const validatePIN = async (pin) => {
    if (!user) return false;
    
    try {
      const storedPIN = localStorage.getItem(`pin_${user.id}`);
      const hashedPIN = btoa(pin);
      
      if (hashedPIN === storedPIN) {
        setIsUnlocked(true);
        // Persistir estado desbloqueado en sessionStorage
        sessionStorage.setItem('isUnlocked', 'true');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error validating PIN:', error);
      return false;
    }
  };

  // Activar Biometría
  const enableBiometric = async () => {
    if (!user) return false;
    
    try {
      if (!window.PublicKeyCredential) {
        alert('Tu navegador no soporta autenticación biométrica');
        return false;
      }

      const publicKeyCredentialCreationOptions = {
        challenge: Uint8Array.from(user.id, c => c.charCodeAt(0)),
        rp: {
          name: "Finanzas VE",
          id: window.location.hostname,
        },
        user: {
          id: Uint8Array.from(user.id, c => c.charCodeAt(0)),
          name: user.email,
          displayName: user.email,
        },
        pubKeyCredParams: [{alg: -7, type: "public-key"}],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
        attestation: "direct"
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      });

      if (credential) {
        localStorage.setItem(`biometric_${user.id}`, 'true');
        localStorage.setItem(`biometric_credential_${user.id}`, JSON.stringify({
          id: credential.id,
          rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId)))
        }));
        setBiometricEnabled(true);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error enabling biometric:', error);
      return false;
    }
  };

  // Autenticar con Biometría
  const authenticateWithBiometric = async () => {
    if (!user || !biometricEnabled) return false;
    
    try {
      const storedCredential = localStorage.getItem(`biometric_credential_${user.id}`);
      if (!storedCredential) return false;

      const credentialData = JSON.parse(storedCredential);
      
      const publicKeyCredentialRequestOptions = {
        challenge: Uint8Array.from(user.id, c => c.charCodeAt(0)),
        allowCredentials: [{
          id: Uint8Array.from(atob(credentialData.rawId), c => c.charCodeAt(0)),
          type: 'public-key',
          transports: ['internal'],
        }],
        timeout: 60000,
        userVerification: "required"
      };

      const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      });

      if (assertion) {
        setIsUnlocked(true);
        // Persistir estado desbloqueado en sessionStorage
        sessionStorage.setItem('isUnlocked', 'true');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error authenticating with biometric:', error);
      return false;
    }
  };

  // Verificar PIN para acciones críticas
  const requirePINForAction = async () => {
    return new Promise((resolve) => {
      if (biometricEnabled) {
        authenticateWithBiometric()
          .then(success => {
            if (success) {
              resolve(true);
            } else {
              const pin = prompt('Ingresa tu PIN para continuar:');
              if (pin) {
                validatePIN(pin).then(resolve);
              } else {
                resolve(false);
              }
            }
          });
      } else {
        const pin = prompt('Ingresa tu PIN para continuar:');
        if (pin) {
          validatePIN(pin).then(resolve);
        } else {
          resolve(false);
        }
      }
    });
  };

  // LOGOUT MEJORADO - Limpieza total
  const logout = async () => {
    try {
      // 1. Cerrar sesión en Supabase
      await supabase.auth.signOut();
      
      // 2. Limpiar estado local
      setIsUnlocked(false);
      setUser(null);
      setHasPIN(false);
      setBiometricEnabled(false);
      
      // 3. Limpiar sessionStorage (estado de desbloqueado)
      sessionStorage.removeItem('isUnlocked');
      
      // 4. NO limpiar localStorage del PIN (para que persista entre sesiones)
      // El PIN y la biometría deben persistir incluso después del logout
      
      // 5. Recargar la página para limpiar cualquier estado residual
      window.location.reload();
    } catch (error) {
      console.error('Error during logout:', error);
      // Forzar recarga incluso si hay error
      window.location.reload();
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isUnlocked,
      hasPIN,
      biometricEnabled,
      loading,
      createPIN,
      validatePIN,
      enableBiometric,
      authenticateWithBiometric,
      requirePINForAction,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};