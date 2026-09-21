// BookOS - VentasPeriodoPage.jsx
// ruta: bookos/frontend/src/pages/VentasPeriodoPage.jsx
// descripcion: listado de ventas por periodo (el dia o un rango) con subtotales,
//   filtro por tipo, paginado server-side y descarga CSV. Equivale a los
//   "listados de la venta del dia y por periodo" del sistema legacy.
//   Se puede EMBEBER en un modal (prop `embebido`): en ese caso no repite el titulo ni la marca de
//   debug, porque el modal ya los pone (Caja > Ventas del periodo).

import { useEffect, useState } from 'react';
import Table from '../ui/Table';
import Paginador from '../ui/Paginador';
import DebugTag from '../ui/DebugTag';
import { ventasApi } from '../api/api';
import { descargarCsv } from '../utils/exportar';

const TIPOS = ['', 'FACTURA_B', 'FACTURA_C', 'PEDIDO', 'PRESUPUESTO', 'GIFTCARD'];
const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;
const aISO = (d) => d.toISOString().slice(0, 10);
const hoy = () => aISO(new Date());
const haceDias = (d) => aISO(new Date(Date.now() - d * 24 * 60 * 60 * 1000));

export default function VentasPeriodoPage({ embebido = false }) {
  const [desde, setDesde] = useState(hoy());
  const [hasta, setHasta] = useState(hoy());
  const [tipo, setTipo] = useState('');
  const [page, setPage] = useState(1);
  const [filas, setFilas] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  const cargar = async (p = page) => {
    try {
      const res = await ventasApi.listar({
        page: p,
        limit: 50,
        desde: desde || undefined,
        hasta: hasta || undefined,
        tipo: tipo || undefined,
      });
      setFilas(res.data || []);
      setTotal(res.pagination ? res.pagination.total : (res.data || []).length);
      setError('');
    } catch (err) { setError(err.message); }
  };

  useEffect(() => { cargar(page); }, [page, desde, hasta, tipo]); // eslint-disable-line

  const subtotalPagina = filas.reduce((a, v) => a + Number(v.total || 0), 0);

  const columnas = [
    { clave: 'id', titulo: 'ID' },
    { clave: 'fechaEmision', titulo: 'Fecha', render: (v) => new Date(v.fechaEmision || v.createdAt).toLocaleString('es-AR') },
    { clave: 'tipoComprobante', titulo: 'Tipo', render: (v) => v.tipoComprobante || v.tipo },
    { clave: 'numeroComprobante', titulo: 'Nro', render: (v) => v.numeroComprobante || '—' },
    { clave: 'cliente', titulo: 'Cliente', render: (v) => (v.cliente ? v.cliente.nombre : 'Consumidor final') },
    { clave: 'items', titulo: 'Items', render: (v) => (v.items ? v.items.length : '—') },
    { clave: 'total', titulo: 'Total', render: (v) => fmt(v.total), valorExport: (v) => Number(v.total) },
    { clave: 'estado', titulo: 'Estado' },
  ];

  const exportar = () => {
    const cols = columnas.filter((c) => c.clave !== 'items');
    descargarCsv(
      `ventas_${desde}_${hasta}`,
      cols.map((c) => ({ titulo: c.titulo, clave: c.clave })),
      filas.map((f) => {
        const o = {};
        for (const c of cols) o[c.clave] = c.valorExport ? c.valorExport(f) : (c.render ? c.render(f) : f[c.clave]);
        return o;
      })
    );
  };

  return (
    <div>
      {!embebido && <DebugTag nombre="VentasPeriodoPage" />}
      <div className={`flex items-center mb-4 ${embebido ? 'justify-end' : 'justify-between'}`}>
        {!embebido && <h2 className="text-lg font-semibold">Ventas del dia / periodo</h2>}
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost text-xs" onClick={() => { setDesde(hoy()); setHasta(hoy()); setPage(1); }}>Hoy</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => { setDesde(haceDias(7)); setHasta(hoy()); setPage(1); }}>Ultimos 7 dias</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => { setDesde(haceDias(30)); setHasta(hoy()); setPage(1); }}>Ultimos 30 dias</button>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <div className="flex gap-2 flex-wrap items-end">
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Desde</span>
            <input className="input-os" type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPage(1); }} />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Hasta</span>
            <input className="input-os" type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPage(1); }} />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">Tipo</span>
            <select className="input-os" value={tipo} onChange={(e) => { setTipo(e.target.value); setPage(1); }}>
              {TIPOS.map((t) => <option key={t || 'todos'} value={t}>{t || 'Todos'}</option>)}
            </select>
          </label>
          <button type="button" className="btn btn-primary" onClick={() => cargar(1)}>Filtrar</button>
        </div>
      </div>

      {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>{error}</p>}

      <Table columnas={columnas} filas={filas} vacio="Sin ventas en el periodo" exportable={false} />
      <div className="flex justify-between items-center mt-2 flex-wrap gap-2">
        <span className="text-sm text-muted">
          {total.toLocaleString('es-AR')} comprobantes en el periodo · subtotal de esta pagina: <strong>{fmt(subtotalPagina)}</strong>
        </span>
        <button type="button" className="btn btn-ghost text-xs" onClick={exportar} disabled={!filas.length}>Exportar CSV</button>
      </div>
      <Paginador page={page} total={total} limite={50} onCambiar={setPage} etiqueta="ventas del periodo" />
    </div>
  );
}
