// ============================================================================
// DASHBOARD API - Optimized Parallel Data Fetching
// ============================================================================

import { apiClient, getAuthToken } from './core'
import type { 
  DashboardData,
  DashboardStats,
  File,
  Review,
  Folder,
  ApiResult,
  ReviewListResponse
} from './types'

export class DashboardAPI {
  /**
   * Fetch all dashboard data in parallel with comprehensive error handling
   */
  static async fetchDashboardData(): Promise<ApiResult<DashboardData>> {
    try {
      console.log('Fetching dashboard data...')
      
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      // Parallel data fetching with optimized endpoints
      const results = await apiClient.parallel({
        files: { 
          endpoint: '/api/files/?page=1&limit=50',
          timeout: 10000 
        },
        reviews: { 
          endpoint: '/api/reviews/',
          timeout: 10000 
        },
        folders: { 
          endpoint: '/api/folders/',
          timeout: 8000 
        }
      }, authToken)

      // Process results with fallbacks
      const files: File[] = results.files.success 
        ? (Array.isArray(results.files.data) ? results.files.data : [])
        : []

      const reviewsResponse = results.reviews.success ? results.reviews.data : null
      const reviews: Review[] = (reviewsResponse as ReviewListResponse)?.reviews || 
                              (Array.isArray(reviewsResponse) ? reviewsResponse : [])

      const folders: Folder[] = results.folders.success 
        ? (Array.isArray(results.folders.data) ? results.folders.data : [])
        : []

      // Calculate comprehensive stats
      const stats = DashboardAPI.calculateDashboardStats(files, reviews, folders)

      // Collect warnings for partial failures
      const warnings: string[] = []
      if (!results.files.success) warnings.push(`Files: ${results.files.error}`)
      if (!results.reviews.success) warnings.push(`Reviews: ${results.reviews.error}`)
      if (!results.folders.success) warnings.push(`Folders: ${results.folders.error}`)

      const dashboardData: DashboardData = {
        files,
        reviews,
        folders,
        stats
      }

      console.log('Dashboard data fetched successfully', {
        files: files.length,
        reviews: reviews.length,
        folders: folders.length,
        warnings: warnings.length
      })

      return { 
        success: true, 
        data: dashboardData,
        ...(warnings.length > 0 && { warnings })
      }

    } catch (error) {
      console.error('💥 Dashboard API error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch dashboard data'
      }
    }
  }

  /**
   * Fetch only dashboard stats for quick updates
   */
  static async fetchDashboardStats(): Promise<ApiResult<DashboardStats>> {
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      // Optimized stats-only fetch
      const results = await apiClient.parallel({
        fileStats: { 
          endpoint: '/api/files/?page=1&limit=1', // Just get counts
          timeout: 5000 
        },
        reviewStats: { 
          endpoint: '/api/reviews/?page=1&limit=1',
          timeout: 5000 
        },
        folderStats: { 
          endpoint: '/api/folders/',
          timeout: 5000 
        }
      }, authToken)

      // Extract stats from responses
      const fileStats = results.fileStats.success ? results.fileStats.data : null
      const reviewStats = results.reviewStats.success ? results.reviewStats.data : null
      const folderStats = results.folderStats.success ? results.folderStats.data : []

      const stats: DashboardStats = {
        total_files: (fileStats as { total_count?: number })?.total_count || 0,
        total_reviews: (reviewStats as { total_count?: number })?.total_count || 0,
        total_folders: Array.isArray(folderStats) ? folderStats.length : 0,
        completed_files: 0,
        processing_files: 0,
        failed_files: 0,
        recent_uploads: 0
      }

      return { success: true, data: stats }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch dashboard stats'
      }
    }
  }

  /**
   * Fetch recent activity with configurable limits
   */
  static async fetchRecentActivity(limit: number = 10): Promise<ApiResult<{
    recent_files: File[]
    recent_reviews: Review[]
  }>> {
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      const results = await apiClient.parallel({
        files: { 
          endpoint: `/api/files/?page=1&limit=${limit}`,
          timeout: 8000 
        },
        reviews: { 
          endpoint: `/api/reviews/?page=1&limit=${limit}`,
          timeout: 8000 
        }
      }, authToken)

      const recent_files: File[] = results.files.success 
        ? (Array.isArray(results.files.data) ? results.files.data : [])
        : []

      const reviewsResponse = results.reviews.success ? results.reviews.data : null
      const recent_reviews: Review[] = (reviewsResponse as ReviewListResponse)?.reviews || 
                                     (Array.isArray(reviewsResponse) ? reviewsResponse : [])

      return {
        success: true,
        data: { recent_files, recent_reviews }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch recent activity'
      }
    }
  }

  /**
   * Health check for dashboard components
   */
  static async healthCheck(): Promise<ApiResult<{ 
    backend: boolean
    database: boolean
    services: string[]
  }>> {
    try {
      const result = await apiClient.healthCheck()
      
      if (!result.success) {
        return {
          success: false,
          error: 'Backend service unavailable'
        }
      }

      return {
        success: true,
        data: {
          backend: true,
          database: true,
          services: ['files', 'reviews', 'folders']
        }
      }
    } catch {
      return {
        success: false,
        error: 'Health check failed'
      }
    }
  }

  /**
   * Real-time dashboard refresh
   */
  static async refreshDashboardData(): Promise<ApiResult<DashboardData>> {
    console.log(' Refreshing dashboard data...')
    return DashboardAPI.fetchDashboardData()
  }

  /**
   * Calculate comprehensive dashboard statistics
   */
  private static calculateDashboardStats(
    files: File[],
    reviews: Review[],
    folders: Folder[]
  ): DashboardStats {
    // File status breakdown
    const filesByStatus = files.reduce((acc, file) => {
      acc[file.status] = (acc[file.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Recent uploads (last 7 days)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const recent_uploads = files.filter(file => 
      new Date(file.created_at) > weekAgo
    ).length

    return {
      total_files: files.length,
      total_reviews: reviews.length,
      total_folders: folders.length,
      completed_files: filesByStatus.completed || 0,
      processing_files: (filesByStatus.processing || 0) + (filesByStatus.queued || 0),
      failed_files: filesByStatus.failed || 0,
      recent_uploads
    }
  }

  /**
   * Get user summary statistics
   */
  static async getUserSummary(): Promise<ApiResult<{
    files_processed_today: number
    reviews_completed_today: number
    total_data_extracted: number
    average_processing_time: number
  }>> {
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        return { success: false, error: 'Authentication required' }
      }

      // Get today's data
      const today = new Date().toISOString().split('T')[0]
      
      const results = await apiClient.parallel({
        todayFiles: { 
          endpoint: `/api/files/?created_after=${today}`,
          timeout: 5000 
        },
        todayReviews: { 
          endpoint: `/api/reviews/?created_after=${today}`,
          timeout: 5000 
        }
      }, authToken)

      const todayFiles = results.todayFiles.success ? results.todayFiles.data : []
      const todayReviews = results.todayReviews.success ? results.todayReviews.data : []

      return {
        success: true,
        data: {
          files_processed_today: Array.isArray(todayFiles) ? todayFiles.length : 0,
          reviews_completed_today: Array.isArray(todayReviews) ? todayReviews.length : 0,
          total_data_extracted: 0, // Would need to calculate from results
          average_processing_time: 0 // Would need to calculate from processing times
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user summary'
      }
    }
  }
}

// Export individual functions for convenience
export const fetchDashboardData = DashboardAPI.fetchDashboardData
export const fetchDashboardStats = DashboardAPI.fetchDashboardStats
export const fetchRecentActivity = DashboardAPI.fetchRecentActivity
export const refreshDashboardData = DashboardAPI.refreshDashboardData
export const getUserSummary = DashboardAPI.getUserSummary
export const dashboardHealthCheck = DashboardAPI.healthCheck