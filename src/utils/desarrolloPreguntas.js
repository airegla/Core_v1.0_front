// BookOS - desarrolloPreguntas.js
// ruta: bookos/frontend/src/utils/desarrolloPreguntas.js
// descripcion: preguntas del instalador PoC. Agregar una pregunta = agregar un
//   objeto aca; el formulario se arma solo y las respuestas se guardan en
//   empresa.config. No se toca codigo core.

export default [
  {
    clave: 'nombre',
    etiqueta: 'Nombre de la empresa',
    tipo: 'texto',
    requerido: true,
  },
  {
    clave: 'pais',
    etiqueta: 'Pais',
    tipo: 'select',
    opciones: ['AR', 'ES', 'UY'],
    default: 'AR',
  },
  {
    clave: 'rubro',
    etiqueta: 'Rubro',
    tipo: 'select',
    opciones: ['libreria', 'papeleria', 'kiosco', 'otro'],
    default: 'libreria',
  },
  {
    clave: 'como_llega_stock',
    etiqueta: '¿Como te llega el stock?',
    tipo: 'textarea',
    ayuda: 'Describi proveedores, remitos, consignacion...',
  },
  {
    clave: 'como_vendes',
    etiqueta: '¿Como vendes?',
    tipo: 'textarea',
    ayuda: 'Mostrador, mayorista, online...',
  },
];
