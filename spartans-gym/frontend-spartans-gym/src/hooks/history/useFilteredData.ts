// hooks/useFilteredData.ts
import { useMemo, useState } from 'react';

interface FilterOptions<T> {
  items: T[];
  itemsPerPage?: number;
  filterFn: (item: T, filters: Record<string, any>) => boolean;
}

export function useFilteredData<T>({ items, itemsPerPage = 10, filterFn }: FilterOptions<T>) {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [currentPage, setCurrentPage] = useState(1);

  const filteredItems = useMemo(() => {
    return items.filter(item => filterFn(item, filters));
  }, [items, filters, filterFn]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const resetPage = () => setCurrentPage(1);
  const updateFilters = (newFilters: Record<string, any>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    resetPage();
  };

  return {
    filteredItems,
    paginatedItems,
    currentPage,
    totalPages,
    filters,
    setCurrentPage,
    updateFilters,
    resetPage
  };
}