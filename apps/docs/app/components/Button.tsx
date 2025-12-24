import { ReactNode } from 'react'

interface ButtonProps {
  children: ReactNode
  variant?: 'primary' | 'secondary'
  href?: string
  onClick?: () => void
}

export function Button({ children, variant = 'primary', href, onClick }: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium text-sm transition-colors'
  const variantClasses = {
    primary: 'bg-emerald-500 text-white hover:bg-emerald-600',
    secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700',
  }

  const classes = `${baseClasses} ${variantClasses[variant]}`

  if (href) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    )
  }

  return (
    <button onClick={onClick} className={classes}>
      {children}
    </button>
  )
}
