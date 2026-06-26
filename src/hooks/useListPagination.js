import { useState, useMemo } from 'react'

export default function useListPagination(records, initialPageSize = 10) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  const totalPages = Math.max(1, Math.ceil(records.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const pagedRecords = useMemo(
    () => records.slice((safePage - 1) * pageSize, safePage * pageSize),
    [records, safePage, pageSize]
  )

  const handlePageSizeChange = (size) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  return {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize: handlePageSizeChange,
    totalPages,
    safePage,
    pagedRecords,
  }
}
