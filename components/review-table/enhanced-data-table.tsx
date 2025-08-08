"use client"

import * as React from "react"
import * as XLSX from 'xlsx-js-style'
import { useVirtualizer } from '@tanstack/react-virtual'
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
  ColumnOrderState,
} from "@tanstack/react-table"
import { 
  ChevronDown, 
  Search, 
  Plus, 
  Play, 
  Settings2, 
  Download,
  GripVertical,
  Maximize2,
  Minimize2,
  Columns3
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
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
import { cn } from "@/lib/utils"

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
import {
  TooltipProvider,
} from "@/components/ui/tooltip"

// Excel sanitization and utility functions
function sanitizeForExcel(v: unknown): string {
  const s = String(v ?? '')
  return /^[=+\-@]/.test(s) ? "'" + s : s
}

function isUrl(s: string): boolean {
  try { 
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:' 
  } catch { 
    return false 
  }
}

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
  minWidth?: number;
  maxWidth?: number;
}

// Helper function to measure text width
function measureTextWidth(text: string, font: string = '12px sans-serif'): number {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return 0
  context.font = font
  const metrics = context.measureText(text)
  return metrics.width
}

// Helper function to calculate optimal column width
function calculateOptimalWidth(
  columnName: string,
  prompt: string,
  sampleData: string[],
  minWidth: number = 200,
  maxWidth: number = 800
): number {
  const padding = 60 // Extra padding for cell padding and borders
  
  // Measure header width
  const headerWidth = Math.max(
    measureTextWidth(columnName, '14px bold sans-serif'),
    measureTextWidth(prompt, '11px sans-serif')
  ) + padding
  
  // Measure sample data widths (take all samples to get better estimate)
  const dataWidths = sampleData.map(text => {
    // Estimate width based on character count (rough approximation for wrapped text)
    const charCount = (text || '').length
    const estimatedWidth = Math.min(charCount * 7, 600) // Approx 7px per char, cap at 600
    return estimatedWidth + padding
  })
  
  // Calculate maximum data width
  const maxDataWidth = Math.max(...dataWidths, 0)
  
  // Use max data width to ensure content fits
  const optimalWidth = Math.max(
    headerWidth,
    maxDataWidth
  )
  
  return Math.min(Math.max(optimalWidth, minWidth), maxWidth)
}

// Column resize handle component
function ColumnResizeHandle({ 
  onResize, 
}: { 
  onResize: (delta: number) => void
}) {
  const [startX, setStartX] = React.useState(0)
  const [isResizing, setIsResizing] = React.useState(false)
  
  const handleMouseDown = (e: React.MouseEvent) => {
    setStartX(e.clientX)
    setIsResizing(true)
    e.preventDefault()
  }
  
  React.useEffect(() => {
    if (!isResizing) return
    
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX
      onResize(delta)
      setStartX(e.clientX)
    }
    
    const handleMouseUp = () => {
      setStartX(0)
      setIsResizing(false)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, startX, onResize])
  
  return (
    <div
      className={cn(
        "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none",
        "hover:bg-blue-500 hover:w-[3px] transition-all",
        isResizing && "bg-blue-500 w-[3px]"
      )}
      onMouseDown={handleMouseDown}
    />
  )
}

// Helper function to get display name for columns
function getColumnDisplayName(columnId: string, reviewColumns?: Array<{ id: string; column_name: string; prompt: string; data_type: string }>): string {
  if (columnId === "fileName") return "Document"
  if (columnId === "actions") return "Actions"
  
  const reviewColumn = reviewColumns?.find(rc => rc.id === columnId)
  if (reviewColumn) {
    return reviewColumn.column_name
  }
  
  return columnId
}

export function EnhancedDataTable({
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
  isMobile = false,
}: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [tableData, setTableData] = React.useState(data)
  const [columnSizing, setColumnSizing] = React.useState<Record<string, number>>({})
  const [isFullScreen, setIsFullScreen] = React.useState(false)
  const [draggedRow, setDraggedRow] = React.useState<number | null>(null)
  
  // Modal state management
  const [showAddFilesModal, setShowAddFilesModal] = React.useState(false)
  const [showAddColumnModal, setShowAddColumnModal] = React.useState(false)
  const [showExportModal, setShowExportModal] = React.useState(false)
  
  // Export customization state
  const [exportConfig, setExportConfig] = React.useState({
    selectedColumns: reviewColumns?.map(col => col.id) || [],
    answerType: 'short' as 'short' | 'long' | 'both',
    includeSource: false
  })

  // Update table data when prop changes
  React.useEffect(() => {
    setTableData(data)
  }, [data])

  // Initialize column sizing based on content
  React.useEffect(() => {
    if (!reviewColumns || reviewColumns.length === 0) return
    
    const newSizing: Record<string, number> = {
      fileName: 250,
      actions: 100,
    }
    
    reviewColumns.forEach(col => {
      const sampleData = data.map(row => 
        row.results[col.id]?.extracted_value || ''
      )
      
      newSizing[col.id] = calculateOptimalWidth(
        col.column_name,
        col.prompt,
        sampleData,
        250,
        800
      )
    })
    
    setColumnSizing(newSizing)
  }, [reviewColumns, data])

  // Set column order to ensure new columns are always second
  React.useEffect(() => {
    if (!reviewColumns || reviewColumns.length === 0) return
    
    // Get all possible column IDs
    const allColumnIds = ['fileName', ...reviewColumns.map(col => col.id), 'actions']
    
    // Check if there's a new column (not in current order)
    const currentOrder = columnOrder.length > 0 ? columnOrder : allColumnIds
    const newColumns = reviewColumns.filter(col => !currentOrder.includes(col.id))
    
    if (newColumns.length > 0) {
      // Create new order with new columns as second position
      const newOrder: string[] = []
      
      // First add fileName (Document column)
      if (allColumnIds.includes('fileName')) {
        newOrder.push('fileName')
      }
      
      // Then add new columns
      newColumns.forEach(col => {
        newOrder.push(col.id)
      })
      
      // Then add existing columns (except fileName and actions)
      currentOrder.forEach(id => {
        if (id !== 'fileName' && id !== 'actions' && !newColumns.some(col => col.id === id)) {
          newOrder.push(id)
        }
      })
      
      // Finally add actions
      if (allColumnIds.includes('actions')) {
        newOrder.push('actions')
      }
      
      setColumnOrder(newOrder)
    }
  }, [reviewColumns, columnOrder])

  // Load saved column preferences from localStorage
  React.useEffect(() => {
    const savedPrefs = localStorage.getItem(`table-prefs-${reviewId}`)
    if (savedPrefs) {
      try {
        const prefs = JSON.parse(savedPrefs)
        if (prefs.columnSizing) setColumnSizing(prefs.columnSizing)
        if (prefs.columnOrder) setColumnOrder(prefs.columnOrder)
        if (prefs.columnVisibility) setColumnVisibility(prefs.columnVisibility)
      } catch (e) {
        console.error('Failed to load table preferences:', e)
      }
    }
  }, [reviewId])

  // Save column preferences to localStorage
  const savePreferences = React.useCallback(() => {
    const prefs = {
      columnSizing,
      columnOrder,
      columnVisibility,
    }
    localStorage.setItem(`table-prefs-${reviewId}`, JSON.stringify(prefs))
  }, [columnSizing, columnOrder, columnVisibility, reviewId])

  React.useEffect(() => {
    savePreferences()
  }, [savePreferences])

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
    onColumnOrderChange: setColumnOrder,
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
      columnOrder,
    },
    initialState: {
      pagination: {
        pageSize: 50, // Increased for virtualization
      },
    },
  })

  // Virtualization setup
  const tableContainerRef = React.useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 60, // Estimated row height
    overscan: 10,
  })

  // Column drag and drop handlers
  const handleColumnDragStart = React.useCallback((e: React.DragEvent, columnId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('dragType', 'column')
    e.dataTransfer.setData('columnId', columnId)
  }, [])

  const handleColumnDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleColumnDrop = React.useCallback((e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault()
    const dragType = e.dataTransfer.getData('dragType')
    if (dragType !== 'column') return
    
    const sourceColumnId = e.dataTransfer.getData('columnId')
    
    if (sourceColumnId === targetColumnId) return
    
    const allColumns = table.getAllColumns().map(col => col.id)
    const sourceIndex = allColumns.indexOf(sourceColumnId)
    const targetIndex = allColumns.indexOf(targetColumnId)
    
    if (sourceIndex === -1 || targetIndex === -1) return
    
    const newOrder = [...allColumns]
    const [removed] = newOrder.splice(sourceIndex, 1)
    newOrder.splice(targetIndex, 0, removed)
    
    setColumnOrder(newOrder)
  }, [table])

  // Row drag and drop handlers
  const handleRowDragStart = React.useCallback((e: React.DragEvent, rowIndex: number) => {
    setDraggedRow(rowIndex)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('dragType', 'row')
    e.dataTransfer.setData('rowIndex', rowIndex.toString())
  }, [])

  const handleRowDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleRowDrop = React.useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    const dragType = e.dataTransfer.getData('dragType')
    if (dragType !== 'row') return
    
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

  const handleRowDragEnd = React.useCallback(() => {
    setDraggedRow(null)
  }, [])

  // Column resize handler - no maximum limit
  const handleColumnResize = React.useCallback((columnId: string, delta: number) => {
    setColumnSizing(prev => {
      const currentWidth = prev[columnId] || 300
      const newWidth = Math.max(100, currentWidth + delta) // No maximum limit
      return { ...prev, [columnId]: newWidth }
    })
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

  // Auto-fit columns to content
  const autoFitColumns = React.useCallback(() => {
    const newSizing: Record<string, number> = {
      fileName: 250,
      actions: 100,
    }
    
    reviewColumns?.forEach(col => {
      const sampleData = table.getFilteredRowModel().rows
        .map(row => row.original.results[col.id]?.extracted_value || '')
      
      newSizing[col.id] = calculateOptimalWidth(
        col.column_name,
        col.prompt,
        sampleData,
        250,
        800
      )
    })
    
    setColumnSizing(newSizing)
  }, [reviewColumns, table])

  // Reset column layout
  const resetColumnLayout = React.useCallback(() => {
    setColumnOrder([])
    setColumnVisibility({})
    autoFitColumns()
  }, [autoFitColumns])

  const executeExport = React.useCallback(() => {
    try {
      const filteredData = table.getFilteredRowModel().rows.map(row => row.original)
      const wb = XLSX.utils.book_new()
      const exportData: (string | number | null)[][] = []
      
      // Build headers and prompts based on configuration
      const headers = ['Document']
      const prompts = ['File Name']
      const selectedReviewColumns = reviewColumns?.filter(col => 
        exportConfig.selectedColumns.includes(col.id)
      ) || []
      
      selectedReviewColumns.forEach(column => {
        if (exportConfig.answerType === 'both') {
          headers.push(`${column.column_name} (Short)`)
          headers.push(`${column.column_name} (Long)`)
          prompts.push(column.prompt)
          prompts.push(column.prompt)
          if (exportConfig.includeSource) {
            headers.push(`${column.column_name} (Source)`)
            prompts.push('Source Reference')
          }
        } else {
          const suffix = exportConfig.answerType === 'long' ? ' (Long)' : ''
          headers.push(`${column.column_name}${suffix}`)
          prompts.push(column.prompt)
          if (exportConfig.includeSource) {
            headers.push(`${column.column_name} (Source)`)
            prompts.push('Source Reference')
          }
        }
      })
      
      // Add sanitized headers and prompts to export data
      exportData.push(headers.map(sanitizeForExcel))
      exportData.push(prompts.map(sanitizeForExcel))
      
      // Build rows based on configuration with sanitization
      filteredData.forEach(row => {
        const exportRow: (string | number | null)[] = [sanitizeForExcel(row.fileName)]
        
        selectedReviewColumns.forEach(column => {
          const result = row.results[column.id]
          
          if (exportConfig.answerType === 'both') {
            exportRow.push(sanitizeForExcel(result?.extracted_value || ''))
            exportRow.push(sanitizeForExcel(result?.long || ''))
            
            if (exportConfig.includeSource) {
              exportRow.push(sanitizeForExcel(result?.source_reference || ''))
            }
          } else {
            const value = exportConfig.answerType === 'long' 
              ? (result?.long || '') 
              : (result?.extracted_value || '')
            exportRow.push(sanitizeForExcel(value))
            
            if (exportConfig.includeSource) {
              exportRow.push(sanitizeForExcel(result?.source_reference || ''))
            }
          }
        })
        
        exportData.push(exportRow)
      })
      
      const ws = XLSX.utils.aoa_to_sheet(exportData)
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
      
      // Add auto-filter on header row
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ r: 0, c: 0 }, { r: 0, c: range.e.c }) }
      
      // Freeze top 2 rows (header+prompt) and first column
      ;(ws as unknown as { '!freeze': { xSplit: number; ySplit: number } })['!freeze'] = { xSplit: 1, ySplit: 2 }
      
      // Set workbook properties
      wb.Props = {
        Title: reviewName,
        Subject: 'Review Export',
        Author: 'Tabular',
        CreatedDate: new Date(),
      }
      
      // Better auto column widths
      const colWidths = headers.map((header: string, index: number) => {
        if (index === 0) return { wch: 35 }
        
        let maxLen = Math.max(header.length, (prompts[index]?.length || 0))
        for (let R = 2; R < exportData.length; R++) {
          const cell = exportData[R][index]
          const len = String(cell ?? '').length
          maxLen = Math.max(maxLen, Math.min(len, 120))
        }
        return { wch: Math.min(Math.max(maxLen + 2, 18), 80) }
      })
      ws['!cols'] = colWidths
      
      // Apply formatting to headers and cells
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const headerAddress = XLSX.utils.encode_cell({ r: 0, c: C })
        if (!ws[headerAddress]) continue
        ws[headerAddress].s = {
          font: { bold: true, color: { rgb: '1F2937' } },
          fill: { fgColor: { rgb: 'E5F0FF' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          }
        }
        
        const promptAddress = XLSX.utils.encode_cell({ r: 1, c: C })
        if (!ws[promptAddress]) continue
        ws[promptAddress].s = {
          font: { italic: true, color: { rgb: "333333" } },
          fill: { fgColor: { rgb: "F2F2F2" } },
          alignment: { horizontal: "left", vertical: "top", wrapText: true },
          border: {
            top: { style: "thin", color: { rgb: "CCCCCC" } },
            bottom: { style: "thin", color: { rgb: "CCCCCC" } },
            left: { style: "thin", color: { rgb: "CCCCCC" } },
            right: { style: "thin", color: { rgb: "CCCCCC" } }
          }
        }
      }
      
      // Format data cells with wrapping
      for (let R = 2; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
          if (!ws[cellAddress]) continue
          ws[cellAddress].s = {
            alignment: { 
              horizontal: C === 0 ? "left" : "left", 
              vertical: "top", 
              wrapText: true 
            },
            border: {
              top: { style: "thin", color: { rgb: "E0E0E0" } },
              bottom: { style: "thin", color: { rgb: "E0E0E0" } },
              left: { style: "thin", color: { rgb: "E0E0E0" } },
              right: { style: "thin", color: { rgb: "E0E0E0" } }
            }
          }
          
          if (R % 2 === 0) {
            ws[cellAddress].s.fill = { fgColor: { rgb: "F9F9F9" } }
          }
        }
      }
      
      // Set row heights
      if (!ws['!rows']) ws['!rows'] = []
      ws['!rows'][0] = { hpt: 25 }
      ws['!rows'][1] = { hpt: 40 }
      
      // Convert source URLs to clickable hyperlinks
      const sourceColIndexes = headers
        .map((h, i) => ({ h, i }))
        .filter(({ h }) => h.endsWith('(Source)'))
        .map(({ i }) => i)
      
      for (let R = 2; R <= range.e.r; ++R) {
        sourceColIndexes.forEach((C) => {
          const addr = XLSX.utils.encode_cell({ r: R, c: C })
          const cell = ws[addr]
          if (!cell || typeof cell.v !== 'string') return
          const v = cell.v.trim()
          if (isUrl(v)) {
            cell.l = { Target: v, Tooltip: 'Open source' }
          }
        })
      }
      
      XLSX.utils.book_append_sheet(wb, ws, 'Review Data')
      
      // Create metadata sheet
      const metaData = [
        ['Export Configuration', ''],
        ['Review Name', reviewName],
        ['Status', reviewStatus],
        ['Answer Type', exportConfig.answerType === 'both' ? 'Short & Long' : 
                     exportConfig.answerType === 'long' ? 'Long Answer' : 'Short Answer'],
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

  // Toggle fullscreen mode
  const toggleFullScreen = React.useCallback(() => {
    setIsFullScreen(prev => !prev)
  }, [])

  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0
  const paddingBottom = virtualRows.length > 0
    ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0)
    : 0

  return (
    <TooltipProvider>
      <div className={cn(
        "w-full space-y-6 transition-all duration-300",
        isFullScreen && "fixed inset-0 z-50 bg-white p-6 overflow-auto"
      )}>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">{reviewName}</h2>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <span className="font-medium text-gray-900">{totalFiles}</span>
                <span>documents</span>
              </div>
              {completionPercentage > 0 && completionPercentage < 100 && (
                <div className="flex items-center space-x-2">
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium">{Math.round(completionPercentage)}%</span>
                </div>
              )}
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullScreen}
            className="h-8"
          >
            {isFullScreen ? (
              <>
                <Minimize2 className="mr-2 h-4 w-4" />
                Exit Fullscreen
              </>
            ) : (
              <>
                <Maximize2 className="mr-2 h-4 w-4" />
                Fullscreen
              </>
            )}
          </Button>
        </div>

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
          
          <div className={cn(
            "flex items-center space-x-2",
            isMobile && "flex-wrap gap-2"
          )}>
            <Button variant="outline" size="sm" onClick={handleAddFiles} className="h-9">
              <Plus className="mr-2 h-4 w-4" />
              {isMobile ? "Add Files" : "Add Documents"}
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
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleShowExportModal}
              className="h-9"
              title="Customize and export table data"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Settings2 className="mr-2 h-4 w-4" />
                  View
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[220px]">
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                  Column Layout
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={autoFitColumns}>
                  <Columns3 className="mr-2 h-4 w-4" />
                  Auto-fit Columns
                </DropdownMenuItem>
                <DropdownMenuItem onClick={resetColumnLayout}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  Reset Layout
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
                        className="text-sm"
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

        <Card className="border-0 shadow-none rounded-none overflow-hidden">
          <CardContent className="p-0 rounded-none">
            <div 
              ref={tableContainerRef}
              className="w-full overflow-auto"
              style={{ 
                height: isFullScreen 
                  ? 'calc(100vh - 200px)' 
                  : isMobile 
                    ? '400px' 
                    : '600px' 
              }}
            >
              <Table className="w-full border-collapse">
                <TableHeader className="bg-gray-50 sticky top-0 z-20 border-b border-gray-200">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="bg-gray-50">
                      {headerGroup.headers.map((header) => {
                        const columnId = header.column.id
                        const width = columnSizing[columnId] || header.column.getSize()
                        const isSticky = (header.column.columnDef.meta as ColumnMeta)?.isSticky
                        
                        return (
                          <TableHead 
                            key={header.id}
                            style={{ 
                              width,
                              minWidth: width,
                              maxWidth: width,
                            }}
                            className={cn(
                              "relative h-auto px-4 py-3 text-center font-semibold text-gray-900",
                              "border-r border-gray-200 last:border-r-0 bg-gray-50",
                              isSticky && "sticky left-0 z-30",
                              "group"
                            )}
                            draggable={!isSticky}
                            onDragStart={(e) => handleColumnDragStart(e, columnId)}
                            onDragOver={handleColumnDragOver}
                            onDrop={(e) => handleColumnDrop(e, columnId)}
                          >
                            <div className="flex items-center justify-center">
                              {!isSticky && (
                                <GripVertical className="h-4 w-4 text-gray-400 mr-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move" />
                              )}
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </div>
                            {!isSticky && columnId !== 'actions' && (
                              <ColumnResizeHandle
                                onResize={(delta) => handleColumnResize(columnId, delta)}
                              />
                            )}
                          </TableHead>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody className="bg-white">
                  {paddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${paddingTop}px` }} />
                    </tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const row = table.getRowModel().rows[virtualRow.index]
                    return (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        className={cn(
                          "border-b border-gray-200 bg-white",
                          draggedRow === virtualRow.index && 'opacity-50'
                        )}
                        style={{
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start - virtualRow.index * virtualRow.size}px)`,
                        }}
                        draggable={true}
                        onDragStart={(e) => handleRowDragStart(e, virtualRow.index)}
                        onDragOver={handleRowDragOver}
                        onDrop={(e) => handleRowDrop(e, virtualRow.index)}
                        onDragEnd={handleRowDragEnd}
                      >
                        {row.getVisibleCells().map((cell) => {
                          const columnId = cell.column.id
                          const width = columnSizing[columnId] || cell.column.getSize()
                          const isSticky = (cell.column.columnDef.meta as ColumnMeta)?.isSticky
                          
                          return (
                            <TableCell 
                              key={cell.id} 
                              style={{ 
                                width,
                                minWidth: width,
                                maxWidth: width,
                              }}
                              className={cn(
                                "px-3 py-2 align-top text-center border-r border-gray-200 last:border-r-0",
                                isSticky && "sticky left-0 bg-white z-10"
                              )}
                            >
                              <div className="w-full overflow-hidden">
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </div>
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    )
                  })}
                  {paddingBottom > 0 && (
                    <tr>
                      <td style={{ height: `${paddingBottom}px` }} />
                    </tr>
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
          <div className={cn(
            "flex items-center space-x-6 lg:space-x-8",
            isMobile && "space-x-3"
          )}>
            {!isMobile && (
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium">Rows per page</p>
                <select
                  value={table.getState().pagination.pageSize}
                  onChange={(e) => {
                    table.setPageSize(Number(e.target.value))
                  }}
                  className="h-8 w-[70px] rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[25, 50, 100, 200].map((pageSize) => (
                    <option key={pageSize} value={pageSize}>
                      {pageSize}
                    </option>
                  ))}
                </select>
              </div>
            )}
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

              <div className="space-y-3">
                <Label className="text-base font-semibold">Additional Data</Label>
                <div className="space-y-2">
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

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Export Summary</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• {exportConfig.selectedColumns.length} column(s) selected</p>
                  <p>• {totalFiles} document(s) to export</p>
                  <p>• Answer type: {exportConfig.answerType === 'both' ? 'Short & Long' : 
                                 exportConfig.answerType === 'long' ? 'Long Answer' : 'Short Answer'}</p>
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
    </TooltipProvider>
  )
}
