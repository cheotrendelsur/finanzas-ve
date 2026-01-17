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
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user || null);
    
    if (session?.user) {
      await loadPINSettings(session.user.id);
    }
    
    setLoading(false);
  };

  const loadPINSettings = async (userId) => {
    // Cargar configuración de PIN desde localStorage
    const storedPIN = localStorage.getItem(`pin_${userId}`);
    const biometricSetting = localStorage.getItem(`biometric_${userId}`);
    
    setHasPIN(!!storedPIN);
    setBiometricEnabled(biometricSetting === 'true');
  };

  // Crear PIN
  const createPIN = async (pin) => {
    if (!user) return false;
    
    try {
      // Hashear el PIN antes de guardarlo (simple hash para demo)
      const hashedPIN = btoa(pin);
      localStorage.setItem(`pin_${user.id}`, hashedPIN);
      setHasPIN(true);
      setIsUnlocked(true);
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
      // Verificar si WebAuthn está disponible
      if (!window.PublicKeyCredential) {
        alert('Tu navegador no soporta autenticación biométrica');
        return false;
      }

      // Crear credencial WebAuthn
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
      // Primero intentar biometría si está disponible
      if (biometricEnabled) {
        authenticateWithBiometric()
          .then(success => {
            if (success) {
              resolve(true);
            } else {
              // Si falla biometría, pedir PIN
              const pin = prompt('Ingresa tu PIN para continuar:');
              if (pin) {
                validatePIN(pin).then(resolve);
              } else {
                resolve(false);
              }
            }
          });
      } else {
        // Solo PIN
        const pin = prompt('Ingresa tu PIN para continuar:');
        if (pin) {
          validatePIN(pin).then(resolve);
        } else {
          resolve(false);
        }
      }
    });
  };

  const logout = () => {
    setIsUnlocked(false);
    setUser(null);
    setHasPIN(false);
    setBiometricEnabled(false);
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