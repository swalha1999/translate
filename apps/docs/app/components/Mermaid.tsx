import { useEffect, useRef } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#10b981',
    primaryTextColor: '#fff',
    primaryBorderColor: '#059669',
    lineColor: '#6b7280',
    secondaryColor: '#1f2937',
    tertiaryColor: '#111827',
    background: '#18181b',
    mainBkg: '#27272a',
    nodeBorder: '#3f3f46',
    clusterBkg: '#1f2937',
    titleColor: '#f4f4f5',
    edgeLabelBackground: '#27272a',
  },
})

export function Mermaid({ chart, title }: { chart: string; title?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
      mermaid.render(`mermaid-${Math.random().toString(36).slice(2)}`, chart).then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg
        }
      })
    }
  }, [chart])

  return (
    <div className="my-6">
      {title && <h4 className="text-sm font-medium text-zinc-400 mb-3">{title}</h4>}
      <div
        ref={containerRef}
        className="bg-zinc-900/50 rounded-lg p-6 border border-zinc-800 overflow-x-auto [&_svg]:max-w-full"
      />
    </div>
  )
}
