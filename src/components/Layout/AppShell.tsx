import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AppShellProps {
  title?: string
  subtitle?: string
  children: ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '6xl' | 'full'
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '6xl': 'max-w-6xl',
  full: 'max-w-full',
}

export function AppShell({
  title,
  subtitle,
  children,
  className,
  maxWidth = '6xl',
}: AppShellProps) {
  return (
    <main className={cn('mx-auto w-full py-8 px-4', maxWidthClasses[maxWidth])}>
      <div className="bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-3xl p-6 md:p-8 shadow-[0_8px_32px_rgba(6,182,212,0.1)]">
        {title && (
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
              {title}
            </h1>
            {subtitle && (
              <p className="text-lg text-slate-400 max-w-2xl">
                {subtitle}
              </p>
            )}
          </div>
        )}
        <div className={className}>
          {children}
        </div>
      </div>
    </main>
  )
}
