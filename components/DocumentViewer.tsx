import React, { useState, useEffect } from 'react'
import { X, FileText, BookOpen, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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

        // Call the simplified API route to get file info and signed URL
        console.log('Fetching new signed URL for file:', selectedCell.fileId)
        const response = await fetch(`/api/file-url?fileId=${selectedCell.fileId}`)
        
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
        className={`bg-white rounded-lg w-full ${isMobile ? 'max-w-[95vw] h-[90vh]' : 'max-w-4xl h-[85vh]'} flex flex-col shadow-xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold">
              {loading ? 'Loading...' : fileInfo?.original_filename || 'Document'}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {documentUrl && fileInfo && (
              <Button variant="ghost" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleCloseClick}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Content */}
        <Tabs defaultValue="analysis" className="flex-1 flex flex-col">
          <div className="px-4 pt-3">
            <TabsList className="grid w-full max-w-xs grid-cols-2">
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
              <TabsTrigger value="document">Document</TabsTrigger>
            </TabsList>
          </div>

          {/* Analysis Tab */}
          <TabsContent value="analysis" className="flex-1 overflow-hidden mt-3">
            <div className="h-full overflow-y-auto px-4 pb-4 space-y-4">
              {/* Quick Answer */}
              {hasDetailedAnswer && selectedCell.value && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-medium text-green-800 mb-2">Quick Answer</h3>
                  <p className="text-sm text-green-700">{selectedCell.value}</p>
                </div>
              )}

              {/* Main Analysis */}
              <div className="space-y-3">
                <h3 className="font-medium">
                  {hasDetailedAnswer ? 'Detailed Analysis' : 'Extracted Information'}
                </h3>
                <div className="bg-gray-50 border rounded-lg p-3 max-h-48 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">{displayValue}</p>
                </div>
              </div>

              <Separator />

              {/* Source Reference */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Source Reference</h4>
                <div className="bg-gray-50 border rounded-lg p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs text-muted-foreground">{selectedCell.sourceRef}</p>
                </div>
              </div>

              {/* Confidence Score */}
              {selectedCell.confidence && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Confidence</h4>
                  <Badge 
                    variant={selectedCell.confidence > 0.8 ? 'default' : selectedCell.confidence > 0.5 ? 'secondary' : 'destructive'}
                  >
                    {Math.round(selectedCell.confidence * 100)}%
                  </Badge>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Document Tab */}
          <TabsContent value="document" className="flex-1 overflow-hidden mt-3">
            <div className="h-full p-4">
              {loading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Loading document...</p>
                  </div>
                </div>
              )}
              
              {error && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center border border-red-200 bg-red-50 rounded-lg p-6 max-w-md">
                    <p className="text-red-800 font-medium">Failed to load document</p>
                    <p className="text-sm text-red-600 mt-1">{error}</p>
                  </div>
                </div>
              )}
              
              {!loading && !error && documentUrl && fileInfo && (
                <div className="h-full border rounded-lg overflow-hidden">
                  <DocViewer
                    documents={[{
                      uri: documentUrl,
                      fileName: fileInfo.original_filename,
                    }]}
                    pluginRenderers={DocViewerRenderers}
                    config={{
                      header: { disableFileName: true },
                      pdfZoom: { defaultZoom: 1.0, zoomJump: 0.2 },
                    }}
                    style={{ height: '100%' }}
                    theme={{
                      primary: "hsl(var(--primary))",
                      secondary: "hsl(var(--background))",
                      tertiary: "hsl(var(--muted))",
                    }}
                  />
                </div>
              )}
              
              {!loading && !error && !documentUrl && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center border border-yellow-200 bg-yellow-50 rounded-lg p-6 max-w-md">
                    <p className="text-yellow-800 font-medium">Document not available</p>
                    <p className="text-sm text-yellow-600 mt-1">The document may not be stored or accessible.</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}