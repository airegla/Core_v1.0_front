// BookOS - formasPago.js
// ruta: bookos/frontend/src/utils/formasPago.js
// descripcion: costo estimado de una sub-forma de pago (coeficiente del comercio + porcentaje del
//   operador) y su etiqueta legible. Espejo de backend/src/utils/formasPago.helper.js: el mostrador
//   ve lo que absorbe ANTES de cobrar, el backend guarda el mismo numero como snapshot.

// costo = monto x (coeficiente - 1) + monto x (% del operador / 100)
export function costoEstimadoDeForma(forma, monto) {
  if (!forma) return 0;
  const m = Number(monto) || 0;
  const coef = Number(forma.coeficiente) || 1;
  const porcentaje = Number(forma.operador?.porcentajeCostoEstimado) || 0;
  return Math.round((m * (coef - 1) + m * (porcentaje / 100)) * 100) / 100;
}

export function etiquetaForma(forma) {
  if (!forma) return '';
  const partes = [forma.nombre];
  if (forma.subtipo) partes.push(forma.subtipo);
  if (forma.cuotas) partes.push(`${forma.cuotas} cuotas`);
  if (Number(forma.coeficiente) !== 1) partes.push(`x${forma.coeficiente}`);
  return partes.join(' · ');
}

// Sub-formas que corresponden al metodo de pago elegido (por nombre: es lo que viaja en el cobro).
export function formasDelMetodo(formas, nombreMetodo) {
  const n = String(nombreMetodo || '').trim().toUpperCase();
  return (formas || []).filter((f) => f.activo && String(f.metodoPago?.nombre || '').toUpperCase() === n);
}
