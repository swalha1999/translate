import { Link, useLocation } from 'react-router-dom'

const navigation = [
  { name: 'Introduction', href: '/' },
  { name: 'Getting Started', href: '/docs/getting-started' },
  { name: 'Configuration', href: '/docs/configuration' },
  { name: 'Architecture', href: '/docs/architecture' },
  { name: 'Adapters', href: '/docs/adapters' },
  { name: 'API Reference', href: '/docs/api-reference' },
  { name: 'Examples', href: '/docs/examples' },
  { name: 'Playground', href: '/playground' },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-zinc-900/50 border-r border-zinc-800 p-6">
      <div className="mb-8">
        <Link to="/" className="text-xl font-bold text-white">
          @swalha1999/translate
        </Link>
      </div>

      <nav className="space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
              }`}
            >
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="absolute bottom-6 left-6 right-6">
        <a
          href="https://github.com/swalha1999/translate"
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300"
        >
          <span>GitHub</span>
        </a>
      </div>
    </aside>
  )
}
