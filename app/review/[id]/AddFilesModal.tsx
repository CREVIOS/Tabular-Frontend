// AddFilesModal.tsx - Updated with shadcn Dialog and Supabase RPC
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, FileText, AlertCircle, CheckCircle, Loader2, Folder } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/database.types'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Updated interface to match RPC function return
interface FileItem {
  file_id: string
  file_name: string
  file_size: number | null
  is_in_review: boolean
  folder_id: string | null
  folder_name: string | null
}

interface AddFilesModalProps {
  isOpen: boolean
  onClose: () => void
  reviewId: string
  existingFileIds?: string[] // Keep for compatibility but not used with RPC
  existingFiles?: unknown[] // Keep for compatibility
  onFilesAdded?: () => void
}

// Helper function to get file type icon and color (documents only)
const getFileTypeInfo = (filename: string) => {
  const extension = filename.split('.').pop()?.toLowerCase()
  
  // Document files
  if (extension && ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(extension)) {
    return { icon: FileText, color: 'text-blue-500', type: 'document' }
  }
  
  // Default - treat all files as documents
  return { icon: FileText, color: 'text-blue-500', type: 'document' }
}

export default function AddFilesModal({ 
  isOpen, 
  onClose, 
  reviewId, 
  onFilesAdded
}: AddFilesModalProps) {
  const [availableFiles, setAvailableFiles] = useState<FileItem[]>([])
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'available'>('available')
  const [filterType, setFilterType] = useState<'all' | 'document'>('all')
  const [filterFolder, setFilterFolder] = useState<string>('all')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  const supabase = createClient()
  
  // Fetch files using the new RPC function
  const fetchFiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: rpcError } = await (supabase as any)
        .rpc('get_review_files', { review_id_param: reviewId })
      
      if (rpcError) {
        throw new Error(rpcError.message)
      }
      
      // Transform the database response to match FileItem interface
      const dbFiles: Database['public']['Functions']['get_review_files']['Returns'] = data || []
      const transformedFiles: FileItem[] = dbFiles.map(file => ({
        file_id: file.file_id,
        file_name: file.file_name,
        file_size: file.file_size,
        is_in_review: file.is_in_review,
        folder_id: file.folder_id,
        folder_name: file.folder_name
      }))
      setAvailableFiles(transformedFiles)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [reviewId, supabase])
  
  // Load files when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchFiles()
      setSelectedFileIds([])
      setSearchQuery('')
      setError(null)
      setSuccessMessage(null)
    }
  }, [isOpen, fetchFiles])
  
  // Get unique folders for filter dropdown
  const uniqueFolders = useMemo(() => {
    const folders = availableFiles
      .filter(file => file.folder_name)
      .map(file => ({ id: file.folder_id!, name: file.folder_name! }))
      .filter((folder, index, arr) => 
        arr.findIndex(f => f.id === folder.id) === index
      )
    return folders
  }, [availableFiles])
  
  // Filter available files
  const filteredFiles = useMemo(() => {
    return availableFiles.filter(file => {
      // Filter by review status
      if (filterStatus === 'available' && file.is_in_review) return false
      
      // Filter by file type
      if (filterType !== 'all') {
        const { type } = getFileTypeInfo(file.file_name)
        if (type !== filterType) return false
      }
      
      // Filter by folder
      if (filterFolder !== 'all' && file.folder_id !== filterFolder) return false
      
      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          file.file_name.toLowerCase().includes(query) ||
          file.folder_name?.toLowerCase().includes(query)
        )
      }
      
      return true
    })
  }, [availableFiles, filterStatus, filterType, filterFolder, searchQuery])
  
  // Handle file selection
  const toggleFileSelection = useCallback((fileId: string) => {
    setSelectedFileIds(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    )
  }, [])
  
  const selectAll = useCallback(() => {
    const availableForSelection = filteredFiles.filter(f => !f.is_in_review)
    setSelectedFileIds(availableForSelection.map(f => f.file_id))
  }, [filteredFiles])
  
  const deselectAll = useCallback(() => {
    setSelectedFileIds([])
  }, [])
  
  const handleSubmit = useCallback(async () => {
    if (selectedFileIds.length === 0) return
    setIsSubmitting(true)
    setError(null)
    setSuccessMessage(null)
    
    try {
      // Get Supabase session and access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication required. Please log in again.')
      }
      
      // Backend URL - Use backend API for adding files to review
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://app2.makebell.com:8443'
      const url = `${backendUrl}/api/reviews/${reviewId}/files`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ file_ids: selectedFileIds })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || data.message || data.detail || 'Failed to add files')
      }
      
      /* REMOVED: Direct Supabase insertion - using backend API instead
      const filesToAdd = selectedFileIds.map(fileId => ({
        review_id: reviewId,
        file_id: fileId,
        added_at: new Date().toISOString()
      }))
      
      const { error: insertError } = await supabase
        .from('tabular_review_files')
        .insert(filesToAdd)
      
      if (insertError) {
        throw new Error(insertError.message)
      }
      */
      
      setSuccessMessage('Files added successfully! Analysis will start automatically.')
      setTimeout(() => {
        setIsSubmitting(false)
        setSuccessMessage(null)
        if (onFilesAdded) onFilesAdded()
        onClose()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add files')
      setIsSubmitting(false)
    }
  }, [selectedFileIds, reviewId, onClose, supabase, onFilesAdded])
  
  // Format file size with null handling
  const formatFileSize = (bytes: number | null) => {
    if (bytes === null || bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
  
  const availableFilesCount = filteredFiles.filter(f => !f.is_in_review).length
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Add Documents</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Select documents to add to your review. Only files not already in the review are available for selection.
          </DialogDescription>
        </DialogHeader>
        
        {/* Progress Indicator */}
        {isSubmitting && (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Adding {selectedFileIds.length} documents...
              </span>
            </div>
          </Card>
        )}
        
        {successMessage && (
          <Card className="p-4 bg-green-50 border-green-200">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-800">{successMessage}</span>
            </div>
          </Card>
        )}
        
        {/* Search and Filters */}
        <div className="space-y-4 py-4 border-y">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by filename or folder..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={(value: 'all' | 'available') => setFilterStatus(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available Only</SelectItem>
                  <SelectItem value="all">All Files</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filterType} onValueChange={(value: 'all' | 'document') => setFilterType(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Files</SelectItem>
                  <SelectItem value="document">Documents</SelectItem>
                </SelectContent>
              </Select>
              
              {uniqueFolders.length > 0 && (
                <Select value={filterFolder} onValueChange={setFilterFolder}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Folders</SelectItem>
                    {uniqueFolders.map(folder => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          
          {/* Selection Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={availableFilesCount === 0}
              >
                Select All Available ({availableFilesCount})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={deselectAll}
                disabled={selectedFileIds.length === 0}
              >
                Deselect All
              </Button>
            </div>
            <Badge variant="secondary" className="text-sm">
              {selectedFileIds.length} selected
            </Badge>
          </div>
        </div>
        
        {/* File List */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading files...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-destructive">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p className="text-sm font-medium mb-2">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchFiles}>
                Try Again
              </Button>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2" />
              <p className="text-sm font-medium">No files found</p>
              <p className="text-xs mt-1">
                {searchQuery ? 'Try adjusting your search or filters' : 'No files match the current filters'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFiles.map((file) => {
                const { icon: FileIcon, color } = getFileTypeInfo(file.file_name)
                const isDisabled = file.is_in_review
                const isSelected = selectedFileIds.includes(file.file_id)
                
                return (
                  <Card
                    key={file.file_id}
                    className={`p-4 cursor-pointer transition-all duration-200 ${
                      isDisabled 
                        ? 'opacity-60 cursor-not-allowed bg-muted/30' 
                        : isSelected 
                          ? 'bg-blue-50 border-blue-200 shadow-sm' 
                          : 'hover:bg-muted/50'
                    }`}
                    onClick={() => !isDisabled && toggleFileSelection(file.file_id)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => !isDisabled && toggleFileSelection(file.file_id)}
                        className="mt-1"
                      />
                      
                      <FileIcon className={`h-5 w-5 ${color} mt-0.5 flex-shrink-0`} />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-sm break-words leading-tight">
                              {file.file_name}
                            </h4>
                            
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {formatFileSize(file.file_size)}
                              </Badge>
                              
                              <Badge variant="outline" className="text-xs">
                                Document
                              </Badge>
                              
                              {file.folder_name && (
                                <Badge variant="outline" className="text-xs">
                                  <Folder className="h-3 w-3 mr-1" />
                                  {file.folder_name}
                                </Badge>
                              )}
                              
                              {isDisabled && (
                                <Badge variant="secondary" className="text-xs">
                                  Already in review
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {!isDisabled && (
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <DialogFooter className="border-t pt-4">
          {error && !loading && (
            <div className="flex items-center gap-2 text-destructive text-sm mr-auto">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="flex gap-3 ml-auto">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={selectedFileIds.length === 0 || isSubmitting}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                `Add ${selectedFileIds.length} File${selectedFileIds.length !== 1 ? 's' : ''}`
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
