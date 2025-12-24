import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  title?: string
  className?: string
}

export function Card({ children, title, className = '' }: CardProps) {
  return (
    <div className={`bg-zinc-900/50 rounded-xl border border-zinc-800 p-6 ${className}`}>
      {title && <h3 className="text-lg font-semibold text-zinc-100 mb-4">{title}</h3>}
      {children}
    </div>
  )
}
