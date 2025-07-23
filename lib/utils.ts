import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Securely sanitize a filename to prevent security vulnerabilities
 * 
 * This function addresses multiple security concerns:
 * - Path traversal attacks (../, ..\)
 * - Null byte injection (%00)
 * - URL encoding bypasses (%2e%2e%2f)
 * - Windows reserved filenames (CON, PRN, etc.)
 * - Cross-platform illegal characters
 * - Control characters that can cause display issues
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

  // 3. Remove or replace illegal characters across all platforms
  // Windows: < > : " | ? * \ /
  // All platforms: control characters (0x00-0x1f, 0x80-0x9f)
  const illegalChars = /[<>:"|?*\\/\x00-\x1f\x80-\x9f]/g
  name = name.replace(illegalChars, '_')

  // 4. Handle path traversal attempts
  name = name.replace(/\.\./g, '_')  // Remove .. sequences
  name = name.replace(/\/+/g, '_')   // Remove multiple slashes
  name = name.replace(/\\+/g, '_')   // Remove multiple backslashes

  // 5. Remove leading/trailing whitespace and dots
  name = name.trim()
  name = name.replace(/^\.+/, '')    // Remove leading dots
  name = name.replace(/\.+$/, '')    // Remove trailing dots
  
  // 6. Check for Windows reserved filenames (case-insensitive)
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i
  if (reservedNames.test(name)) {
    name = '_' + name
  }

  // 7. Ensure filename doesn't start with hyphen or dot (some systems don't like this)
  if (name.match(/^[-\.]/)) {
    name = '_' + name
  }

  // 8. Handle empty filename after sanitization
  if (!name || name.length === 0) {
    name = 'file'
  }

  // 9. Smart truncation preserving file extension
  if (name.length > maxLength) {
    const extensionMatch = name.match(/(\.[^.]{1,10})$/)
    if (extensionMatch) {
      const extension = extensionMatch[1]
      const baseName = name.slice(0, name.length - extension.length)
      const allowedBaseLength = maxLength - extension.length
      name = baseName.slice(0, Math.max(1, allowedBaseLength)) + extension
    } else {
      name = name.slice(0, maxLength)
    }
  }

  // 10. Final check: ensure we have a valid filename
  if (!name || name.length === 0 || name === '.' || name === '..') {
    name = 'sanitized_file'
  }

  return name
}