import { useState, useEffect } from 'react';
import { Lock, Fingerprint, Delete } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function PinScreen() {
  const { 
    hasPIN, 
    biometricEnabled, 
    createPIN, 
    validatePIN, 
    enableBiometric,
    authenticateWithBiometric 
  } = useAuth();
  
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(hasPIN ? 'validate' : 'create');
  const [error, setError] = useState('');
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [biometricError, setBiometricError] = useState('');

  const handleBiometricAuth = async () => {
    try {
      setBiometricError('');
      const success = await authenticateWithBiometric();
      if (!success) {
        setBiometricError('Autenticación biométrica falló. Usa tu PIN.');
      }
    } catch (error) {
      console.error('Error biométrico:', error);
      if (error.message === 'NO_CREDENTIAL') {
        setBiometricError('Huella no configurada en este dispositivo. Entra con PIN y actívala en Ajustes.');
      } else {
        setBiometricError('Error al leer huella. Usa tu PIN.');
      }
    }
  };

  const handleNumberClick = (num) => {
    if (step === 'validate' || step === 'create') {
      if (pin.length < 4) {
        setPin(pin + num);
        setError('');
        setBiometricError('');
      }
    } else if (step === 'confirm') {
      if (confirmPin.length < 4) {
        setConfirmPin(confirmPin + num);
        setError('');
      }
    }
  };

  const handleDelete = () => {
    if (step === 'validate' || step === 'create') {
      setPin(pin.slice(0, -1));
    } else if (step === 'confirm') {
      setConfirmPin(confirmPin.slice(0, -1));
    }
    setError('');
    setBiometricError('');
  };

  useEffect(() => {
    if (step === 'create' && pin.length === 4) {
      setStep('confirm');
    } else if (step === 'confirm' && confirmPin.length === 4) {
      handleConfirmPIN();
    } else if (step === 'validate' && pin.length === 4) {
      handleValidatePIN();
    }
  }, [pin, confirmPin, step]);

  const handleConfirmPIN = async () => {
    if (pin === confirmPin) {
      const success = await createPIN(pin);
      if (success) {
        setShowBiometricPrompt(true);
      }
    } else {
      setError('Los PINs no coinciden');
      setPin('');
      setConfirmPin('');
      setStep('create');
    }
  };

  const handleValidatePIN = async () => {
    const isValid = await validatePIN(pin);
    if (!isValid) {
      setError('PIN incorrecto');
      setPin('');
    }
  };

  const handleEnableBiometric = async () => {
    try {
      const success = await enableBiometric();
      if (success) {
        setShowBiometricPrompt(false);
        sessionStorage.setItem('isUnlocked', 'true');
        window.location.reload();
      }
    } catch (error) {
      alert('Error al activar huella: ' + error.message + '\n\nPuedes activarla más tarde desde Ajustes.');
      handleSkipBiometric();
    }
  };

  const handleSkipBiometric = () => {
    setShowBiometricPrompt(false);
    sessionStorage.setItem('isUnlocked', 'true');
    window.location.reload();
  };

  const PinDots = ({ currentLength }) => (
    <div className="flex justify-center gap-4 mb-8">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full border-2 transition-all ${
            i <= currentLength
              ? 'bg-blue-600 border-blue-600'
              : 'border-gray-300'
          }`}
        />
      ))}
    </div>
  );

  const NumberPad = () => (
    <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
        <button
          key={num}
          onClick={() => handleNumberClick(num.toString())}
          className="w-20 h-20 rounded-full bg-white border-2 border-gray-200 text-2xl font-bold text-gray-800 active:scale-95 active:bg-gray-100 transition-all shadow-sm"
        >
          {num}
        </button>
      ))}
      <button
        onClick={biometricEnabled ? handleBiometricAuth : undefined}
        className={`w-20 h-20 rounded-full border-2 flex items-center justify-center ${
          biometricEnabled
            ? 'bg-blue-50 border-blue-300 text-blue-600 active:scale-95'
            : 'border-gray-100 text-gray-300'
        }`}
        disabled={!biometricEnabled}
      >
        <Fingerprint className="w-8 h-8" />
      </button>
      <button
        onClick={() => handleNumberClick('0')}
        className="w-20 h-20 rounded-full bg-white border-2 border-gray-200 text-2xl font-bold text-gray-800 active:scale-95 active:bg-gray-100 transition-all shadow-sm"
      >
        0
      </button>
      <button
        onClick={handleDelete}
        className="w-20 h-20 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-gray-600 active:scale-95 active:bg-gray-100 transition-all shadow-sm"
      >
        <Delete className="w-6 h-6" />
      </button>
    </div>
  );

  if (showBiometricPrompt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-purple-800 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Fingerprint className="w-10 h-10 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            ¿Activar Huella Digital?
          </h2>
          <p className="text-gray-600 mb-8">
            Usa tu huella digital o Face ID para acceder más rápido en el futuro
          </p>
          <div className="space-y-3">
            <button
              onClick={handleEnableBiometric}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold active:scale-98 transition-transform"
            >
              ✓ Activar Biometría
            </button>
            <button
              onClick={handleSkipBiometric}
              className="w-full py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold active:scale-98 transition-transform"
            >
              Ahora No
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-purple-800 flex items-center justify-center px-4">
      <div className="text-center w-full max-w-md">
        <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-8">
          <Lock className="w-12 h-12 text-white" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">
          {step === 'create' && 'Crea tu PIN'}
          {step === 'confirm' && 'Confirma tu PIN'}
          {step === 'validate' && 'Ingresa tu PIN'}
        </h1>

        <p className="text-white/80 mb-8">
          {step === 'create' && 'Crea un PIN de 4 dígitos para proteger tu información'}
          {step === 'confirm' && 'Ingresa el PIN nuevamente'}
          {step === 'validate' && 'Desbloquea para continuar'}
        </p>

        <PinDots currentLength={step === 'confirm' ? confirmPin.length : pin.length} />

        {biometricError && (
          <div className="mb-6 px-6 py-3 bg-red-500/90 backdrop-blur-sm border border-red-300 rounded-xl mx-auto max-w-sm">
            <p className="text-white font-medium text-sm">{biometricError}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 px-6 py-3 bg-red-500/20 backdrop-blur-sm border border-red-300 rounded-xl mx-auto max-w-sm">
            <p className="text-white font-medium">{error}</p>
          </div>
        )}

        <NumberPad />
      </div>
    </div>
  );
}