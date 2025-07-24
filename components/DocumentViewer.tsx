import React, { useState, useEffect, useCallback } from 'react'
import { X, BookOpen, RefreshCw, AlertCircle, CheckCircle, ExternalLink, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SelectedCell } from '../types'

// React PDF Viewer imports
import { Viewer } from '@react-pdf-viewer/core'
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout'
import { highlightPlugin } from '@react-pdf-viewer/highlight'
import { searchPlugin } from '@react-pdf-viewer/search'
import type { RenderHighlightsProps } from '@react-pdf-viewer/highlight'

// Import required CSS
import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/default-layout/lib/styles/index.css'
import '@react-pdf-viewer/highlight/lib/styles/index.css'
import '@react-pdf-viewer/search/lib/styles/index.css'

interface DocumentViewerProps {
  selectedCell: SelectedCell | null
  onClose: () => void
  isMobile?: boolean
  highlightData?: Array<{
    page: number
    section: string
    paragraph: number
    text_excerpt: string
    location_type: string
  }>
}

interface FileInfo {
  id: string
  original_filename: string
  file_size: number | null
  file_type: string | null
  storage_path: string | null
}

interface HighlightArea {
  pageIndex: number
  left: number
  top: number
  width: number
  height: number
  backgroundColor: string
  opacity: number
}

// Cache for signed URLs
const urlCache = new Map<string, { fileInfo: FileInfo; signedUrl: string; timestamp: number }>()
const CACHE_DURATION = 45 * 60 * 1000 // 45 minutes

// PDF.js worker will be configured at runtime

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  selectedCell,
  onClose,
  isMobile = false,
  highlightData = []
}) => {
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [highlightAreas, setHighlightAreas] = useState<HighlightArea[]>([])
  const [searchKeywords] = useState<string[]>(
    highlightData.map(highlight => highlight.text_excerpt).filter(Boolean)
  )

  // Create highlight areas from data
  const createHighlightAreas = useCallback((): HighlightArea[] => {
    return highlightData.map((highlight, index) => ({
      pageIndex: Math.max(0, highlight.page - 1),
      left: 5 + (index % 3) * 30,
      top: highlight.location_type === 'header' ? 10 : 20 + (index % 5) * 15,
      width: Math.min(85, 20 + highlight.text_excerpt.length / 2),
      height: 8,
      backgroundColor: '#fbbf24',
      opacity: 0.6
    }))
  }, [highlightData])

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

      // Check cache first
      if (!isRetry) {
        const cached = urlCache.get(selectedCell.fileId)
        const now = Date.now()
        
        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
          setFileInfo(cached.fileInfo)
          setDocumentUrl(cached.signedUrl)
          setLoading(false)
          return
        }
      }

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

  // Configure PDF.js worker dynamically with version matching
  useEffect(() => {
    const configurePdfWorker = async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        if (pdfjs && pdfjs.GlobalWorkerOptions && pdfjs.version) {
          // Use matching version and .mjs extension for compatibility
          pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
          console.log(`PDF.js worker configured with version: ${pdfjs.version}`)
        }
      } catch (error) {
        console.warn('Failed to configure PDF.js worker:', error)
        // Fallback configuration
        try {
          const pdfjs = await import('pdfjs-dist')
          if (pdfjs && pdfjs.GlobalWorkerOptions) {
            pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.mjs'
          }
        } catch (fallbackError) {
          console.error('Fallback PDF.js worker configuration failed:', fallbackError)
        }
      }
    }
    
    // Only configure if we're in the browser
    if (typeof window !== 'undefined') {
      configurePdfWorker()
    }
  }, [])

  // Initialize highlight areas
  useEffect(() => {
    if (highlightData.length > 0) {
      setHighlightAreas(createHighlightAreas())
    }
  }, [highlightData, createHighlightAreas])

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

  // Custom highlight renderer
  const renderHighlights = (props: RenderHighlightsProps) => {
    return (
      <div>
        {highlightAreas
          .filter((area) => area.pageIndex === props.pageIndex)
          .map((area, idx) => {
            const highlightInfo = highlightData[idx]
            return (
              <div
                key={`highlight-${props.pageIndex}-${idx}`}
                className="absolute rounded-sm cursor-pointer transition-opacity hover:opacity-80"
                style={{
                  left: `${area.left}%`,
                  top: `${area.top}%`,
                  width: `${area.width}%`,
                  height: `${area.height}%`,
                  backgroundColor: area.backgroundColor,
                  opacity: area.opacity,
                  border: '1px solid rgba(251, 191, 36, 0.8)',
                  zIndex: 1
                }}
                title={highlightInfo ? `${highlightInfo.section} - Page ${highlightInfo.page}` : 'Highlighted text'}
              />
            )
          })}
      </div>
    )
  }

  // Plugin instances
  const searchPluginInstance = searchPlugin({
    keyword: searchKeywords.length > 0 ? searchKeywords : undefined,
  })

  const highlightPluginInstance = highlightPlugin({
    renderHighlights,
  })

  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: (defaultTabs) => [defaultTabs[0]], // Only show thumbnails
  })

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
      onClick={handleBackdropClick}
    >
      <ScrollArea className="h-full">   
        <div className="min-h-full flex items-center justify-center p-4">
        <div 
          className={`bg-white rounded-xl w-full ${isMobile ? 'max-w-[95vw]' : 'max-w-6xl'} flex flex-col shadow-2xl border my-4`}
          onClick={(e) => e.stopPropagation()}
          style={{ minHeight: isMobile ? '90vh' : '600px', maxHeight: 'calc(100vh - 2rem)' }}
        >
        {/* Header with Tabs */}
        <Tabs defaultValue="analysis" className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-gray-50 to-white">
            <TabsList className="grid grid-cols-2 bg-white border shadow-sm">
              <TabsTrigger value="analysis" className="gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 transition-all">
                <BookOpen className="h-4 w-4" />
                Analysis
              </TabsTrigger>
              <TabsTrigger value="document" className="gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 transition-all">
                <FileText className="h-4 w-4" />
                Document
                {highlightData.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs bg-amber-100 text-amber-800">
                    {highlightData.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleCloseClick} 
              className="h-9 w-9 p-0 hover:bg-gray-100 transition-colors rounded-full"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Analysis Tab */}
          <TabsContent value="analysis" className="flex-1 overflow-hidden mt-0">
            <div className="h-full overflow-y-auto p-6 space-y-6">
              {/* Quick Answer */}
              {hasDetailedAnswer && selectedCell.value && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-green-800">Quick Answer</h3>
                  </div>
                  <p className="text-green-700 leading-relaxed">{selectedCell.value}</p>
                </div>
              )}

              {/* Main Analysis */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-lg">
                    {hasDetailedAnswer ? 'Detailed Analysis' : 'Extracted Information'}
                  </h3>
                </div>
                <div className="bg-gray-50 border rounded-xl p-5">
                  <p className="whitespace-pre-wrap leading-relaxed text-gray-800 break-words">
                    {hasDetailedAnswer ? selectedCell.longValue : displayValue}
                  </p>
                </div>
              </div>

              {/* Source Reference */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-gray-600" />
                  <h4 className="font-medium">Source</h4>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800 italic break-words">{selectedCell.sourceRef}</p>
                </div>
              </div>

              {/* Highlights */}
              {highlightData.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <h4 className="font-medium">References ({highlightData.length})</h4>
                  </div>
                  <div className="grid gap-3">
                    {highlightData.map((highlight, index) => (
                      <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-yellow-800">Page {highlight.page}</span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {highlight.location_type}
                          </Badge>
                        </div>
                        <div className="text-sm text-yellow-700">
                          <p className="font-medium">{highlight.section}</p>
                          <p className="mt-1 italic">"{highlight.text_excerpt}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Document Tab */}
          <TabsContent value="document" className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 p-4">
              {loading && (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
                  <p className="font-medium text-gray-900">Loading document...</p>
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
                        <p className="font-medium">Failed to load document</p>
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
                  {fileInfo.file_type?.toLowerCase().includes('pdf') ? (
                    <div className="h-full pdf-viewer-container">
                      <Viewer
                        fileUrl={documentUrl}
                        plugins={[
                          defaultLayoutPluginInstance,
                          searchPluginInstance,
                          highlightPluginInstance,
                        ]}
                        defaultScale={1.2}
                        theme="light"
                      />
                    </div>
                  ) : (
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
                      <p className="font-medium">Document preview not available</p>
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        </div>
        </div>
      </ScrollArea>
    </div>
  )
}