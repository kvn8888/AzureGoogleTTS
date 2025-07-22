'use client'

import { useState } from 'react'
import { Mic, Download, Play, Pause, Volume2, Loader2, LogOut, User } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [text, setText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  // Redirect to sign-in if not authenticated
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    router.push('/auth/signin')
    return null
  }

  // Configuration - Now using our secure API route
  const generateSpeech = async () => {
    if (!text.trim()) {
      setError('Please enter some text to convert')
      return
    }

    setIsGenerating(true)
    setError(null)
    setAudioUrl(null)

    try {
      // Call our secure server-side API route instead of Azure directly
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Request failed: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate speech')
      }

      // Convert base64 to audio blob
      const audioBytes = atob(data.audioData)
      const audioArray = new Uint8Array(audioBytes.length)
      for (let i = 0; i < audioBytes.length; i++) {
        audioArray[i] = audioBytes.charCodeAt(i)
      }
      
      const audioBlob = new Blob([audioArray], { type: 'audio/ogg' })
      const url = URL.createObjectURL(audioBlob)
      setAudioUrl(url)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsGenerating(false)
    }
  }

  const playAudio = () => {
    if (!audioUrl) return

    if (audio) {
      audio.pause()
      setAudio(null)
      setIsPlaying(false)
      return
    }

    const newAudio = new Audio(audioUrl)
    newAudio.onended = () => {
      setIsPlaying(false)
      setAudio(null)
    }
    newAudio.onplay = () => setIsPlaying(true)
    newAudio.onpause = () => setIsPlaying(false)
    
    setAudio(newAudio)
    newAudio.play()
  }

  const downloadAudio = () => {
    if (!audioUrl) return
    
    const a = document.createElement('a')
    a.href = audioUrl
    a.download = 'speech.ogg'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto py-12">
        {/* Header with User Info */}
        <div className="flex justify-between items-center mb-8">
          <div className="text-center flex-1">
            <div className="flex items-center justify-center mb-4">
              <Volume2 className="w-12 h-12 text-indigo-600 mr-3" />
              <h1 className="text-4xl font-bold text-gray-900">Text-to-Speech Generator</h1>
            </div>
            <p className="text-xl text-gray-600">Convert your text to natural speech using Google Cloud AI</p>
          </div>
          
          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-white rounded-lg px-4 py-2 shadow-sm">
              <img 
                src={session.user?.image || ''} 
                alt="Profile" 
                className="w-8 h-8 rounded-full"
              />
              <span className="text-sm font-medium text-gray-700">{session.user?.name}</span>
            </div>
            <button
              onClick={() => signOut()}
              className="bg-gray-600 hover:bg-gray-700 text-white p-2 rounded-lg transition-colors duration-200"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="space-y-6">
            {/* Text Input */}
            <div>
              <label htmlFor="text-input" className="block text-sm font-medium text-gray-700 mb-2">
                Enter your text
              </label>
              <textarea
                id="text-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type or paste the text you want to convert to speech..."
                className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                disabled={isGenerating}
              />
              <div className="text-sm text-gray-500 mt-1">
                {text.length} characters
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={generateSpeech}
              disabled={isGenerating || !text.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Generating Speech...
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 mr-2" />
                  Generate Speech
                </>
              )}
            </button>

            {/* Audio Controls */}
            {audioUrl && (
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Generated Audio</h3>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={playAudio}
                    className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-full transition-colors duration-200"
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6" />
                    ) : (
                      <Play className="w-6 h-6" />
                    )}
                  </button>
                  
                  <button
                    onClick={downloadAudio}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors duration-200 flex items-center"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download
                  </button>
                  
                  <div className="text-sm text-gray-600">
                    Click play to listen or download the audio file
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Security Information */}
        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-800 mb-2">🔒 Secure Authentication</h3>
          <p className="text-green-700 mb-3">
            Your Azure Function credentials are now handled securely server-side. No sensitive keys are exposed to the browser.
          </p>
          <div className="space-y-2 text-sm text-green-700">
            <div><strong>✅ Session-based authentication</strong> - Only authenticated users can access the API</div>
            <div><strong>🔐 Server-side key management</strong> - Function keys never leave the server</div>
            <div><strong>🛡️ Email-based access control</strong> - Restricted to authorized users only</div>
          </div>
        </div>
      </div>
    </main>
  )
}
