import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function Layout() {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-outfit">
      <Sidebar />
      <main className="flex-1 px-8 py-12 ml-64">
        <Outlet />
      </main>
    </div>
  )
}
