// ============================================================================
// REVIEWS API - Tabular Reviews with Real-time WebSocket Support
// ============================================================================

import { apiClient, getAuthToken } from './core'
import type { 
  ReviewsData,
  ReviewsStats,
  Review,
  ReviewDetailResponse,
  ReviewListResponse,
  ReviewColumn,
  ReviewResult,
  File,
  Folder,
  ApiResult,
  TabularReviewCreate,
  AddColumnToReviewRequest,
  AddFilesToReviewRequest,
  TabularReviewColumnUpdate,
  TabularReviewResultUpdate,
  AnalysisRequest,
  AnalysisStatus,
  ValidationStats,
  ReviewSummary,
  PaginatedRequest,
  ExportFormat
} from './types'

export class ReviewsAPI {
  /**
   * Fetch all reviews data with parallel processing
   */
  static async fetchReviewsData(): Promise<ApiResult<ReviewsData>> {
    try {
      console.log('🔍 Fetching reviews data...')
      
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      // Fetch all data in parallel
      const results = await apiClient.parallel({
        reviews: { 
          endpoint: '/api/reviews/',
          timeout: 10000 
        },
        files: { 
          endpoint: '/api/files/?page=1&limit=50',
          timeout: 8000 
        },
        folders: { 
          endpoint: '/api/folders/',
          timeout: 8000 
        }
      }, authToken)

      // Process results
      const reviewsResponse = results.reviews.success ? results.reviews.data : null
      const reviews: Review[] = (reviewsResponse as ReviewListResponse)?.reviews || 
                              (Array.isArray(reviewsResponse) ? reviewsResponse : [])

      const files: File[] = results.files.success 
        ? (Array.isArray(results.files.data) ? results.files.data : [])
        : []

      const folders: Folder[] = results.folders.success 
        ? (Array.isArray(results.folders.data) ? results.folders.data : [])
        : []

      // Calculate stats
      const stats = ReviewsAPI.calculateReviewsStats(reviews)

      // Collect errors
      const errors: string[] = []
      if (!results.reviews.success) errors.push(`Reviews: ${results.reviews.error}`)
      if (!results.files.success) errors.push(`Files: ${results.files.error}`)
      if (!results.folders.success) errors.push(`Folders: ${results.folders.error}`)

      const reviewsData: ReviewsData = {
        reviews,
        files,
        folders,
        stats,
        ...(errors.length > 0 && { errors })
      }

      console.log('✅ Reviews data fetched successfully', {
        reviews: reviews.length,
        files: files.length,
        folders: folders.length,
        errors: errors.length
      })

      return { 
        success: true, 
        data: reviewsData,
        ...(errors.length > 0 && { warnings: errors })
      }

    } catch (error) {
      console.error('💥 Reviews API error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch reviews data'
      }
    }
  }

  /**
   * Fetch single review with detailed information
   */
  static async fetchReview(reviewId: string, includeResults: boolean = true): Promise<ApiResult<ReviewDetailResponse>> {
    try {
      console.log(` Fetching review: ${reviewId}`)
      
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const queryParams = includeResults ? '?include_results=true' : '?include_results=false'
      const result = await apiClient.get<ReviewDetailResponse>(`/api/reviews/${reviewId}${queryParams}`, authToken)
      
      if (result.success) {
        console.log(`✅ Review fetched: ${result.data?.name}`)
      }

      return result.success
        ? { success: true, data: result.data! }
        : { success: false, error: result.error || 'Failed to fetch review' }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch review'
      }
    }
  }

  /**
   * Fetch paginated reviews
   */
  static async fetchPaginatedReviews(params: PaginatedRequest = {}): Promise<ApiResult<ReviewListResponse>> {
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const queryParams = new URLSearchParams()
      if (params.page) queryParams.set('page', params.page.toString())
      if (params.page_size) queryParams.set('page_size', params.page_size.toString())
      if (params.status_filter) queryParams.set('status_filter', params.status_filter)
      if (params.folder_id) queryParams.set('folder_id', params.folder_id)

      const result = await apiClient.get<ReviewListResponse>(
        `/api/reviews/?${queryParams.toString()}`,
        authToken
      )

      return result.success 
        ? { success: true, data: result.data! }
        : { success: false, error: result.error || 'Failed to fetch reviews' }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch reviews'
      }
    }
  }

  /**
   * Create new tabular review
   */
  static async createReview(data: TabularReviewCreate): Promise<ApiResult<Review>> {
    try {
      console.log(`🎯 Creating review: ${data.name}`)
      
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const result = await apiClient.post<Review>('/api/reviews/', data, authToken, 30000) // Extended timeout
      
      if (result.success) {
        console.log(`✅ Review created: ${result.data?.id}`)
      }

      return result.success
        ? { success: true, data: result.data! }
        : { success: false, error: result.error || 'Failed to create review' }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create review'
      }
    }
  }

  /**
   * Delete review
   */
  static async deleteReview(reviewId: string): Promise<ApiResult<{ message: string }>> {
    try {
      console.log(`🗑️ Deleting review: ${reviewId}`)
      
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const result = await apiClient.delete<{ message: string }>(`/api/reviews/${reviewId}`, authToken)
      
      if (result.success) {
        console.log(`✅ Review deleted: ${reviewId}`)
      }

      return result.success
        ? { success: true, data: result.data! }
        : { success: false, error: result.error || 'Failed to delete review' }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete review'
      }
    }
  }

  /**
   * Add column to review
   */
  static async addColumn(reviewId: string, data: AddColumnToReviewRequest): Promise<ApiResult<ReviewColumn>> {
    try {
      console.log(`📊 Adding column to review: ${reviewId}`)
      
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const result = await apiClient.post<ReviewColumn>(`/api/reviews/${reviewId}/columns`, data, authToken)
      
      return result.success
        ? { success: true, data: result.data! }
        : { success: false, error: result.error || 'Failed to add column' }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add column'
      }
    }
  }

  /**
   * Update column
   */
  static async updateColumn(
    reviewId: string, 
    columnId: string, 
    data: TabularReviewColumnUpdate
  ): Promise<ApiResult<ReviewColumn>> {
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const result = await apiClient.put<ReviewColumn>(`/api/reviews/${reviewId}/columns/${columnId}`, data, authToken)
      
      return result.success
        ? { success: true, data: result.data! }
        : { success: false, error: result.error || 'Failed to update column' }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update column'
      }
    }
  }

  /**
   * Delete column
   */
  static async deleteColumn(reviewId: string, columnId: string): Promise<ApiResult<{ message: string }>> {
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const result = await apiClient.delete<{ message: string }>(`/api/reviews/${reviewId}/columns/${columnId}`, authToken)
      
      return result.success
        ? { success: true, data: result.data! }
        : { success: false, error: result.error || 'Failed to delete column' }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete column'
      }
    }
  }

  /**
   * Add files to review
   */
  static async addFiles(reviewId: string, data: AddFilesToReviewRequest): Promise<ApiResult<{ message: string; added_files: number }>> {
    try {
      console.log(`📄 Adding files to review: ${reviewId}`)
      
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const result = await apiClient.post<{ message: string; added_files: number }>(`/api/reviews/${reviewId}/files`, data, authToken)
      
      return result.success
        ? { success: true, data: result.data! }
        : { success: false, error: result.error || 'Failed to add files to review' }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add files to review'
      }
    }
  }

  /**
   * Start analysis for review
   */
  static async startAnalysis(reviewId: string, analysisRequest?: AnalysisRequest): Promise<ApiResult<{ message: string; review_id: string; status: string }>> {
    try {
      console.log(`🚀 Starting analysis for review: ${reviewId}`)
      
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const result = await apiClient.post<{ message: string; review_id: string; status: string }>(
        `/api/reviews/${reviewId}/analyze`, 
        analysisRequest || {}, 
        authToken,
        30000 // Extended timeout for analysis start
      )
      
      if (result.success) {
        console.log(`Analysis started for review: ${reviewId}`)
      }

      return result.success
        ? { success: true, data: result.data! }
        : { success: false, error: result.error || 'Failed to start analysis' }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start analysis'
      }
    }
  }

  /**
   * Get analysis status
   */
  static async getAnalysisStatus(reviewId: string): Promise<ApiResult<AnalysisStatus>> {
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const result = await apiClient.get<AnalysisStatus>(`/api/reviews/${reviewId}/status`, authToken)
      
      return result.success
        ? { success: true, data: result.data! }
        : { success: false, error: result.error || 'Failed to get analysis status' }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get analysis status'
      }
    }
  }

  /**
   * Update review result (manual correction)
   */
  static async updateResult(
    reviewId: string, 
    resultId: string, 
    data: TabularReviewResultUpdate
  ): Promise<ApiResult<ReviewResult>> {
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const result = await apiClient.put<ReviewResult>(`/api/reviews/${reviewId}/results/${resultId}`, data, authToken)
      
      return result.success
        ? { success: true, data: result.data! }
        : { success: false, error: result.error || 'Failed to update result' }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update result'
      }
    }
  }

  /**
   * Export review data
   */
  static async exportReview(
    reviewId: string, 
    format: ExportFormat = 'csv',
    includeMetadata: boolean = true,
    includeConfidence: boolean = true
  ): Promise<ApiResult<Blob>> {
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const queryParams = new URLSearchParams()
      queryParams.set('format', format)
      queryParams.set('include_metadata', includeMetadata.toString())
      queryParams.set('include_confidence', includeConfidence.toString())

      // Special handling for blob response
      const url = `${apiClient['config'].baseUrl}/api/reviews/${reviewId}/export?${queryParams.toString()}`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const blob = await response.blob()
      return { success: true, data: blob }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export review'
      }
    }
  }

  /**
   * Get review statistics
   */
  static async getReviewStats(reviewId: string): Promise<ApiResult<ValidationStats>> {
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const result = await apiClient.get<ValidationStats>(`/api/reviews/${reviewId}/stats`, authToken)
      
      return result.success
        ? { success: true, data: result.data! }
        : { success: false, error: result.error || 'Failed to get review stats' }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get review stats'
      }
    }
  }

  /**
   * Get reviews summary
   */
  static async getReviewsSummary(): Promise<ApiResult<ReviewSummary>> {
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const result = await apiClient.get<ReviewSummary>('/api/reviews/summary', authToken)
      
      return result.success
        ? { success: true, data: result.data! }
        : { success: false, error: result.error || 'Failed to get reviews summary' }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get reviews summary'
      }
    }
  }


  /**
   * Calculate reviews statistics
   */
  private static calculateReviewsStats(reviews: Review[]): ReviewsStats {
    const reviews_by_status = reviews.reduce((acc, review) => {
      acc[review.status] = (acc[review.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const total_files_in_reviews = reviews.reduce((acc, review) => {
      return acc + (review.total_files || review.files?.length || 0)
    }, 0)

    const total_columns = reviews.reduce((acc, review) => {
      return acc + (review.total_columns || review.columns?.length || 0)
    }, 0)

    return {
      total_reviews: reviews.length,
      reviews_by_status,
      total_files_in_reviews,
      total_columns
    }
  }
}

// Export individual functions for convenience
export const fetchReviewsData = ReviewsAPI.fetchReviewsData
export const fetchReview = ReviewsAPI.fetchReview
export const fetchPaginatedReviews = ReviewsAPI.fetchPaginatedReviews
export const createReview = ReviewsAPI.createReview
export const deleteReview = ReviewsAPI.deleteReview
export const addColumn = ReviewsAPI.addColumn
export const updateColumn = ReviewsAPI.updateColumn
export const deleteColumn = ReviewsAPI.deleteColumn
export const addFiles = ReviewsAPI.addFiles
export const startAnalysis = ReviewsAPI.startAnalysis
export const getAnalysisStatus = ReviewsAPI.getAnalysisStatus
export const updateResult = ReviewsAPI.updateResult
export const exportReview = ReviewsAPI.exportReview
export const getReviewStats = ReviewsAPI.getReviewStats
export const getReviewsSummary = ReviewsAPI.getReviewsSummary
