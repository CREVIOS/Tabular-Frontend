import React, { useState, useEffect, useCallback } from 'react'
import { X, BookOpen, RefreshCw, AlertCircle, CheckCircle, ExternalLink, FileText, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SelectedCell } from '../types'

// Types
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

// Constants
const urlCache = new Map<string, { fileInfo: FileInfo; signedUrl: string; timestamp: number }>()
const CACHE_DURATION = 45 * 60 * 1000 // 45 minutes

// Flexible types for LLM-generated highlights that can have various structures
interface HighlightItem {
  page: number
  section?: string | null
  paragraph?: number | null
  text_excerpt: string
  location_type?: string | null
  bounding_info?: string | null
  // Additional fields that LLM might generate
  context?: string | null
  subsection?: string | null
  title?: string | null
  content?: string | null
  excerpt?: string | null
  text?: string | null
  description?: string | null
  bbox?: string | null
  coordinates?: string | null
  region?: string | null
  area?: string | null
}

// Security utilities
const sanitizeText = (text: string): string => {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/[<>&"']/g, (char) => {
      const entityMap: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#39;'
      }
      return entityMap[char] || char
    })
    .slice(0, 10000) // Limit length to prevent DoS
}

// Clean text excerpt for better display
const cleanTextExcerpt = (text: string): string => {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseJsonString = (str: string): any => {
  try {
    // First try to parse as-is
    return JSON.parse(str)
  } catch {
    try {
      // Try to decode HTML entities first
      const decoded = str
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
      return JSON.parse(decoded)
    } catch {
      // If it's still not valid JSON, return the original string
      return str
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseSourceReference = (sourceRef: string): { raw: string; parsed?: any; isJson: boolean } => {
  if (!sourceRef || typeof sourceRef !== 'string') {
    return { raw: '', isJson: false }
  }

  // Check if it looks like JSON (starts with { or [)
  const trimmed = sourceRef.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = parseJsonString(trimmed)
    if (typeof parsed === 'object') {
      return { raw: sourceRef, parsed, isJson: true }
    }
  }

  return { raw: sourceRef, isJson: false }
}

const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url)
    // Only allow HTTPS and specific domains for security
    return urlObj.protocol === 'https:' && 
           (urlObj.hostname.includes('supabase') || 
            urlObj.hostname.includes('amazonaws.com') ||
            urlObj.hostname.includes('storage.googleapis.com'))
  } catch {
    return false
  }
}

// Helper to extract text content from various possible field names
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractTextContent = (item: any): string => {
  const possibleTextFields = [
    'text_excerpt', 'excerpt', 'text', 'content', 'description'
  ]
  
  for (const field of possibleTextFields) {
    if (item[field] && typeof item[field] === 'string' && item[field].trim()) {
      return item[field].trim()
    }
  }
  
  return 'No content available'
}

// Helper to extract section/title information
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractSectionInfo = (item: any): string => {
  const possibleSectionFields = [
    'section', 'title', 'subsection', 'chapter', 'heading'
  ]
  
  for (const field of possibleSectionFields) {
    if (item[field] && typeof item[field] === 'string' && item[field].trim()) {
      return item[field].trim()
    }
  }
  
  return 'Unknown Section'
}

// Helper to extract location context information
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractLocationContext = (item: any): string | null => {
  const possibleContextFields = [
    'bounding_info', 'context', 'bbox', 'coordinates', 'region', 'area', 'location_context'
  ]
  
  for (const field of possibleContextFields) {
    if (item[field] && typeof item[field] === 'string' && item[field].trim()) {
      return item[field].trim()
    }
  }
  
  return null
}

// Robust validation for LLM-generated data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validateHighlightData = (data: any[]): HighlightItem[] => {
  if (!Array.isArray(data)) return []
  
  return data
    .filter(item => {
      // Only require page number and some form of text content
      if (!item || typeof item !== 'object') return false
      
      // Page must be a valid number
      const page = Number(item.page)
      if (!page || page < 1 || page > 10000) return false
      
      // Must have some text content
      const textContent = extractTextContent(item)
      if (!textContent || textContent === 'No content available') return false
      
      return true
    })
    .map(item => {
      const processedItem: HighlightItem = {
        page: Math.floor(Number(item.page)),
        text_excerpt: sanitizeText(extractTextContent(item)),
        section: sanitizeText(extractSectionInfo(item)),
        paragraph: item.paragraph && typeof item.paragraph === 'number' ? Math.floor(item.paragraph) : null,
        location_type: item.location_type && typeof item.location_type === 'string' ? sanitizeText(item.location_type) : 'content',
        bounding_info: extractLocationContext(item) ? sanitizeText(extractLocationContext(item)!) : null,
      }
      
      // Add any additional context fields that might be useful
      const additionalFields = ['context', 'subsection', 'title', 'description']
      additionalFields.forEach(field => {
        if (item[field] && typeof item[field] === 'string') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (processedItem as any)[field] = sanitizeText(item[field])
        }
      })
      
      return processedItem
    })
    .slice(0, 1000) // Limit total highlights to prevent performance issues
}

// Utility function to group highlights with flexible sorting
const groupHighlightsByPage = (highlights: HighlightItem[]) => {
  const grouped = highlights.reduce((acc, highlight) => {
    const page = highlight.page
    if (!acc[page]) {
      acc[page] = []
    }
    acc[page].push(highlight)
    return acc
  }, {} as Record<number, HighlightItem[]>)

  // Sort pages numerically
  return Object.keys(grouped)
    .map(Number)
    .sort((a: number, b: number) => a - b)
    .reduce((acc, page) => {
      acc[page] = grouped[page].sort((a: HighlightItem, b: HighlightItem) => {
        // Sort by section (handle nulls/undefined)
        const sectionA = a.section || 'ZZZ_Unknown'  // Put unknowns at end
        const sectionB = b.section || 'ZZZ_Unknown'
        
        if (sectionA !== sectionB) {
          return sectionA.localeCompare(sectionB)
        }
        
        // Sort by paragraph (handle nulls)
        const paragraphA = a.paragraph || 0
        const paragraphB = b.paragraph || 0
        
        return paragraphA - paragraphB
      })
      return acc
    }, {} as Record<number, HighlightItem[]>)
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  selectedCell,
  onClose,
  isMobile = false,
  highlightData = []
}) => {
  // Validate and sanitize highlight data on component mount
  const validatedHighlightData = validateHighlightData(highlightData)
  
  // State management
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [iframeError, setIframeError] = useState(false)
  // FIX 2: Add loading state for iframe
  const [iframeLoading, setIframeLoading] = useState(true)

  // Helper function to create proxy URL for PDFs
  const createProxyUrl = useCallback((originalUrl: string, page?: number): string => {
    if (!originalUrl) return ''
    
    try {
      const proxyUrl = new URL('/api/pdf-proxy', window.location.origin)
      proxyUrl.searchParams.set('url', originalUrl)
      
      // Add page parameter if specified
      if (page) {
        proxyUrl.searchParams.set('page', page.toString())
      }
      
      return proxyUrl.toString() + (page ? `#page=${page}` : '')
    } catch (error) {
      console.error('Error creating proxy URL:', error)
      return originalUrl // Fallback to original URL
    }
  }, [])

  // Enhanced file fetching with better error handling
  const fetchFileInfo = useCallback(async (isRetry = false) => {
    if (!selectedCell) return
    
    try {
      if (isRetry) {
        setRetrying(true)
        setError(null)
        setIframeError(false) // FIX 2: Reset iframe error on retry
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
      
      // Create AbortController for request cancellation
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout
      
      const response = await fetch(`/api/file-url?fileId=${selectedCell.fileId}`, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Accept': 'application/json'
        }
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // Validate response data
      if (!data.signedUrl || !data.fileInfo) {
        throw new Error('Invalid response: missing required data')
      }
      
      // Cache the result
      const now = Date.now()
      urlCache.set(selectedCell.fileId, {
        fileInfo: data.fileInfo,
        signedUrl: data.signedUrl,
        timestamp: now
      })
      
      // Validate URL before setting
      if (!isValidUrl(data.signedUrl)) {
        throw new Error('Invalid or unsafe document URL')
      }
      
      setFileInfo(data.fileInfo)
      setDocumentUrl(data.signedUrl)
    } catch (err) {
      console.error('Error fetching file info:', err)
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Please try again.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load document')
      }
    } finally {
      setLoading(false)
      setRetrying(false)
    }
  }, [selectedCell])

  // Event handlers
  const handleRetry = useCallback(() => {
    fetchFileInfo(true)
  }, [fetchFileInfo])

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])

  const handleCloseClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onClose()
  }, [onClose])

  // FIX 2: Enhanced iframe load handling
  const handleIframeLoad = useCallback((e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const iframe = e.target as HTMLIFrameElement
    setIframeLoading(false)
    
    // Check if iframe loaded successfully
    try {
      // Test if we can access the iframe
      if (iframe.contentDocument === null && iframe.contentWindow === null) {
        // This usually means the iframe was blocked
        setTimeout(() => {
          setIframeError(true)
        }, 1000)
      }
    } catch (error) {
      console.warn('Iframe access restricted:', error)
      // This is normal for cross-origin iframes, don't set error
    }
    
    // Additional check for PDF loading
    setTimeout(() => {
      try {
        if (iframe.contentDocument?.body?.innerHTML === '') {
          setIframeError(true)
        }
      } catch {
        // Cross-origin restriction, this is normal
      }
    }, 2000)
  }, [])

  const handleIframeError = useCallback(() => {
    setIframeError(true)
    setIframeLoading(false)
  }, [])

  // Effects
  useEffect(() => {
    if (!selectedCell) return
    fetchFileInfo()
  }, [selectedCell, fetchFileInfo])

  // FIX 2: Reset iframe states when documentUrl changes
  useEffect(() => {
    if (documentUrl) {
      setIframeError(false)
      setIframeLoading(true)
    }
  }, [documentUrl])

  if (!selectedCell) return null

  const displayValue = sanitizeText(selectedCell.longValue || selectedCell.value || '')
  const hasDetailedAnswer = selectedCell.longValue && selectedCell.longValue !== selectedCell.value
  const groupedHighlights = groupHighlightsByPage(validatedHighlightData)
  
  // FIX 1: Parse source reference
  const sourceReference = parseSourceReference(selectedCell.sourceRef || '')

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div className="min-h-full flex items-center justify-center p-4">
        <div
          className={`bg-white rounded-xl w-full ${isMobile ? 'max-w-[95vw]' : 'max-w-6xl'} flex flex-col shadow-2xl border my-4`}
          onClick={(e) => e.stopPropagation()}
          style={{
            minHeight: isMobile ? '90vh' : '600px',
            maxHeight: 'calc(100vh - 2rem)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Tabs defaultValue="analysis" className="flex-1 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-gray-50 to-white shrink-0">
              <TabsList className="grid grid-cols-2 bg-white border shadow-sm">
                <TabsTrigger value="analysis" className="gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 transition-all">
                  <BookOpen className="h-4 w-4" />
                  Analysis
                </TabsTrigger>
                <TabsTrigger value="document" className="gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 transition-all">
                  <FileText className="h-4 w-4" />
                  Document
                  {validatedHighlightData.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs bg-amber-100 text-amber-800">
                      {validatedHighlightData.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseClick}
                className="h-9 w-9 p-0 hover:bg-gray-100 transition-colors rounded-full shrink-0"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Analysis Tab */}
            <TabsContent value="analysis" className="flex-1 flex flex-col mt-0 min-h-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                {hasDetailedAnswer && selectedCell.value && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <h3 className="font-semibold text-green-800">Quick Answer</h3>
                    </div>
                    <p className="text-green-700 leading-relaxed">{sanitizeText(selectedCell.value || '')}</p>
                  </div>
                )}

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

                {/* FIX 1: Enhanced source reference display */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-gray-600" />
                    <h4 className="font-medium">Source</h4>
                  </div>
                  
                  {sourceReference.isJson && sourceReference.parsed ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="space-y-3">
                        <h5 className="font-medium text-amber-800 mb-2">Document Reference:</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {sourceReference.parsed.page && (
                            <div>
                              <span className="font-medium text-amber-700">Page:</span>
                              <span className="ml-2 text-amber-800">{sourceReference.parsed.page}</span>
                            </div>
                          )}
                          {sourceReference.parsed.section && (
                            <div>
                              <span className="font-medium text-amber-700">Section:</span>
                              <span className="ml-2 text-amber-800">{cleanTextExcerpt(sourceReference.parsed.section)}</span>
                            </div>
                          )}
                          {sourceReference.parsed.paragraph && (
                            <div>
                              <span className="font-medium text-amber-700">Paragraph:</span>
                              <span className="ml-2 text-amber-800">{sourceReference.parsed.paragraph}</span>
                            </div>
                          )}
                          {sourceReference.parsed.location_type && (
                            <div>
                              <span className="font-medium text-amber-700">Location:</span>
                              <span className="ml-2 text-amber-800 capitalize">{cleanTextExcerpt(sourceReference.parsed.location_type)}</span>
                            </div>
                          )}
                        </div>
                        
                        {sourceReference.parsed.text_excerpt && (
                          <div className="mt-3 pt-3 border-t border-amber-200">
                            <span className="font-medium text-amber-700">Excerpt:</span>
                            <p className="mt-1 text-amber-700 italic">
                              "{cleanTextExcerpt(sourceReference.parsed.text_excerpt)}"
                            </p>
                          </div>
                        )}
                        
                        {sourceReference.parsed.bounding_info && (
                          <div className="mt-2">
                            <span className="font-medium text-amber-700">Context:</span>
                            <span className="ml-2 text-amber-700 text-xs">{cleanTextExcerpt(sourceReference.parsed.bounding_info)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <p className="text-sm text-amber-800 italic break-words">{cleanTextExcerpt(sourceReference.raw)}</p>
                    </div>
                  )}
                </div>

                {Object.keys(groupedHighlights).length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-green-600" />
                      <h4 className="font-medium">Source References ({validatedHighlightData.length} total)</h4>
                    </div>
                    <div className="space-y-4">
                      {Object.entries(groupedHighlights).map(([page, highlights]) => (
                        <div key={page} className="border border-gray-200 rounded-xl overflow-hidden">
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b">
                            <div className="flex items-center justify-between">
                              <h5 className="font-semibold text-blue-800">Page {page}</h5>
                              <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                                {highlights.length} reference{highlights.length > 1 ? 's' : ''}
                              </Badge>
                            </div>
                          </div>
                          <div className="p-4 space-y-4">
                            {highlights.map((highlight, index) => {
                               // Collect all available context information
                               const contextItems = []
                               
                               if (highlight.location_type) {
                                 contextItems.push({
                                   label: highlight.location_type,
                                   color: 'bg-white',
                                   textColor: 'text-gray-700'
                                 })
                               }
                               
                               if (highlight.bounding_info) {
                                 contextItems.push({
                                   label: cleanTextExcerpt(highlight.bounding_info),
                                   color: 'bg-blue-50 border-blue-200',
                                   textColor: 'text-blue-700'
                                 })
                               }
                               
                               // Check for any additional context fields
                               const additionalContext = []
                               // eslint-disable-next-line @typescript-eslint/no-explicit-any
                               if ((highlight as any).context) additionalContext.push((highlight as any).context)
                               // eslint-disable-next-line @typescript-eslint/no-explicit-any
                               if ((highlight as any).subsection) additionalContext.push((highlight as any).subsection)
                               // eslint-disable-next-line @typescript-eslint/no-explicit-any
                               if ((highlight as any).description) additionalContext.push((highlight as any).description)
                               
                               return (
                                 <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                   <div className="flex items-start justify-between mb-3">
                                     <div className="space-y-2 flex-1">
                                       {/* Section and paragraph info */}
                                       <div className="flex items-center gap-2 flex-wrap">
                                         {highlight.section && (
                                           <span className="font-medium text-yellow-800">{highlight.section}</span>
                                         )}
                                         {highlight.paragraph && (
                                           <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700">
                                             Para {highlight.paragraph}
                                           </Badge>
                                         )}
                                       </div>
                                       
                                       {/* Context badges - only show if we have any */}
                                       {contextItems.length > 0 && (
                                         <div className="flex items-center gap-2 flex-wrap">
                                           {contextItems.map((context, idx) => (
                                             <Badge 
                                               key={idx}
                                               variant="outline" 
                                               className={`text-xs capitalize ${context.color} ${context.textColor}`}
                                             >
                                               {context.label}
                                             </Badge>
                                           ))}
                                         </div>
                                       )}
                                       
                                       {/* Additional context - show as small text */}
                                       {additionalContext.length > 0 && (
                                         <div className="text-xs text-gray-600">
                                           {additionalContext.map((ctx, idx) => (
                                             <span key={idx}>
                                               {cleanTextExcerpt(ctx)}
                                               {idx < additionalContext.length - 1 && ' • '}
                                             </span>
                                           ))}
                                         </div>
                                       )}
                                     </div>
                                   </div>
                                   
                                   {/* Main content */}
                                   <div className="text-sm text-yellow-700">
                                     <p className="italic leading-relaxed">
                                       "{cleanTextExcerpt(highlight.text_excerpt)}"
                                     </p>
                                   </div>
                                 </div>
                               )
                             })}
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
              {/* Page Navigation for Referenced Pages */}
              {Object.keys(groupedHighlights).length > 0 && (
                <div className="p-4 border-b bg-gray-50 shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <h4 className="font-medium text-gray-900">Referenced Pages</h4>
                    <Badge variant="secondary" className="text-xs">
                      {Object.keys(groupedHighlights).length} pages
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(groupedHighlights)
                      .map(Number)
                      .sort((a, b) => a - b)
                      .map((page) => (
                                                 <Button
                           key={page}
                           variant="outline"
                           size="sm"
                           onClick={() => {
                             if (documentUrl && isValidUrl(documentUrl) && fileInfo?.file_type?.toLowerCase().includes('pdf')) {
                               // Validate page number for security
                               const pageNumber = Math.max(1, Math.min(10000, Math.floor(page)))
                               
                               // Use proxy URL for iframe to avoid CORS issues
                               const proxyPageUrl = createProxyUrl(documentUrl, pageNumber)
                               
                               // Safer DOM manipulation with more specific selector
                               const iframe = document.querySelector(`iframe[data-file-id="${selectedCell?.fileId}"]`) as HTMLIFrameElement
                               if (iframe && proxyPageUrl) {
                                 iframe.src = proxyPageUrl
                                 // FIX 2: Reset loading state when navigating
                                 setIframeLoading(true)
                                 setIframeError(false)
                               }
                             }
                           }}
                           className="gap-1 hover:bg-blue-50 hover:border-blue-300"
                         >
                          <span className="font-medium">Page {page}</span>
                          <Badge variant="secondary" className="text-xs ml-1">
                            {groupedHighlights[page].length}
                          </Badge>
                        </Button>
                      ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Click a page button to jump directly to that page in the document
                  </p>
                </div>
              )}
              
              <div className="flex-1 p-4 overflow-hidden">
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
                          <p className="text-sm">{error}</p>
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
                  <div className="h-full border-2 border-gray-200 rounded-xl overflow-hidden shadow-inner bg-white flex flex-col">
                    {fileInfo.file_type?.toLowerCase().includes('pdf') ? (
                        <div className="flex-1 relative">
                          {/* FIX 2: Show loading state for iframe */}
                          {iframeLoading && !iframeError && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                              <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600 mx-auto mb-2"></div>
                                <p className="text-sm text-gray-600">Loading PDF...</p>
                              </div>
                            </div>
                          )}
                          
                                                     {!iframeError ? (
                             <iframe
                               src={createProxyUrl(documentUrl, 1) + '&toolbar=1&navpanes=1&scrollbar=1&view=FitH'}
                               className="w-full h-full border-none"
                               title={sanitizeText(fileInfo.original_filename || '')}
                               data-file-id={selectedCell?.fileId}
                               style={{ minHeight: '500px' }}
                               sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-modals"
                               referrerPolicy="strict-origin-when-cross-origin"
                               loading="eager"
                               allow="fullscreen"
                               onError={handleIframeError}
                               onLoad={handleIframeLoad}
                             />
                          ) : (
                            <div className="flex items-center justify-center h-full bg-gray-100">
                              <div className="text-center p-8">
                                <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">
                                  PDF Preview Blocked
                                </h3>
                                <p className="text-gray-600 mb-4">
                                  Your browser blocked the PDF preview for security reasons.
                                </p>
                                <div className="space-y-2">
                                  <a
                                    href={documentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                    Open PDF in New Tab
                                  </a>
                                  <div className="text-center">
                                                                         <Button
                                       variant="outline"
                                       size="sm"
                                       onClick={() => {
                                         setIframeError(false)
                                         setIframeLoading(true)
                                         // Force iframe reload with proxy URL
                                         const iframe = document.querySelector(`iframe[data-file-id="${selectedCell?.fileId}"]`) as HTMLIFrameElement
                                         if (iframe && documentUrl) {
                                           iframe.src = createProxyUrl(documentUrl, 1) + '&toolbar=1&navpanes=1&scrollbar=1&view=FitH'
                                         }
                                       }}
                                       className="gap-2"
                                     >
                                      <RefreshCw className="h-4 w-4" />
                                      Try Again
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="absolute top-4 right-4 space-y-2">
                            <a
                              href={documentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Open Full Screen
                            </a>
                            {!iframeError && (
                              <div className="text-xs text-gray-600 bg-white/90 p-2 rounded">
                                If PDF doesn't load, click "Open Full Screen" above
                              </div>
                            )}
                          </div>
                        </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full space-y-4">
                        <div className="text-center">
                          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {sanitizeText(fileInfo.original_filename || '')}
                          </h3>
                          <p className="text-gray-600 mb-4">
                            {sanitizeText(fileInfo.file_type?.toUpperCase() || 'Document')} • {fileInfo.file_size && typeof fileInfo.file_size === 'number' ? (Math.max(0, fileInfo.file_size) / 1024 / 1024).toFixed(1) + ' MB' : 'Unknown size'}
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
    </div>
  )
}