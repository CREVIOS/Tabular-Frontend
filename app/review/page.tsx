// /review/page.tsx

'use client'

import React, { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { 
  Plus, 
  BarChart3,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

// API imports
import { fetchReviewsData } from '@/lib/api/reviews-api'

// Components
import { ReviewDataTable } from '../../components/review-list/data-table'
import { createReviewColumns, ReviewTableRow } from '../../components/review-list/columns'
import EnhancedCreateReview from '../../components/CreateReview'
import { ReviewsTableSkeleton, PageLoadingSkeleton } from '@/components/ui/loading-skeletons'

// Types
import { Review } from '../../types'

// Loading component for Suspense fallback
function ReviewPageLoading() {
  return <PageLoadingSkeleton />
}

// Main component that uses useSearchParams
function TabularReviewPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // Get folder context from URL parameters
  const folderId = searchParams.get('folderId')
  const fileIds = useMemo(() => {
  return searchParams.get('fileIds')?.split(',').filter(Boolean) || [];
}, [searchParams]);
  
  // Local state
  const [reviews, setReviews] = useState<Review[]>([])
  const [folders, setFolders] = useState<Array<{ id: string; name: string; color: string }>>([])
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingReview, setIsCreatingReview] = useState(!!folderId || fileIds.length > 0)
  
  // Fetch reviews data
  useEffect(() => {
    const loadReviewsData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const result = await fetchReviewsData()
        
        if (!result.success) {
          throw new Error(result.error)
        }
        
        setReviews(result.data.reviews as Review[])
        setFolders(result.data.folders.map(f => ({ 
          id: f.id, 
          name: f.name, 
          color: f.color 
        })))
        
      } catch (error) {
        console.error('Failed to fetch reviews data:', error)
        setError(error instanceof Error ? error.message : 'Failed to load reviews')
      } finally {
        setIsLoading(false)
      }
    }
    
    loadReviewsData()
  }, [])

  // Initialize selected files from URL
  useEffect(() => {
    if (fileIds.length > 0) {
      setSelectedFiles(fileIds)
    }
  }, [fileIds, setSelectedFiles])

  // Transform reviews data to include folder info - with safety checks
  const tableData: ReviewTableRow[] = useMemo(() => {
    if (!Array.isArray(reviews)) {
      return []
    }
    
    const transformedData = reviews.map(review => {
      const folder = folders.find(f => f.id === review.folder_id)
      return {
        ...review,
        folderName: folder?.name || '',
        folderColor: folder?.color || '#6b7280'
      }
    })
    
    return transformedData
  }, [reviews, folders])

  // Create columns with handlers
  const columns = useMemo(() => {
    return createReviewColumns({
      onSelectReview: (review: Review) => {
        router.push(`/review/${review.id}`)
      },
      onDeleteReview: undefined
    })
  }, [router])

  const handleCreateReview = (reviewId: string) => {
    setIsCreatingReview(false)
    setSelectedFiles([])
    router.push(`/review/${reviewId}`)         
  }

  // Loading state
  if (isLoading) {
    return <ReviewsTableSkeleton />
  }

  if (isCreatingReview) {
    return (
      <EnhancedCreateReview
        initialFolderId={folderId}
        selectedFiles={selectedFiles}
        onSuccess={handleCreateReview}
        onCancel={() => {
          setIsCreatingReview(false)
          setSelectedFiles([])
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  Tabular Reviews
                </h1>
                <p className="text-gray-600 mt-1">
                  AI-powered document analysis and data extraction
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                onClick={() => setIsCreatingReview(true)}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg flex-1 sm:flex-initial touch-target"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Review
              </Button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <span className="font-medium">Error:</span>
              <span>{error}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Main Content */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-0">
            <ReviewDataTable
              columns={columns}
              data={tableData}
              selectedFiles={selectedFiles}
              onCreateReview={() => setIsCreatingReview(true)}
              folders={folders}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Main exported component with Suspense boundary
export default function TabularReviewPage() {
  return (
    <Suspense fallback={<ReviewPageLoading />}>
      <TabularReviewPageContent />
    </Suspense>
  )
}
