"use client"
import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { uploadFiles } from '@/lib/api/upload-api'
import type { UploadProgress } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { sanitizeFileName } from '@/lib/utils'
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

export function FileUpload({ onUploadSuccess, folderId }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileWithStatus[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const generateFileId = () => Math.random().toString(36).substr(2, 9)

  const onDrop = useCallback((acceptedFiles: File[]) => {
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
      setError(`${rejectedCount} file(s) rejected. Only PDF, Microsoft Office, and text files allowed.`)
      setTimeout(() => setError(null), 5000)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.template': ['.dotx'],
      'application/vnd.ms-word.document.macroEnabled.12': ['.docm'],
      'application/vnd.ms-word.template.macroEnabled.12': ['.dotm'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.template': ['.xltx'],
      'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
      'application/vnd.ms-excel.template.macroEnabled.12': ['.xltm'],
      'application/vnd.ms-excel.addin.macroEnabled.12': ['.xlam'],
      'application/vnd.ms-excel.sheet.binary.macroEnabled.12': ['.xlsb'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.openxmlformats-officedocument.presentationml.template': ['.potx'],
      'application/vnd.openxmlformats-officedocument.presentationml.slideshow': ['.ppsx'],
      'application/vnd.ms-powerpoint.addin.macroEnabled.12': ['.ppam'],
      'application/vnd.ms-powerpoint.presentation.macroEnabled.12': ['.pptm'],
      'application/vnd.ms-powerpoint.template.macroEnabled.12': ['.potm'],
      'application/vnd.ms-powerpoint.slideshow.macroEnabled.12': ['.ppsm'],
      'application/vnd.ms-access': ['.mdb', '.accdb'],
      'text/plain': ['.txt']
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

  // Format file size helper
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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

      {/* Upload area */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 sm:p-8 lg:p-12 text-center cursor-pointer transition-colors touch-manipulation ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <IconCloudUpload className="mx-auto h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 text-muted-foreground mb-3 sm:mb-4 lg:mb-6" />
            {isDragActive ? (
              <p className="text-base sm:text-lg lg:text-xl">Drop the files here...</p>
            ) : (
              <div className="space-y-3 sm:space-y-4 lg:space-y-6">
                <p className="text-lg sm:text-xl lg:text-2xl font-medium">
                  Drop files or folders here
                </p>
                <p className="text-sm sm:text-base text-muted-foreground px-2 max-w-md mx-auto">
                  PDF, Microsoft Office (Word, Excel, PowerPoint, Access), and text files (max 50MB each)
                  <br className="hidden sm:block" />
                  <span className="sm:hidden"> </span>
                  Concurrent uploads with automatic retry
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-3 sm:pt-4">
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="w-full sm:w-auto min-h-[48px] sm:min-h-[44px] touch-manipulation"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFileSelect()
                    }}
                    disabled={uploading}
                  >
                    <IconFiles className="h-5 w-5 mr-2 flex-shrink-0" />
                    <span>Select Files</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="w-full sm:w-auto min-h-[48px] sm:min-h-[44px] touch-manipulation"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFolderSelect()
                    }}
                    disabled={uploading}
                  >
                    <IconFolder className="h-5 w-5 mr-2 flex-shrink-0" />
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
                <div key={fileWithStatus.id} className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <IconFiles className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p 
                          className="font-medium text-gray-900 text-sm break-words leading-tight"
                          style={{ 
                            wordBreak: 'break-all',
                            overflowWrap: 'anywhere',
                            lineHeight: '1.3'
                          }}
                          title={fileWithStatus.file.name}
                        >
                          {fileWithStatus.file.name}
                        </p>
                        <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                          <span>{fileWithStatus.file.type || 'Unknown type'}</span>
                          <span>•</span>
                          <span>{formatFileSize(fileWithStatus.file.size)}</span>
                        </div>
                      </div>
                    </div>

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

                  {/* Progress bar */}
                  {['uploading', 'processing', 'retrying'].includes(fileWithStatus.status) && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 capitalize">
                          {fileWithStatus.status === 'retrying' ? 
                            `Retrying (${fileWithStatus.retries}/${MAX_RETRIES})` : 
                            fileWithStatus.status
                          }
                        </span>
                        <span className="text-gray-600">{fileWithStatus.progress}%</span>
                      </div>
                      <Progress value={fileWithStatus.progress} className="h-2" />
                    </div>
                  )}

                  {/* Error display */}
                  {fileWithStatus.status === 'failed' && fileWithStatus.error && (
                    <div className="text-xs text-red-600 px-3 py-2 bg-red-50 rounded border border-red-200 break-words">
                      {fileWithStatus.error}
                    </div>
                  )}
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
