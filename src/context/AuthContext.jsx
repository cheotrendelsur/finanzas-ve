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
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const searchParams = new URLSearchParams(window.location.search);
      
      const hasAuthParams = 
        hashParams.has('access_token') || 
        hashParams.has('refresh_token') ||
        searchParams.has('code') ||
        searchParams.has('token_hash');

      if (hasAuthParams) {
        console.log('🔐 [AUTH] Detectados parámetros de Magic Link, esperando procesamiento...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      
      if (session?.user) {
        await loadPINSettings(session.user.id);
        
        const wasUnlocked = sessionStorage.getItem('isUnlocked') === 'true';
        if (wasUnlocked) {
          setIsUnlocked(true);
        }
      }
    } catch (error) {
      console.error('❌ [AUTH] Error checking user:', error);
      setUser(null);
    } finally {
      setLoading(false);
      console.log('✅ [AUTH] Inicialización completada');
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

  const createPIN = async (pin) => {
    if (!user) return false;
    
    try {
      const hashedPIN = btoa(pin);
      localStorage.setItem(`pin_${user.id}`, hashedPIN);
      setHasPIN(true);
      return true;
    } catch (error) {
      console.error('Error creating PIN:', error);
      return false;
    }
  };

  const validatePIN = async (pin) => {
    if (!user) return false;
    
    try {
      const storedPIN = localStorage.getItem(`pin_${user.id}`);
      const hashedPIN = btoa(pin);
      
      if (hashedPIN === storedPIN) {
        setIsUnlocked(true);
        sessionStorage.setItem('isUnlocked', 'true');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error validating PIN:', error);
      return false;
    }
  };

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
      console.error('❌ [BIOMETRIC] Error enabling:', error);
      throw error;
    }
  };

  const authenticateWithBiometric = async () => {
    if (!user || !biometricEnabled) return false;
    
    try {
      const storedCredential = localStorage.getItem(`biometric_credential_${user.id}`);
      if (!storedCredential) {
        throw new Error('NO_CREDENTIAL');
      }

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
        sessionStorage.setItem('isUnlocked', 'true');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ [BIOMETRIC] Error authenticating:', error);
      throw error;
    }
  };

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
          })
          .catch(() => {
            const pin = prompt('Ingresa tu PIN para continuar:');
            if (pin) {
              validatePIN(pin).then(resolve);
            } else {
              resolve(false);
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

  const logout = async () => {
    try {
      console.log('🚪 [LOGOUT] Iniciando cierre de sesión...');
      
      setIsUnlocked(false);
      setUser(null);
      setHasPIN(false);
      setBiometricEnabled(false);
      
      sessionStorage.removeItem('isUnlocked');
      
      await supabase.auth.signOut();
      
      console.log('✅ [LOGOUT] Sesión cerrada correctamente');
      
      window.location.href = '/';
    } catch (error) {
      console.error('❌ [LOGOUT] Error durante logout:', error);
      window.location.href = '/';
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