import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { setLive } from './data/store'
import { RangeProvider } from './lib/range'
import ArtifactDetail from './pages/ArtifactDetail'
import Artifacts from './pages/Artifacts'
import Exhibition from './pages/Exhibition'
import NotFound from './pages/NotFound'
import Overview from './pages/Overview'
import PainPoints from './pages/PainPoints'
import Reports from './pages/Reports'
import Reviews from './pages/Reviews'
import VisitorDetail from './pages/VisitorDetail'
import Visitors from './pages/Visitors'

export default function App() {
  useEffect(() => {
    setLive(true)
    return () => setLive(false)
  }, [])

  return (
    <RangeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="exhibition" element={<Exhibition />} />
            <Route path="artifacts" element={<Artifacts />} />
            <Route path="artifacts/:id" element={<ArtifactDetail />} />
            <Route path="visitors" element={<Visitors />} />
            <Route path="visitors/:id" element={<VisitorDetail />} />
            <Route path="pain-points" element={<PainPoints />} />
            <Route path="reviews" element={<Reviews />} />
            <Route path="reports" element={<Reports />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </RangeProvider>
  )
}
