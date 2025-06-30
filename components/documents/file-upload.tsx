"use client"
import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { uploadFiles } from '@/lib/api/upload-api'
import type { UploadProgress } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  IconCloudUpload, 
  IconX, 
  IconAlertCircle, 
  IconFiles, 
  IconFolder,
  IconCheck,
  IconExclamationMark,
  IconLoader2,
  IconRefresh
} from '@tabler/icons-react'

type FileStatus = 'pending' | 'uploading' | 'processing' | 'retrying' | 'retry_pending' | 'completed' | 'failed'

interface FileWithStatus {
  file: File
  status: FileStatus
  progress: number
  error?: string
  retries: number
  id: string
}

interface FileUploadProps {
  onUploadSuccess: () => void
  folderId?: string | null
}

const MAX_CONCURRENT_UPLOADS = 5
const MAX_RETRIES = 3
const RETRY_DELAY = 1000

function sanitizeFileName(name: string, maxLength: number = 100): string {
  // Remove any characters not alphanumeric, dash, underscore, or dot
  const sanitized = name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, maxLength)
  return sanitized
}

export function FileUpload({ onUploadSuccess, folderId }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileWithStatus[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const generateFileId = () => Math.random().toString(36).substr(2, 9)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    
    const validFiles = acceptedFiles.filter(file => {
      if (allowedTypes.includes(file.type)) return true
      
      const extension = '.' + file.name.split('.').pop()?.toLowerCase()
      const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx']
      return allowedExtensions.includes(extension)
    })
    
    const newFiles: FileWithStatus[] = validFiles.map(file => {
      const sanitizedName = sanitizeFileName(file.name)
      const safeFile = new File([file], sanitizedName, { type: file.type })
      return {
        file: safeFile,
        status: 'pending',
        progress: 0,
        retries: 0,
        id: generateFileId()
      }
    })
    
    setSelectedFiles(prev => [...prev, ...newFiles])
    
    const rejectedCount = acceptedFiles.length - validFiles.length
    if (rejectedCount > 0) {
      setError(`${rejectedCount} file(s) rejected. Only PDF, Word, Excel, and text files allowed.`)
      setTimeout(() => setError(null), 5000)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxSize: 50 * 1024 * 1024,
    multiple: true
  })

  const handleFileSelect = () => fileInputRef.current?.click()
  const handleFolderSelect = () => folderInputRef.current?.click()

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length > 0) onDrop(files)
    event.target.value = ''
  }

  const removeFile = (id: string) => {
    setSelectedFiles(files => files.filter(f => f.id !== id))
  }

  const retryFile = async (id: string) => {
    const fileToRetry = selectedFiles.find(f => f.id === id)
    if (!fileToRetry) return

    setSelectedFiles(files => files.map(f => 
      f.id === id ? { ...f, status: 'pending', progress: 0, error: undefined } : f
    ))

    await handleUpload([fileToRetry])
  }

  const updateFileProgress = (fileId: string, progress: UploadProgress) => {
    setSelectedFiles(prev => prev.map(f => 
      f.id === fileId ? {
        ...f,
        status: progress.status,
        progress: progress.progress,
        retries: progress.retries || 0,
        ...(progress.status === 'failed' && { error: 'Upload failed' })
      } : f
    ))
  }

  const handleUpload = async (filesToUpload?: FileWithStatus[]) => {
    const files = filesToUpload || selectedFiles.filter(f => f.status === 'pending')
    if (files.length === 0) return

    setUploading(true)
    setError(null)

    try {
      const uploadItems = files.map(fileWithStatus => ({
        file: fileWithStatus.file,
        id: fileWithStatus.id,
        ...(folderId && { folderId })
      }))

      const result = await uploadFiles(
        uploadItems,
        updateFileProgress,
        {
          maxRetries: MAX_RETRIES,
          retryDelay: RETRY_DELAY,
          maxConcurrent: MAX_CONCURRENT_UPLOADS,
          timeout: 60000
        }
      )

      if (result.success) {
        const successCount = result.data?.filter(r => r.success).length || 0
        const failureCount = (result.data?.length || 0) - successCount
        
        if (failureCount === 0) {
          console.log(`✅ All ${successCount} files uploaded successfully`)
          onUploadSuccess()
        } else {
          setError(`${failureCount} file(s) failed to upload. You can retry individual files.`)
        }
      } else {
        setError(result.error || 'Upload failed')
      }

    } catch (error) {
      console.error('Upload error:', error)
      setError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const getStatusIcon = (file: FileWithStatus) => {
    switch (file.status) {
      case 'pending':
        return null
      case 'uploading':
      case 'processing':
        return <IconLoader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
      case 'retrying':
        return <IconRefresh className="h-4 w-4 animate-spin text-orange-500 flex-shrink-0" />
      case 'retry_pending':
        return <IconRefresh className="h-4 w-4 text-orange-500 flex-shrink-0" />
      case 'completed':
        return <IconCheck className="h-4 w-4 text-green-500 flex-shrink-0" />
      case 'failed':
        return <IconExclamationMark className="h-4 w-4 text-red-500 flex-shrink-0" />
    }
  }

  const getStatusText = (file: FileWithStatus) => {
    switch (file.status) {
      case 'pending':
        return 'Ready to upload'
      case 'uploading':
        return `Uploading... ${file.progress}%`
      case 'processing':
        return `Processing... ${file.progress}%`
      case 'retrying':
        return `Retrying... (${file.retries + 1}/${MAX_RETRIES})`
      case 'retry_pending':
        return `Retry ${file.retries + 1}/${MAX_RETRIES} pending...`
      case 'completed':
        return 'Upload completed'
      case 'failed':
        return `Failed after ${file.retries} retries`
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Smart file name truncation for different screen sizes
  const truncateFileName = (fileName: string, maxLength: number = 30) => {
    if (fileName.length <= maxLength) return fileName
    
    const extension = fileName.split('.').pop()
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'))
    const maxNameLength = maxLength - (extension?.length || 0) - 3 // Account for "..." and "."
    
    if (maxNameLength <= 0) return fileName.substring(0, maxLength - 3) + '...'
    
    return nameWithoutExt.substring(0, maxNameLength) + '...' + (extension ? '.' + extension : '')
  }

  const pendingCount = selectedFiles.filter(f => f.status === 'pending').length
  const uploadingCount = selectedFiles.filter(f => ['uploading', 'processing', 'retrying', 'retry_pending'].includes(f.status)).length
  const completedCount = selectedFiles.filter(f => f.status === 'completed').length
  const failedCount = selectedFiles.filter(f => f.status === 'failed').length

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.xls,.xlsx"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        {...({ 
          webkitdirectory: "", 
          directory: "" 
        } as Record<string, string>)}
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Upload area */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-4 sm:p-6 lg:p-8 text-center cursor-pointer transition-colors touch-manipulation ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <IconCloudUpload className="mx-auto h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-muted-foreground mb-2 sm:mb-3 lg:mb-4" />
            {isDragActive ? (
              <p className="text-sm sm:text-base">Drop the files here...</p>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                <p className="text-base sm:text-lg lg:text-xl font-medium">
                  Drop files or folders here
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground px-2">
                  PDF, Word, Excel, and text files (max 50MB each)
                  <br className="hidden sm:block" />
                  <span className="sm:hidden"> </span>
                  Concurrent uploads with automatic retry
                </p>
                
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center pt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] touch-manipulation"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFileSelect()
                    }}
                    disabled={uploading}
                  >
                    <IconFiles className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>Select Files</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] touch-manipulation"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFolderSelect()
                    }}
                    disabled={uploading}
                  >
                    <IconFolder className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>Select Folder</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error alert */}
      {error && (
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4 flex-shrink-0" />
          <AlertDescription className="text-sm break-words">{error}</AlertDescription>
        </Alert>
      )}

      {/* File list */}
      {selectedFiles.length > 0 && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <h3 className="font-medium text-sm sm:text-base">
                  Files ({selectedFiles.length})
                </h3>
                {(completedCount > 0 || failedCount > 0 || uploadingCount > 0) && (
                  <div className="flex items-center gap-3 text-xs sm:text-sm">
                    {uploadingCount > 0 && (
                      <span className="text-blue-600 flex items-center gap-1">
                        <IconLoader2 className="h-3 w-3 animate-spin flex-shrink-0" />
                        <span>{uploadingCount}</span>
                      </span>
                    )}
                    {completedCount > 0 && (
                      <span className="text-green-600 flex items-center gap-1">
                        <IconCheck className="h-3 w-3 flex-shrink-0" />
                        <span>{completedCount}</span>
                      </span>
                    )}
                    {failedCount > 0 && (
                      <span className="text-red-600 flex items-center gap-1">
                        <IconExclamationMark className="h-3 w-3 flex-shrink-0" />
                        <span>{failedCount}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="self-start sm:self-auto min-h-[36px] touch-manipulation"
                onClick={() => setSelectedFiles([])}
                disabled={uploading}
              >
                Clear All
              </Button>
            </div>
            
            <div className="space-y-2 sm:space-y-3 max-h-60 sm:max-h-80 overflow-y-auto">
              {selectedFiles.map((fileWithStatus) => (
                <div key={fileWithStatus.id} className="p-3 sm:p-4 bg-muted rounded-lg border">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="flex-1 min-w-0 space-y-1 sm:space-y-2">
                      {/* File name and status */}
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          {/* Mobile: Show truncated name */}
                          <p 
                            className="text-sm font-medium break-words sm:hidden leading-tight"
                            title={fileWithStatus.file.name}
                          >
                            {truncateFileName(fileWithStatus.file.name, 25)}
                          </p>
                          {/* Desktop: Show more of the name */}
                          <p 
                            className="text-sm font-medium break-words hidden sm:block leading-tight"
                            title={fileWithStatus.file.name}
                          >
                            {truncateFileName(fileWithStatus.file.name, 50)}
                          </p>
                        </div>
                        <div className="flex-shrink-0 mt-0.5">
                          {getStatusIcon(fileWithStatus)}
                        </div>
                      </div>
                      
                      {/* File info and status */}
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs text-muted-foreground">
                        <span className="bg-background px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs border flex-shrink-0">
                          {fileWithStatus.file.type?.split('/')[1]?.toUpperCase() || 'FILE'}
                        </span>
                        <span className="flex-shrink-0">{formatFileSize(fileWithStatus.file.size)}</span>
                        <span className="text-foreground text-xs min-w-0 break-words">
                          {getStatusText(fileWithStatus)}
                        </span>
                      </div>
                      
                      {/* Progress bar */}
                      {['uploading', 'processing', 'retrying'].includes(fileWithStatus.status) && (
                        <div className="w-full">
                          <Progress value={fileWithStatus.progress} className="h-1.5 sm:h-2" />
                        </div>
                      )}
                      
                      {/* Error message */}
                      {fileWithStatus.status === 'failed' && fileWithStatus.error && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 break-words">
                          {fileWithStatus.error}
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-1">
                      {fileWithStatus.status === 'failed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => retryFile(fileWithStatus.id)}
                          className="h-8 w-8 p-0 hover:bg-orange-100 hover:text-orange-600 touch-manipulation flex-shrink-0"
                          title="Retry upload"
                        >
                          <IconRefresh className="h-4 w-4" />
                          <span className="sr-only">Retry upload</span>
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(fileWithStatus.id)}
                        className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 touch-manipulation flex-shrink-0"
                        disabled={['uploading', 'processing', 'retrying'].includes(fileWithStatus.status)}
                        title="Remove file"
                      >
                        <IconX className="h-4 w-4" />
                        <span className="sr-only">Remove file</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {pendingCount > 0 && (
              <Button
                onClick={() => handleUpload()}
                disabled={uploading}
                className="w-full mt-3 sm:mt-4 min-h-[44px] touch-manipulation"
              >
                {uploading ? (
                  <>
                    <IconLoader2 className="animate-spin h-4 w-4 mr-2 flex-shrink-0" />
                    <span>Uploading {uploadingCount} files...</span>
                  </>
                ) : (
                  <span>Upload {pendingCount} file{pendingCount !== 1 ? 's' : ''}</span>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
