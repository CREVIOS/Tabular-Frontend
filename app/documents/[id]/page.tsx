"use client"
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
import { FolderDetailSkeleton } from '@/components/ui/loading-skeletons'

// Icons
import { 
  FolderOpen, 
  ArrowLeft, 
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
  isAuthenticated: boolean | null
  showUpload: boolean
}

export default function FolderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const folderId = params.id as string
  
  // Consolidated state
  const [state, setState] = useState<FolderDetailState>({
    folder: null,
    files: [],
    loading: true,
    error: null,
    isAuthenticated: null,
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

  // Authentication and data fetching effect
  useEffect(() => {
    let isMounted = true

    const checkAuthAndFetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!isMounted) return
        
        if (!session) {
          setState(prev => ({ ...prev, isAuthenticated: false }))
          router.push('/login')
          return
        }
        
        setState(prev => ({ ...prev, isAuthenticated: true }))
        await fetchFolderData()
        
      } catch (error) {
        console.error('Auth check failed:', error)
        if (isMounted) {
          setState(prev => ({ 
            ...prev, 
            isAuthenticated: false,
            error: 'Authentication failed'
          }))
        }
      }
    }

    checkAuthAndFetchData()
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return
        
        if (event === 'SIGNED_OUT' || !session) {
          setState(prev => ({ ...prev, isAuthenticated: false }))
          router.push('/login')
        } else if (session) {
          setState(prev => ({ ...prev, isAuthenticated: true }))
        }
      }
    )
    
    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [router, supabase.auth, folderId, fetchFolderData])

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

  // Loading state
  if (state.loading || state.isAuthenticated === null) {
    return <FolderDetailSkeleton />
  }

  // Redirect if not authenticated
  if (state.isAuthenticated === false) {
    return null
  }

  // Error state
  if (state.error && !state.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FolderOpen className="h-10 w-10 text-red-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              {state.error}
            </h3>
            <div className="space-x-4">
              <Button 
                onClick={() => router.push('/documents')}
                variant="outline"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Documents
              </Button>
              <Button onClick={fetchFolderData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Breadcrumb Navigation */}
        <div className="mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink 
                  href="/documents"
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
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
        </div>

        {/* Folder Header */}
        {state.folder && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div 
                  className="p-4 rounded-xl"
                  style={{ backgroundColor: `${state.folder.color}20` }}
                >
                  <FolderOpen 
                    className="h-8 w-8"
                    style={{ color: state.folder.color }} 
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    {state.folder.name}
                  </h1>
                  {state.folder.description && (
                    <p className="text-gray-600 mb-3">
                      {state.folder.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      <span>{state.folder.file_count} files</span>
                    </div>
                    <div>
                      {formatFileSize(state.folder.total_size)}
                    </div>
                    <div>
                      Created {new Date(state.folder.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button 
                  onClick={() => router.push('/documents')}
                  variant="outline"
                  className="touch-target"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                
                <Dialog open={state.showUpload} onOpenChange={(open) => 
                  setState(prev => ({ ...prev, showUpload: open }))
                }>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700 touch-target">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Files
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] max-w-4xl mx-auto max-h-[90vh] overflow-y-auto">
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
                  className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 touch-target"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create Review
                </Button>
                
                <Button 
                  onClick={fetchFolderData} 
                  variant="outline" 
                  disabled={state.loading}
                  className="touch-target"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${state.loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {state.error && (
          <div className="mb-6">
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          </div>
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
