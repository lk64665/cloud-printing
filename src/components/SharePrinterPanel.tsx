import { useEffect, useState } from 'preact/hooks'
import { useSelector } from '@xstate/react'
import { actor, receiverConfig } from '../scripts/actor'
import QRCode from 'react-qr-code'
import './SharePrinterPanel.css'

export default function SharePrinterPanel() {
  const roomId = useSelector(actor, (s) => s.context.printerRoomId)
  const isConnected = useSelector(actor, (s) => s.hasTag('printer-connected'))
  const peerCount = useSelector(actor, (s) => s.context.peers.size)
  const activeTab = useSelector(actor, (s) => s.context.activeTab)

  const isSending = useSelector(actor, (s) => s.matches('printing'))
  const receivedFile = useSelector(actor, (s) => s.context.receivedFile)
  const [senderUrl, setSenderUrl] = useState(window.location.href)
  const [receivedUrl, setReceivedUrl] = useState('')

  useEffect(() => {
    void receiverConfig.then(config => {
      if (config?.senderUrl) setSenderUrl(config.senderUrl)
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
