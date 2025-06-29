import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Eye, Trash2, Download, FileText, Clock, CheckCircle, AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { File } from "@/lib/api/types"

export type FileTableRow = File & {
  folderName?: string
  folderColor?: string
}

interface FileColumnsProps {
  onViewFile?: (file: File) => void
  onDeleteFile?: (fileId: string) => void
  onMoveFile?: (fileId: string) => void
}

export const createFileColumns = ({ 
  onViewFile, 
  onDeleteFile, 
  onMoveFile 
}: FileColumnsProps = {}): ColumnDef<FileTableRow>[] => [
  {
    accessorKey: "original_filename",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto px-2 py-1 hover:bg-blue-50 text-xs sm:text-sm"
        >
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>File Name</span>
            <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
          </div>
        </Button>
      )
    },
    cell: ({ row }) => {
      const file = row.original
      return (
        <div 
          className="space-y-1 max-w-[12rem] sm:max-w-[20rem] cursor-pointer hover:text-blue-600 transition-colors"
          onClick={() => onViewFile?.(file)}
        >
          <div
            className="font-medium text-gray-900 truncate text-xs sm:text-sm"
            title={file.original_filename}
          >
            {file.original_filename}
          </div>
          <div className="text-xs text-gray-500">
            {file.file_type && (
              <span className="uppercase">{file.file_type}</span>
            )}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "file_size",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto px-2 py-1 hover:bg-blue-50 text-xs sm:text-sm"
        >
          <span>Size</span>
          <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const fileSize = row.getValue("file_size") as number | undefined
      
      if (!fileSize) return <span className="text-gray-400 text-xs">—</span>
      
      const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
      }
      
      return (
        <span className="text-xs sm:text-sm text-gray-700">
          {formatFileSize(fileSize)}
        </span>
      )
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto px-2 py-1 hover:bg-blue-50 text-xs sm:text-sm"
        >
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Status</span>
            <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
          </div>
        </Button>
      )
    },
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      
      const getStatusConfig = (status: string) => {
        switch (status) {
          case 'completed':
            return {
              variant: 'default' as const,
              icon: CheckCircle,
              color: 'text-green-600',
              bg: 'bg-green-100'
            }
          case 'processing':
          case 'queued':
            return {
              variant: 'secondary' as const,
              icon: Loader2,
              color: 'text-blue-600',
              bg: 'bg-blue-100'
            }
          case 'failed':
            return {
              variant: 'destructive' as const,
              icon: AlertTriangle,
              color: 'text-red-600',
              bg: 'bg-red-100'
            }
          default:
            return {
              variant: 'outline' as const,
              icon: Clock,
              color: 'text-gray-600',
              bg: 'bg-gray-100'
            }
        }
      }
      
      const config = getStatusConfig(status)
      const Icon = config.icon
      
      return (
        <Badge 
          variant={config.variant} 
          className={`capitalize text-xs flex items-center gap-1 ${config.bg} ${config.color} border-0`}
        >
          <Icon className={`h-3 w-3 ${status === 'processing' || status === 'queued' ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{status}</span>
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "folderName",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto px-2 py-1 hover:bg-blue-50 text-xs sm:text-sm"
        >
          <span>Folder</span>
          <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const folderName = row.getValue("folderName") as string
      const folderColor = row.original.folderColor
      
      if (!folderName) {
        return (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <div className="w-2 h-2 rounded-full bg-gray-300" />
            <span className="hidden sm:inline">No Folder</span>
            <span className="sm:hidden">—</span>
          </div>
        )
      }
      
      return (
        <div className="flex items-center gap-2 max-w-[8rem] sm:max-w-none">
          <div 
            className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: folderColor || '#6b7280' }}
          />
          <span className="text-xs sm:text-sm text-gray-700 font-medium truncate" title={folderName}>
            {folderName}
          </span>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "upload_date",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto px-2 py-1 hover:bg-blue-50 text-xs sm:text-sm"
        >
          <span>Uploaded</span>
          <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const uploadDate = row.getValue("upload_date") as string
      
      const formatDate = (dateString: string) => {
        try {
          const date = new Date(dateString)
          return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })
        } catch {
          return 'Invalid date'
        }
      }
      
      return (
        <span className="text-xs sm:text-sm text-gray-600">
          {formatDate(uploadDate)}
        </span>
      )
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const file = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {file.status === 'completed' && onViewFile && (
              <DropdownMenuItem onClick={() => onViewFile(file)}>
                <Eye className="mr-2 h-4 w-4" />
                View File
              </DropdownMenuItem>
            )}
            {onMoveFile && (
              <DropdownMenuItem onClick={() => onMoveFile(file.id)}>
                <Download className="mr-2 h-4 w-4" />
                Move to Folder
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onDeleteFile && (
              <DropdownMenuItem 
                onClick={() => onDeleteFile(file.id)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
] 