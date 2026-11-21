import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { defaultSettings, formatPhoto } from './formatPhoto'
import type { PhotoSettings } from './formatPhoto'

export interface PrintSettings extends PhotoSettings {
  pages: string
  pagesPerSheet: 1 | 2 | 4
  sides: 'simplex' | 'long-edge' | 'short-edge'
}

export const defaultPrintSettings: PrintSettings = {
  ...defaultSettings,
  pages: '',
  pagesPerSheet: 1,
  sides: 'simplex',
}

export async function openPdf(file: File) {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  GlobalWorkerOptions.workerSrc = workerUrl
  const loading = getDocument({ data: await file.arrayBuffer() })
  loading.onPassword = () => { void loading.destroy().catch(() => {}) }
  return loading
}

export function selectedPages(range: string, count: number): number[] {
  if (!range.trim()) return Array.from({ length: count }, (_, index) => index + 1)

  const pages = new Set<number>()
  for (const part of range.split(',')) {
    const match = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(part.trim())
    const first = Number(match?.[1])
    const last = Number(match?.[2] ?? first)
    if (!match || first < 1 || last < first || last > count) {
      throw new Error(`Enter page numbers or ranges between 1 and ${count}, for example 1-3, 5.`)
    }
    for (let page = first; page <= last; page++) pages.add(page)
  }
  return [...pages]
}

export async function preparePrint(file: File, isPdf: boolean, settings: PrintSettings) {
  const { PDFDocument, Duplex, PageSizes, PrintScaling } = await import('pdf-lib')
  let pdf

  if (!isPdf) {
    selectedPages(settings.pages, 1)
    const formatted = await formatPhoto(file, settings)
    pdf = await PDFDocument.load(await formatted.file.arrayBuffer())
  } else {
    const loading = await openPdf(file)
    try {
      const source = await loading.promise.catch(() => {
        throw new Error('Could not read this PDF. Choose a valid, unlocked copy.')
      })
      const pages = selectedPages(settings.pages, source.numPages)
      pdf = await PDFDocument.create()

      const [short, long] = PageSizes[settings.paper]
      const landscape = settings.orientation === 'landscape'
      const width = landscape ? long : short
      const height = landscape ? short : long
      const columns = settings.pagesPerSheet === 1 || (settings.pagesPerSheet === 2 && !landscape) ? 1 : 2
      const rows = settings.pagesPerSheet / columns
      const margin = settings.margin * 72 / 25.4
      const gap = settings.pagesPerSheet === 1 ? 0 : 6
      const cellWidth = (width - 2 * margin - (columns - 1) * gap) / columns
      const cellHeight = (height - 2 * margin - (rows - 1) * gap) / rows
      const canvas = document.createElement('canvas')

      for (let offset = 0; offset < pages.length; offset += settings.pagesPerSheet) {
        const sheet = pdf.addPage([width, height])
        for (const [index, number] of pages.slice(offset, offset + settings.pagesPerSheet).entries()) {
          const page = await source.getPage(number)
          const natural = page.getViewport({ scale: 1 })
          const scale = Math.min(cellWidth / natural.width, cellHeight / natural.height)
          const viewport = page.getViewport({ scale: scale * 2.5 })
          canvas.width = Math.max(1, Math.ceil(viewport.width))
          canvas.height = Math.max(1, Math.ceil(viewport.height))
          try {
            await page.render({ canvas, viewport, intent: 'print', background: '#fff' }).promise
            const image = await pdf.embedJpg(canvas.toDataURL('image/jpeg', 0.93))
            const imageWidth = natural.width * scale
            const imageHeight = natural.height * scale
            sheet.drawImage(image, {
              x: margin + index % columns * (cellWidth + gap) + (cellWidth - imageWidth) / 2,
              y: height - margin - Math.floor(index / columns) * (cellHeight + gap)
                - (cellHeight + imageHeight) / 2,
              width: imageWidth,
              height: imageHeight,
            })
          } finally {
            page.cleanup()
          }
        }
      }
    } finally {
      if (!loading.destroyed) await loading.destroy()
    }
  }

  const preferences = pdf.catalog.getOrCreateViewerPreferences()
  preferences.setPrintScaling(PrintScaling.None)
  preferences.setPickTrayByPDFSize(true)
  preferences.setDuplex({
    simplex: Duplex.Simplex,
    'long-edge': Duplex.DuplexFlipLongEdge,
    'short-edge': Duplex.DuplexFlipShortEdge,
  }[settings.sides])

  const name = file.name.replace(/\.[^.]+$/, '') || 'document'
  return new File([new Uint8Array(await pdf.save())], `${name}.pdf`, { type: 'application/pdf' })
}
