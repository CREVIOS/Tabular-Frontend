import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Eye, Trash2, Edit, FolderOpen, Files } from "lucide-react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { folders as folderApi } from "@/lib/api/index"
import type { Folder } from "@/lib/api/types"

export type FolderTableRow = Folder & {}

export interface FolderColumnsProps {
  onViewFolder?: (folder: Folder) => void
  onEditFolder?: (folder: Folder) => void
  onDeleteFolder?: (folderId: string) => void
  onUploadToFolder?: (folderId: string) => void
}

// Delete dialog component to properly handle React hooks
interface DeleteFolderDialogProps {
  folder: Folder
  onDeleteFolder?: (folderId: string) => void
}

const DeleteFolderDialog: React.FC<DeleteFolderDialogProps> = ({ folder, onDeleteFolder }) => {
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)

  const handleDelete = async () => {
    try {
      setDeleteError(null)
      const result = await folderApi.delete(folder.id)
      if (result.success) {
        onDeleteFolder?.(folder.id)
        setOpen(false)
      } else {
        setDeleteError(result.error || 'Failed to delete folder')
      }
    } catch (error) {
      console.error('Error deleting folder:', error)
      setDeleteError('An error occurred while deleting the folder')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          className="text-red-600 focus:text-red-600"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Folder</DialogTitle>
          <DialogDescription className="space-y-2">
            <span>Are you sure you want to delete the folder:</span>
            <div className="mt-2 p-2 bg-gray-50 rounded border">
              <span className="font-medium text-sm break-all">{folder.name}</span>
            </div>
            <span>This action cannot be undone. The folder must be empty to be deleted.</span>
          </DialogDescription>
        </DialogHeader>
        {deleteError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{deleteError}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => {
            setDeleteError(null)
            setOpen(false)
          }}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const createFolderColumns = ({
  onViewFolder,
  onEditFolder,
  onDeleteFolder,
  onUploadToFolder
}: FolderColumnsProps): ColumnDef<FolderTableRow>[] => {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 hover:bg-transparent"
          >
            <div className="flex items-center gap-1">
              <FolderOpen className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Folder</span>
              <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
            </div>
          </Button>
        )
      },
      cell: ({ row }) => {
        const folder = row.original
        return (
          <div className="flex items-center gap-4 min-w-0">
            <div 
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border border-white/20"
              style={{ 
                backgroundColor: folder.color || '#6366F1',
                background: `linear-gradient(135deg, ${folder.color || '#6366F1'}, ${folder.color || '#6366F1'}dd)`
              }}
            >
              <FolderOpen className="h-5 w-5 sm:h-6 sm:w-6 text-white drop-shadow-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 truncate text-sm sm:text-base">
                {folder.name}
              </div>
              {folder.description && (
                <div className="text-xs sm:text-sm text-gray-600 truncate mt-0.5">
                  {folder.description}
                </div>
              )}
            </div>
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
            className="h-auto p-0 hover:bg-transparent"
          >
            <div className="flex items-center gap-1">
              <Files className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Files</span>
              <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
            </div>
          </Button>
        )
      },
      cell: ({ row }) => {
        const count = row.getValue("file_count") as number
        return (
          <div className="flex items-center justify-center">
            <Badge variant="secondary" className="text-xs font-medium px-2.5 py-1">
              {count || 0}
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
            className="h-auto p-0 hover:bg-transparent"
          >
            <div className="flex items-center gap-1">
              <span>Size</span>
              <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
            </div>
          </Button>
        )
      },
      cell: ({ row }) => {
        const size = row.getValue("total_size") as number
        const formatSize = (bytes: number) => {
          if (!bytes) return "0 B"
          const k = 1024
          const sizes = ["B", "KB", "MB", "GB"]
          const i = Math.floor(Math.log(bytes) / Math.log(k))
          return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
        }
        
        return (
          <div className="flex items-center justify-center">
            <span className="text-sm text-gray-600 font-medium">
              {formatSize(size || 0)}
            </span>
          </div>
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
            className="h-auto p-0 hover:bg-transparent"
          >
            <div className="flex items-center gap-1">
              <span>Created</span>
              <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
            </div>
          </Button>
        )
      },
      cell: ({ row }) => {
        const date = new Date(row.getValue("created_at"))
        return (
          <div className="flex items-center justify-center">
            <span className="text-sm text-gray-600">
              {date.toLocaleDateString()}
            </span>
          </div>
        )
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const folder = row.original

        return (
          <div className="flex items-center justify-center">
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
                  <Files className="mr-2 h-4 w-4" />
                  Upload Files
                </DropdownMenuItem>
              )}
              
              {onEditFolder && (
                <DropdownMenuItem onClick={() => onEditFolder(folder)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              
              <DropdownMenuSeparator />
              {onDeleteFolder && (
                <DeleteFolderDialog folder={folder} onDeleteFolder={onDeleteFolder} />
              )}
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]
} 