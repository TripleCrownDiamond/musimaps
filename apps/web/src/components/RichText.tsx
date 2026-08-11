import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

/**
 * Rendu public d'un contenu markdown (+ HTML) édité dans l'admin.
 * S'applique aux champs convertis en éditeur riche.
 * `asHeading` permet de conserver la sémantique de titre (ex. philosophie)
 * au lieu de rendre un simple paragraphe dans une div.
 */
export default function RichText({
  content,
  className = '',
  asHeading,
}: {
  content: string
  className?: string
  asHeading?: 'h1' | 'h2' | 'h3'
}) {
  const components: Components = {
    a: ({ children, ...props }) => (
      <a {...props} target="_blank" rel="noopener noreferrer" className="text-brand-deep underline">
        {children}
      </a>
    ),
  }

  // En mode heading, la className (taille, graisse…) doit porter sur le
  // heading lui-même, sinon le font-size UA du heading (2em pour h2)
  // écrase le sizing Tailwind du wrapper. Un champ de citation est une
  // seule ligne → un seul <p> racine → un seul heading.
  if (asHeading) {
    const Tag = asHeading
    components.p = ({ children }) => <Tag className={className}>{children}</Tag>
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
        {content || ''}
      </ReactMarkdown>
    )
  }

  components.p = ({ children }) => <p className="mb-2 last:mb-0">{children}</p>
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
        {content || ''}
      </ReactMarkdown>
    </div>
  )
}
