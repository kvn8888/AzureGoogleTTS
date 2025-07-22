import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      )
    }

    // Verify the user is authorized (same email check as in NextAuth)
    const allowedEmail = 'kc681269@gmail.com'
    if (session.user?.email !== allowedEmail) {
      return NextResponse.json(
        { error: 'Forbidden - Access denied' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { text } = body

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      )
    }

    // Get Azure Function credentials from server-side environment variables
    const azureFunctionUrl = process.env.NEXT_PUBLIC_API_URL
    const azureFunctionKey = process.env.AZURE_FUNCTION_KEY

    if (!azureFunctionUrl || !azureFunctionKey) {
      console.error('Missing Azure Function configuration:', {
        hasUrl: !!azureFunctionUrl,
        hasKey: !!azureFunctionKey
      })
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Make secure request to Azure Function with server-side key
    const response = await fetch(azureFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-functions-key': azureFunctionKey, // Key stays on server
      },
      body: JSON.stringify({ text })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Azure Function error:', response.status, errorText)
      return NextResponse.json(
        { error: `Azure Function request failed: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    if (!data.success) {
      return NextResponse.json(
        { error: data.message || 'Failed to generate speech' },
        { status: 500 }
      )
    }

    // Return the audio data to the client
    return NextResponse.json({
      success: true,
      audioData: data.audioData,
      format: data.format,
      chunksProcessed: data.chunksProcessed
    })

  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
