// BookOS - selectores.js
// ruta: bookos/frontend/src/utils/selectores.js
// descripcion: busquedas asincronicas para SelectBuscador (maestros grandes). Una sola fuente
//   para todas las pantallas: cada funcion devuelve [{ id, etiqueta, detalle? }] consultando el
//   endpoint con search+limit (nunca se precarga la tabla entera).

import { clientesApi, proveedoresApi, autoresApi, editorialesApi, materiasApi, catalogoApi, mayoristaApi } from '../api/api';

const LIMITE = 20;

// excluir: ids a dejar afuera (p. ej. Consumidor Final en cuenta corriente).
export async function buscarClientes(q, excluir = []) {
  const res = await clientesApi.listar({ search: q, limit: LIMITE });
  return (res.data || [])
    .filter((c) => !excluir.includes(c.id))
    .map((c) => ({ id: c.id, etiqueta: c.nombre, nombre: c.nombre, detalle: c.telefono || c.documento || '' }));
}

// Articulos para los renglones del mayorista: muestra EAN y precio de lista.
export async function buscarArticulos(q) {
  const res = await catalogoApi.listar({ search: q, limit: LIMITE });
  return (res.data || []).map((a) => {
    // El listado del catalogo devuelve `precio`; aFicha tambien expone `precioLista` en algunos flujos.
    const precio = a.precioLista != null ? Number(a.precioLista) : (a.precio != null ? Number(a.precio) : null);
    return {
      id: a.id,
      etiqueta: a.titulo,
      detalle: `${a.ean || a.barras || a.codigo || ''} · ${precio != null ? `$${precio.toLocaleString('es-AR')}` : 'sin precio'}`,
      ean13: a.ean || a.barras || a.codigo || '',
      precioLista: precio || 0,
    };
  });
}

export async function buscarProveedores(q) {
  const res = await proveedoresApi.listar({ search: q, limit: LIMITE });
  return (res.data || []).map((p) => ({ id: p.id, etiqueta: p.nombre, detalle: p.localidad || '' }));
}

export async function buscarAutores(q) {
  const res = await autoresApi.listar({ search: q, limit: LIMITE });
  return (res.data || []).map((a) => ({ id: a.id, etiqueta: a.nombre }));
}

export async function buscarEditoriales(q) {
  const res = await editorialesApi.listar({ search: q, limit: LIMITE });
  return (res.data || []).map((e) => ({ id: e.id, etiqueta: e.nombre }));
}

export async function buscarMaterias(q) {
  const res = await materiasApi.listar({ search: q, limit: LIMITE });
  return (res.data || []).map((m) => ({ id: m.id, etiqueta: m.descripcion }));
}

// Clientes mayoristas con su deposito espejo (la sabana): el conjunto es chico y viene entero
// con su descuento/plazo, asi el operario ve contra que sabila va a operar.
export async function buscarMayoristas(q) {
  const res = await mayoristaApi.clientes();
  const t = String(q || '').toLowerCase();
  return (res.data || [])
    .filter((c) => !t || String(c.nombre || '').toLowerCase().includes(t) || String(c.cuit || '').includes(t))
    .slice(0, LIMITE)
    .map((c) => ({
      id: c.id,
      etiqueta: c.nombre,
      nombre: c.nombre,
      detalle: c.deposito ? c.deposito.nombre : 'sin depósito espejo',
      descuentoFijo: c.descuentoFijo,
      diasPlazoPago: c.diasPlazoPago,
      deposito: c.deposito,
    }));
}
