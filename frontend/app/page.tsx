'use client'

import { useState } from 'react'
import { Mic, Download, Play, Pause, Volume2, Loader2 } from 'lucide-react'

export default function Home() {
  const [text, setText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)
  const [userApiKey, setUserApiKey] = useState('')

  // Configuration - Update these with your Azure Function details
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://func-my-tts-app-e9ffa9b7-5dc4-497d-a75a-099176703ed0.azurewebsites.net/api/textToSpeech'
  const FUNCTION_KEY = process.env.NEXT_PUBLIC_FUNCTION_KEY || ''

  const generateSpeech = async () => {
    if (!text.trim()) {
      setError('Please enter some text to convert')
      return
    }

    setIsGenerating(true)
    setError(null)
    setAudioUrl(null)

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Use user-provided key if available, otherwise fall back to env variable
          ...((userApiKey || FUNCTION_KEY) && { 'x-functions-key': userApiKey || FUNCTION_KEY })
        },
        body: JSON.stringify({ text })
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to generate speech')
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
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Volume2 className="w-12 h-12 text-indigo-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">Text-to-Speech Generator</h1>
          </div>
          <p className="text-xl text-gray-600">Convert your text to natural speech using Google Cloud AI</p>
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

            {/* API Key Input */}
            <div>
              <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 mb-2">
                Function Key (Optional)
              </label>
              <input
                id="api-key"
                type="password"
                value={userApiKey}
                onChange={(e) => setUserApiKey(e.target.value)}
                placeholder="Enter your Azure Function key to override environment settings..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={isGenerating}
              />
              <div className="text-sm text-gray-500 mt-1">
                {userApiKey ? 'Using provided key' : FUNCTION_KEY ? 'Using environment key' : 'No key configured'}
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

        {/* Configuration Instructions */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">⚙️ Configuration</h3>
          <p className="text-yellow-700 mb-3">
            You can configure your Azure Function details in two ways:
          </p>
          <div className="space-y-3 text-sm text-yellow-700">
            <div>
              <strong>Option 1 - Environment Variables (Recommended):</strong>
              <div className="ml-4 mt-1 space-y-1">
                <div><strong>1.</strong> Create a <code className="bg-yellow-100 px-1 rounded">.env.local</code> file in the frontend directory</div>
                <div><strong>2.</strong> Add: <code className="bg-yellow-100 px-1 rounded">NEXT_PUBLIC_API_URL=your-function-url</code></div>
                <div><strong>3.</strong> Add: <code className="bg-yellow-100 px-1 rounded">NEXT_PUBLIC_FUNCTION_KEY=your-key</code></div>
              </div>
            </div>
            <div>
              <strong>Option 2 - Manual Entry:</strong>
              <div className="ml-4 mt-1">
                Enter your function key directly in the form above (overrides environment settings)
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
