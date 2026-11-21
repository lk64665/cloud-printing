export const paperSizes = ['A4', 'Letter', 'A5', 'Legal'] as const
export type PaperSize = typeof paperSizes[number]

export interface PhotoSettings {
  paper: PaperSize
  orientation: 'portrait' | 'landscape'
  margin: number
  fit: 'contain' | 'cover'
}

export const defaultSettings: PhotoSettings = {
  paper: 'A4',
  orientation: 'portrait',
  margin: 10,
  fit: 'contain',
}

export async function formatPhoto(file: File, settings: PhotoSettings) {
  const { PDFDocument, PageSizes } = await import('pdf-lib')
  const [short, long] = PageSizes[settings.paper]
  const landscape = settings.orientation === 'landscape'
  const width = landscape ? long : short
  const height = landscape ? short : long
  const pixelsPerPoint = 200 / 72
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * pixelsPerPoint)
  canvas.height = Math.round(height * pixelsPerPoint)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare the page preview.')

  const source = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = source
    await image.decode()

    const margin = settings.margin * 200 / 25.4
    const innerWidth = canvas.width - 2 * margin
    const innerHeight = canvas.height - 2 * margin
    const scale = (settings.fit === 'contain' ? Math.min : Math.max)(
      innerWidth / image.naturalWidth,
      innerHeight / image.naturalHeight,
    )
    const imageWidth = image.naturalWidth * scale
    const imageHeight = image.naturalHeight * scale

    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.beginPath()
    context.rect(margin, margin, innerWidth, innerHeight)
    context.clip()
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, (canvas.width - imageWidth) / 2, (canvas.height - imageHeight) / 2, imageWidth, imageHeight)
  } finally {
    URL.revokeObjectURL(source)
  }

  const preview = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not render the page.')), 'image/jpeg', 0.94)
  })
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([width, height])
  const image = await pdf.embedJpg(await preview.arrayBuffer())
  page.drawImage(image, { x: 0, y: 0, width, height })
  const name = file.name.replace(/\.[^.]+$/, '') || 'photo'
  const documentFile = new File([new Uint8Array(await pdf.save())], `${name}.pdf`, { type: 'application/pdf' })
  return { preview, file: documentFile }
}
