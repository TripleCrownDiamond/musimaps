import { Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Eye } from 'lucide-react'
import { CmsProvider } from '@/context/CmsContext'
import Navbar from '@/components/Navbar'
import Loader from '@/components/Loader'

const Landing = lazy(() => import('./Landing'))
const ArtistSignup = lazy(() => import('./ArtistSignup'))

interface PreviewPageProps {
  /** Quelle page publique prévisualiser ? */
  page?: 'landing' | 'artistes'
}

export default function PreviewPage({ page = 'landing' }: PreviewPageProps) {
  return (
    <CmsProvider source="draft">
      {/* Bandeau d'aperçu, en bas pour ne pas chevaucher la Navbar fixe */}
      <div className="fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4 pb-4">
        <Link
          to="/admin"
          className="bg-primary text-primary-foreground flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg transition-transform hover:scale-[1.03]"
        >
          <Eye className="size-4" />
          Aperçu brouillon — non visible du public
          <span className="bg-primary-foreground/20 rounded-full px-2 py-0.5 text-xs">
            <ArrowLeft className="inline size-3" /> Retour au dashboard
          </span>
        </Link>
      </div>

      {/* Navbar rendue pour vérifier aussi les liens/CTA du brouillon */}
      <Navbar />

      <Suspense fallback={<Loader />}>
        {page === 'landing' ? <Landing /> : <ArtistSignup />}
      </Suspense>
    </CmsProvider>
  )
}
