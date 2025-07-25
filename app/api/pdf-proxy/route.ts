import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pdfUrl = searchParams.get('url')
    
    if (!pdfUrl) {
      return NextResponse.json(
        { error: 'PDF URL parameter is required' },
        { status: 400 }
      )
    }

    // Validate URL to prevent SSRF attacks
    let validatedUrl: URL
    try {
      validatedUrl = new URL(pdfUrl)
      
      // Only allow HTTPS URLs from trusted domains
      if (validatedUrl.protocol !== 'https:') {
        throw new Error('Only HTTPS URLs are allowed')
      }
      
      // Whitelist trusted domains
      const allowedDomains = [
        'supabase.co',
        'amazonaws.com',
        'storage.googleapis.com',
        'makebell.com'
      ]
      
      const isAllowedDomain = allowedDomains.some(domain => 
        validatedUrl.hostname.includes(domain)
      )
      
      if (!isAllowedDomain) {
        throw new Error('Domain not allowed')
      }
      
    } catch (urlError) {
      console.error('URL validation failed:', urlError)
      return NextResponse.json(
        { error: 'Invalid or unauthorized URL' },
        { status: 400 }
      )
    }

    // Fetch the PDF file
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout
    
    const response = await fetch(pdfUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PDF-Proxy/1.0)',
        'Accept': 'application/pdf,*/*',
      }
    })
    
    clearTimeout(timeoutId)

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch PDF: ${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    // Get the PDF content
    const pdfBuffer = await response.arrayBuffer()
    
    // Verify it's actually a PDF
    const pdfHeader = new Uint8Array(pdfBuffer.slice(0, 4))
    const isPdf = pdfHeader[0] === 0x25 && // %
                  pdfHeader[1] === 0x50 && // P
                  pdfHeader[2] === 0x44 && // D
                  pdfHeader[3] === 0x46    // F
    
    if (!isPdf) {
      return NextResponse.json(
        { error: 'File is not a valid PDF' },
        { status: 400 }
      )
    }

    // Create response with proper headers for iframe embedding
    const proxyResponse = new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Content-Length': pdfBuffer.byteLength.toString(),
        
        // CORS headers
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        
        // Security headers that allow iframe embedding
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy': "frame-ancestors 'self'",
        
        // Cache headers for better performance
        'Cache-Control': 'public, max-age=3600, immutable',
        'ETag': `"${Buffer.from(pdfUrl).toString('base64')}"`,
        
        // Additional headers to prevent issues
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
      }
    })

    return proxyResponse

  } catch (error) {
    console.error('PDF proxy error:', error)
    
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 408 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
} 