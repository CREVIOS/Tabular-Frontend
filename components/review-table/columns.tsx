"use client"

import { ColumnDef, Column } from "@tanstack/react-table"
import { useCallback } from "react"
import {
  ArrowUpDown,
  MoreHorizontal,
  FileText,
  Loader2,
  AlertCircle,
  GripVertical,
  RotateCcw,
} from "lucide-react"

import { Button } from "@/components/ui/button"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
      className="mx-auto flex items-center gap-1 text-center"
      onClick={handleSort}
    >
      {title}
      <ArrowUpDown className="h-3 w-3 opacity-60" />
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

// Helper function to truncate text to max 4 words
function truncateToWords(text: string, maxWords: number = 4): string {
  const words = text.split(' ')
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ') + '...'
}

// Helper function to truncate text to 2-3 lines (approximately 60-90 characters)
function truncateToLines(text: string, maxChars: number = 90): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + '...'
}

export function createColumns({
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
          title={
            <>
              <FileText className="mr-1 h-4 w-4 text-blue-600" />
              Document
            </>
          }
          column={column}
        />
      ),
      cell: ({ row }) => {
        const rowIndex = row.index + 1
        
        return (
          <div className="flex items-center gap-3 py-2">
            {/* Row Number */}
            <span className="text-sm text-gray-500 w-6 text-center font-medium">
              {rowIndex}
            </span>
            
            {/* Drag Handle */}
            <div className="drag-handle cursor-grab hover:cursor-grabbing">
              <GripVertical className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </div>
            
            {/* Document Icon - Always show for every row */}
            <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
            
            {/* Filename */}
            <span className="text-sm text-gray-900 truncate flex-1">
              {row.original.fileName}
            </span>
          </div>
        )
      },
      size: 320,
      minSize: 280,
      maxSize: 450,
      meta: { 
        className: "sticky-column",
        isSticky: true 
      },
    },
    {
      id: "actions",
      header: () => <div className="text-center w-full">Actions</div>,
      enableSorting: false,
      size: 80,
      cell: ({ row }) => {
        const fileId = row.original.file.file_id
        const handleRerunAnalysis = () => onRerunAnalysis(fileId, reviewId)

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 mx-auto">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>File Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleRerunAnalysis}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Rerun
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  /* ─────────────────────────────  dynamic columns  ────────────────────────── */
  const dynamicColumns: ColumnDef<ReviewTableRow>[] = columns.map(
    (col,) => ({
      id: col.id,
      accessorKey: `results.${col.id}`,
      header: ({ column }) => (
        <CenteredHeader
          title={
            <div className="flex flex-col items-center">
              <span className="truncate max-w-[8rem] font-medium">
                {truncateToWords(col.column_name)}
              </span>
              <span className="text-[10px] text-muted-foreground truncate max-w-[8rem]">
                {truncateToWords(col.prompt)}
              </span>
            </div>
          }
          column={column}
        />
      ),
      meta: { className: "w-48" },
      size: 200,
      minSize: 200,
      maxSize: 250,
      cell: ({ row }) => {
        const file   = row.original.file
        const key    = `${file.file_id}-${col.id}`
        const stored = row.original.results[col.id]
        const live    = realTimeUpdates[key]
        const spinning = processingCells.has(key)
        const res    = live || stored
        const updated    = live && live.timestamp && Date.now() - live.timestamp < 1500

        const handleCellClick = () => {
          if (res) {
            onCellClick(file.file_id, col.id, res as ReviewResult)
          }
        }
      
        /* ---- states ---- */
        if (spinning)
          return (
            <CenteredBox>
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-[11px] text-blue-600">Analyzing…</span>
            </CenteredBox>
          )
      
        if (res?.error)
          return (
            <CenteredBox>
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-[11px] text-red-600">Failed</span>
            </CenteredBox>
          )
      
        if (!res?.extracted_value)
          return (
            <div className="w-full p-3">
              {!res ? (
                // Show skeleton when no result exists yet (initial loading)
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ) : (
                // Show "No data" only when processing is complete but no value found
                <CenteredBox>
                  <span className="text-[11px] text-muted-foreground">No data</span>
                </CenteredBox>
              )}
            </div>
          )
      
        /* ---- success with 2-3 line wrapping ---- */
        console.log('✅ Rendering data for:', key, res.extracted_value)
        const confidence = Math.round((res.confidence_score || 0) * 100)
        
        // Use full text with line truncation instead of word truncation
        const fullText = res.extracted_value || ''
        const displayText = truncateToLines(fullText, 90)
      
        return (
          <div
            className={`group relative w-full rounded border border-transparent p-3 hover:border-blue-200 hover:bg-muted/30 transition-all duration-200 cursor-pointer min-h-[70px]
                        ${updated ? "border-green-300 bg-green-50 shadow-sm" : ""}`}
            onClick={handleCellClick}
            title={`${fullText}\nConfidence: ${confidence}%${
              res.source_reference ? `\nSource: ${res.source_reference}` : ""
            }`}
          >
            <div className="text-[13px] leading-relaxed text-left w-full">
              <div 
                className="break-words hyphens-auto"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: '1.4',
                  maxHeight: '4.2em' // 3 lines * 1.4 line-height
                }}
              >
                {displayText}
              </div>
            </div>
          </div>
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

  /* final order: [Document | dynamic cols | Actions] */
  return [...baseColumns.slice(0, 1), ...dynamicColumns, baseColumns[1]]
}

/* helper small bits  -------------------------------------------------------- */
function CenteredBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[70px] flex-col items-center justify-center gap-2 text-center p-2 rounded border border-gray-100 bg-gray-50/30">
      {children}
    </div>
  )
}
