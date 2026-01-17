import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 1. Mensaje de inicio
console.log('🚀 [DEBUG] El script main.jsx ha comenzado a ejecutarse');

try {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    throw new Error("❌ NO SE ENCONTRÓ EL DIV 'root' en el HTML");
  }

  console.log('✅ [DEBUG] Elemento root encontrado, creando React Root...');

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  console.log('✨ [DEBUG] Render inicial completado sin errores inmediatos');

} catch (error) {
  console.error('☠️ [FATAL ERROR] La aplicación explotó al iniciar:', error);
  // Esto escribirá el error en la pantalla blanca para que lo veas
  document.body.innerHTML = `<div style="color: red; padding: 20px; font-size: 20px;">
    <h1>Error Fatal detectado:</h1>
    <pre>${error.message}</pre>
    <p>Abre la consola (F12) para más detalles.</p>
  </div>`;
}