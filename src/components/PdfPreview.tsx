import { useEffect, useRef, useState } from 'preact/hooks'
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

export default function PdfPreview({ file }: { file: File }) {
  const pageContainer = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('Loading PDF preview…')
  const [error, setError] = useState('')
  const [fallbackUrl, setFallbackUrl] = useState('')

  useEffect(() => {
    const url = URL.createObjectURL(new Blob([file], { type: 'application/pdf' }))
    setFallbackUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    let cancelled = false
    let loading: PDFDocumentLoadingTask | undefined

    async function openPdf() {
      const bytes = await file.arrayBuffer()
      const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs')
      if (cancelled) return
      GlobalWorkerOptions.workerSrc = workerUrl
      loading = getDocument({ data: bytes })
      loading.onPassword = () => {
        if (!cancelled) {
          setStatus('')
          setError('This PDF is password protected. Choose an unlocked copy to preview it.')
        }
        void loading?.destroy().catch(() => {})
      }
      const document = await loading.promise
      if (!cancelled) setPdf(document)
    }

    void openPdf().catch(() => {
      if (cancelled || loading?.destroyed) return
      setStatus('')
      setError('Could not preview this PDF.')
    })

    return () => {
      cancelled = true
      if (loading && !loading.destroyed) void loading.destroy().catch(() => {})
    }
  }, [file])

  useEffect(() => {
    if (!pdf) return
    let cancelled = false
    let rendering: RenderTask | undefined
    const container = pageContainer.current
    container?.replaceChildren()
    setStatus('Rendering page…')
    setError('')

    async function renderPage(document: PDFDocumentProxy) {
      const pdfPage = await document.getPage(page)
      if (cancelled) return
      const original = pdfPage.getViewport({ scale: 1 })
      const viewport = pdfPage.getViewport({ scale: 1200 / Math.max(original.width, original.height) })
      const canvas = window.document.createElement('canvas')
      canvas.setAttribute('role', 'img')
      canvas.setAttribute('aria-label', `Page ${page} of ${document.numPages}`)
      canvas.width = Math.max(1, Math.ceil(viewport.width))
      canvas.height = Math.max(1, Math.ceil(viewport.height))
      rendering = pdfPage.render({ canvas, viewport })
      await rendering.promise
      if (cancelled) return
      container?.replaceChildren(canvas)
      setStatus('')
    }

    void renderPage(pdf).catch(() => {
      if (cancelled) return
      setStatus('')
      setError('Could not display this page.')
    })

    return () => {
      cancelled = true
      rendering?.cancel()
    }
  }, [pdf, page])

  return (
    <div class="pdf-preview" aria-label="PDF preview">
      {pdf && pdf.numPages > 1 && (
        <div class="pdf-page-navigation">
          <button type="button" disabled={page === 1} onClick={() => setPage(value => Math.max(1, value - 1))}>
            Previous
          </button>
          <span aria-live="polite">{page} / {pdf.numPages}</span>
          <button type="button" disabled={page === pdf.numPages} onClick={() => setPage(value => Math.min(pdf.numPages, value + 1))}>
            Next
          </button>
        </div>
      )}
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
      {fallbackUrl && <a href={fallbackUrl} target="_blank" rel="noopener">Open PDF preview in a new tab</a>}
      <div ref={pageContainer} />
    </div>
  )
}
