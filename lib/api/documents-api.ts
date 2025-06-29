// ============================================================================
// DOCUMENTS API - File and Folder Management
// ============================================================================

import { apiClient, getAuthToken } from './core'
import type { 
  DocumentsData,
  DocumentsStats,
  FolderDetailsData,
  File,
  Folder,
  MarkdownResponse,
  ApiResult,
  FolderCreate,
  FolderUpdate,
  PaginatedRequest,
  // PaginatedResponse,
  UploadProgress
} from './types'

export class DocumentsAPI {
  /**
   * Fetch all documents data with parallel processing
   */
  static async fetchDocumentsData(): Promise<ApiResult<DocumentsData>> {
    try {
      console.log('📂 Fetching documents data...')
      
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      // Fetch folders and orphaned files in parallel
      const results = await apiClient.parallel({
        folders: { 
          endpoint: '/api/folders/',
          timeout: 8000 
        },
        orphanedFiles: { 
          endpoint: '/api/files/?folder_id=null&page=1&limit=50',
          timeout: 10000 
        }
      }, authToken)

      const folders: Folder[] = results.folders.success 
        ? (Array.isArray(results.folders.data) ? results.folders.data : [])
        : []

      const orphanedFiles: File[] = results.orphanedFiles.success 
        ? (Array.isArray(results.orphanedFiles.data) ? results.orphanedFiles.data : [])
        : []

      // Fetch files for each folder in parallel (with concurrency control)
      const folderFileRequests = folders.length > 0 
        ? folders.reduce((acc, folder) => {
            acc[`folder_${folder.id}`] = {
              endpoint: `/api/files/?folder_id=${folder.id}&page=1&limit=25`,
              timeout: 8000
            }
            return acc
          }, {} as Record<string, { endpoint: string; timeout: number }>)
        : {}

      const folderFileResults = Object.keys(folderFileRequests).length > 0 
        ? await apiClient.parallel(folderFileRequests, authToken)
        : {}

      // Combine all files and update folder counts
      const allFiles: File[] = [...orphanedFiles]
      const foldersWithCounts = folders.map(folder => {
        const folderResult = folderFileResults[`folder_${folder.id}`]
        const folderFiles: File[] = folderResult?.success && folderResult.data
          ? (Array.isArray(folderResult.data) ? folderResult.data : [])
          : []

        allFiles.push(...folderFiles)
        
        return {
          ...folder,
          file_count: folderFiles.length
        }
      })

      // Calculate statistics
      const stats = DocumentsAPI.calculateDocumentsStats(foldersWithCounts, allFiles)

      // Collect errors
      const errors: string[] = []
      if (!results.folders.success) errors.push(`Folders: ${results.folders.error}`)
      if (!results.orphanedFiles.success) errors.push(`Files: ${results.orphanedFiles.error}`)
      
      Object.entries(folderFileResults).forEach(([key, result]) => {
        if (!result.success) {
          const folderId = key.replace('folder_', '')
          errors.push(`Folder ${folderId} files: ${result.error}`)
        }
      })

      const documentsData: DocumentsData = {
        folders: foldersWithCounts,
        files: allFiles,
        stats,
        ...(errors.length > 0 && { errors })
      }

      console.log('✅ Documents data fetched successfully', {
        folders: foldersWithCounts.length,
        files: allFiles.length,
        errors: errors.length
      })

      return { 
        success: true, 
        data: documentsData,
        ...(errors.length > 0 && { warnings: errors })
      }

    } catch (error) {
      console.error('💥 Documents API error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch documents data'
      }
    }
  }

  /**
   * Fetch specific folder details with files
   */
  static async fetchFolderDetails(folderId: string): Promise<ApiResult<FolderDetailsData>> {
    try {
      console.log(`📁 Fetching folder details: ${folderId}`)
      
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      // Note: Backend doesn't have individual folder endpoint, so we get from folders list
      const results = await apiClient.parallel({
        folders: { 
          endpoint: '/api/folders/',
          timeout: 8000 
        },
        files: { 
          endpoint: `/api/files/?folder_id=${folderId}`,
          timeout: 10000 
        }
      }, authToken)

      if (!results.folders.success) {
        return { success: false, error: results.folders.error || 'Failed to fetch folder' }
      }

      // Find the specific folder
      const folders = Array.isArray(results.folders.data) ? results.folders.data : []
      const folder = folders.find((f: Folder) => f.id === folderId)

      if (!folder) {
        return { success: false, error: 'Folder not found' }
      }

      const files: File[] = results.files.success 
        ? (Array.isArray(results.files.data) ? results.files.data : [])
        : []

      // Calculate folder stats
      const stats = DocumentsAPI.calculateFolderStats(files)

      const errors: string[] = []
      if (!results.files.success) {
        errors.push(`Files: ${results.files.error}`)
      }

      const folderData: FolderDetailsData = {
        folder,
        files,
        stats,
        ...(errors.length > 0 && { errors })
      }

      return { success: true, data: folderData }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch folder details'
      }
    }
  }

  /**
   * Fetch paginated files with filtering
   */
  static async fetchFiles(params: PaginatedRequest = {}): Promise<ApiResult<File[]>> {
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const queryParams = new URLSearchParams()
      if (params.page) queryParams.set('page', params.page.toString())
      if (params.page_size) queryParams.set('limit', params.page_size.toString())
      if (params.folder_id !== undefined) {
        queryParams.set('folder_id', params.folder_id || 'null')
      }

      const result = await apiClient.get<File[]>(
        `/api/files/?${queryParams.toString()}`,
        authToken
      )

      return result.success
        ? { success: true, data: result.data! }
        : { success: false, error: result.error || 'Failed to fetch files' }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch files'
      }
    }
  }

  /**
   * Create new folder
   */
  static async createFolder(data: FolderCreate): Promise<ApiResult<Folder>> {
    try {
      console.log(`📁 Creating folder: ${data.name}`)
      
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const result = await apiClient.post<Folder>('/api/folders/', data, authToken)
      
      if (result.success) {
        console.log(`✅ Folder created: ${result.data?.name}`)
      }

      return result.success
        ? { success: true, data: result.data! }
        : { success: false, error: result.error || 'Failed to create folder' }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create folder'
      }
    }
  }

  /**
   * Update existing folder
   */
  static async updateFolder(folderId: string, data: FolderUpdate): Promise<ApiResult<Folder>> {
    try {
      console.log(`📁 Updating folder: ${folderId}`)
      
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const result = await apiClient.put<Folder>(`/api/folders/${folderId}`, data, authToken)

      return result.success
        ? { success: true, data: result.data! }
        : { success: false, error: result.error || 'Failed to update folder' }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update folder'
      }
    }
  }

  /**
   * Delete folder
   */
  static async deleteFolder(folderId: string): Promise<ApiResult<{ message: string; files_moved: number }>> {
    try {
      console.log(`🗑️ Deleting folder: ${folderId}`)
      
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const result = await apiClient.delete<{ message: string; files_moved: number }>(`/api/folders/${folderId}`, authToken)

      if (result.success) {
        console.log(`✅ Folder deleted: ${folderId}`)
      }

      return result.success
        ? { success: true, data: result.data! }
        : { success: false, error: result.error || 'Failed to delete folder' }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete folder'
      }
    }
  }

  /**
   * Move file to different folder
   */
  static async moveFile(fileId: string, folderId?: string): Promise<ApiResult<{ message: string; folder_id?: string }>> {
    try {
      console.log(`📄 Moving file: ${fileId} to folder: ${folderId || 'none'}`)
      
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const data = { folder_id: folderId }
      const result = await apiClient.put<{ message: string; folder_id?: string }>(`/api/files/${fileId}/move`, data, authToken)

      return result.success
        ? { success: true, data: result.data! }
        : { success: false, error: result.error || 'Failed to move file' }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to move file'
      }
    }
  }

  /**
   * Get file markdown content
   */
  static async getFileMarkdown(fileId: string): Promise<ApiResult<MarkdownResponse>> {
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const result = await apiClient.get<MarkdownResponse>(`/api/files/${fileId}/markdown`, authToken)

      return result.success
        ? { success: true, data: result.data! }
        : { success: false, error: result.error || 'Failed to fetch file content' }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch file content'
      }
    }
  }

  /**
   * Upload files with progress tracking
   */
  static async uploadFiles(
    formData: FormData,
    onProgress?: (progress: UploadProgress[]) => void
  ): Promise<ApiResult<File[]>> {
    try {
      console.log('📤 Starting file upload...')
      
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      // Note: Progress callback removed as upload method doesn't support it yet
      if (onProgress) {
        // Simulate basic progress
        const files = Array.from(formData.getAll('files')) as (globalThis.File)[]
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

      if (result.success) {
        console.log(`✅ Upload completed: ${result.data?.length} files`)
      }

      return result

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload files'
      }
    }
  }

  /**
   * Calculate documents statistics
   */
  private static calculateDocumentsStats(folders: Folder[], files: File[]): DocumentsStats {
    const files_by_status = files.reduce((acc, file) => {
      acc[file.status] = (acc[file.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const files_by_type = files.reduce((acc, file) => {
      const type = file.file_type || 'unknown'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      total_folders: folders.length,
      total_files: files.length,
      files_by_status,
      files_by_type
    }
  }

  /**
   * Calculate folder-specific statistics
   */
  private static calculateFolderStats(files: File[]) {
    const files_by_status = files.reduce((acc, file) => {
      acc[file.status] = (acc[file.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const files_by_type = files.reduce((acc, file) => {
      const type = file.file_type || 'unknown'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      total_files: files.length,
      files_by_status,
      files_by_type
    }
  }
}

/**
 * Format file size in human readable format
 */
export const formatFileSize = (bytes: number = 0): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// Export individual functions for convenience
export const fetchDocumentsData = DocumentsAPI.fetchDocumentsData
export const fetchFolderDetails = DocumentsAPI.fetchFolderDetails
export const fetchFiles = DocumentsAPI.fetchFiles
export const createFolder = DocumentsAPI.createFolder
export const updateFolder = DocumentsAPI.updateFolder
export const deleteFolder = DocumentsAPI.deleteFolder
export const moveFile = DocumentsAPI.moveFile
export const getFileMarkdown = DocumentsAPI.getFileMarkdown
export const uploadFiles = DocumentsAPI.uploadFiles