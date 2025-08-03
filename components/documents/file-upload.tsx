"use client"
import { useState, useCallback, useRef } from 'react'
import { uploadFiles } from '@/lib/api/upload-api'
import type { UploadProgress } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { sanitizeFileName, formatFileProcessingError } from '@/lib/utils'
import {
  FileUpload as ShadcnFileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadItemProgress,
  FileUploadList,
  type FileUploadProps as ShadcnFileUploadProps,
  FileUploadTrigger,
} from "@/components/ui/file-upload"
import { 
  Upload, 
  X, 
  AlertCircle, 
  Files, 
  Folder,
  Check,
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw
} from 'lucide-react'
import { toast } from "sonner"

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

export function FileUpload({ onUploadSuccess, folderId }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([])
  const [selectedFiles, setSelectedFiles] = useState<FileWithStatus[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadComplete, setUploadComplete] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const generateFileId = () => Math.random().toString(36).substr(2, 9)

  const validateAndProcessFiles = useCallback((acceptedFiles: File[]) => {
    const allowedTypes = [
      // PDF
      'application/pdf',
      
      // Microsoft Word
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
      'application/vnd.ms-word.document.macroEnabled.12',
      'application/vnd.ms-word.template.macroEnabled.12',
      
      // Microsoft Excel
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
      'application/vnd.ms-excel.template.macroEnabled.12',
      'application/vnd.ms-excel.addin.macroEnabled.12',
      'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
      
      // Microsoft PowerPoint
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.presentationml.template',
      'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
      'application/vnd.ms-powerpoint.addin.macroEnabled.12',
      'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
      'application/vnd.ms-powerpoint.template.macroEnabled.12',
      'application/vnd.ms-powerpoint.slideshow.macroEnabled.12',
      
      // Microsoft Access
      'application/vnd.ms-access',
      
      // Text files
      'text/plain'
    ]
    
    const validFiles = acceptedFiles.filter(file => {
      if (allowedTypes.includes(file.type)) return true
      
      const extension = '.' + file.name.split('.').pop()?.toLowerCase()
      const allowedExtensions = [
        '.pdf', '.doc', '.docx', '.dotx', '.docm', '.dotm',
        '.xls', '.xlsx', '.xltx', '.xlsm', '.xltm', '.xlam', '.xlsb',
        '.ppt', '.pptx', '.potx', '.ppsx', '.ppam', '.pptm', '.potm', '.ppsm',
        '.mdb', '.accdb', '.accde', '.accdr', '.accdt',
        '.txt'
      ]
      return allowedExtensions.includes(extension)
    })
    
    const newFiles: FileWithStatus[] = validFiles.map(file => {
      // Enhanced filename sanitization with validation
      const sanitizedName = sanitizeFileName(file.name, 80) // Shorter for better compatibility
      
      // Validate the sanitized name
      if (sanitizedName === 'sanitized_file.txt' || sanitizedName.startsWith('file_')) {
        console.warn(`File "${file.name}" was heavily sanitized to "${sanitizedName}"`)
      }
      
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
    setFiles(prev => [...prev, ...validFiles])
    
    const rejectedCount = acceptedFiles.length - validFiles.length
    if (rejectedCount > 0) {
      setError(`${rejectedCount} file(s) rejected. Only PDF, Microsoft Office, and text files allowed.`)
      setTimeout(() => setError(null), 5000)
    }
  }, [])

  const onUpload: NonNullable<ShadcnFileUploadProps["onUpload"]> = useCallback(
    async (files, { onProgress, onSuccess, onError }) => {
      try {
        // First validate and process the files
        validateAndProcessFiles(files)
        
        // Process each file individually
        const uploadPromises = files.map(async (file) => {
          try {
            const fileWithStatus = selectedFiles.find(f => f.file.name === file.name)
            const fileId = fileWithStatus?.id || generateFileId()
            
            // Create upload progress callback for this specific file
            const progressCallback = (fileId: string, progress: UploadProgress) => {
              onProgress(file, progress.progress)
              updateFileProgress(fileId, progress)
            }
            
            const uploadItems = [{
              file,
              id: fileId,
              ...(folderId && { folderId })
            }]

            const result = await uploadFiles(
              uploadItems,
              progressCallback,
              {
                maxRetries: MAX_RETRIES,
                retryDelay: RETRY_DELAY,
                maxConcurrent: 1, // Process one at a time in this callback
                timeout: 60000
              }
            )

            if (result.success) {
              onSuccess(file)
            } else {
              const errorMsg = 'error' in result ? result.error : 'Upload failed'
              onError(file, new Error(formatFileProcessingError(errorMsg)))
            }
          } catch (error) {
            onError(
              file,
              error instanceof Error ? error : new Error("Upload failed"),
            )
          }
        })

        // Wait for all uploads to complete
        await Promise.all(uploadPromises)
        
        // Check if all uploads were successful
        const allSuccessful = files.every(file => 
          selectedFiles.find(f => f.file.name === file.name)?.status === 'completed'
        )
        
        if (allSuccessful) {
          setUploadComplete(true)
          setSuccessMessage(`Successfully uploaded ${files.length} file${files.length !== 1 ? 's' : ''}!`)
          setTimeout(() => {
            onUploadSuccess()
            setUploadComplete(false)
            setSuccessMessage(null)
            setSelectedFiles([])
            setFiles([])
          }, 2000)
        }
      } catch (error) {
        console.error("Unexpected error during upload:", error)
      }
    },
    [selectedFiles, folderId, onUploadSuccess, validateAndProcessFiles]
  )

  const onFileReject = useCallback((file: File, message: string) => {
    toast(message, {
      description: `"${file.name.length > 20 ? `${file.name.slice(0, 20)}...` : file.name}" has been rejected`,
    })
  }, [])

  const handleFolderSelect = () => folderInputRef.current?.click()

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length > 0) validateAndProcessFiles(files)
    event.target.value = ''
  }

  const removeFile = (id: string) => {
    setSelectedFiles(currentFiles => {
      const updatedFiles = currentFiles.filter(f => f.id !== id)
      // Also update the main files array
      const fileToRemove = currentFiles.find(f => f.id === id)
      if (fileToRemove) {
        setFiles(currentFiles => currentFiles.filter(f => f.name !== fileToRemove.file.name))
      }
      return updatedFiles
    })
  }

  const retryFile = async (id: string) => {
    const fileToRetry = selectedFiles.find(f => f.id === id)
    if (!fileToRetry) return

    setSelectedFiles(files => files.map(f => 
      f.id === id ? { ...f, status: 'pending', progress: 0, error: undefined } : f
    ))

    // Use the FileUpload onUpload mechanism for retry
    await onUpload([fileToRetry.file], {
      onProgress: (_file, progress) => {
        updateFileProgress(id, { status: 'uploading', progress, retries: fileToRetry.retries + 1 } as UploadProgress)
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      onSuccess: (_file) => {
        updateFileProgress(id, { status: 'completed', progress: 100, retries: fileToRetry.retries + 1 } as UploadProgress)
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      onError: (_file, _error) => {
        updateFileProgress(id, { status: 'failed', progress: 0, retries: fileToRetry.retries + 1 } as UploadProgress)
      }
    })
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

  // Note: handleUpload function preserved for potential future use
  // Currently not used but may be needed for alternative upload flows
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
          // Get specific error details from failed uploads
          const failedUploads = result.data?.filter(r => !r.success) || []
          const errorMessages = failedUploads.map(upload => 
            upload.error ? formatFileProcessingError(upload.error) : 'Upload failed'
          )
          
          const uniqueErrors = [...new Set(errorMessages)]
          setError(`${failureCount} file(s) failed: ${uniqueErrors.join(', ')}. You can retry individual files.`)
        }
      } else {
        setError(formatFileProcessingError(result.error || 'Upload failed'))
      }

    } catch (error) {
      console.error('Upload error:', error)
      setError(formatFileProcessingError(error))
    } finally {
      setUploading(false)
    }
  }

  // Format file size helper
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // File status counts - preserved for potential future display/logic
  // Currently calculated but not used in UI
  const pendingCount = selectedFiles.filter(f => f.status === 'pending').length
  const uploadingCount = selectedFiles.filter(f => ['uploading', 'processing', 'retrying', 'retry_pending'].includes(f.status)).length
  const completedCount = selectedFiles.filter(f => f.status === 'completed').length
  const failedCount = selectedFiles.filter(f => f.status === 'failed').length
  
  // Prevent unused variable warnings while keeping the logic
  void (pendingCount && uploadingCount && completedCount && failedCount)

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.dotx,.docm,.dotm,.xls,.xlsx,.xltx,.xlsm,.xltm,.xlam,.xlsb,.ppt,.pptx,.potx,.ppsx,.ppam,.pptm,.potm,.ppsm,.mdb,.accdb,.accde,.accdr,.accdt,.txt"
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

      {/* Modern FileUpload Component */}
      <ShadcnFileUpload
        value={files}
        onValueChange={setFiles}
        onUpload={onUpload}
        onFileReject={onFileReject}
        maxFiles={50}
        className="w-full"
        multiple
      >
        <FileUploadDropzone className="min-h-[200px] sm:min-h-[240px] lg:min-h-[280px]">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/25 p-6 sm:p-8">
              <Upload className="size-8 sm:size-10 lg:size-12 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <p className="text-xl sm:text-2xl lg:text-3xl font-semibold text-foreground">
                Drag & drop files here
              </p>
              <p className="text-sm sm:text-base text-muted-foreground max-w-md">
                  PDF, Microsoft Office (Word, Excel, PowerPoint, Access), and text files (max 50MB each)
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Concurrent uploads with automatic retry • Up to 50 files
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
              <FileUploadTrigger asChild>
                <Button variant="outline" size="lg" className="min-h-[44px] sm:min-h-[48px]">
                  <Files className="h-5 w-5 mr-2" />
                  Browse Files
                  </Button>
              </FileUploadTrigger>
                  
                  <Button 
                    variant="outline" 
                    size="lg"
                className="min-h-[44px] sm:min-h-[48px]"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFolderSelect()
                    }}
                    disabled={uploading}
                  >
                <Folder className="h-5 w-5 mr-2" />
                Select Folder
                  </Button>
                </div>
          </div>
        </FileUploadDropzone>

        <FileUploadList className="space-y-3 sm:space-y-4">
          {selectedFiles.map((fileWithStatus) => (
            <FileUploadItem 
              key={fileWithStatus.id} 
              value={fileWithStatus.file} 
              className="flex-col bg-muted/50 rounded-lg p-4 sm:p-5"
            >
              <div className="flex w-full items-center gap-3 sm:gap-4">
                <FileUploadItemPreview className="shrink-0" />
                <div className="flex-1 min-w-0 space-y-1">
                  <FileUploadItemMetadata 
                    className="break-words"
                    style={{ 
                      wordBreak: 'break-all',
                      overflowWrap: 'anywhere'
                    }}
                  />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatFileSize(fileWithStatus.file.size)}</span>
                    {fileWithStatus.status !== 'pending' && (
                      <>
                        <span>•</span>
                        <span className="capitalize flex items-center gap-1">
                          {fileWithStatus.status === 'completed' && (
                            <Check className="h-3 w-3 text-green-600" />
                          )}
                          {fileWithStatus.status === 'failed' && (
                            <AlertTriangle className="h-3 w-3 text-red-600" />
                          )}
                          {['uploading', 'processing', 'retrying'].includes(fileWithStatus.status) && (
                            <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                          )}
                          {fileWithStatus.status === 'retrying' ? 
                            `Retrying (${fileWithStatus.retries}/${MAX_RETRIES})` : 
                            fileWithStatus.status
                          }
                      </span>
                      </>
                    )}
                  </div>
            </div>
            
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      {fileWithStatus.status === 'failed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => retryFile(fileWithStatus.id)}
                      className="h-9 w-9 p-0 hover:bg-orange-100 hover:text-orange-600"
                          title="Retry upload"
                        >
                      <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      
                  <FileUploadItemDelete asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                      className="h-9 w-9 p-0 hover:bg-red-100 hover:text-red-600"
                      disabled={['uploading', 'processing', 'retrying'].includes(fileWithStatus.status)}
                        onClick={() => removeFile(fileWithStatus.id)}
                      >
                      <X className="h-4 w-4" />
                      </Button>
                  </FileUploadItemDelete>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {['uploading', 'processing', 'retrying'].includes(fileWithStatus.status) && (
                <FileUploadItemProgress className="mt-3" />
                  )}

                  {/* Error display */}
                  {fileWithStatus.status === 'failed' && fileWithStatus.error && (
                <div className="mt-3 text-xs text-red-600 px-3 py-2 bg-red-50 rounded border border-red-200 break-words">
                      {fileWithStatus.error}
                    </div>
                  )}
            </FileUploadItem>
          ))}
        </FileUploadList>
      </ShadcnFileUpload>

      {/* Status alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm break-words">{error}</AlertDescription>
        </Alert>
      )}
      
      {uploadComplete && successMessage && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-sm text-green-800 font-medium">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
