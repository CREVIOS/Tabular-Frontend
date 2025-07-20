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
  }, [availableFiles, filterStatus, filterFolder, searchQuery])
  
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
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Documents</DialogTitle>
          <DialogDescription>
            Select documents to add to your review.
          </DialogDescription>
        </DialogHeader>
        
        {/* Status Messages */}
        {isSubmitting && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-blue-800">Adding {selectedFileIds.length} documents...</span>
            </div>
          </div>
        )}
        
        {successMessage && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-green-800">{successMessage}</span>
            </div>
          </div>
        )}
        
        {/* Search and Filters */}
        <div className="space-y-3 py-3 border-y">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={(value: 'all' | 'available') => setFilterStatus(value)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="all">All Files</SelectItem>
                </SelectContent>
              </Select>
              
              {uniqueFolders.length > 0 && (
                <Select value={filterFolder} onValueChange={setFilterFolder}>
                  <SelectTrigger className="w-[140px]">
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
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={availableFilesCount === 0}
              >
                Select All ({availableFilesCount})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={deselectAll}
                disabled={selectedFileIds.length === 0}
              >
                Clear
              </Button>
            </div>
            <span className="text-muted-foreground">
                {selectedFileIds.length} selected
              </span>
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
                const isDisabled = file.is_in_review
                const isSelected = selectedFileIds.includes(file.file_id)
                
                return (
                  <div
                    key={file.file_id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      isDisabled 
                        ? 'opacity-60 cursor-not-allowed bg-gray-50' 
                        : isSelected 
                          ? 'bg-blue-50 border-blue-200' 
                          : 'hover:bg-gray-50'
                    }`}
                    onClick={() => !isDisabled && toggleFileSelection(file.file_id)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => !isDisabled && toggleFileSelection(file.file_id)}
                        className="mt-0.5"
                      />
                      
                      <FileText className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      
                        <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-sm break-words">
                              {file.file_name}
                            </h4>
                            
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                              <span>{formatFileSize(file.file_size)}</span>
                              
                              {file.folder_name && (
                                <span className="flex items-center gap-1">
                                  <Folder className="h-3 w-3" />
                                  {file.folder_name}
                                </span>
                              )}
                              
                              {isDisabled && (
                                <span className="text-amber-600">Already in review</span>
                          )}
                        </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        
        <DialogFooter className="border-t pt-3">
          <div className="flex items-center justify-between w-full">
          {error && !loading && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
            </div>
          )}
            
            <div className="flex gap-2 ml-auto">
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
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
