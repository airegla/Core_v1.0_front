// BookOS - main.jsx
// ruta: bookos/frontend/src/main.jsx
// descripcion: punto de entrada React. Carga la hoja de estilos unica del OS.

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './AppContext';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
