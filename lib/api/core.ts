// ============================================================================
// CORE API CLIENT - Optimized with Retry, Parallel Processing, and Error Handling
// ============================================================================

import type { 
    ApiError, 
    ApiResult, 
    ApiClientConfig 
  } from '@/lib/api/types'
  
  // Environment configuration
  export const getBackendUrl = (): string => {
    if (typeof window !== 'undefined') {
      return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
    }
    return process.env.BACKEND_URL || 'http://localhost:8000'
  }
  
  // API Configuration
  export const apiConfig = {
    timeouts: {
      standard: 15000,     // 15 seconds
      upload: 120000,      // 2 minutes
      websocket: 30000,    // 30 seconds
      health: 5000         // 5 seconds
    },
    retry: {
      maxAttempts: 3,
      baseDelay: 1000,     // 1 second
      maxDelay: 10000,     // 10 seconds
      backoffMultiplier: 2
    },
    parallel: {
      maxConcurrent: 5     // Maximum concurrent requests
    }
  }
  
  // Authentication helper
  export const getAuthToken = async (): Promise<string | null> => {
    try {
      if (typeof window === 'undefined') return null
      
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      return session?.access_token || null
    } catch (error) {
      console.error('Failed to get auth token:', error)
      return null
    }
  }
  
  // Standard headers helper
  export const getStandardHeaders = (authToken?: string): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }
    
    return headers
  }
  
  // Error handling utility
  export const handleApiError = (error: ApiError | string): string => {
    if (typeof error === 'string') return error
    
    switch (error.status) {
      case 400:
        return 'Invalid request. Please check your input.'
      case 401:
        return 'Authentication required. Please log in again.'
      case 403:
        return 'Access denied. You don\'t have permission for this action.'
      case 404:
        return 'The requested resource was not found.'
      case 413:
        return 'File too large. Please upload a smaller file.'
      case 422:
        return 'Validation error. Please check your input data.'
      case 429:
        return 'Too many requests. Please wait before trying again.'
      case 500:
        return 'A server error occurred. Please try again later.'
      case 503:
        return 'Service temporarily unavailable. Please try again later.'
      default:
        return error.message || 'An unexpected error occurred. Please try again.'
    }
  }
  
  // Core API Client Class
  export class ApiClient {
    private config: ApiClientConfig
    private requestQueue: Map<string, Promise<ApiResult<any>>> = new Map() // eslint-disable-line @typescript-eslint/no-explicit-any
  
    constructor(config: Partial<ApiClientConfig> = {}) {
      this.config = {
        baseUrl: getBackendUrl(),
        timeout: apiConfig.timeouts.standard,
        retry: apiConfig.retry,
        ...config
      }
    }
  
    // Request deduplication - prevent duplicate requests
    private getRequestKey(endpoint: string, options: RequestInit): string {
      return `${options.method || 'GET'}:${endpoint}:${JSON.stringify(options.body || {})}`
    }
  
    // Core request method with comprehensive error handling and retry logic
    private async request<T>(
      endpoint: string,
      options: RequestInit = {},
      authToken?: string,
      timeoutMs?: number
    ): Promise<ApiResult<T>> {
      const url = `${this.config.baseUrl}${endpoint}`
      const requestKey = this.getRequestKey(endpoint, options)
      
      // Check for duplicate requests
      if (this.requestQueue.has(requestKey)) {
        console.log(`Deduplicating request: ${requestKey}`)
        return this.requestQueue.get(requestKey)!
      }
  
      const requestPromise = this.executeRequest<T>(url, options, authToken, timeoutMs)
      this.requestQueue.set(requestKey, requestPromise)
  
      try {
        const result = await requestPromise
        return result
      } finally {
        // Clean up request queue
        setTimeout(() => this.requestQueue.delete(requestKey), 1000)
      }
    }
  
    private async executeRequest<T>(
      url: string,
      options: RequestInit,
      authToken?: string,
      timeoutMs?: number
    ): Promise<ApiResult<T>> {
      let lastError: Error | null = null
      const timeout = timeoutMs || this.config.timeout
  
      for (let attempt = 1; attempt <= this.config.retry.maxAttempts; attempt++) {
        try {
          console.log(`API Request [${attempt}/${this.config.retry.maxAttempts}]: ${options.method || 'GET'} ${url}`)
  
          const headers = {
            ...getStandardHeaders(authToken),
            ...this.config.headers,
            ...options.headers
          }
  
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), timeout)
  
          const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal
          })
  
          clearTimeout(timeoutId)
  
          // Handle different response types
          if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`
            
            try {
              const errorBody = await response.text()
              if (errorBody) {
                try {
                  const errorJson = JSON.parse(errorBody)
                  errorMessage = errorJson.detail || errorJson.message || errorMessage
                } catch {
                  errorMessage = errorBody.substring(0, 200) // Limit error message length
                }
              }
            } catch {
              // Use default error message
            }
  
            throw new Error(errorMessage)
          }
  
          // Handle different content types
          const contentType = response.headers.get('content-type')
          let data: T
  
          if (contentType?.includes('application/json')) {
            data = await response.json()
          } else if (contentType?.includes('text/')) {
            data = await response.text() as unknown as T
          } else {
            data = await response.blob() as unknown as T
          }
  
          console.log(`API Success: ${options.method || 'GET'} ${url}`)
          return { success: true, data }
  
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          
          console.error(`API Attempt ${attempt} failed: ${lastError.message}`, {
            url,
            method: options.method || 'GET',
            attempt
          })
  
          // Don't retry on auth errors or client errors (4xx)
          if (lastError.message.includes('401') || 
              lastError.message.includes('403') || 
              lastError.message.includes('422')) {
            break
          }
  
          if (attempt === this.config.retry.maxAttempts) {
            break
          }
  
          // Calculate delay with exponential backoff and jitter
          const baseDelay = this.config.retry.baseDelay * Math.pow(this.config.retry.backoffMultiplier, attempt - 1)
          const jitter = Math.random() * 0.1 * baseDelay
          const delay = Math.min(baseDelay + jitter, this.config.retry.maxDelay)
  
          console.log(`Retrying ${url} after ${Math.round(delay)}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
  
      return {
        success: false,
        error: handleApiError(lastError?.message || 'Unknown error occurred'),
        details: lastError?.message
      }
    }
  
    // Parallel request execution with concurrency control
    async parallel<T extends Record<string, unknown>>(
      requests: Record<keyof T, { endpoint: string; options?: RequestInit; timeout?: number }>,
      authToken?: string
    ): Promise<Record<keyof T, ApiResult<T[keyof T]>>> {
      const requestEntries = Object.entries(requests)
      const results = {} as Record<keyof T, ApiResult<T[keyof T]>>
  
      // Process requests in batches to control concurrency
      const batchSize = apiConfig.parallel.maxConcurrent
      
      for (let i = 0; i < requestEntries.length; i += batchSize) {
        const batch = requestEntries.slice(i, i + batchSize)
        
        const batchPromises = batch.map(async ([key, { endpoint, options, timeout }]) => {
          const result = await this.request<T[keyof T]>(endpoint, options, authToken, timeout)
          return [key, result] as const
        })
  
        const batchResults = await Promise.allSettled(batchPromises)
        
        batchResults.forEach((result, index) => {
          const [key] = batch[index]
          if (result.status === 'fulfilled') {
            results[key as keyof T] = result.value[1]
          } else {
            results[key as keyof T] = {
              success: false,
              error: result.reason?.message || 'Request failed'
            }
          }
        })
      }
  
      return results
    }
  
    // HTTP Methods
    async get<T>(endpoint: string, authToken?: string, timeout?: number): Promise<ApiResult<T>> {
      return this.request<T>(endpoint, { method: 'GET' }, authToken, timeout)
    }
  
    async post<T>(endpoint: string, data?: unknown, authToken?: string, timeout?: number): Promise<ApiResult<T>> {
      return this.request<T>(endpoint, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined
      }, authToken, timeout)
    }
  
    async put<T>(endpoint: string, data?: unknown, authToken?: string, timeout?: number): Promise<ApiResult<T>> {
      return this.request<T>(endpoint, {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined
      }, authToken, timeout)
    }
  
    async delete<T>(endpoint: string, authToken?: string, timeout?: number): Promise<ApiResult<T>> {
      return this.request<T>(endpoint, { method: 'DELETE' }, authToken, timeout)
    }
  
    // Upload with progress support
    async upload<T>(
      endpoint: string,
      formData: FormData,
      authToken?: string
    ): Promise<ApiResult<T>> {
      const url = `${this.config.baseUrl}${endpoint}`
      
      try {
        console.log(`Upload starting: ${endpoint}`)
  
        const headers: Record<string, string> = {}
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`
        }
        // Don't set Content-Type for FormData - let browser set it with boundary
  
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: formData
        })
  
        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`
          try {
            const errorBody = await response.text()
            if (errorBody) {
              try {
                const errorJson = JSON.parse(errorBody)
                errorMessage = errorJson.detail || errorJson.message || errorMessage
              } catch {
                errorMessage = errorBody.substring(0, 200)
              }
            }
          } catch {
            // Use default error message
          }
          throw new Error(errorMessage)
        }
  
        const data = await response.json()
        console.log(`Upload successful: ${endpoint}`)
        return { success: true, data }
  
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed'
        console.error(`Upload failed: ${endpoint}`, errorMessage)
        return {
          success: false,
          error: handleApiError(errorMessage)
        }
      }
    }
  
    // Health check with short timeout
    async healthCheck(): Promise<ApiResult<{ status: string }>> {
      return this.request<{ status: string }>('/api/health', 
        { method: 'GET' }, 
        undefined, 
        apiConfig.timeouts.health
      )
    }

  }
  
  // Global API client instance
  export const apiClient = new ApiClient()
  
  // Convenience function for getting authenticated API client
  export const getAuthenticatedClient = async (): Promise<{ client: ApiClient; token: string | null }> => {
    const token = await getAuthToken()
    return { client: apiClient, token }
  }