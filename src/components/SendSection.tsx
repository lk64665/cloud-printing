import { useRef, useState } from 'preact/hooks'
import { paperSizes } from '../scripts/formatPhoto'
import type { PaperSize } from '../scripts/formatPhoto'
import { defaultPrintSettings, preparePrint } from '../scripts/printLayout'
import type { PrintSettings } from '../scripts/printLayout'
import PdfPreview from './PdfPreview'

interface Props {
  isConnected: boolean
  isSending: boolean
  sendProgress: number
  fileName: string
  sendStatus: string
  onSendFile: (file: File, paper?: PaperSize) => void
  onCancelSend: () => void
}

export default function SendSection({ isConnected, isSending, sendProgress, fileName, sendStatus, onSendFile, onCancelSend }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<File | null>(null)
  const [settings, setSettings] = useState(defaultPrintSettings)
  const [prepared, setPrepared] = useState<File | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')
  const isPdf = selected !== null && (/\.pdf$/i.test(selected.name) || selected.type === 'application/pdf')
  const maxSize = 25 * 1024 * 1024
  const oversized = selected !== null && selected.size > maxSize

  function updateSettings(changes: Partial<PrintSettings>) {
    setSettings(value => ({ ...value, ...changes }))
    setPrepared(null)
    setError('')
  }

  async function showPreview() {
    if (!selected || oversized || preparing) return
    setPreparing(true)
    setPrepared(null)
    setError('')
    try {
      const file = await preparePrint(selected, isPdf, settings)
      if (file.size > maxSize) throw new Error('The formatted PDF exceeds 25 MB. Select fewer pages.')
      setPrepared(file)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setError(isPdf ? message || 'Could not prepare this PDF.' : 'Could not prepare this image. Try a JPEG or PNG file.')
    } finally {
      setPreparing(false)
    }
  }

  return (
    <div class="send-section">
      <h2 class="step-label">2. Prepare and send</h2>
      <button disabled={!isConnected || isSending || preparing} onClick={() => fileInputRef.current?.click()}>
        {selected ? 'Choose another file' : 'Choose file'}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.jepg,.png,.webp,.gif,.bmp,.avif,image/*,application/pdf"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file) {
            setSelected(file)
            setPrepared(null)
            setError('')
            setSettings(defaultPrintSettings)
          }
          event.currentTarget.value = ''
        }}
      />

      {selected && <p class="selected-file">{selected.name}</p>}
      {oversized && <p role="alert">Choose a file no larger than 25 MB.</p>}
      {selected && (
        <fieldset class="photo-settings" disabled={preparing || isSending}>
          <legend>Print settings</legend>
          <label>Paper size
            <select value={settings.paper} onChange={event => updateSettings({ paper: event.currentTarget.value as PaperSize })}>
              {paperSizes.map(size => <option key={size}>{size}</option>)}
            </select>
          </label>
          <label>Orientation
            <select value={settings.orientation} onChange={event => updateSettings({ orientation: event.currentTarget.value as PrintSettings['orientation'] })}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
          <label>Margins
            <select value={settings.margin} onChange={event => updateSettings({ margin: Number(event.currentTarget.value) })}>
              {[0, 5, 10, 15, 20, 25].map(margin => <option key={margin} value={margin}>{margin} mm</option>)}
            </select>
          </label>
          <label>Pages
            <input type="text" value={settings.pages} placeholder={isPdf ? 'All (e.g. 1-3, 5)' : '1'} disabled={!isPdf}
              onInput={event => updateSettings({ pages: event.currentTarget.value })} />
          </label>
          <label>Page layout
            <select value={settings.pagesPerSheet} disabled={!isPdf}
              onChange={event => updateSettings({ pagesPerSheet: Number(event.currentTarget.value) as PrintSettings['pagesPerSheet'] })}>
              <option value="1">1 page per sheet</option>
              <option value="2">2 pages per sheet</option>
              <option value="4">4 pages per sheet</option>
            </select>
          </label>
          <label>Print sides
            <select value={settings.sides} onChange={event => updateSettings({ sides: event.currentTarget.value as PrintSettings['sides'] })}>
              <option value="simplex">Single-sided</option>
              <option value="long-edge">Double-sided (long edge)</option>
              <option value="short-edge">Double-sided (short edge)</option>
            </select>
          </label>
          {!isPdf && (
            <label>Photo fit
              <select value={settings.fit} onChange={event => updateSettings({ fit: event.currentTarget.value as PrintSettings['fit'] })}>
                <option value="contain">Fit entire photo</option>
                <option value="cover">Fill page area (crop)</option>
              </select>
            </label>
          )}
        </fieldset>
      )}
      {selected && !isSending && (
        <button disabled={oversized || preparing} onClick={showPreview}>{preparing ? 'Preparing preview…' : 'Preview'}</button>
      )}
      {prepared && <PdfPreview file={prepared} />}
      {prepared && !isSending && (
        <button disabled={!isConnected} onClick={() => onSendFile(prepared, settings.paper)}>Submit</button>
      )}
      {isSending && (
        <div id="send-progress">
          <div class="progress-row">
            <progress aria-label="File transfer progress" value={sendProgress} max={1} />
            {sendProgress < 1 && <button class="cancel-btn" onClick={onCancelSend}>Cancel</button>}
          </div>
          <span id="send-progress-text">
            {sendProgress === 1 ? 'Waiting for the laptop…' : `Sending ${fileName}… ${Math.round(sendProgress * 100)}%`}
          </span>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {sendStatus && <p class="send-status" role="status">{sendStatus}</p>}
    </div>
  )
}
