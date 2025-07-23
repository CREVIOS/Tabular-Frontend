import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Create Supabase client with service key
function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')
    
    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      )
    }

    // Create service client with elevated permissions
    const supabase = createServiceClient()
    
    // Get file information from database
    const { data: fileData, error: fileError } = await supabase
      .from('files')
      .select('id, original_filename, file_size, file_type, storage_path')
      .eq('id', fileId)
      .single()

    if (fileError || !fileData) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    if (!fileData.storage_path) {
      return NextResponse.json(
        { error: 'File has no storage path' },
        { status: 404 }
      )
    }

    // Generate signed URL with service key
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(fileData.storage_path, 3600) // 1 hour expiry

    if (urlError) {
      console.error('Error creating signed URL:', urlError)
      return NextResponse.json(
        { error: 'Failed to generate signed URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      fileInfo: {
        id: fileData.id,
        original_filename: fileData.original_filename,
        file_size: fileData.file_size,
        file_type: fileData.file_type,
        storage_path: fileData.storage_path
      },
      signedUrl: signedUrlData.signedUrl
    })

  } catch (error) {
    console.error('Error in signed URL API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 