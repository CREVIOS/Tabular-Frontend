// ReviewDetailPage.tsx - Fixed TypeScript errors
'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import RealTimeReviewTable from '@/components/review-table/RealTimeReviewtable'

interface ToastProps {
  type: 'success' | 'error' | 'info'
  message: string
  onClose: () => void
}

interface FileItem {
  id: string
  original_filename: string
  file_size: number | null
  status: string | null
  folder_id: string | null
  created_at: string | null
  folder?: {
    name: string
  }
}

// Fixed: Make added_at optional to match database schema
interface ReviewFile {
  id: string
  file_id: string
  review_id: string
  added_at: string | null  // Changed from string to string | null
  files?: FileItem
}

const Toast = ({ type, message, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [onClose])
  
  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: AlertCircle
  }
  
  const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  }
  
  const Icon = icons[type]
  
  return (
    <div className={`fixed top-4 right-4 p-4 rounded-lg border shadow-lg z-50 ${colors[type]} max-w-md`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-auto text-lg leading-none">&times;</button>
      </div>
    </div>
  )
}

export default function ReviewDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const reviewId = params.id as string
  
  // State (modal state management moved to DataTable)
  const [toasts, setToasts] = useState<Array<{id: string; type: 'success' | 'error' | 'info'; message: string}>>([])
  const [existingFiles, setExistingFiles] = useState<FileItem[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reviewData, setReviewData] = useState<any>(null)
  
  // Toast management
  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, type, message }])
  }, [])
  
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])
  
  // Fetch existing files in the review
  const fetchExistingFiles = useCallback(async () => {
    if (!reviewId) return
    
    // Loading state removed - handled by DataTable
    try {
      // Fetch review files with file details and folder information
      const { data: reviewFiles, error: reviewFilesError } = await supabase
        .from('tabular_review_files')
        .select(`
          id,
          file_id,
          review_id,
          added_at,
          files (
            id,
            original_filename,
            file_size,
            status,
            folder_id,
            created_at,
            folders (
              id,
              name
            )
          )
        `)
        .eq('review_id', reviewId)
      
      if (reviewFilesError) {
        throw reviewFilesError
      }
      
      // Transform the data to match FileItem interface with proper null handling
      const transformedFiles: FileItem[] = (reviewFiles || [])
        .filter((rf: ReviewFile) => rf.files) // Only include files that exist
        .map((rf: ReviewFile) => ({
          id: rf.files!.id,
          original_filename: rf.files!.original_filename,
          file_size: rf.files!.file_size,
          status: rf.files!.status,
          folder_id: rf.files!.folder_id,
          created_at: rf.files!.created_at,
          // Fixed: Safely access nested folders property
          ...(rf.files!.folder && {
            folder: {
              name: rf.files!.folder.name
            }
          })
        }))
      
      setExistingFiles(transformedFiles)
      
      console.log('Existing files loaded:', transformedFiles.length, transformedFiles)
      
    } catch (error) {
      console.error('Error fetching existing files:', error)
      addToast('error', 'Failed to load existing files')
    }
  }, [reviewId, supabase, addToast])
  
  // Fetch review details
  const fetchReviewData = useCallback(async () => {
    if (!reviewId) return
    
    try {
      const { data: review, error: reviewError } = await supabase
        .from('tabular_reviews')
        .select(`
          *,
          tabular_review_columns (*)
        `)
        .eq('id', reviewId)
        .single()
      
      if (reviewError) {
        throw reviewError
      }
      
      setReviewData(review)
    } catch (error) {
      console.error('Error fetching review data:', error)
      addToast('error', 'Failed to load review data')
    }
  }, [reviewId, supabase, addToast])
  
  // Load data on mount
  useEffect(() => {
    if (reviewId) {
      fetchReviewData()
      fetchExistingFiles()
    }
  }, [reviewId, fetchReviewData, fetchExistingFiles])
  
  // Handle successful file addition
  const handleFilesAdded = useCallback(() => {
    // Refresh the existing files list
    fetchExistingFiles()
    addToast('success', 'Files added successfully!')
  }, [fetchExistingFiles, addToast])
  
  // Handle successful column addition  
  const handleColumnAdded = useCallback(() => {
    addToast('success', 'Column added successfully!')
  }, [addToast])
  
  // Export functionality removed
  
  // Modal handlers no longer needed - handled by DataTable
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 flex">
      <div className="w-full mx-auto px-4 py-12 sm:px-8">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.push('/review')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors shadow-sm border border-gray-200 bg-white"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {reviewData?.name || 'Review Analysis'}
                </h1>
                <p className="text-base text-gray-600 mt-1">
                  Real-time document analysis and data extraction
                  {existingFiles.length > 0 && (
                    <span className="ml-2 text-sm text-blue-600">
                      • {existingFiles.length} document{existingFiles.length !== 1 ? 's' : ''}
                      {existingFiles.length > 0 && existingFiles[0].folder && 
                        ` from "${existingFiles[0].folder.name}" folder`
                      }
                    </span>
                  )}
                </p>
              </div>
            </div>
            {/* Export button removed */}
          </div>
          
          {/* Action buttons moved to DataTable toolbar */}
          
          {/* Status indicators */}
          {/* {existingFiles.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <FileText className="h-4 w-4" />
                <span>
                  Currently reviewing {existingFiles.length} document{existingFiles.length !== 1 ? 's' : ''}
                  {(() => {
                    const folders = [...new Set(existingFiles
                      .filter(f => f.folder)
                      .map(f => f.folder!.name))]
                    if (folders.length === 1) {
                      return ` from "${folders[0]}" folder`
                    } else if (folders.length > 1) {
                      return ` from ${folders.length} different folders`
                    }
                    return ''
                  })()}
                </span>
              </div>
            </div>
          )} */}
        </div>
        
        {/* Fixed: Updated props to match RealTimeReviewTable interface */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-10">
          <RealTimeReviewTable 
            reviewId={reviewId}
            onFilesAdded={handleFilesAdded}
            onColumnAdded={handleColumnAdded}
            reviewName={reviewData?.name || 'Document Review'}
            reviewStatus={reviewData?.status || 'draft'}
          />
        </div>
        
        {/* Modals are now integrated in the DataTable component */}
        
        {/* Toast notifications */}
        <div className="fixed top-6 right-6 z-50 space-y-3">
          {toasts.map(toast => (
            <Toast
              key={toast.id}
              type={toast.type}
              message={toast.message}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}