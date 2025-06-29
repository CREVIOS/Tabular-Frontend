// ============================================================================
// DOCUMENTS API - Enhanced File Upload with Retry and Progress
// ============================================================================

import { apiClient, getAuthToken } from './core'
import type { 
  File,
  ApiResult,
  UploadProgress
} from './types'

interface UploadConfig {
  maxRetries?: number
  retryDelay?: number
  maxConcurrent?: number
  timeout?: number
}

interface FileUploadItem {
  file: globalThis.File
  id: string
  folderId?: string
}

interface FileUploadResult {
  success: boolean
  file?: File
  error?: string
  retries: number
}

export class UploadAPI {
  /**
   * Upload multiple files with concurrent processing, retry logic, and individual progress
   */
  static async uploadFiles(
    files: FileUploadItem[],
    onProgress: (fileId: string, progress: UploadProgress) => void,
    config: UploadConfig = {}
  ): Promise<ApiResult<FileUploadResult[]>> {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      maxConcurrent = 5,
      timeout = 30000
    } = config

    try {
      console.log(`📤 Starting upload of ${files.length} files (max concurrent: ${maxConcurrent})`)
      
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const results: FileUploadResult[] = []
      const activeUploads = new Set<Promise<FileUploadResult>>()

      // Process files with concurrency control
      for (const fileItem of files) {
        // Wait if we've reached max concurrent uploads
        if (activeUploads.size >= maxConcurrent) {
          const completed = await Promise.race(activeUploads)
          activeUploads.delete(Promise.resolve(completed))
          results.push(completed)
        }

        // Start upload for this file
        const uploadPromise = UploadAPI.uploadSingleFile(
          fileItem,
          authToken,
          onProgress,
          maxRetries,
          retryDelay,
          timeout
        )

        activeUploads.add(uploadPromise)
      }

      // Wait for remaining uploads to complete
      const remainingResults = await Promise.all(activeUploads)
      results.push(...remainingResults)

      const successCount = results.filter(r => r.success).length
      const failureCount = results.length - successCount

      console.log(`✅ Upload completed: ${successCount} success, ${failureCount} failed`)

      if (failureCount === 0) {
        return {
          success: true,
          data: results
        }
      } else {
        return {
          success: false,
          error: `${failureCount} file(s) failed to upload`
        }
      }

    } catch (error) {
      console.error('💥 Upload process failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload process failed'
      }
    }
  }

  /**
   * Upload a single file with retry logic and progress tracking
   */
  private static async uploadSingleFile(
    fileItem: FileUploadItem,
    authToken: string,
    onProgress: (fileId: string, progress: UploadProgress) => void,
    maxRetries: number,
    retryDelay: number,
    timeout: number
  ): Promise<FileUploadResult> {
    let retries = 0

    while (retries <= maxRetries) {
      try {
        // Update progress to uploading state
        onProgress(fileItem.id, {
          file: fileItem.file.name,
          progress: 0,
          status: retries > 0 ? 'retrying' : 'uploading',
          retries
        })

        const uploadedFile = await UploadAPI.performFileUpload(
          fileItem,
          authToken,
          (progress) => onProgress(fileItem.id, {
            file: fileItem.file.name,
            progress,
            status: 'uploading',
            retries
          }),
          timeout
        )

        // Success
        onProgress(fileItem.id, {
          file: fileItem.file.name,
          progress: 100,
          status: 'completed',
          retries
        })

        return {
          success: true,
          file: uploadedFile,
          retries
        }

      } catch (error) {
        retries++
        const isLastRetry = retries > maxRetries

        if (isLastRetry) {
          // Final failure
          onProgress(fileItem.id, {
            file: fileItem.file.name,
            progress: 0,
            status: 'failed',
            retries: retries - 1
          })

          return {
            success: false,
            error: error instanceof Error ? error.message : 'Upload failed',
            retries: retries - 1
          }
        }

        // Wait before retry
        onProgress(fileItem.id, {
          file: fileItem.file.name,
          progress: 0,
          status: 'retry_pending',
          retries: retries - 1
        })

        await new Promise(resolve => setTimeout(resolve, retryDelay * retries))
      }
    }

    // This should never be reached, but TypeScript requires it
    return {
      success: false,
      error: 'Unexpected error',
      retries: maxRetries
    }
  }

  /**
   * Perform the actual file upload using XMLHttpRequest for progress tracking
   */
  private static performFileUpload(
    fileItem: FileUploadItem,
    authToken: string,
    onProgress: (progress: number) => void,
    timeout: number
  ): Promise<File> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()

      // Prepare form data
      formData.append('files', fileItem.file)
      if (fileItem.folderId) {
        formData.append('folder_id', fileItem.folderId)
      }

      // Configure request
      xhr.timeout = timeout
      xhr.withCredentials = false

      // Progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          onProgress(progress)
        }
      })

      // Success handler
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            // Backend returns array, take first file
            const uploadedFile = Array.isArray(response) ? response[0] : response
            resolve(uploadedFile)
          } catch {
            reject(new Error('Invalid response format'))
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText)
            reject(new Error(errorResponse.detail || `HTTP ${xhr.status}`))
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        }
      })

      // Error handlers
      xhr.addEventListener('error', () => {
        reject(new Error('Network error occurred'))
      })

      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timed out'))
      })

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload was aborted'))
      })

      // Start upload
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://app2.makebell.com:8443'
      xhr.open('POST', `${backendUrl}/api/files/upload`)
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`)
      xhr.send(formData)
    })
  }

  /**
   * Legacy upload method for backward compatibility
   */
  static async uploadFilesLegacy(
    formData: FormData,
    onProgress?: (progress: UploadProgress[]) => void
  ): Promise<ApiResult<File[]>> {
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      // Note: Progress callback not implemented in upload method yet
      if (onProgress) {
        const files = Array.from(formData.getAll('files')) as globalThis.File[]
        const fileProgress: UploadProgress[] = files.map((file) => ({
          file: file.name,
          progress: 0,
          status: 'uploading'
        }))
        onProgress(fileProgress)
      }

      const result = await apiClient.upload<File[]>(
        '/api/files/upload', 
        formData, 
        authToken
      )

      return result

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload files'
      }
    }
  }
}

// Export the upload function
export const uploadFiles = UploadAPI.uploadFiles
export const uploadFilesLegacy = UploadAPI.uploadFilesLegacy