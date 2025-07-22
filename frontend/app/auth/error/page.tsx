'use client'

import { useSearchParams } from 'next/navigation'
import { AlertCircle, Home } from 'lucide-react'

export default function AuthError() {
  const searchParams = useSearchParams()
  const error = searchParams?.get('error') || null

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'AccessDenied':
        return {
          title: 'Access Denied',
          message: 'Your Google account is not authorized to access this application. Only kc681269@gmail.com is allowed.',
          showDetails: false,
        }
      case 'Configuration':
        return {
          title: 'Configuration Error',
          message: 'The authentication system is missing required environment variables.',
          showDetails: true,
        }
      case 'Signin':
        return {
          title: 'Sign In Error',
          message: 'There was an error during the sign-in process. Please try again.',
          showDetails: false,
        }
      case 'OAuthSignin':
      case 'OAuthCallback':
      case 'OAuthCreateAccount':
        return {
          title: 'OAuth Error',
          message: 'There was an error with Google authentication. Please try again.',
          showDetails: false,
        }
      default:
        return {
          title: 'Authentication Error',
          message: 'An unexpected error occurred during authentication.',
          showDetails: false,
        }
    }
  }

  // Check environment variables for detailed error reporting
  const checkEnvironmentVariables = () => {
    const vars = {
      'GOOGLE_CLIENT_ID': process.env.GOOGLE_CLIENT_ID,
      'GOOGLE_CLIENT_SECRET': process.env.GOOGLE_CLIENT_SECRET,
      'NEXTAUTH_URL': process.env.NEXTAUTH_URL,
      'NEXTAUTH_SECRET': process.env.NEXTAUTH_SECRET,
    }

    return Object.entries(vars).map(([name, value]) => ({
      name,
      status: value ? '✅ Set' : '❌ Missing',
      value: value ? (value.length > 20 ? `${value.substring(0, 20)}...` : value) : 'Not configured',
      isMissing: !value
    }))
  }

  const { title, message, showDetails } = getErrorMessage(error)
  const envVars = checkEnvironmentVariables()

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        
        <div className="space-y-3">
          <a 
            href="/auth/signin"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 block"
          >
            Try Again
          </a>
          <a 
            href="/"
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
          >
            <Home className="w-5 h-5 mr-2" />
            Go Home
          </a>
        </div>
        
        {error === 'AccessDenied' && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> This application is restricted to authorized users only. 
              If you believe you should have access, please contact the administrator.
            </p>
          </div>
        )}

        {error === 'Configuration' && showDetails && (
          <div className="mt-6 space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-sm font-semibold text-red-800 mb-3">Environment Variables Status:</h4>
              <div className="space-y-2">
                {envVars.map((envVar) => (
                  <div key={envVar.name} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-gray-700">{envVar.name}:</span>
                    <div className="flex items-center space-x-2">
                      <span className={envVar.isMissing ? 'text-red-600' : 'text-green-600'}>
                        {envVar.status}
                      </span>
                      {!envVar.isMissing && (
                        <span className="text-gray-500 font-mono text-xs">
                          {envVar.value}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">Quick Fix:</h4>
              <div className="text-xs text-blue-700 space-y-1">
                <p><strong>1.</strong> Go to Vercel Dashboard → Your Project → Settings → Environment Variables</p>
                <p><strong>2.</strong> Add missing variables from your <code className="bg-blue-100 px-1 rounded">.env.local</code> file</p>
                <p><strong>3.</strong> Redeploy your application</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Current Environment:</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <p><strong>Domain:</strong> <code className="bg-gray-100 px-1 rounded">{window.location.origin}</code></p>
                <p><strong>Environment:</strong> {process.env.NODE_ENV || 'development'}</p>
                <p><strong>Timestamp:</strong> {new Date().toISOString()}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
