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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { files as fileApi } from "@/lib/api/index"
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

// Utility function to get simple file extension display
const getSimpleFileType = (filename: string, mimeType?: string): string => {
  // Get extension from filename
  const extension = filename.split('.').pop()?.toLowerCase()
  
  // Return simple extension if available
  if (extension) {
    // Convert some common extensions to more readable formats
    switch (extension) {
      case 'docx':
      case 'doc':
        return 'DOCX'
      case 'xlsx':
      case 'xls':
        return 'XLSX'
      case 'pptx':
      case 'ppt':
        return 'PPTX'
      case 'pdf':
        return 'PDF'
      case 'txt':
        return 'TXT'
      case 'accdb':
      case 'mdb':
        return 'ACCESS'
      default:
        return extension.toUpperCase()
    }
  }
  
  // Fallback to MIME type mapping if no extension
  if (mimeType) {
    if (mimeType.includes('word')) return 'DOCX'
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'XLSX'
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'PPTX'
    if (mimeType.includes('pdf')) return 'PDF'
    if (mimeType.includes('text')) return 'TXT'
    if (mimeType.includes('access')) return 'ACCESS'
  }
  
  return 'FILE'
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
      const simpleFileType = getSimpleFileType(file.original_filename, file.file_type)
      
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
            <span className="inline-block px-1.5 py-0.5 bg-gray-100 rounded text-xs font-medium">
              {simpleFileType}
            </span>
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
    accessorKey: "created_at",
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
      const uploadDate = row.getValue("created_at") as string
      
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
              <Dialog>
                <DialogTrigger asChild>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Are you absolutely sure?</DialogTitle>
                    <DialogDescription className="space-y-2">
                      <span>This action cannot be undone. This will permanently delete the file:</span>
                      <div className="mt-2 p-2 bg-gray-50 rounded border">
                        <span className="font-mono text-sm break-all">{file.original_filename}</span>
                      </div>
                      <span>from your account.</span>
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline">Cancel</Button>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        try {
                          const result = await fileApi.delete(file.id)
                          if (result.success) {
                            onDeleteFile?.(file.id)
                          } else {
                            console.error('Failed to delete file:', result.error)
                          }
                        } catch (error) {
                          console.error('Error deleting file:', error)
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
] 