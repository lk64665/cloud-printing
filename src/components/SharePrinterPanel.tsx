import { useEffect, useState } from 'preact/hooks'
import { useSelector } from '@xstate/react'
import { actor, receiverConfig } from '../scripts/actor'
import QRCode from 'react-qr-code'
import './SharePrinterPanel.css'

interface Printer { name: string; available: boolean }

export default function SharePrinterPanel() {
  const roomId = useSelector(actor, (s) => s.context.printerRoomId)
  const isConnected = useSelector(actor, (s) => s.hasTag('printer-connected'))
  const peerCount = useSelector(actor, (s) => s.context.peers.size)
  const activeTab = useSelector(actor, (s) => s.context.activeTab)

  const isSending = useSelector(actor, (s) => s.matches('printing'))
  const receivedFile = useSelector(actor, (s) => s.context.receivedFile)
  const [senderUrl, setSenderUrl] = useState(window.location.href)
  const [receivedUrl, setReceivedUrl] = useState('')
  const [hasReceiver, setHasReceiver] = useState(false)
  const [printers, setPrinters] = useState<Printer[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState('')
  const [loadingPrinters, setLoadingPrinters] = useState(false)
  const [printerError, setPrinterError] = useState('')

  async function refreshPrinters() {
    setLoadingPrinters(true)
    setPrinterError('')
    try {
      const response = await fetch('./api/printers', { cache: 'no-store' })
      if (!response.ok) throw new Error()
      const result = await response.json()
      setPrinters(result.printers)
      setSelectedPrinter(result.selectedPrinter)
    } catch {
      setPrinterError('Could not load Windows printers. Try refreshing the list.')
    } finally {
      setLoadingPrinters(false)
    }
  }

  async function changePrinter(name: string) {
    setLoadingPrinters(true)
    setPrinterError('')
    try {
      const response = await fetch('./api/printers?' + new URLSearchParams({ name }), { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message)
      setSelectedPrinter(result.selectedPrinter)
    } catch (error) {
      setPrinterError(error instanceof Error ? error.message : 'Could not select that printer.')
    } finally {
      setLoadingPrinters(false)
    }
  }

  useEffect(() => {
    void receiverConfig.then(config => {
      if (!config) return
      if (config.senderUrl) setSenderUrl(config.senderUrl)
      setHasReceiver(true)
      void refreshPrinters()
    })
  }, [])

  useEffect(() => {
    if (!receivedFile) return
    const url = URL.createObjectURL(receivedFile)
    setReceivedUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [receivedFile])

  const roomUrl = new URL(senderUrl)
  roomUrl.hash = roomId

  const peerText = isConnected
    ? peerCount === 1
      ? '1 peer connected'
      : `${peerCount} peers connected`
    : 'Waiting for connection...'

  return (
    <div id="tab-room" class={`tab-panel${activeTab === 'room' ? ' active' : ''}`}>
      <section id="room-section">
        <h2 class="panel-title">Share Printer</h2>
        {isSending ? (
          <p class="room-hint">Disconnect from the other laptop to share this device.</p>
        ) : (
          <>
            <p class="room-hint">Scan this code with your phone. Keep this tab open to receive files.</p>
            <QRCode id="room-qr" value={roomUrl.href} size={200} fgColor="#292524" bgColor="transparent" />
          </>
        )}
        <p class="room-id-display">{roomId}</p>
        <span class={`peer-status${isConnected ? ' connected' : ''}`}>
          <span class="peer-count">{peerText}</span>
        </span>
        {hasReceiver && !isSending && (
          <div class="printer-picker">
            <label for="output-printer">Printer</label>
            <select id="output-printer" value={selectedPrinter} disabled={loadingPrinters}
              onChange={event => {
                const name = event.currentTarget.value
                event.currentTarget.value = selectedPrinter
                void changePrinter(name)
              }}>
              <option value="">Save PDF only</option>
              {selectedPrinter && !printers.some(printer => printer.name === selectedPrinter) && (
                <option value={selectedPrinter} disabled>{selectedPrinter} (unavailable)</option>
              )}
              {printers.map(printer => (
                <option key={printer.name} disabled={!printer.available} value={printer.name}>
                  {printer.name}{printer.available ? '' : ' (unavailable)'}
                </option>
              ))}
            </select>
            <button type="button" class="muted-btn" disabled={loadingPrinters} onClick={refreshPrinters}>
              Refresh printers
            </button>
            {printerError && <p role="alert">{printerError}</p>}
          </div>
        )}
        {receivedFile && receivedUrl && (
          <div class="received-document" role="status">
            <p>Received {receivedFile.name}</p>
            <a href={receivedUrl} download={receivedFile.name}>Download again</a>
            <a href={receivedUrl} target="_blank" rel="noopener">Open PDF to print</a>
          </div>
        )}
      </section>
    </div>
  )
}
