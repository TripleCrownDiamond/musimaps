import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { hasSupabase } from '@/lib/supabase'
import { signIn } from '@/lib/admin'
import Brand from '@/components/Brand'

/**
 * Page de connexion de l'espace administrateur.
 * Connexion avec un compte EXISTANT uniquement : la création de compte est
 * désactivée — les comptes sont créés par le propriétaire (Supabase), et le
 * premier compte autorisé devient administrateur.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!hasSupabase()) {
      setError(
        'Supabase n’est pas configuré. Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans apps/web/.env.local.',
      )
      return
    }
    setLoading(true)
    try {
      const result = await signIn(email, password)
      if (result.error) {
        setError('Identifiants incorrects : ' + result.error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-8 p-4">
      <Brand className="h-14 w-auto md:h-16" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-display text-xl font-extrabold">Espace administrateur</CardTitle>
          <CardDescription>
            Gérez le contenu du site : sections, SEO, navigation, liste d’attente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="admin-password">Mot de passe</Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Se connecter
            </Button>
          </form>

          <p className="text-muted-foreground mt-4 border-t border-hairline pt-4 text-xs leading-relaxed">
            Les comptes sont créés par le propriétaire du site. Le premier compte autorisé
            devient automatiquement administrateur.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
