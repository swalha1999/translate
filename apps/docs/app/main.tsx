import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { GettingStartedPage } from './pages/GettingStartedPage'
import { ConfigurationPage } from './pages/ConfigurationPage'
import { AdaptersPage } from './pages/AdaptersPage'
import { ApiReferencePage } from './pages/ApiReferencePage'
import { ExamplesPage } from './pages/ExamplesPage'
import { PlaygroundPage } from './pages/PlaygroundPage'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/docs/getting-started" element={<GettingStartedPage />} />
          <Route path="/docs/configuration" element={<ConfigurationPage />} />
          <Route path="/docs/adapters" element={<AdaptersPage />} />
          <Route path="/docs/api-reference" element={<ApiReferencePage />} />
          <Route path="/docs/examples" element={<ExamplesPage />} />
          <Route path="/playground" element={<PlaygroundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
