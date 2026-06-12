import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { BrandingProvider } from './utils/BrandingContext'

// Lokale Fonts — kein Google CDN, datenschutzkonform
import '@fontsource/outfit/300.css'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/500.css'
import '@fontsource/outfit/600.css'
import '@fontsource/outfit/700.css'
import '@fontsource/outfit/800.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import '@fontsource/oswald/400.css'
import '@fontsource/oswald/500.css'
import '@fontsource/oswald/600.css'
import '@fontsource/oswald/700.css'
import '@fontsource/bebas-neue/400.css'
import '@fontsource/rajdhani/400.css'
import '@fontsource/rajdhani/600.css'
import '@fontsource/rajdhani/700.css'
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/700.css'
import '@fontsource/merriweather/400.css'
import '@fontsource/merriweather/700.css'
import '@fontsource/dancing-script/400.css'
import '@fontsource/dancing-script/700.css'
import '@fontsource/caveat/400.css'
import '@fontsource/caveat/700.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <BrandingProvider>
        <App />
      </BrandingProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
