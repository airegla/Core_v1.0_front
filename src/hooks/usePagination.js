// ARCHIVO: usePagination.js
// RUTA: frontend/src/hooks/usePagination.js
// DESCRIPCIÓN: Hook de paginación + búsqueda en memoria para tablas.

import { useState, useMemo } from 'react';

export const usePagination = (items = [], getSearchText, pageSize = 10) => {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(item => {
      const text = getSearchText ? getSearchText(item) : JSON.stringify(item);
      return String(text || '').toLowerCase().includes(q);
    });
  }, [items, query, getSearchText]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return { query, setQuery, page: currentPage, setPage, totalPages, pageItems, filtered };
};

export default usePagination;
