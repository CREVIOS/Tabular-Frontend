import { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { sanitizeFileName, formatFileProcessingError } from '@/lib/utils'
import { 
  IconCloudUpload, 
  IconX
} from '@tabler/icons-react'
import { Folder, Files } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'

interface Folder {
  id: string
  name: string
  description: string | null
  color: string
  file_count: number
  total_size: number
}

interface FileUploadWithFoldersProps {
  onUploadSuccess: () => void
  selectedFolderId?: string | null
  onFolderChange?: (folderId: string | null) => void
}

export default function FileUploadWithFolders({ 
  onUploadSuccess, 
  selectedFolderId, 
  onFolderChange 
}: FileUploadWithFoldersProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [loadingFolders, setLoadingFolders] = useState(true)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(selectedFolderId || null)
  const [error, setError] = useState<string | null>(null)

  // Fetch folders on component mount
  useEffect(() => {
    fetchFolders()
  }, [])

  // Update currentFolderId when selectedFolderId prop changes
  useEffect(() => {
    setCurrentFolderId(selectedFolderId || null)
  }, [selectedFolderId])

  const fetchFolders = async () => {
    try {
      setLoadingFolders(true)
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        setError('Authentication required')
        return
      }

      const response = await fetch('https://app2.makebell.com:8443/api/folders/', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setFolders(data)
    } catch (error: Error | unknown) {
      console.error('Failed to fetch folders:', error)
      setError('Failed to load folders')
    } finally {
      setLoadingFolders(false)
    }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Filter files based on allowed types
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
      if (allowedTypes.includes(file.type)) {
        return true
      }
      
      // Additional check by extension for files with incorrect MIME types
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
    
    // Sanitize filenames for security
    const processedFiles = validFiles.map(file => {
      // Enhanced filename sanitization with validation
      const sanitizedName = sanitizeFileName(file.name, 80) // Shorter for better compatibility
      
      // Validate the sanitized name
      if (sanitizedName === 'sanitized_file.txt' || sanitizedName.startsWith('file_')) {
        console.warn(`File "${file.name}" was heavily sanitized to "${sanitizedName}"`)
      }
      
      return new File([file], sanitizedName, { type: file.type })
    })
    
    setSelectedFiles(prev => [...prev, ...processedFiles])
    
    // Show warning for rejected files
    const rejectedCount = acceptedFiles.length - validFiles.length
    if (rejectedCount > 0) {
      setError(`${rejectedCount} file(s) were rejected. Please upload PDF, Microsoft Office, or text files only.`)
    } else {
      setError(null)
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
    maxSize: 50 * 1024 * 1024, // 50MB limit
    multiple: true
  })

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index))
  }

  const handleFolderChange = (folderId: string | null) => {
    setCurrentFolderId(folderId)
    onFolderChange?.(folderId)
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    setUploading(true)
    setError(null)
    
    try {
      console.log('Starting upload:', selectedFiles.map(f => ({ name: f.name, type: f.type, size: f.size })))
      console.log('Target folder:', currentFolderId)
      
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        throw new Error('Authentication required')
      }

      // Create FormData and append files
      const formData = new FormData()
      selectedFiles.forEach(file => {
        formData.append('files', file)
      })
      
      // Add folder_id if selected
      if (currentFolderId) {
        formData.append('folder_id', currentFolderId)
      }

      const response = await fetch('https://app2.makebell.com:8443/api/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
          // Don't set Content-Type header - let browser set it with boundary for FormData
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }))
        const errorMessage = errorData.detail || errorData.message || `HTTP error! status: ${response.status}`
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log('Upload successful:', result)
      
      setSelectedFiles([])
      onUploadSuccess()
      
    } catch (error: unknown) {
      console.error('Upload failed:', error)
      setError(formatFileProcessingError(error))
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getSelectedFolderName = () => {
    if (!currentFolderId) return 'Uncategorized'
    const folder = folders.find(f => f.id === currentFolderId)
    return folder?.name || 'Unknown Folder'
  }

  return (
    <div className="space-y-6">
      {/* Folder Selection */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Select Destination</h3>
            </div>
            
            {loadingFolders ? (
              <div className="animate-pulse">
                <div className="h-10 bg-gray-200 rounded-md"></div>
              </div>
            ) : (
              <Select
                value={currentFolderId || 'uncategorized'}
                onValueChange={(value) => handleFolderChange(value === 'uncategorized' ? null : value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a folder">
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4" />
                      <span>{getSelectedFolderName()}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncategorized">
                    <div className="flex items-center gap-2">
                      <Files className="h-4 w-4 text-gray-500" />
                      <span>Uncategorized</span>
                    </div>
                  </SelectItem>
                  {folders.map(folder => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: folder.color }}
                        />
                        <span>{folder.name}</span>
                        <span className="text-xs text-gray-500">({folder.file_count} files)</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <div className="text-sm text-gray-600">
              Files will be uploaded to: <span className="font-semibold">{getSelectedFolderName()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Upload Area */}
      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 sm:p-8 lg:p-12 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            <IconCloudUpload className="mx-auto h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 text-gray-400 mb-4 sm:mb-6" />
            {isDragActive ? (
              <div>
                <p className="text-lg sm:text-xl lg:text-2xl font-medium text-blue-600">Drop the files here...</p>
                <p className="text-sm sm:text-base text-blue-500 mt-2">
                  Files will be added to {getSelectedFolderName()}
                </p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                <p className="text-lg sm:text-xl lg:text-2xl font-medium text-gray-700">Drop files here or click to browse</p>
                <p className="text-sm sm:text-base text-gray-500 mt-2 max-w-md mx-auto">
                  Support for PDF, Microsoft Office (Word, Excel, PowerPoint, Access), and text files (max 50MB each)
                </p>
                <p className="text-xs sm:text-sm text-gray-400 mt-3">
                  Files will be uploaded to: {getSelectedFolderName()}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">
                  Selected Files ({selectedFiles.length})
                </h3>
                <div className="text-sm text-gray-500">
                  Destination: <span className="font-semibold">{getSelectedFolderName()}</span>
                </div>
              </div>
              
              <div className="space-y-3">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Files className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p 
                          className="font-medium text-gray-900 break-words leading-tight"
                          style={{ 
                            wordBreak: 'break-all',
                            overflowWrap: 'anywhere',
                            lineHeight: '1.3'
                          }}
                          title={file.name}
                        >
                          {file.name}
                        </p>
                        <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                          <span>{file.type || 'Unknown type'}</span>
                          <span>•</span>
                          <span>{formatFileSize(file.size)}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-red-600 flex-shrink-0"
                    >
                      <IconX className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Uploading to {getSelectedFolderName()}...
                    </>
                  ) : (
                    <>
                      <IconCloudUpload className="h-4 w-4 mr-2" />
                      Upload {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} to {getSelectedFolderName()}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Quick Stats */}
      {selectedFiles.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          Total size: {formatFileSize(selectedFiles.reduce((sum, file) => sum + file.size, 0))} • 
          Uploading to: <span className="font-semibold">{getSelectedFolderName()}</span>
        </div>
      )}
    </div>
  )
}