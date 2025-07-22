import GoogleProvider from 'next-auth/providers/google'
import type { NextAuthOptions } from 'next-auth'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  ],
  callbacks: {
    async signIn({ user }) {
      // Only allow your specific email address
      const allowedEmail = 'kc681269@gmail.com'
      
      if (user.email === allowedEmail) {
        return true
      } else {
        // Reject the sign-in attempt
        return false
      }
    },
    async session({ session }) {
      // Add any additional session data if needed
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
}
