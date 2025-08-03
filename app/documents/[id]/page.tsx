"use client"
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { fetchFolderDetails } from '@/lib/api/documents-api'
import type { Folder as ApiFolder, File as ApiFile } from '@/lib/api/types'

// Components
import { createFileColumns, FilesDataTable, type FileTableRow } from '@/components/files'
import { FileUpload } from '@/components/documents/file-upload'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

// Icons
import { 
  FolderOpen, 
  Upload, 
  RefreshCw, 
  FileText,
  Sparkles
} from 'lucide-react'

// Enhanced types for this component
interface FolderWithStats extends ApiFolder {
  file_count: number
  total_size: number
  color: string
}

interface FolderDetailState {
  folder: FolderWithStats | null
  files: ApiFile[]
  loading: boolean
  error: string | null
  showUpload: boolean
}

export default function FolderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const folderId = params.id as string
  
  // Consolidated state
  const [state, setState] = useState<FolderDetailState>({
    folder: null,
    files: [],
    loading: true,
    error: null,
    showUpload: false
  })

  // Utility function to format file sizes
  const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  // Fetch folder data function
  const fetchFolderData = useCallback(async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      
      const result = await fetchFolderDetails(folderId)
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch folder details')
      }
      
      setState(prev => ({
        ...prev,
        folder: result.data.folder as FolderWithStats,
        files: result.data.files,
        loading: false
      }))
      
    } catch (error: unknown) {
      console.error('Failed to fetch folder data:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch folder data'
      setState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false
      }))
    }
  }, [folderId])

  useEffect(() => {
    fetchFolderData()
  }, [fetchFolderData])

  // Event handlers
  const handleUploadSuccess = useCallback((): void => {
    setState(prev => ({ ...prev, showUpload: false }))
    fetchFolderData()
  }, [fetchFolderData])

  const handleCreateReview = useCallback((): void => {
    router.push(`/review?folderId=${folderId}`)
  }, [router, folderId])

  const handleDeleteFile = useCallback(async (fileId: string): Promise<void> => {
    try {
      const { files } = await import('@/lib/api/index')
      const result = await files.delete(fileId)
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete file')
      }
      
      // Update state to remove the deleted file
      setState(prev => {
        const fileToDelete = prev.files.find(f => f.id === fileId)
        const updatedFiles = prev.files.filter(f => f.id !== fileId)
        
        return {
          ...prev,
          files: updatedFiles,
          folder: prev.folder ? {
            ...prev.folder,
            file_count: Math.max(0, prev.folder.file_count - 1),
            total_size: Math.max(0, prev.folder.total_size - (fileToDelete?.file_size || 0))
          } : null
        }
      })
      
    } catch (error) {
      console.error('Failed to delete file:', error)
      setState(prev => ({ ...prev, error: 'Failed to delete file' }))
    }
  }, [])

  const handleMoveFile = useCallback((fileId: string): void => {
    // TODO: Implement move file to different folder
    console.log('Move file:', fileId)
  }, [])

  const handleViewFile = useCallback((file: FileTableRow): void => {
    router.push(`/documents/file/${file.id}`)
  }, [router])

  // Column configurations
  const fileColumns = createFileColumns({
    onViewFile: handleViewFile,
    onDeleteFile: handleDeleteFile,
    onMoveFile: handleMoveFile
  })

  // Prepare table data
  const fileTableData: FileTableRow[] = state.files.map(file => ({
    ...file,
    folderName: state.folder?.name,
    folderColor: state.folder?.color
  }))

  if (state.loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink 
                href="/documents"
                className="flex items-center gap-2"
              >
                <FolderOpen className="h-4 w-4" />
                Documents
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="flex items-center gap-2">
                {state.folder && (
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: state.folder.color }}
                  />
                )}
                {state.folder?.name || 'Loading...'}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Folder Header */}
        {state.folder && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div 
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: `${state.folder.color}20` }}
                >
                  <FolderOpen 
                    className="h-6 w-6"
                    style={{ color: state.folder.color }} 
                  />
                </div>
                <div>
                  <h1 className="text-xl font-semibold mb-1">
                    {state.folder.name}
                  </h1>
                  {state.folder.description && (
                    <p className="text-gray-600 text-sm mb-2">
                      {state.folder.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      <span>{state.folder.file_count} files</span>
                    </div>
                    <span>{formatFileSize(state.folder.total_size)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Dialog open={state.showUpload} onOpenChange={(open) => 
                  setState(prev => ({ ...prev, showUpload: open }))
                }>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Files
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Upload Files to {state.folder.name}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                      <FileUpload 
                        onUploadSuccess={handleUploadSuccess}
                        folderId={folderId}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Button 
                  onClick={handleCreateReview}
                  variant="outline"
                  size="sm"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create Review
                </Button>
                
                <Button 
                  onClick={fetchFolderData} 
                  variant="outline" 
                  size="sm"
                  disabled={state.loading}
                >
                  <RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {state.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {/* Files Table */}
        <FilesDataTable
          columns={fileColumns}
          data={fileTableData}
          onUpload={() => setState(prev => ({ ...prev, showUpload: true }))}
          isLoading={state.loading}
        />
      </div>
    </div>
  )
}
