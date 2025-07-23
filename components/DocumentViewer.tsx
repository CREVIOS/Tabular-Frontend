import React, { useState, useEffect } from 'react'
import { X, FileText, Info, BookOpen, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DocViewer, { DocViewerRenderers } from '@cyntler/react-doc-viewer'
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

  useEffect(() => {
    if (!selectedCell) return

    const fetchFileInfo = async () => {
      try {
        setLoading(true)
        setError(null)

        // Check cache first
        const cached = urlCache.get(selectedCell.fileId)
        const now = Date.now()
        
        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
          console.log('Using cached signed URL for file:', selectedCell.fileId)
          setFileInfo(cached.fileInfo)
          setDocumentUrl(cached.signedUrl)
          setLoading(false)
          return
        }

        // Call the API route to get file info and signed URL
        console.log('Fetching new signed URL for file:', selectedCell.fileId)
        const response = await fetch(`/api/files/${selectedCell.fileId}/signed-url`)
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        const data = await response.json()
        
        // Cache the result
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
      }
    }

    fetchFileInfo()
  }, [selectedCell])

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

  const handleDownload = () => {
    if (documentUrl && fileInfo) {
      const link = document.createElement('a')
      link.href = documentUrl
      link.download = fileInfo.original_filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  // Use long value if available, otherwise fall back to short value
  const displayValue = selectedCell.longValue || selectedCell.value
  const hasDetailedAnswer = selectedCell.longValue && selectedCell.longValue !== selectedCell.value

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div 
        className={`bg-white rounded-xl w-full ${isMobile ? 'max-w-[95vw] max-h-[90vh]' : 'max-w-6xl max-h-[90vh]'} flex flex-col shadow-2xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between border-b border-gray-200 flex-shrink-0 ${isMobile ? 'p-4' : 'p-6'}`}>
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className={`font-semibold text-gray-900 ${isMobile ? 'text-lg' : 'text-xl'}`}>
                {loading ? 'Loading Document...' : fileInfo?.original_filename || 'Document Viewer'}
              </h3>
              <p className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                {fileInfo?.file_size ? `${(fileInfo.file_size / 1024 / 1024).toFixed(1)} MB` : 'Document and analysis results'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {documentUrl && fileInfo && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleDownload}
                className="flex-shrink-0 hover:bg-gray-100"
                type="button"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleCloseClick}
              className={`flex-shrink-0 hover:bg-gray-100 touch-target ${isMobile ? 'h-10 w-10 p-0' : 'h-9 w-9 p-0'}`}
              type="button"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Tabbed Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="document" className="h-full flex flex-col">
            <div className="border-b border-gray-200 px-6 pt-4">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="document" className="flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>Document</span>
                </TabsTrigger>
                <TabsTrigger value="analysis" className="flex items-center space-x-2">
                  <BookOpen className="h-4 w-4" />
                  <span>Analysis</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Document Tab */}
            <TabsContent value="document" className="flex-1 overflow-hidden m-0">
              <div className="h-full p-6">
                {loading && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading document...</p>
                    </div>
                  </div>
                )}
                
                {error && (
                  <div className="flex items-center justify-center h-full">
                    <Card className="border-red-200 bg-red-50/50 max-w-md">
                      <CardContent className="p-6 text-center">
                        <p className="text-red-800 mb-4">Failed to load document</p>
                        <p className="text-sm text-red-600">{error}</p>
                      </CardContent>
                    </Card>
                  </div>
                )}
                
                {!loading && !error && documentUrl && fileInfo && (
                  <div className="h-full border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                    <DocViewer
                      documents={[{
                        uri: documentUrl,
                        fileName: fileInfo.original_filename,
                      }]}
                      pluginRenderers={DocViewerRenderers}
                      config={{
                        header: {
                          disableFileName: true,
                          disableHeader: false,
                        },
                        pdfZoom: {
                          defaultZoom: 1.0,
                          zoomJump: 0.2,
                        },
                      }}
                      style={{ height: '100%' }}
                      theme={{
                        primary: "#3b82f6",
                        secondary: "#ffffff",
                        tertiary: "#f3f4f6",
                        textPrimary: "#111827",
                        textSecondary: "#6b7280",
                        textTertiary: "#9ca3af",
                        disableThemeScrollbar: false,
                      }}
                    />
                  </div>
                )}
                
                {!loading && !error && !documentUrl && (
                  <div className="flex items-center justify-center h-full">
                    <Card className="border-yellow-200 bg-yellow-50/50 max-w-md">
                      <CardContent className="p-6 text-center">
                        <p className="text-yellow-800">Document not available for preview</p>
                        <p className="text-sm text-yellow-600 mt-2">The document may not be stored or accessible.</p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Analysis Tab */}
            <TabsContent value="analysis" className="flex-1 overflow-auto m-0">
              <div className={`space-y-4 ${isMobile ? 'p-4' : 'p-6 space-y-6'}`}>
                {/* Show short answer if we have detailed answer */}
                {hasDetailedAnswer && selectedCell.value && (
                  <Card className="border-green-200 bg-green-50/50">
                    <CardHeader className={isMobile ? 'pb-2 p-4' : 'pb-3'}>
                      <CardTitle className={`flex items-center space-x-2 ${isMobile ? 'text-base' : 'text-lg'}`}>
                        <Info className="h-5 w-5 text-green-600" />
                        <span>Quick Answer</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className={`${isMobile ? 'p-4 pt-0' : ''}`}>
                      <div className="bg-white p-4 rounded-lg border border-green-200">
                        <p className={`text-gray-900 leading-relaxed break-words font-medium ${isMobile ? 'text-sm' : ''}`}>
                          {selectedCell.value}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Detailed Analysis Card */}
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardHeader className={isMobile ? 'pb-2 p-4' : 'pb-3'}>
                    <CardTitle className={`flex items-center space-x-2 ${isMobile ? 'text-base' : 'text-lg'}`}>
                      <BookOpen className="h-5 w-5 text-blue-600" />
                      <span>{hasDetailedAnswer ? 'Detailed Analysis' : 'Extracted Information'}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className={`space-y-3 ${isMobile ? 'p-4 pt-0' : 'space-y-4'}`}>
                    <div>
                      <label className={`text-gray-700 block mb-2 font-semibold ${isMobile ? 'text-sm' : 'text-sm'}`}>
                        {hasDetailedAnswer ? 'Full Analysis:' : 'Extracted Value:'}
                      </label>
                      <div className="bg-white p-4 rounded-lg border border-blue-200 max-h-64 overflow-y-auto">
                        <p className={`text-gray-900 leading-relaxed break-words whitespace-pre-wrap ${isMobile ? 'text-sm' : ''}`}>
                          {displayValue}
                        </p>
                      </div>
                    </div>
                    
                    <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                      <div>
                        <label className={`text-gray-700 block mb-2 font-semibold ${isMobile ? 'text-sm' : 'text-sm'}`}>
                          Source Reference:
                        </label>
                        <div className="bg-white p-3 rounded-lg border border-blue-200 max-h-32 overflow-y-auto">
                          <p className={`text-gray-600 break-words ${isMobile ? 'text-xs' : 'text-sm'}`}>
                            {selectedCell.sourceRef}
                          </p>
                        </div>
                      </div>
                      
                      {selectedCell.confidence && (
                        <div>
                          <label className={`text-gray-700 block mb-2 font-semibold ${isMobile ? 'text-sm' : 'text-sm'}`}>
                            Confidence Score:
                          </label>
                          <div className="bg-white p-3 rounded-lg border border-blue-200">
                            <Badge 
                              variant={selectedCell.confidence > 0.8 ? 'default' : selectedCell.confidence > 0.5 ? 'secondary' : 'destructive'}
                              className="text-sm"
                            >
                              {Math.round(selectedCell.confidence * 100)}% confident
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className={`flex justify-end border-t border-gray-200 bg-gray-50/50 flex-shrink-0 ${isMobile ? 'p-4' : 'p-6'}`}>
          <Button onClick={handleCloseClick} className={`touch-target ${isMobile ? 'px-6 h-11' : 'px-6'}`} type="button">
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}