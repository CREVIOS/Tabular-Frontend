import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Securely sanitize a filename to prevent security vulnerabilities and storage issues
 * 
 * This function addresses multiple security concerns:
 * - Path traversal attacks (../, ..\)
 * - Null byte injection (%00)
 * - URL encoding bypasses (%2e%2e%2f)
 * - Windows reserved filenames (CON, PRN, etc.)
 * - Cross-platform illegal characters
 * - Control characters that can cause display issues
 * - S3/Cloud storage incompatible characters
 * 
 * @param name - The original filename to sanitize
 * @param maxLength - Maximum allowed length (default: 100)
 * @returns A secure, sanitized filename
 */
export function sanitizeFileName(name: string, maxLength: number = 100): string {
  if (!name || typeof name !== 'string') {
    return 'file'
  }

  // 1. URL decode to prevent encoded path traversal attacks
  try {
    name = decodeURIComponent(name)
    name = decodeURI(name)
  } catch {
    // If decoding fails, continue with original name
  }

  // 2. Remove null bytes (security: null byte injection)
  name = name.replace(/\0/g, '')

  // 3. Remove or replace illegal characters across all platforms and storage systems
  // Windows: < > : " | ? * \ /
  // S3/Cloud Storage: [ ] { } # % & + space and other special chars
  // All platforms: control characters (0x00-0x1f, 0x80-0x9f)
  const illegalChars = /[<>:"|?*\\/\x00-\x1f\x80-\x9f\[\]{}#%&\+\s~`!@$^=;,]/g
  name = name.replace(illegalChars, '_')

  // 4. Handle path traversal attempts
  name = name.replace(/\.\./g, '_')  // Remove .. sequences
  name = name.replace(/\/+/g, '_')   // Remove multiple slashes
  name = name.replace(/\\+/g, '_')   // Remove multiple backslashes

  // 5. Remove leading/trailing whitespace and dots
  name = name.trim()
  name = name.replace(/^\.+/, '')    // Remove leading dots
  name = name.replace(/\.+$/, '')    // Remove trailing dots
  
  // 6. Replace multiple underscores with single underscore
  name = name.replace(/_+/g, '_')
  
  // 7. Check for Windows reserved filenames (case-insensitive)
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i
  if (reservedNames.test(name)) {
    name = '_' + name
  }

  // 8. Ensure filename doesn't start with hyphen, dot, or underscore (some systems don't like this)
  if (name.match(/^[-\._]/)) {
    name = 'file_' + name
  }

  // 9. Handle empty filename after sanitization
  if (!name || name.length === 0) {
    name = 'file'
  }

  // 10. Smart truncation preserving file extension
  if (name.length > maxLength) {
    const extensionMatch = name.match(/(\.[a-zA-Z0-9]{1,10})$/)
    if (extensionMatch) {
      const extension = extensionMatch[1]
      const baseName = name.slice(0, name.length - extension.length)
      const allowedBaseLength = maxLength - extension.length
      name = baseName.slice(0, Math.max(1, allowedBaseLength)) + extension
    } else {
      name = name.slice(0, maxLength)
    }
  }

  // 11. Final check: ensure we have a valid filename
  if (!name || name.length === 0 || name === '.' || name === '..' || name === '_') {
    name = 'sanitized_file'
  }

  // 12. Ensure filename ends with valid extension or add .txt
  if (!name.match(/\.[a-zA-Z0-9]{1,10}$/)) {
    name += '.txt'
  }

  return name
}

/**
 * Generate a storage-safe key for cloud storage (S3, etc.)
 * This ensures compatibility with various storage systems
 * 
 * @param userId - User ID for namespacing
 * @param fileId - File ID for uniqueness
 * @param originalFilename - Original filename to sanitize
 * @returns A storage-safe key path
 */
export function generateStorageKey(userId: string, fileId: string, originalFilename: string): string {
  // Sanitize all components
  const safeUserId = userId.replace(/[^a-zA-Z0-9\-]/g, '')
  const safeFileId = fileId.replace(/[^a-zA-Z0-9\-]/g, '')
  const safeFilename = sanitizeFileName(originalFilename, 80) // Shorter for storage keys
  
  // Generate timestamp for uniqueness
  const timestamp = Date.now()
  
  // Create storage-safe key with clear structure
  return `users/${safeUserId}/files/${safeFileId}_${timestamp}_${safeFilename}`
}

/**
 * Validate if a storage key is safe for cloud storage
 * 
 * @param key - Storage key to validate
 * @returns boolean indicating if key is safe
 */
export function isStorageKeySafe(key: string): boolean {
  // Check for invalid characters in storage keys
  const invalidChars = /[^a-zA-Z0-9\-_.\/]/
  
  // Check length (most storage systems have limits)
  if (key.length > 1024) return false
  
  // Check for invalid characters
  if (invalidChars.test(key)) return false
  
  // Check for path traversal
  if (key.includes('..') || key.includes('//')) return false
  
  // Check for valid structure
  if (key.startsWith('/') || key.endsWith('/')) return false
  
  return true
}

/**
 * Extract error details from file processing error
 * 
 * @param error - Error object or string
 * @returns Formatted error message with actionable information
 */
export function formatFileProcessingError(error: unknown): string {
  if (typeof error === 'string') {
    // Check for specific error patterns
    if (error.includes('Invalid key:')) {
      return 'File name contains invalid characters. Please rename the file and try again.'
    }
    if (error.includes('statusCode: 400')) {
      return 'File format is not supported or contains invalid data. Please check the file and try again.'
    }
    if (error.includes('statusCode: 413')) {
      return 'File is too large. Please reduce file size to under 50MB and try again.'
    }
    if (error.includes('statusCode: 429')) {
      return 'Too many upload requests. Please wait a moment and try again.'
    }
    return error
  }
  
  if (error instanceof Error) {
    return formatFileProcessingError(error.message)
  }
  
  return 'An unknown error occurred during file processing. Please try again.'
}