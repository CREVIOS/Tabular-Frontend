"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { fetchDocumentsData, createFolder } from '@/lib/api/documents-api'
import type { Folder as ApiFolder } from '@/lib/api/types'

// Components
import { createFolderColumns, FoldersDataTable, type FolderTableRow } from '@/components/folders'
import { FileUpload } from '@/components/documents/file-upload'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DataTableSkeleton } from '@/components/ui/loading-skeletons'

// Icons
import { FolderOpen } from 'lucide-react'

const folderColors = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
]

export default function DocumentsPage() {
  const router = useRouter()
  
  // State
  const [folders, setFolders] = useState<ApiFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Modal states
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [showUploadFiles, setShowUploadFiles] = useState(false)
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null)
  const [newFolderData, setNewFolderData] = useState({
    name: '',
    description: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const documentsResult = await fetchDocumentsData()
      
      if (!documentsResult.success) {
        throw new Error(documentsResult.error)
      }
      
      setFolders(documentsResult.data.folders)
      
    } catch (error: unknown) {
      console.error('Failed to fetch data:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch data'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const createFolderHandler = async () => {
    try {
      setError(null)
      
      if (!newFolderData.name.trim()) {
        setError('Folder name is required')
        return
      }

      // Get random color
      const randomColor = folderColors[Math.floor(Math.random() * folderColors.length)]

      // Use the centralized API function
      const result = await createFolder({
        name: newFolderData.name.trim(),
        description: newFolderData.description.trim() || undefined,
        color: randomColor
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to create folder')
      }

      // Add the new folder to the list
      setFolders(prev => [result.data, ...prev])
      setShowCreateFolder(false)
      setNewFolderData({ name: '', description: '' })
      setError(null)
    } catch (error: unknown) {
      console.error('Failed to create folder:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create folder'
      setError(errorMessage)
    }
  }

  const handleUploadSuccess = () => {
    setShowUploadFiles(false)
    setUploadFolderId(null)
    fetchData()
  }

  // Column configurations
  const folderColumns = createFolderColumns({
    onViewFolder: (folder) => {
      router.push(`/documents/${folder.id}`)
    },
    onEditFolder: (folder) => {
      setNewFolderData({
        name: folder.name,
        description: folder.description || ''
      })
      setShowCreateFolder(true)
    },
    onDeleteFolder: async (folderId) => {
      try {
        const { folders } = await import('@/lib/api/index')
        const result = await folders.delete(folderId)
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to delete folder')
        }
        
        // Update state to remove the deleted folder
        setFolders(prev => prev.filter(f => f.id !== folderId))
        
      } catch (error) {
        console.error('Failed to delete folder:', error)
        setError(error instanceof Error ? error.message : 'Failed to delete folder')
      }
    },
    onUploadToFolder: (folderId) => {
      setUploadFolderId(folderId)
      setShowUploadFiles(true)
    }
  })

  // Prepare table data
  const folderTableData: FolderTableRow[] = folders.map(folder => ({
    ...folder
  }))

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">

        {/* Error Alert */}
        {error && (
          <div className="mb-4 sm:mb-6">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Create Folder Dialog */}
        <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Folder Name *
                </label>
                <Input
                  placeholder="e.g., Contracts, Invoices, Reports"
                  value={newFolderData.name}
                  onChange={(e) => setNewFolderData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Description (Optional)
                </label>
                <Textarea
                  placeholder="Brief description..."
                  value={newFolderData.description}
                  onChange={(e) => setNewFolderData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button onClick={createFolderHandler} className="flex-1">
                  Create Folder
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowCreateFolder(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Main Content */}
        {loading ? (
          <DataTableSkeleton />
        ) : (
          <div className="bg-white rounded-lg shadow-sm border">
            {/* Action Bar */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Folders</h2>
              <Button 
                onClick={() => setShowCreateFolder(true)}
                size="sm"
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                New Folder
              </Button>
            </div>

            {/* Folders Table */}
            <div className="p-4">
              <FoldersDataTable
                columns={folderColumns}
                data={folderTableData}
              />
            </div>
          </div>
        )}

        {/* Upload Files Dialog */}
        <Dialog open={showUploadFiles} onOpenChange={setShowUploadFiles}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Upload Files{uploadFolderId && folders.find(f => f.id === uploadFolderId)?.name && 
                  ` to ${folders.find(f => f.id === uploadFolderId)?.name}`}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <FileUpload 
                onUploadSuccess={handleUploadSuccess}
                folderId={uploadFolderId}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
