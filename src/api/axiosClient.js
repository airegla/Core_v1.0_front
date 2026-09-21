// BookOS - axiosClient.js
// ruta: bookos/frontend/src/api/axiosClient.js
// descripcion: cliente HTTP unico del OS. Inyecta el JWT y desempaqueta el
//   envelope {success, message, data}. En 401 limpia sesion.

import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 120000,
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('bookos_token');
  if (token && token !== 'null' && token !== 'undefined') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response && err.response.status === 401 && !err.config.url.includes('/auth/login')) {
      localStorage.removeItem('bookos_token');
      window.location.reload();
    }
    const message = err.response && err.response.data && err.response.data.message
      ? err.response.data.message
      : err.message;
    // El STATUS viaja con el error (antes se perdia: solo quedaba el texto y ningun llamador podia
    // distinguir un 404 "ya no existe" de una caida de red). Un solo lugar decide esto, no cada page.
    const fallo = new Error(message);
    fallo.status = err.response ? err.response.status : null;
    return Promise.reject(fallo);
  }
);

export default axiosClient;
