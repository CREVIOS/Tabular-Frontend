// ============================================================================
// CORE API TYPES - Based on FastAPI Backend
// ============================================================================

// Authentication & User Types
export interface User {
    id: string
    email: string
    full_name?: string
    created_at: string
    updated_at: string
  }
  
  // File Management Types
  export interface File {
    id: string
    user_id: string
    folder_id?: string | null
    original_filename: string
    file_size?: number
    file_type?: string
    storage_path?: string
    storage_url?: string
    status: 'queued' | 'processing' | 'completed' | 'failed'
    created_at: string
    updated_at: string
    processed_at?: string | null
    error_message?: string | null
  }
  
  export interface MarkdownResponse {
    id: string
    file_id: string
    user_id: string
    content: string
    word_count?: number
    created_at: string
    updated_at: string
  }
  
  // Folder Management Types
  export interface Folder {
    id: string
    user_id: string
    name: string
    description?: string | null
    color: string
    file_count: number
    total_size: number
    created_at: string
    updated_at: string
  }
  
  export interface FolderCreate {
    name: string
    description?: string
    color?: string
  }
  
  export interface FolderUpdate {
    name?: string
    description?: string
    color?: string
  }
  
  // Tabular Reviews Types (Based on server schemas)
  export interface Review {
    id: string
    user_id: string
    name: string
    description?: string | null
    status: 'processing' | 'completed' | 'failed'
    review_scope: 'files' | 'folder'
    folder_id?: string | null
    created_at: string
    updated_at: string
    last_processed_at?: string | null
    columns: ReviewColumn[]
    files: ReviewFile[]
    total_files: number
    total_columns: number
    completion_percentage: number
  }
  
  export interface ReviewColumn {
    id: string
    column_name: string
    prompt: string
    column_order: number
    data_type: 'text' | 'number' | 'date' | 'boolean' | 'currency' | 'percentage'
    created_at: string
  }
  
  export interface ReviewFile {
    id: string
    file_id: string
    filename: string
    file_size?: number
    status: string
    added_at: string
  }
  
  export interface ReviewResult {
    id: string
    file_id: string
    column_id: string
    extracted_value?: string | null
    confidence_score?: number
    source_reference?: string
    created_at: string
  }
  
  export interface ReviewDetailResponse extends Review {
    results: ReviewResult[]
  }
  
  export interface ReviewListResponse {
    reviews: Review[]
    total_count: number
    page: number
    page_size: number
    total_pages: number
  }
  
  // Create/Update Request Types
  export interface TabularReviewCreate {
    name: string
    description?: string
    review_scope: 'files' | 'folder'
    folder_id?: string
    file_ids?: string[]
    columns: {
      column_name: string
      prompt: string
      column_order?: number
      data_type: 'text' | 'number' | 'date' | 'boolean' | 'currency' | 'percentage'
    }[]
  }
  
  export interface AddColumnToReviewRequest {
    column_name: string
    prompt: string
    data_type: 'text' | 'number' | 'date' | 'boolean' | 'currency' | 'percentage'
  }
  
  export interface AddFilesToReviewRequest {
    file_ids: string[]
  }
  
  export interface TabularReviewColumnUpdate {
    column_name?: string
    prompt?: string
    data_type?: 'text' | 'number' | 'date' | 'boolean' | 'currency' | 'percentage'
    column_order?: number
  }
  
  export interface TabularReviewResultUpdate {
    extracted_value?: string
    confidence_score?: number
    source_reference?: string
  }
  
  export interface AnalysisRequest {
    force_reprocess?: boolean
  }
  
  export interface AnalysisStatus {
    review_id: string
    status: 'processing' | 'completed' | 'failed'
    progress_percentage: number
    files_processed: number
    total_files: number
    cells_completed: number
    total_cells: number
    estimated_completion?: string | null
    error_message?: string | null
    current_task?: string | null
  }
  
  export interface ValidationStats {
    total_results: number
    validated_results: number
    invalid_results: number
    high_confidence_results: number
    low_confidence_results: number
    manually_edited_results: number
  }
  
  export interface ReviewSummary {
    total_reviews: number
    active_reviews: number
    completed_reviews: number
    failed_reviews: number
    total_documents_processed: number
    total_extractions: number
    average_confidence: number
  }
  
  // WebSocket Types
  export interface WebSocketMessage {
    type: 'structure' | 'cached_results' | 'cell_update' | 'review_completed' | 
          'processing_started' | 'error' | 'heartbeat' | 'files_added' | 
          'column_added' | 'analysis_started' | 'analysis_queued' | 'analysis_failed'
    data?: unknown
    message?: string
    timestamp?: string
  }
  
  // Dashboard Types
  export interface DashboardStats {
    total_files: number
    total_reviews: number
    total_folders: number
    completed_files: number
    processing_files: number
    failed_files: number
    recent_uploads: number
  }
  
  export interface DashboardData {
    files: File[]
    reviews: Review[]
    folders: Folder[]
    stats: DashboardStats
  }
  
  // Documents Types
  export interface DocumentsStats {
    total_folders: number
    total_files: number
    files_by_status: Record<string, number>
    files_by_type: Record<string, number>
  }
  
  export interface DocumentsData {
    folders: Folder[]
    files: File[]
    stats: DocumentsStats
    errors?: string[]
  }
  
  export interface FolderDetailsData {
    folder: Folder
    files: File[]
    stats: {
      total_files: number
      files_by_status: Record<string, number>
      files_by_type: Record<string, number>
    }
    errors?: string[]
  }
  
  // Reviews Data Types
  export interface ReviewsStats {
    total_reviews: number
    reviews_by_status: Record<string, number>
    total_files_in_reviews: number
    total_columns: number
  }
  
  export interface ReviewsData {
    reviews: Review[]
    files: File[]
    folders: Folder[]
    stats: ReviewsStats
    errors?: string[]
  }
  
  // Pagination Types
  export interface PaginatedRequest {
    page?: number
    page_size?: number
    status_filter?: string
    folder_id?: string
  }
  
  export interface PaginatedResponse<T> {
    data: T[]
    total_count: number
    page: number
    page_size: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
  
  // API Response Types
  export interface ApiResponse<T = unknown> {
    data?: T
    error?: string
    success: boolean
    warnings?: string[]
  }
  
  export interface ApiError {
    message: string
    status: number
    code?: string
    details?: string
  }
  
  export type ApiResult<T> = {
    success: true
    data: T
    warnings?: string[]
  } | {
    success: false
    error: string
    details?: string
  }
  
  // Upload Types
  export interface UploadProgress {
    file: string
    progress: number
    status: 'uploading' | 'processing' | 'completed' | 'failed' | 'retrying' | 'retry_pending'
    error?: string
    retries?: number
  }
  
  export interface UploadResponse {
    files: File[]
    errors?: { file: string; error: string }[]
  }
  
  // Export Types
  export type ExportFormat = 'csv' | 'json'
  
  export interface ExportRequest {
    format: ExportFormat
    include_metadata?: boolean
    include_confidence?: boolean
  }
  
  // Health Check Types
  export interface HealthCheckResponse {
    status: 'healthy' | 'unhealthy'
    version?: string
    uptime?: number
    database?: 'connected' | 'disconnected'
    storage?: 'connected' | 'disconnected'
  }
  
  // Configuration Types
  export interface RetryConfig {
    maxAttempts: number
    baseDelay: number
    maxDelay: number
    backoffMultiplier: number
  }
  
  export interface ApiClientConfig {
    baseUrl: string
    timeout: number
    retry: RetryConfig
    headers?: Record<string, string>
  }

