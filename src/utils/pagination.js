export function normalizePage(response, fallbackSize = 10) {
  const raw = response?.data ?? response ?? {};

  if (Array.isArray(raw)) {
    return {
      content: raw,
      page: 0,
      size: raw.length || fallbackSize,
      numberOfElements: raw.length,
      totalElements: raw.length,
      totalPages: raw.length ? 1 : 0,
      first: true,
      last: true,
      empty: raw.length === 0,
    };
  }

  const content = Array.isArray(raw.content) ? raw.content : [];
  const page = Number(raw.page ?? raw.number ?? 0);
  const size = Number(raw.size ?? fallbackSize);
  const totalElements = Number(raw.totalElements ?? content.length);
  const totalPages = Number(raw.totalPages ?? (totalElements ? Math.ceil(totalElements / Math.max(size, 1)) : 0));

  return {
    content,
    page: Number.isFinite(page) ? page : 0,
    size: Number.isFinite(size) && size > 0 ? size : fallbackSize,
    numberOfElements: Number(raw.numberOfElements ?? content.length),
    totalElements: Number.isFinite(totalElements) ? totalElements : content.length,
    totalPages: Number.isFinite(totalPages) ? totalPages : 0,
    first: raw.first ?? page <= 0,
    last: raw.last ?? (totalPages === 0 || page >= totalPages - 1),
    empty: raw.empty ?? content.length === 0,
  };
}

export function paginationItems(currentPage, totalPages, maxVisible = 5) {
  if (totalPages <= 0) return [];
  const visible = Math.min(maxVisible, totalPages);
  let start = Math.max(0, currentPage - Math.floor(visible / 2));
  start = Math.min(start, totalPages - visible);
  return Array.from({ length: visible }, (_, index) => start + index);
}

export function pageDisplayRange(page, size, numberOfElements, totalElements) {
  if (!totalElements || !numberOfElements) return { from: 0, to: 0 };
  const from = page * size + 1;
  return { from, to: from + numberOfElements - 1 };
}
