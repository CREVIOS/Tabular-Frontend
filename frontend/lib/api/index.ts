// ============================================================================
// API INDEX - Main entry point for all API functions
// ============================================================================

// Core API exports
export * from './core'
export * from './types'

// Feature-specific API exports
export * from './dashboard-api'
export * from './reviews-api'

// Documents API exports (excluding uploadFiles to avoid conflict)
export {
  fetchDocumentsData,
  fetchFolderDetails,
  fetchFiles,
  createFolder,
  updateFolder,
  deleteFolder,
  moveFile,
  getFileMarkdown,
  formatFileSize
} from './documents-api'

// Upload API exports
export {
  uploadFiles,
  uploadFilesLegacy,
  UploadAPI
} from './upload-api'

// Organized API object exports for backwards compatibility
import { uploadFiles, uploadFilesLegacy } from './upload-api'
import { 
  fetchDocumentsData, 
  fetchFolderDetails, 
  fetchFiles, 
  createFolder, 
  updateFolder, 
  deleteFolder, 
  moveFile, 
  getFileMarkdown
} from './documents-api'
import {
  fetchReviewsData,
  fetchReview,
  fetchPaginatedReviews,
  createReview,
  deleteReview,
  addColumn,
  updateColumn,
  deleteColumn,
  addFiles,
  startAnalysis,
  getAnalysisStatus,
  updateResult,
  exportReview,
  getReviewStats,
  getReviewsSummary
} from './reviews-api'
import {
  fetchDashboardData,
  fetchDashboardStats,
  fetchRecentActivity,
  refreshDashboardData,
  getUserSummary,
  dashboardHealthCheck
} from './dashboard-api'

// Organized API objects
export const files = {
  upload: async (fileList: globalThis.File[], folderId?: string | null) => {
    // Convert File[] to FormData for legacy upload
    const formData = new FormData()
    fileList.forEach(file => {
      formData.append('files', file)
    })
    if (folderId) {
      formData.append('folder_id', folderId)
    }
    
    return uploadFilesLegacy(formData)
  },
  uploadFiles,
  uploadFilesLegacy,
  fetchFiles,
  moveFile,
  getMarkdown: getFileMarkdown
}

export const folders = {
  fetch: fetchDocumentsData,
  fetchDetails: fetchFolderDetails,
  create: createFolder,
  update: updateFolder,
  delete: deleteFolder
}

export const reviews = {
  fetch: fetchReviewsData,
  fetchOne: fetchReview,
  fetchPaginated: fetchPaginatedReviews,
  create: createReview,
  delete: deleteReview,
  addColumn,
  updateColumn,
  deleteColumn,
  addFiles,
  startAnalysis,
  getStatus: getAnalysisStatus,
  updateResult,
  export: exportReview,
  getStats: getReviewStats,
  getSummary: getReviewsSummary
}

export const dashboard = {
  fetch: fetchDashboardData,
  fetchStats: fetchDashboardStats,
  fetchRecentActivity,
  refresh: refreshDashboardData,
  getUserSummary,
  healthCheck: dashboardHealthCheck
}

// Default export for convenience
const api = {
  files,
  folders,
  reviews,
  dashboard
}

export default api 