import React, { useState, useEffect, useCallback } from 'react'
import { X, BookOpen, RefreshCw, AlertCircle, CheckCircle, ExternalLink, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SelectedCell } from '../types'

interface DocumentViewerProps {
  selectedCell: SelectedCell | null
  onClose: () => void
  isMobile?: boolean
}

interface FileInfo {
  id: string
  original_filename: string
  file_size: number | null
  file_type: string | null
  storage_path: string | null
}

// Cache for signed URLs to avoid duplicate API calls
const urlCache = new Map<string, { fileInfo: FileInfo; signedUrl: string; timestamp: number }>()
const CACHE_DURATION = 45 * 60 * 1000 // 45 minutes (less than the 1-hour expiry)

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  selectedCell,
  onClose,
  isMobile = false
}) => {
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  const fetchFileInfo = useCallback(async (isRetry = false) => {
    if (!selectedCell) return
    
    try {
      if (isRetry) {
        setRetrying(true)
        setError(null)
      } else {
        setLoading(true)
        setError(null)
      }

      // Check cache first (but skip cache on retry)
      if (!isRetry) {
        const cached = urlCache.get(selectedCell.fileId)
        const now = Date.now()
        
        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
          console.log('Using cached signed URL for file:', selectedCell.fileId)
          setFileInfo(cached.fileInfo)
          setDocumentUrl(cached.signedUrl)
          setLoading(false)
          return
        }
      }

      // Call the simplified API route to get file info and signed URL
      console.log('Fetching new signed URL for file:', selectedCell.fileId)
      const response = await fetch(`/api/file-url?fileId=${selectedCell.fileId}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      
      // Cache the result
      const now = Date.now()
      urlCache.set(selectedCell.fileId, {
        fileInfo: data.fileInfo,
        signedUrl: data.signedUrl,
        timestamp: now
      })
      
      setFileInfo(data.fileInfo)
      setDocumentUrl(data.signedUrl)

    } catch (err) {
      console.error('Error fetching file info:', err)
      setError(err instanceof Error ? err.message : 'Failed to load document')
    } finally {
      setLoading(false)
      setRetrying(false)
    }
  }, [selectedCell])

  const handleRetry = () => {
    fetchFileInfo(true)
  }

  useEffect(() => {
    if (!selectedCell) return
    fetchFileInfo()
  }, [selectedCell, fetchFileInfo])

  if (!selectedCell) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleCloseClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onClose()
  }

  // Use long value if available, otherwise fall back to short value
  const displayValue = selectedCell.longValue || selectedCell.value
  const hasDetailedAnswer = selectedCell.longValue && selectedCell.longValue !== selectedCell.value

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div 
        className={`bg-white rounded-xl w-full ${isMobile ? 'max-w-[95vw] h-[95vh]' : 'max-w-5xl h-[90vh]'} flex flex-col shadow-2xl overflow-hidden border`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh', minHeight: '500px' }}
      >
        {/* Enhanced Header with Tabs */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-gray-900">Document Viewer</h2>
              <div className="flex items-center gap-4 mt-2">
                <Tabs defaultValue="analysis" className="w-auto">
                  <TabsList className="grid w-full grid-cols-2 bg-white border">
                    <TabsTrigger value="analysis" className="gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                      <BookOpen className="h-4 w-4" />
                      Analysis Results
                    </TabsTrigger>
                    <TabsTrigger value="document" className="gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                      <FileText className="h-4 w-4" />
                      Source Document
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleCloseClick} className="h-9 w-9 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Enhanced Content */}
        <Tabs defaultValue="analysis" className="flex-1 flex flex-col">
          {/* Analysis Tab - Enhanced */}
          <TabsContent value="analysis" className="flex-1 overflow-hidden mt-0">
            <div className="h-full overflow-y-auto p-6 space-y-6">
              {/* Quick Answer with better styling */}
              {hasDetailedAnswer && selectedCell.value && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-green-800">Quick Answer</h3>
                  </div>
                  <p className="text-green-700 leading-relaxed">{selectedCell.value}</p>
                </div>
              )}

              {/* Main Analysis with better presentation */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-lg">
                    {hasDetailedAnswer ? 'Detailed Analysis' : 'Extracted Information'}
                  </h3>
                </div>
                <div className="bg-gray-50 border rounded-xl p-4 max-h-80 overflow-y-auto">
                  <p className="whitespace-pre-wrap leading-relaxed text-gray-800 break-words">{displayValue}</p>
                </div>
              </div>

              {/* Enhanced Source Reference */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-gray-600" />
                  <h4 className="font-medium">Source Reference</h4>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <p className="text-sm text-amber-800 italic break-words">{selectedCell.sourceRef}</p>
                </div>
              </div>

              {/* Enhanced Confidence Score */}
              {selectedCell.confidence && (
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-gray-600" />
                    Confidence Score
                  </h4>
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant={selectedCell.confidence > 0.8 ? 'default' : selectedCell.confidence > 0.5 ? 'secondary' : 'destructive'}
                      className="text-sm px-3 py-1"
                    >
                      {Math.round(selectedCell.confidence * 100)}% confident
                    </Badge>
                    <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-32">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          selectedCell.confidence > 0.8 ? 'bg-green-500' : 
                          selectedCell.confidence > 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${selectedCell.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Document Tab - Enhanced with Simple PDF Viewer */}
          <TabsContent value="document" className="flex-1 overflow-hidden mt-0">
            <div className="h-full p-6">
              {loading && (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
                  <div className="text-center">
                    <p className="font-medium text-gray-900">Loading document...</p>
                    <p className="text-sm text-gray-500 mt-1">Please wait while we fetch your document</p>
                  </div>
                  <div className="space-y-2 w-full max-w-md">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              )}
              
              {error && (
                <div className="flex items-center justify-center h-full">
                  <Alert className="max-w-md border-red-200 bg-red-50">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <AlertDescription className="text-red-800">
                      <div className="space-y-3">
                        <div>
                          <p className="font-medium">Failed to load document</p>
                          <p className="text-sm mt-1">{error}</p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleRetry}
                          disabled={retrying}
                          className="gap-2"
                        >
                          {retrying ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          Try Again
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              
              {!loading && !error && documentUrl && fileInfo && (
                <div className="h-full border-2 border-gray-200 rounded-xl overflow-hidden shadow-inner bg-white">
                  {/* Simple PDF Viewer using iframe - no worker issues */}
                  {fileInfo.file_type?.toLowerCase().includes('pdf') ? (
                    <iframe
                      src={`${documentUrl}#toolbar=1&navpanes=1&scrollbar=1&page=1&view=FitH`}
                      className="w-full h-full border-0"
                      title={fileInfo.original_filename}
                      loading="lazy"
                      onError={() => {
                        // Fallback to basic iframe without parameters
                        const iframe = document.querySelector('iframe[title="' + fileInfo.original_filename + '"]') as HTMLIFrameElement;
                        if (iframe) {
                          iframe.src = documentUrl;
                        }
                      }}
                    />
                  ) : (
                    // For non-PDF files, show download option or preview if possible
                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                      <div className="text-center">
                        <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          {fileInfo.original_filename}
                        </h3>
                        <p className="text-gray-600 mb-4">
                          {fileInfo.file_type?.toUpperCase() || 'Document'} • {fileInfo.file_size ? (fileInfo.file_size / 1024 / 1024).toFixed(1) + ' MB' : 'Unknown size'}
                        </p>
                        <a
                          href={documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open in New Tab
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {!loading && !error && !documentUrl && (
                <div className="flex items-center justify-center h-full">
                  <Alert className="max-w-md border-yellow-200 bg-yellow-50">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      <div className="space-y-2">
                        <p className="font-medium">Document preview not available</p>
                        <p className="text-sm">This document cannot be previewed in the browser.</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}