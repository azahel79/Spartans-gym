import { useMemo, useState } from 'react';

interface FilterOptions<T, F extends Record<string, unknown>> {
  items: T[];
  itemsPerPage?: number;
  filterFn: (item: T, filters: F) => boolean;
}

export function useFilteredData<T, F extends Record<string, unknown> = Record<string, unknown>>({
  items,
  itemsPerPage = 10,
  filterFn,
}: FilterOptions<T, F>) {
  const [filters, setFilters] = useState<F>({} as F);
  const [currentPage, setCurrentPage] = useState(1);
  const filteredItems = useMemo(() => items.filter((item) => filterFn(item, filters)), [items, filters, filterFn]);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);
  const resetPage = () => setCurrentPage(1);
  const updateFilters = (newFilters: Partial<F>) => {
    setFilters((previous) => ({ ...previous, ...newFilters }));
    resetPage();
  };
  return { filteredItems, paginatedItems, currentPage, totalPages, filters, setCurrentPage, updateFilters, resetPage };
}
