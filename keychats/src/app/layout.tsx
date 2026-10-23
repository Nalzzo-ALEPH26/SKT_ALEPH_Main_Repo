import type { Metadata } from 'next'
import { Fjalla_One } from 'next/font/google'
import type { ReactNode } from 'react'

import './globals.css'

const squeeze = Fjalla_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-squeeze',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Keychats',
  description: 'Private team chat',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko" className={squeeze.variable}>
      <body>{children}</body>
    </html>
  )
}
