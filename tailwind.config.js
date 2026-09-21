// BookOS - tailwind.config.js
// ruta: bookos/frontend/tailwind.config.js
// descripcion: configuracion Tailwind del OS (base de Meta, adaptada). Los colores
//   referencian las variables definidas en src/styles/globals.css (un solo lugar
//   para modificar toda la identidad visual).

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        card: 'var(--card)',
        primary: 'var(--primary)',
        border: 'var(--border)',
        muted: 'var(--muted)',
      },
      borderRadius: {
        os: 'var(--radius)',
      },
    },
  },
  plugins: [],
};
