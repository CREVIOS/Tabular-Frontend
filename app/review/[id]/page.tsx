'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle, CheckCircle } from 'lucide-react'
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


interface ReviewFile {
  id: string
  file_id: string
  review_id: string
  added_at: string | null
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
  const supabase = createClient()
  const reviewId = params.id as string
  
  const [toasts, setToasts] = useState<Array<{id: string; type: 'success' | 'error' | 'info'; message: string}>>([])
  // existingFiles state - used to track files already in the review
  // This is loaded via fetchExistingFiles and can be used for duplicate checking or display
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
  
  const fetchExistingFiles = useCallback(async () => {
    if (!reviewId) return
    
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
      
      const transformedFiles: FileItem[] = (reviewFiles || [])
        .filter((rf: ReviewFile) => rf.files)
        .map((rf: ReviewFile) => ({
          id: rf.files!.id,
          original_filename: rf.files!.original_filename,
          file_size: rf.files!.file_size,
          status: rf.files!.status,
          folder_id: rf.files!.folder_id,
          created_at: rf.files!.created_at,
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
    <div className="w-full mx-auto px-4 py-6 sm:px-8">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <RealTimeReviewTable 
          reviewId={reviewId}
          onFilesAdded={handleFilesAdded}
          onColumnAdded={handleColumnAdded}
          reviewName={reviewData?.name || 'Document Review'}
          reviewStatus={reviewData?.status || 'draft'}
          existingFiles={existingFiles}
        />
      </div>
      
      {/* Toast notifications */}
      <div className="fixed top-20 right-6 z-50 space-y-3">
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
  )
}
