"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronDown, Search, Upload, Filter, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"


import { FileTableRow } from "./columns"

interface FilesDataTableProps {
  columns: ColumnDef<FileTableRow>[]
  data: FileTableRow[]
  onUpload?: () => void
  isLoading?: boolean
}

export function FilesDataTable({
  columns,
  data,
  onUpload,
  isLoading = false
}: FilesDataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [searchInput, setSearchInput] = React.useState("")

  // Debounce search typing to reduce re-renders and heavy filtering
  React.useEffect(() => {
    const id = setTimeout(() => {
      setGlobalFilter(searchInput)
    }, 250)
    return () => clearTimeout(id)
  }, [searchInput])

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  const selectedCount = table.getFilteredSelectedRowModel().rows.length
  const totalCount = table.getFilteredRowModel().rows.length

  const activeStatusFilters = (table.getColumn("status")?.getFilterValue() as string[]) || []

  const resetFilters = React.useCallback(() => {
    setGlobalFilter("")
    setSearchInput("")
    setSorting([])
    table.getColumn("status")?.setFilterValue(undefined)
  }, [table])

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = { completed: 0, processing: 0, queued: 0, failed: 0 }
    for (const row of data as unknown as Array<{ status?: string }>) {
      const s = (row.status || '').toLowerCase()
      if (counts[s] !== undefined) counts[s] += 1
    }
    return counts
  }, [data])

  const toggleStatus = (status: string) => {
    const column = table.getColumn('status')
    const current = (column?.getFilterValue() as string[]) || []
    if (current.includes(status)) {
      column?.setFilterValue(current.filter(v => v !== status))
    } else {
      column?.setFilterValue([...current, status])
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Files</h3>
          <p className="text-sm text-muted-foreground">
            {totalCount} file{totalCount !== 1 ? 's' : ''} total
            {selectedCount > 0 && ` • ${selectedCount} selected`}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search files..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Status
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {['completed', 'processing', 'queued', 'failed'].map((status) => {
                  const isChecked = (table.getColumn("status")?.getFilterValue() as string[])?.includes(status)
                  return (
                    <DropdownMenuCheckboxItem
                      key={status}
                      className="capitalize"
                      checked={isChecked}
                      onCheckedChange={(value) => {
                        const column = table.getColumn("status")
                        const currentFilter = column?.getFilterValue() as string[] || []
                        if (value) {
                          column?.setFilterValue([...currentFilter, status])
                        } else {
                          column?.setFilterValue(currentFilter.filter(f => f !== status))
                        }
                      }}
                    >
                      {status}
                    </DropdownMenuCheckboxItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Clear filters */}
            {(activeStatusFilters.length > 0 || globalFilter) && (
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Reset
              </Button>
            )}

          </div>
        </div>

        {/* Active filters chips */}
        {(activeStatusFilters.length > 0 || globalFilter) && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {globalFilter && (
              <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Search: "{globalFilter}"
              </span>
            )}
            {activeStatusFilters.map((s) => (
              <button
                key={s}
                className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 transition"
                onClick={() => {
                  const column = table.getColumn('status')
                  const current = (column?.getFilterValue() as string[]) || []
                  column?.setFilterValue(current.filter(v => v !== s))
                }}
                title="Remove filter"
              >
                Status: {s} ✕
              </button>
            ))}
          </div>
        )}

        {/* Quick status filter pills */}
        <div className="flex flex-wrap items-center gap-2">
          {(['completed','processing','queued','failed'] as const).map((s) => {
            const active = activeStatusFilters.includes(s)
            const count = statusCounts[s] || 0
            return (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition ${active ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                title={`Toggle ${s}`}
              >
                <span className="capitalize">{s}</span>
                <span className={`ml-2 inline-flex items-center justify-center rounded-full px-1.5 ${active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="rounded-xl border bg-white shadow-sm overflow-auto max-h-[65vh]">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-50 hover:to-gray-100 border-b-2 border-gray-200 sticky top-0 z-10">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="font-semibold text-gray-700 text-center py-4">
                    <div className="flex items-center justify-center">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span>Loading files...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row, index) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={`hover:bg-blue-50 cursor-pointer transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className={`py-4 text-center`}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-32 text-center"
                  >
                    <div className="flex flex-col items-center justify-center space-y-4 py-8">
                      <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                        <FileText className="h-8 w-8 text-gray-400" />
                      </div>
                      <div className="text-center">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No files found</h3>
                        <p className="text-sm text-gray-500 mb-6 max-w-md">
                          Upload files or check if any filters are applied
                        </p>
                        {onUpload && (
                          <Button 
                            onClick={onUpload}
                            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload First File
                          </Button>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {table.getRowModel().rows?.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-lg border">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{" "}
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  table.getFilteredRowModel().rows.length
                )}{" "}
                of {table.getFilteredRowModel().rows.length} files
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <div className="flex items-center space-x-1">
                  <span className="text-sm">Page</span>
                  <span className="text-sm font-medium">
                    {table.getState().pagination.pageIndex + 1} of{" "}
                    {table.getPageCount()}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
