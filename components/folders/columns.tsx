import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Eye, Trash2, Upload, FolderOpen, Edit, FileText } from "lucide-react"
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
import type { Folder } from "@/lib/api/types"

export type FolderTableRow = Folder & {}

interface FolderColumnsProps {
  onViewFolder?: (folder: Folder) => void
  onEditFolder?: (folder: Folder) => void
  onDeleteFolder?: (folderId: string) => void
  onUploadToFolder?: (folderId: string) => void
}

export const createFolderColumns = ({ 
  onViewFolder, 
  onEditFolder, 
  onDeleteFolder, 
  onUploadToFolder 
}: FolderColumnsProps = {}): ColumnDef<FolderTableRow>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto px-2 py-1 hover:bg-blue-50 text-xs sm:text-sm"
        >
          <div className="flex items-center gap-1">
            <FolderOpen className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Folder Name</span>
            <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
          </div>
        </Button>
      )
    },
    cell: ({ row }) => {
      const folder = row.original
      return (
        <div 
          className="space-y-1 max-w-[12rem] sm:max-w-[20rem] cursor-pointer hover:text-blue-600 transition-colors"
          onClick={() => onViewFolder?.(folder)}
        >
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-lg flex-shrink-0"
              style={{ backgroundColor: folder.color }}
            />
            <div
              className="font-medium text-gray-900 truncate text-xs sm:text-sm"
              title={folder.name}
            >
              {folder.name}
            </div>
          </div>
          {folder.description && (
            <div
              className="text-xs text-gray-500 truncate ml-5"
              title={folder.description}
            >
              {folder.description}
            </div>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "file_count",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto px-2 py-1 hover:bg-blue-50 text-xs sm:text-sm"
        >
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Files</span>
            <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
          </div>
        </Button>
      )
    },
    cell: ({ row }) => {
      const fileCount = row.getValue("file_count") as number
      
      return (
        <div className="flex items-center justify-center">
          <Badge variant="outline" className="text-xs">
            {fileCount} file{fileCount !== 1 ? 's' : ''}
          </Badge>
        </div>
      )
    },
  },
  {
    accessorKey: "total_size",
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
      const totalSize = row.getValue("total_size") as number | undefined
      
      if (!totalSize) return <span className="text-gray-400 text-xs">—</span>
      
      const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
      }
      
      return (
        <span className="text-xs sm:text-sm text-gray-700">
          {formatFileSize(totalSize)}
        </span>
      )
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
          <span>Created</span>
          <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const createdAt = row.getValue("created_at") as string
      
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
          {formatDate(createdAt)}
        </span>
      )
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const folder = row.original

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
            {onViewFolder && (
              <DropdownMenuItem onClick={() => onViewFolder(folder)}>
                <Eye className="mr-2 h-4 w-4" />
                View Folder
              </DropdownMenuItem>
            )}
            {onUploadToFolder && (
              <DropdownMenuItem onClick={() => onUploadToFolder(folder.id)}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Files
              </DropdownMenuItem>
            )}
            {onEditFolder && (
              <DropdownMenuItem onClick={() => onEditFolder(folder)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Folder
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onDeleteFolder && (
              <DropdownMenuItem 
                onClick={() => onDeleteFolder(folder.id)}
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