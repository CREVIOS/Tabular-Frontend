"use client"

import * as React from "react"
import * as XLSX from 'xlsx'
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
import { ChevronDown, Search, Plus, Play, Settings2, Download } from "lucide-react"

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
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ReviewTableRow } from "./columns"

// Import modal components
import AddFilesModal from "@/app/review/[id]/AddFilesModal"
import AddColumnModal from "@/app/review/[id]/AddColumnModal"

// Add export modal import and Dialog components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

// File item interface for the modals
interface FileItem {
  id: string
  original_filename: string
  file_size: number | null
  status: string | null
  folder_id: string | null
  created_at: string | null
  folder?: {
    name: string
  }
}

interface DataTableProps {
  columns: ColumnDef<ReviewTableRow>[]
  data: ReviewTableRow[]
  reviewName: string
  reviewStatus: string
  reviewId: string
  onStartAnalysis?: () => void
  onFilesAdded?: () => void
  onColumnAdded?: () => void
  totalFiles: number
  completionPercentage: number
  reviewColumns?: Array<{ id: string; column_name: string; prompt: string; data_type: string }>
  existingFiles?: FileItem[]
  existingFileIds?: string[]
  isMobile?: boolean
}

interface ColumnMeta {
  isSticky?: boolean;
}

// Helper function to truncate text to max words
function truncateToWords(text: string, maxWords: number = 4): string {
  const words = text.split(' ')
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ') + '...'
}

// Helper function to get display name for columns
function getColumnDisplayName(columnId: string, reviewColumns?: Array<{ id: string; column_name: string; prompt: string; data_type: string }>): string {
  if (columnId === "fileName") return "Document"
  if (columnId === "actions") return "Actions"
  
  const reviewColumn = reviewColumns?.find(rc => rc.id === columnId)
  if (reviewColumn) {
    return truncateToWords(reviewColumn.column_name)
  }
  
  return truncateToWords(columnId)
}

export function DataTable({
  columns,
  data,
  reviewName,
  reviewStatus,
  reviewId,
  onStartAnalysis,
  onFilesAdded,
  onColumnAdded,
  totalFiles,
  completionPercentage,
  reviewColumns,
  existingFiles = [],
  existingFileIds = [],
}: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [tableData, setTableData] = React.useState(data)
  const [draggedRow, setDraggedRow] = React.useState<number | null>(null)
  
  // Modal state management
  const [showAddFilesModal, setShowAddFilesModal] = React.useState(false)
  const [showAddColumnModal, setShowAddColumnModal] = React.useState(false)
  const [showExportModal, setShowExportModal] = React.useState(false)
  
  // Export customization state
  const [exportConfig, setExportConfig] = React.useState({
    selectedColumns: reviewColumns?.map(col => col.id) || [],
    answerType: 'short' as 'short' | 'long' | 'both',
    includeConfidence: true,
    includeSource: false
  })

  // Update table data when prop changes
  React.useEffect(() => {
    setTableData(data)
  }, [data])

  const table = useReactTable({
    data: tableData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) => {
      const fileName = row.original.fileName.toLowerCase()
      const searchValue = filterValue.toLowerCase()
      
      if (fileName.includes(searchValue)) return true
      
      const results = row.original.results
      return Object.values(results).some(result => 
        result?.extracted_value?.toLowerCase().includes(searchValue)
      )
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  // Drag and Drop handlers
  const handleDragStart = React.useCallback((e: React.DragEvent, rowIndex: number) => {
    setDraggedRow(rowIndex)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = React.useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    
    if (draggedRow === null || draggedRow === dropIndex) return
    
    const newData = [...tableData]
    const draggedItem = newData[draggedRow]
    
    // Remove dragged item
    newData.splice(draggedRow, 1)
    
    // Insert at new position
    newData.splice(dropIndex, 0, draggedItem)
    
    setTableData(newData)
    setDraggedRow(null)
  }, [draggedRow, tableData])

  const handleDragEnd = React.useCallback(() => {
    setDraggedRow(null)
  }, [])

  // Modal handlers
  const handleAddFiles = React.useCallback(() => {
    setShowAddFilesModal(true)
  }, [])

  const handleAddColumn = React.useCallback(() => {
    setShowAddColumnModal(true)
  }, [])

  const handleFilesModalClose = React.useCallback(() => {
    setShowAddFilesModal(false)
  }, [])

  const handleColumnModalClose = React.useCallback(() => {
    setShowAddColumnModal(false)
  }, [])

  const handleFilesAdded = React.useCallback(() => {
    setShowAddFilesModal(false)
    if (onFilesAdded) onFilesAdded()
  }, [onFilesAdded])

  const handleColumnAdded = React.useCallback(() => {
    setShowAddColumnModal(false)
    if (onColumnAdded) onColumnAdded()
  }, [onColumnAdded])

  // Export modal handlers
  const handleShowExportModal = React.useCallback(() => {
    // Initialize with all available columns selected
    setExportConfig(prev => ({
      ...prev,
      selectedColumns: reviewColumns?.map(col => col.id) || []
    }))
    setShowExportModal(true)
  }, [reviewColumns])

  const handleExportModalClose = React.useCallback(() => {
    setShowExportModal(false)
  }, [])

  const handleColumnToggle = React.useCallback((columnId: string, checked: boolean) => {
    setExportConfig(prev => ({
      ...prev,
      selectedColumns: checked 
        ? [...prev.selectedColumns, columnId]
        : prev.selectedColumns.filter(id => id !== columnId)
    }))
  }, [])

  const handleSelectAllColumns = React.useCallback(() => {
    setExportConfig(prev => ({
      ...prev,
      selectedColumns: reviewColumns?.map(col => col.id) || []
    }))
  }, [reviewColumns])

  const handleDeselectAllColumns = React.useCallback(() => {
    setExportConfig(prev => ({
      ...prev,
      selectedColumns: []
    }))
  }, [])

  const executeExport = React.useCallback(() => {
    try {
      const filteredData = table.getFilteredRowModel().rows.map(row => row.original)
      const wb = XLSX.utils.book_new()
      const exportData: (string | number | null)[][] = []
      
      // Build headers based on configuration
      const headers = ['Document']
      const selectedReviewColumns = reviewColumns?.filter(col => 
        exportConfig.selectedColumns.includes(col.id)
      ) || []
      
      selectedReviewColumns.forEach(column => {
        if (exportConfig.answerType === 'both') {
          headers.push(`${column.column_name} (Short)`)
          headers.push(`${column.column_name} (Long)`)
          if (exportConfig.includeConfidence) {
            headers.push(`${column.column_name} (Confidence)`)
          }
          if (exportConfig.includeSource) {
            headers.push(`${column.column_name} (Source)`)
          }
        } else {
          const suffix = exportConfig.answerType === 'long' ? ' (Long)' : ''
          headers.push(`${column.column_name}${suffix}`)
          if (exportConfig.includeConfidence) {
            headers.push(`${column.column_name} (Confidence)`)
          }
          if (exportConfig.includeSource) {
            headers.push(`${column.column_name} (Source)`)
          }
        }
      })
      
      exportData.push(headers)
      
      // Build rows based on configuration
      filteredData.forEach(row => {
        const exportRow: (string | number | null)[] = [row.fileName]
        
        selectedReviewColumns.forEach(column => {
          const result = row.results[column.id]
          
          if (exportConfig.answerType === 'both') {
            // Short answer
            exportRow.push(result?.extracted_value || '')
            // Long answer  
            exportRow.push(result?.long || '')
            
            if (exportConfig.includeConfidence) {
              const confidence = result?.confidence_score ? Math.round(result.confidence_score * 100) : 0
              exportRow.push(confidence)
            }
            if (exportConfig.includeSource) {
              exportRow.push(result?.source_reference || '')
            }
          } else {
            // Single answer type
            const value = exportConfig.answerType === 'long' 
              ? (result?.long || '') 
              : (result?.extracted_value || '')
            exportRow.push(value)
            
            if (exportConfig.includeConfidence) {
              const confidence = result?.confidence_score ? Math.round(result.confidence_score * 100) : 0
              exportRow.push(confidence)
            }
            if (exportConfig.includeSource) {
              exportRow.push(result?.source_reference || '')
            }
          }
        })
        
        exportData.push(exportRow)
      })
      
      const ws = XLSX.utils.aoa_to_sheet(exportData)
      
      // Set column widths
      const colWidths = headers.map((header: string, index: number) => {
        if (index === 0) return { wch: 35 } // Document column
        
        let maxWidth = header.length
        exportData.slice(1, 6).forEach(row => {
          if (row[index] && typeof row[index] === 'string') {
            maxWidth = Math.max(maxWidth, row[index].length)
          }
        })
        
        return { wch: Math.min(Math.max(maxWidth + 2, 15), 50) }
      })
      ws['!cols'] = colWidths
      
      XLSX.utils.book_append_sheet(wb, ws, 'Review Data')
      
      // Create metadata sheet
      const metaData = [
        ['Export Configuration', ''],
        ['Review Name', reviewName],
        ['Status', reviewStatus],
        ['Answer Type', exportConfig.answerType === 'both' ? 'Short & Long' : 
                     exportConfig.answerType === 'long' ? 'Long Answer' : 'Short Answer'],
        ['Include Confidence', exportConfig.includeConfidence ? 'Yes' : 'No'],
        ['Include Source', exportConfig.includeSource ? 'Yes' : 'No'],
        ['Total Files', totalFiles.toString()],
        ['Selected Columns', exportConfig.selectedColumns.length.toString()],
        ['Completion', `${completionPercentage}%`],
        ['Export Date', new Date().toLocaleString()],
        ['Exported Records', filteredData.length.toString()],
        [''],
        ['Column Definitions', '']
      ]
      
      if (selectedReviewColumns.length > 0) {
        metaData.push(['Column Name', 'Prompt', 'Data Type'])
        selectedReviewColumns.forEach(col => {
          metaData.push([col.column_name, col.prompt, col.data_type])
        })
      }
      
      const metaWs = XLSX.utils.aoa_to_sheet(metaData)
      metaWs['!cols'] = [{ wch: 20 }, { wch: 50 }]
      XLSX.utils.book_append_sheet(wb, metaWs, 'Export Info')
      
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const sanitizedName = reviewName.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_')
      const answerTypeSuffix = exportConfig.answerType === 'both' ? '_complete' : 
                             exportConfig.answerType === 'long' ? '_detailed' : '_summary'
      const filename = `${sanitizedName}${answerTypeSuffix}_${timestamp}.xlsx`
      
      XLSX.writeFile(wb, filename)
      
      console.log(`Excel file exported: ${filename}`)
      setShowExportModal(false)
      
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Failed to export data to Excel. Please try again.')
    }
  }, [table, reviewColumns, reviewName, reviewStatus, totalFiles, completionPercentage, exportConfig])

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">{reviewName}</h2>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <div className="flex items-center space-x-1">
              <span className="font-medium text-gray-900">{totalFiles}</span>
              <span>documents</span>
            </div>
          </div>
        </div>
      </div>

      {reviewStatus === 'processing' && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-blue-700 font-medium">Processing Analysis</span>
                </div>
                <span className="text-blue-700 font-semibold">{Math.round(completionPercentage)}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${Math.round(completionPercentage)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between space-x-4">
        <div className="flex flex-1 items-center space-x-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search documents and results..."
              value={globalFilter ?? ""}
              onChange={(event) => setGlobalFilter(String(event.target.value))}
              className="pl-9 h-9 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          {globalFilter && (
            <Badge variant="secondary" className="text-xs">
              {table.getFilteredRowModel().rows.length} results
            </Badge>
          )}
        </div>
        
        {/* Right side controls - properly arranged */}
        <div className="flex items-center space-x-2">
          {/* Action buttons */}
          <Button variant="outline" size="sm" onClick={handleAddFiles} className="h-9">
            <Plus className="mr-2 h-4 w-4" />
            Add Documents
          </Button>
          <Button variant="outline" size="sm" onClick={handleAddColumn} className="h-9">
            <Plus className="mr-2 h-4 w-4" />
            Add Column
          </Button>
          {onStartAnalysis && reviewStatus !== 'processing' && (
            <Button size="sm" onClick={onStartAnalysis} className="h-9">
              <Play className="mr-2 h-4 w-4" />
              {reviewStatus === 'completed' ? 'Re-analyze' : 'Start Analysis'}
            </Button>
          )}
          
          {/* Export button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleShowExportModal}
            className="h-9"
            title="Customize and export table data"
          >
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
          
          {/* View options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Settings2 className="mr-2 h-4 w-4" />
                View Options
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                Toggle Columns
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  const displayName = getColumnDisplayName(column.id, reviewColumns)
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize text-sm"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {displayName}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-0">
          <div className="table-container custom-scrollbar">
            <Table className="w-full border-collapse">
              <TableHeader className="bg-gray-50/80 sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="border-b border-gray-200 hover:bg-transparent">
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead 
                          key={header.id} 
                          style={{ 
                            width: header.getSize(),
                            minWidth: header.column.columnDef.minSize || 'auto'
                          }}
                          className={`h-auto px-4 py-3 text-center font-semibold text-gray-900 border-r border-gray-200 last:border-r-0 bg-gray-50/80 backdrop-blur-sm ${
                            (header.column.columnDef.meta as ColumnMeta)?.isSticky 
                              ? 'sticky-column-header' 
                              : ''
                          }`}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="bg-white">
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row, index) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                      } ${draggedRow === index ? 'opacity-50' : ''}`}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell 
                          key={cell.id} 
                          style={{ 
                            width: cell.column.getSize(),
                            minWidth: cell.column.columnDef.minSize || 'auto',
                            maxWidth: cell.column.getSize()
                          }}
                          className={`px-3 py-4 align-top text-center border-r border-gray-100 last:border-r-0 overflow-hidden ${
                            (cell.column.columnDef.meta as ColumnMeta)?.isSticky 
                              ? 'sticky-column-cell' 
                              : ''
                          }`}
                        >
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
                      <div className="flex flex-col items-center space-y-2">
                        <div className="text-muted-foreground">No results found.</div>
                        {globalFilter && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setGlobalFilter("")}
                          >
                            Clear search
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between space-x-4 py-4">
        <div className="flex flex-1 text-sm text-muted-foreground">
          <span>
            Showing {table.getFilteredRowModel().rows.length > 0 ? 
              ((table.getState().pagination.pageIndex) * table.getState().pagination.pageSize) + 1 : 0
            } to {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )} of {table.getFilteredRowModel().rows.length} entries
            {table.getFilteredRowModel().rows.length !== table.getCoreRowModel().rows.length && 
              ` (filtered from ${table.getCoreRowModel().rows.length} total)`
            }
          </span>
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value))
              }}
              className="h-8 w-[70px] rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 20, 30, 50].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-[120px] items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount() || 1}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-8"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-8"
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Integrated Modals */}
      <AddFilesModal
        isOpen={showAddFilesModal}
        onClose={handleFilesModalClose}
        reviewId={reviewId}
        existingFileIds={existingFileIds}
        existingFiles={existingFiles}
        onFilesAdded={handleFilesAdded}
      />
      
      <AddColumnModal
        isOpen={showAddColumnModal}
        onClose={handleColumnModalClose}
        reviewId={reviewId}
        existingColumns={reviewColumns?.map(col => col.column_name) || []}
        onColumnAdded={handleColumnAdded}
      />

      {/* Export Customization Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customize Export</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Answer Type Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Answer Type</Label>
              <RadioGroup 
                value={exportConfig.answerType} 
                onValueChange={(value: 'short' | 'long' | 'both') => 
                  setExportConfig(prev => ({ ...prev, answerType: value }))
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="short" id="short" />
                  <Label htmlFor="short">Short Answer Only</Label>
                  <span className="text-sm text-gray-500">(Quick extracted values)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="long" id="long" />
                  <Label htmlFor="long">Long Answer Only</Label>
                  <span className="text-sm text-gray-500">(Detailed explanations)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="both" id="both" />
                  <Label htmlFor="both">Both Short & Long</Label>
                  <span className="text-sm text-gray-500">(Complete data set)</span>
                </div>
              </RadioGroup>
            </div>

            {/* Additional Options */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Additional Data</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="confidence"
                    checked={exportConfig.includeConfidence}
                    onCheckedChange={(checked) => 
                      setExportConfig(prev => ({ ...prev, includeConfidence: checked as boolean }))
                    }
                  />
                  <Label htmlFor="confidence">Include Confidence Scores</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="source"
                    checked={exportConfig.includeSource}
                    onCheckedChange={(checked) => 
                      setExportConfig(prev => ({ ...prev, includeSource: checked as boolean }))
                    }
                  />
                  <Label htmlFor="source">Include Source References</Label>
                </div>
              </div>
            </div>

            {/* Column Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Columns to Export</Label>
                <div className="space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSelectAllColumns}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleDeselectAllColumns}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                {reviewColumns?.map(column => (
                  <div key={column.id} className="flex items-start space-x-2">
                    <Checkbox
                      id={`col-${column.id}`}
                      checked={exportConfig.selectedColumns.includes(column.id)}
                      onCheckedChange={(checked) => 
                        handleColumnToggle(column.id, checked as boolean)
                      }
                    />
                    <div className="flex-1">
                      <Label 
                        htmlFor={`col-${column.id}`}
                        className="font-medium cursor-pointer"
                      >
                        {column.column_name}
                      </Label>
                      <p className="text-xs text-gray-500 mt-1">
                        {column.prompt.slice(0, 100)}
                        {column.prompt.length > 100 ? '...' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Export Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Export Summary</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <p>• {exportConfig.selectedColumns.length} column(s) selected</p>
                <p>• {totalFiles} document(s) to export</p>
                <p>• Answer type: {exportConfig.answerType === 'both' ? 'Short & Long' : 
                               exportConfig.answerType === 'long' ? 'Long Answer' : 'Short Answer'}</p>
                {exportConfig.includeConfidence && <p>• Confidence scores included</p>}
                {exportConfig.includeSource && <p>• Source references included</p>}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={handleExportModalClose}>
              Cancel
            </Button>
            <Button 
              onClick={executeExport}
              disabled={exportConfig.selectedColumns.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
