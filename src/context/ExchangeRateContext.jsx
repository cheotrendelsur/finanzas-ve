import { createContext, useContext } from 'react';
import { supabase } from '../supabaseClient';

const ExchangeRateContext = createContext();

export const ExchangeRateProvider = ({ children }) => {
  
  // Búsqueda recursiva inteligente de tasa
  const getExchangeRate = async (fecha) => {
    try {
      const targetDate = new Date(fecha);
      let searchDate = new Date(targetDate);
      let attempts = 0;
      const maxAttempts = 30; // Buscar hasta 30 días atrás

      // Búsqueda recursiva hacia atrás
      while (attempts < maxAttempts) {
        const dateStr = searchDate.toISOString().split('T')[0];
        
        const { data, error } = await supabase
          .from('tasas_cambio')
          .select('valor, fecha')
          .eq('fecha', dateStr)
          .single();

        if (!error && data) {
          return {
            valor: parseFloat(data.valor),
            fecha: data.fecha,
            isExact: attempts === 0
          };
        }

        // Retroceder un día
        searchDate.setDate(searchDate.getDate() - 1);
        attempts++;
      }

      // Fallback: Buscar la tasa más cercana
      const { data: closestRate } = await supabase
        .from('tasas_cambio')
        .select('valor, fecha')
        .order('fecha', { ascending: false })
        .limit(1)
        .single();

      if (closestRate) {
        return {
          valor: parseFloat(closestRate.valor),
          fecha: closestRate.fecha,
          isExact: false,
          isFallback: true
        };
      }

      // Última opción: valor por defecto
      return {
        valor: 587.89,
        fecha: fecha,
        isExact: false,
        isFallback: true,
        isDefault: true
      };

    } catch (error) {
      console.error('Error en getExchangeRate:', error);
      return { valor: 587.89, fecha, isExact: false, isDefault: true };
    }
  };

  // Obtener la tasa más reciente del sistema
  const getLatestRate = async () => {
    try {
      const { data, error } = await supabase
        .from('tasas_cambio')
        .select('valor, fecha')
        .order('fecha', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return { valor: 587.89, fecha: new Date().toISOString().split('T')[0] };
      }

      return {
        valor: parseFloat(data.valor),
        fecha: data.fecha
      };
    } catch (error) {
      console.error('Error en getLatestRate:', error);
      return { valor: 587.89, fecha: new Date().toISOString().split('T')[0] };
    }
  };

  // Convertir VES a USD usando tasa específica
  const convertToUSD = async (montoVES, fecha) => {
    const rate = await getExchangeRate(fecha);
    return {
      montoUSD: parseFloat(montoVES) / rate.valor,
      tasa: rate.valor,
      fechaTasa: rate.fecha,
      isExact: rate.isExact
    };
  };

  return (
    <ExchangeRateContext.Provider value={{ 
      getExchangeRate, 
      getLatestRate, 
      convertToUSD 
    }}>
      {children}
    </ExchangeRateContext.Provider>
  );
};

export const useExchangeRate = () => {
  const context = useContext(ExchangeRateContext);
  if (!context) {
    throw new Error('useExchangeRate must be used within ExchangeRateProvider');
  }
  return context;
};