"use client"

import { ColumnDef, Column } from "@tanstack/react-table"
import { useCallback } from "react"
import {
  ArrowUpDown,
  MoreHorizontal,
  Loader2,
  RotateCcw,
  Copy,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ReviewFile,
  ReviewColumn,
  ReviewResult,
  RealTimeUpdates,
} from "@/types"

export type ReviewTableRow = {
  file: ReviewFile
  fileName: string
  fileStatus: string
  results: Record<string, ReviewResult | null>
}

import { Skeleton } from "@/components/ui/skeleton"

function CenteredHeader({
  title,
  column,
}: {
  title: React.ReactNode
  column: Column<ReviewTableRow>
}) { 
  const handleSort = useCallback(() => {
    column.toggleSorting(column.getIsSorted() === "asc")
  }, [column])

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full h-full p-2 hover:bg-gray-50"
      onClick={handleSort}
    >
      <div className="flex items-center justify-center gap-1">
        {title}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </div>
    </Button>
  )
}

interface CreateColumnsProps {
  columns: ReviewColumn[]
  realTimeUpdates: RealTimeUpdates
  processingCells: Set<string>
  onCellClick: (fileId: string, columnId: string, result: ReviewResult) => void
  onRerunAnalysis: (fileId: string, reviewId: string) => void
  reviewId: string
  isMobile?: boolean
}

// Simple table cell component with full text display
function DataCell({
  result,
  isProcessing,
  onClick,
}: {
  result: (ReviewResult & { error?: boolean }) | null
  isProcessing: boolean
  onClick: () => void
}) {
  if (isProcessing) {
    return (
      <div className="flex items-center justify-center min-h-[50px] p-2">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      </div>
    )
  }

  if (result?.error) {
    return (
      <div className="flex items-center justify-center min-h-[50px] p-2 text-red-600">
        <span className="text-sm">Failed</span>
      </div>
    )
  }

  if (!result?.extracted_value) {
    return (
      <div className="flex items-center justify-center min-h-[50px] p-2">
        {!result ? (
          <Skeleton className="h-4 w-3/4" />
        ) : (
          <span className="text-sm text-gray-400">-</span>
        )}
      </div>
    )
  }

  const fullText = result.extracted_value || ''

  return (
    <div
      className="w-full p-2 min-h-[50px] flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={onClick}
    >
      <div className="text-sm text-gray-900 text-center whitespace-pre-wrap break-words w-full">
        {fullText}
      </div>
    </div>
  )
}

export function createEnhancedColumns({
  columns,
  realTimeUpdates,
  processingCells,
  onCellClick,    
  onRerunAnalysis,
  reviewId,
}: CreateColumnsProps): ColumnDef<ReviewTableRow>[] {
  
  const baseColumns: ColumnDef<ReviewTableRow>[] = [
    {
      accessorKey: "fileName",
      header: ({ column }) => (
        <CenteredHeader
          title={<span className="font-medium">Document</span>}
          column={column}
        />
      ),
      cell: ({ row }) => {
        const fileName = row.original.fileName
        
        return (
          <div className="w-full p-2 min-h-[50px] flex items-center justify-center">
            <div className="text-sm text-gray-900 text-center whitespace-pre-wrap break-words w-full">
              {fileName}
            </div>
          </div>
        )
      },
      size: 250,
      minSize: 150,
      maxSize: 800,
      meta: { 
        className: "sticky-column",
        isSticky: true 
      },
    },
    {
      id: "actions",
      header: () => (
        <div className="text-center w-full font-semibold">Actions</div>
      ),
      enableSorting: false,
      size: 100,
      cell: ({ row }) => {
        const fileId = row.original.file.file_id
        const handleRerunAnalysis = () => onRerunAnalysis(fileId, reviewId)

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="h-8 w-8 p-0 mx-auto hover:bg-gray-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>File Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleRerunAnalysis}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Rerun Analysis
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(row.original.fileName)}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Filename
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  /* Dynamic columns with enhanced features */
  const dynamicColumns: ColumnDef<ReviewTableRow>[] = columns.map(
    (col) => ({
      id: col.id,
      accessorKey: `results.${col.id}`,
      header: ({ column }) => (
        <CenteredHeader
          title={<span className="font-medium text-sm">{col.column_name}</span>}
          column={column}
        />
      ),
      meta: { 
        className: "min-w-[250px]",
        minWidth: 200,
        maxWidth: 1000,
      },
      size: 300,
      minSize: 200,
      maxSize: 1000,
      cell: ({ row }) => {
        const file = row.original.file
        const key = `${file.file_id}-${col.id}`
        const stored = row.original.results[col.id]
        const live = realTimeUpdates[key]
        const spinning = processingCells.has(key)
        const res = live || stored

        const handleCellClick = () => {
          if (res) {
            onCellClick(file.file_id, col.id, res as ReviewResult)
          }
        }

        return (
          <DataCell
            result={res as (ReviewResult & { error?: boolean }) | null}
            isProcessing={spinning}
            onClick={handleCellClick}
          />
        )
      },
      
      sortingFn: (a, b) =>
        (a.original.results[col.id]?.extracted_value || "").localeCompare(
          b.original.results[col.id]?.extracted_value || ""
        ),
      filterFn: (row, _, value) =>
        (row.original.results[col.id]?.extracted_value || "")
          .toLowerCase()
          .includes(value.toLowerCase()),
    })
  )

  /* Final order: [Document | dynamic cols | Actions] */
  return [...baseColumns.slice(0, 1), ...dynamicColumns, baseColumns[1]]
}


