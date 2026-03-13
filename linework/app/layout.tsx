import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Linework',
  description: 'CIE Ltd. Projects Department — Task Management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg text-text1 font-mono antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1a1d27',
              color: '#f0f2ff',
              border: '1px solid #2a2f45',
              fontFamily: 'DM Mono, monospace',
              fontSize: '12px',
            },
          }}
        />
      </body>
    </html>
  )
}
