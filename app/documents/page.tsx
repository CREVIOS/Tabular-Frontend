"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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

// Icons
import { FolderOpen } from 'lucide-react'

const folderColors = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
]

export default function DocumentsPage() {
  const router = useRouter()
  const supabase = createClient()
  
  // State
  const [folders, setFolders] = useState<ApiFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  
  // Modal states
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [showUploadFiles, setShowUploadFiles] = useState(false)
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null)
  const [newFolderData, setNewFolderData] = useState({
    name: '',
    description: ''
  })

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth error:', error)
          setIsAuthenticated(false)
          router.push('/login')
          return
        }
        
        if (!session) {
          setIsAuthenticated(false)
          router.push('/login')
          return
        }
        
        setIsAuthenticated(true)
        fetchData()
      } catch (error) {
        console.error('Authentication check failed:', error)
        setIsAuthenticated(false)
        router.push('/login')
      }
    }
    
    checkAuth()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false)
          router.push('/login')
        } else if (session) {
          setIsAuthenticated(true)
        }
      }
    )
    
    return () => subscription.unsubscribe()
  }, [router, supabase.auth])

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

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="flex items-center justify-center h-[80vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Checking authentication...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Redirect if not authenticated
  if (isAuthenticated === false) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
              <FolderOpen className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
              Document Management
            </h1>
          </div>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto mb-6 sm:mb-8 px-4">
            Organize your documents into folders and create AI-powered reviews
          </p>
        </div>

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
          <DialogContent className="w-[95vw] max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Folder Name *
                </label>
                <Input
                  placeholder="e.g., Contracts, Invoices, Reports"
                  value={newFolderData.name}
                  onChange={(e) => setNewFolderData(prev => ({ ...prev, name: e.target.value }))}
                  className="touch-target"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <Textarea
                  placeholder="Brief description of this folder's purpose..."
                  value={newFolderData.description}
                  onChange={(e) => setNewFolderData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="touch-target"
                />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button onClick={createFolderHandler} className="flex-1 touch-target">
                  Create Folder
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowCreateFolder(false)}
                  className="flex-1 touch-target"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Folders Table */}
        <FoldersDataTable
          columns={folderColumns}
          data={folderTableData}
          onCreateFolder={() => setShowCreateFolder(true)}
          isLoading={loading}
        />

        {/* Upload Files Dialog */}
        <Dialog open={showUploadFiles} onOpenChange={setShowUploadFiles}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload Files</DialogTitle>
            </DialogHeader>
            <FileUpload
              folderId={uploadFolderId}
              onUploadSuccess={handleUploadSuccess}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
