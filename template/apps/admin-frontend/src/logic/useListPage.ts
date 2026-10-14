import { useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";

const SEARCH_DEBOUNCE_MS = 300;

export interface ListPageQuery {
  q?: string;
  limit: number;
  cursor?: string;
  withTotal: true;
}

export interface ListPageState {
  search: string;
  setSearch: (search: string) => void;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  // The page and search as a list endpoint's query; spread the screen's own
  // filters into it, and key the react-query cache by the result.
  query: ListPageQuery;
}

// Page, page size and a debounced search box for a paged list. Changing the
// search or the page size goes back to the first page.
export function useListPage(initialPageSize = 25): ListPageState {
  const [search, setSearchState] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [debouncedSearch] = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  return {
    search,
    setSearch: (value) => {
      setSearchState(value);
      setPage(1);
    },
    page,
    setPage,
    pageSize,
    setPageSize: (size) => {
      setPageSizeState(size);
      setPage(1);
    },
    query: {
      q: debouncedSearch.trim() || undefined,
      limit: pageSize,
      cursor: page > 1 ? String((page - 1) * pageSize) : undefined,
      withTotal: true,
    },
  };
}
