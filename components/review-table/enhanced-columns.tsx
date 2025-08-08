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
  CheckCircle,
  Copy,
  ExternalLink,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
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
  prompt,
}: {
  title: React.ReactNode
  column: Column<ReviewTableRow>
  prompt?: string
}) { 
  const handleSort = useCallback(() => {
    column.toggleSorting(column.getIsSorted() === "asc")
  }, [column])

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="mx-auto flex flex-col items-center gap-0.5 text-center h-auto p-2 hover:bg-gray-100/50 group"
            onClick={handleSort}
          >
            <div className="flex items-center gap-1">
              {title}
              <ArrowUpDown className={cn(
                "h-3 w-3 transition-all",
                column.getIsSorted() === "asc" && "rotate-180",
                column.getIsSorted() === "desc" && "rotate-0",
                !column.getIsSorted() && "opacity-40 group-hover:opacity-100"
              )} />
            </div>
            {prompt && (
              <span className="text-[10px] text-muted-foreground font-normal line-clamp-2 max-w-[180px]">
                {prompt}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        {prompt && (
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-xs">{prompt}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
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

// Enhanced cell component with better visualization
function DataCell({
  result,
  isProcessing,
  isUpdated,
  onClick,
}: {
  result: (ReviewResult & { error?: boolean }) | null
  isProcessing: boolean
  isUpdated: boolean
  onClick: () => void
}) {
  const copyToClipboard = useCallback((text: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    // You could add a toast notification here
  }, [])

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 min-h-[60px] p-3">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <span className="text-[10px] text-blue-600 font-medium">Analyzing…</span>
        <Progress value={33} className="w-full h-1" />
      </div>
    )
  }

  if (result?.error) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 min-h-[60px] p-3 bg-red-50 rounded-md">
        <AlertCircle className="h-4 w-4 text-red-500" />
        <span className="text-[10px] text-red-600 font-medium">Analysis Failed</span>
      </div>
    )
  }

  if (!result?.extracted_value) {
    return (
      <div className="flex items-center justify-center min-h-[60px] p-3">
        {!result ? (
          <div className="space-y-2 w-full">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No data</span>
        )}
      </div>
    )
  }

  const confidence = Math.round((result.confidence_score || 0) * 100)
  const fullText = result.extracted_value || ''
  const hasLongAnswer = result.long && result.long !== result.extracted_value

  return (
    <div
      className={cn(
        "group relative w-full rounded-lg border p-3 transition-all duration-200 cursor-pointer min-h-[60px]",
        "hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-sm",
        isUpdated && "border-green-400 bg-green-50/50 animate-pulse-once",
        confidence >= 80 ? "border-l-4 border-l-green-500" :
        confidence >= 60 ? "border-l-4 border-l-yellow-500" :
        confidence > 0 ? "border-l-4 border-l-orange-500" : "border-gray-200"
      )}
      onClick={onClick}
    >
      {/* Confidence badge */}
      {confidence > 0 && (
        <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Badge 
            variant={confidence >= 80 ? "default" : confidence >= 60 ? "secondary" : "outline"}
            className="text-[10px] px-1.5 py-0.5"
          >
            {confidence}%
          </Badge>
        </div>
      )}

      {/* Main content */}
      <div className="space-y-2">
        <div className="text-sm leading-relaxed text-gray-900 break-words">
          <div className="line-clamp-3 whitespace-pre-wrap">
            {fullText}
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-2">
            {hasLongAnswer && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    +Details
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">{result.long}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {result.source_reference && (
              <Tooltip>
                <TooltipTrigger>
                  <ExternalLink className="h-3 w-3" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Source: {result.source_reference}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Copy button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
            onClick={(e) => copyToClipboard(fullText, e)}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Updated indicator */}
      {isUpdated && (
        <div className="absolute -top-1 -left-1">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-ping" />
        </div>
      )}
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
          title={
            <div className="flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="font-semibold">Document</span>
            </div>
          }
          column={column}
        />
      ),
      cell: ({ row }) => {
        const rowIndex = row.index + 1
        const fileName = row.original.fileName
        const fileExt = fileName.split('.').pop()?.toUpperCase() || 'FILE'
        
        return (
          <div className="flex items-center gap-3 py-2 px-3">
            {/* Row number badge */}
            <Badge variant="outline" className="min-w-[28px] justify-center text-xs font-medium">
              {rowIndex}
            </Badge>
            
            {/* Drag handle */}
            <div className="drag-handle cursor-grab hover:cursor-grabbing opacity-40 hover:opacity-100 transition-opacity">
              <GripVertical className="h-4 w-4 text-gray-500" />
            </div>
            
            {/* File icon with type badge */}
            <div className="relative flex-shrink-0">
              <FileText className="h-5 w-5 text-blue-500" />
              <Badge 
                variant="secondary" 
                className="absolute -bottom-1 -right-1 text-[8px] px-1 py-0 h-3"
              >
                {fileExt}
              </Badge>
            </div>
            
            {/* Filename with better typography */}
            <div className="flex-1 min-w-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {fileName}
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{fileName}</p>
                </TooltipContent>
              </Tooltip>
              <p className="text-[10px] text-muted-foreground">
                {row.original.file.file_size 
                  ? `${(row.original.file.file_size / 1024).toFixed(1)} KB`
                  : 'Size unknown'}
              </p>
            </div>

            {/* Status indicator */}
            {row.original.fileStatus === 'completed' && (
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
            )}
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
          title={
            <span className="font-semibold text-sm">
              {col.column_name}
            </span>
          }
          column={column}
          prompt={col.prompt}
        />
      ),
      meta: { 
        className: "min-w-[200px]",
        minWidth: 180,
        maxWidth: 350,
      },
      size: 220,
      minSize: 180,
      maxSize: 350,
      cell: ({ row }) => {
        const file = row.original.file
        const key = `${file.file_id}-${col.id}`
        const stored = row.original.results[col.id]
        const live = realTimeUpdates[key]
        const spinning = processingCells.has(key)
        const res = live || stored
        const updated = Boolean(live && live.timestamp && Date.now() - live.timestamp < 1500)

        const handleCellClick = () => {
          if (res) {
            onCellClick(file.file_id, col.id, res as ReviewResult)
          }
        }

        return (
          <TooltipProvider>
            <DataCell
              result={res as (ReviewResult & { error?: boolean }) | null}
              isProcessing={spinning}
              isUpdated={updated}
              onClick={handleCellClick}
            />
          </TooltipProvider>
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

/* Animation for pulse effect */
const style = document.createElement('style')
style.textContent = `
  @keyframes pulse-once {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }
  .animate-pulse-once {
    animation: pulse-once 1s ease-in-out;
  }
`
document.head.appendChild(style)
