import { useEffect, useRef, useState } from 'preact/hooks'
import { defaultSettings, formatPhoto, paperSizes } from '../scripts/formatPhoto'
import type { PaperSize, PhotoSettings } from '../scripts/formatPhoto'
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
  const [selection, setSelection] = useState(0)
  const [settings, setSettings] = useState(defaultSettings)
  const [prepared, setPrepared] = useState<{ file: File; url: string } | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')
  const isPdf = selected !== null && (/\.pdf$/i.test(selected.name) || selected.type === 'application/pdf')
  const isPhoto = selected !== null && !isPdf
  const isOversizedPdf = isPdf && selected.size > 25 * 1024 * 1024
  const previewUrl = prepared?.url

  useEffect(() => {
    if (previewUrl) return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  function updateSettings(changes: Partial<PhotoSettings>) {
    setSettings({ ...settings, ...changes })
    setPrepared(null)
    setError('')
  }

  async function showPreview() {
    if (!selected) return
    setPreparing(true)
    setError('')
    try {
      const result = await formatPhoto(selected, settings)
      setPrepared({ file: result.file, url: URL.createObjectURL(result.preview) })
    } catch {
      setError('Could not preview this photo. Try a JPEG or PNG image.')
    } finally {
      setPreparing(false)
    }
  }

  function submit() {
    if (isPhoto && prepared) onSendFile(prepared.file, settings.paper)
    if (isPdf && !isOversizedPdf) onSendFile(selected)
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
        accept=".pdf,image/*"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file) {
            setSelected(file)
            setSelection(value => value + 1)
            setPrepared(null)
            setError('')
          }
          event.currentTarget.value = ''
        }}
      />

      {selected && <p class="selected-file">{selected.name}</p>}
      {isPdf && !isOversizedPdf && <PdfPreview key={selection} file={selected} />}
      {isOversizedPdf && <p role="alert">Choose a PDF no larger than 25 MB.</p>}
      {isPhoto && (
        <fieldset class="photo-settings" disabled={preparing || isSending}>
          <legend>Page settings</legend>
          <label>Paper size
            <select value={settings.paper} onChange={event => updateSettings({ paper: event.currentTarget.value as PaperSize })}>
              {paperSizes.map(size => <option key={size}>{size}</option>)}
            </select>
          </label>
          <label>Orientation
            <select value={settings.orientation} onChange={event => updateSettings({ orientation: event.currentTarget.value as PhotoSettings['orientation'] })}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
          <label>Margins
            <select value={settings.margin} onChange={event => updateSettings({ margin: Number(event.currentTarget.value) })}>
              {[0, 5, 10, 15, 20, 25].map(margin => <option key={margin} value={margin}>{margin} mm</option>)}
            </select>
          </label>
          <label>Photo fit
            <select value={settings.fit} onChange={event => updateSettings({ fit: event.currentTarget.value as PhotoSettings['fit'] })}>
              <option value="contain">Fit entire photo</option>
              <option value="cover">Fill page area (crop)</option>
            </select>
          </label>
        </fieldset>
      )}
      {isPhoto && !prepared && (
        <button disabled={preparing || isSending} onClick={showPreview}>
          {preparing ? 'Preparing preview…' : 'Preview'}
        </button>
      )}
      {prepared && <img class="photo-preview" src={prepared.url} alt="Preview of the formatted print page" />}

      {selected && !isSending && (
        <button disabled={!isConnected || isOversizedPdf || (isPhoto && !prepared)} onClick={submit}>Submit</button>
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
