// ============================================================================
// API MODULES INDEX - Central export point for all API functionality
// ============================================================================

import { DocumentsAPI } from './documents-api'
import { ReviewsAPI } from './reviews-api'
import { DashboardAPI } from './dashboard-api'
import { UploadAPI } from './upload-api'

// Core API classes
export { DocumentsAPI, ReviewsAPI, DashboardAPI, UploadAPI }

// Individual function exports for convenience
export {
  // Documents functions
  fetchFolderDetails,
  fetchFiles,
  createFolder,
  updateFolder,
  deleteFile,
  deleteFolder,
  moveFile,
  getFileMarkdown,
  uploadFiles,
  formatFileSize
} from './documents-api'

export {
  // Reviews functions - using actual exported names
  fetchReviewsData,
  fetchReview,
  fetchPaginatedReviews,
  createReview,
  deleteReview,
  addColumn,
  addFiles,
  updateColumn,
  updateResult,
  deleteColumn,
  startAnalysis,
  getAnalysisStatus,
  exportReview,
  getReviewStats,
  getReviewsSummary
} from './reviews-api'

export {
  // Dashboard functions
  fetchDashboardData
} from './dashboard-api'

export {
  // Upload functions - using actual exported names
  uploadFiles as uploadFilesToFolder,
  uploadFilesLegacy
} from './upload-api'

// Organized API object exports
export const files = {
  list: DocumentsAPI.fetchFiles,
  upload: DocumentsAPI.uploadFiles,
  delete: DocumentsAPI.deleteFile,
  move: DocumentsAPI.moveFile,
  getMarkdown: DocumentsAPI.getFileMarkdown
}

export const folders = {
  create: DocumentsAPI.createFolder,
  update: DocumentsAPI.updateFolder,
  delete: DocumentsAPI.deleteFolder,
  getDetails: DocumentsAPI.fetchFolderDetails
}

export const reviews = {
  list: ReviewsAPI.fetchReviewsData,
  get: ReviewsAPI.fetchReview,
  getPaginated: ReviewsAPI.fetchPaginatedReviews,
  create: ReviewsAPI.createReview,
  delete: ReviewsAPI.deleteReview,
  addColumn: ReviewsAPI.addColumn,
  addFiles: ReviewsAPI.addFiles,
  updateColumn: ReviewsAPI.updateColumn,
  updateResult: ReviewsAPI.updateResult,
  deleteColumn: ReviewsAPI.deleteColumn,
  startAnalysis: ReviewsAPI.startAnalysis,
  getAnalysisStatus: ReviewsAPI.getAnalysisStatus,
  export: ReviewsAPI.exportReview,
  getStats: ReviewsAPI.getReviewStats,
  getSummary: ReviewsAPI.getReviewsSummary
}

export const dashboard = {
  getData: DashboardAPI.fetchDashboardData
}

export const upload = {
  toFolder: UploadAPI.uploadFiles,
  legacy: UploadAPI.uploadFilesLegacy
}

// Re-export types for convenience
export type * from './types' 