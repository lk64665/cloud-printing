import { useEffect, useState } from 'preact/hooks'
import { useSelector } from '@xstate/react'
import { actor } from '../scripts/actor'
import QRCode from 'react-qr-code'
import './SharePrinterPanel.css'

export default function SharePrinterPanel() {
  const roomId = useSelector(actor, (s) => s.context.printerRoomId)
  const isConnected = useSelector(actor, (s) => s.hasTag('printer-connected'))
  const peerCount = useSelector(actor, (s) => s.context.peers.size)
  const activeTab = useSelector(actor, (s) => s.context.activeTab)

  const [senderUrl, setSenderUrl] = useState('')
  const [receiverHint, setReceiverHint] = useState('Checking laptop receiver…')

  useEffect(() => {
    fetch('./api/receiver')
      .then(response => {
        if (!response.ok) throw new Error('Receiver unavailable')
        return response.json()
      })
      .then(({ senderUrl }) => {
        setSenderUrl(senderUrl)
        setReceiverHint('Scan the QR code with your phone or enter the code on the sender site.')
      })
      .catch(() => setReceiverHint('To show the QR code, run npm run receiver on the laptop and open the address shown in the terminal.'))
  }, [])

  const roomUrl = senderUrl ? new URL(senderUrl) : null
  if (roomUrl) roomUrl.hash = roomId

  const peerText = isConnected
    ? peerCount === 1
      ? '1 peer connected'
      : `${peerCount} peers connected`
    : 'Waiting for connection...'

  return (
    <div id="tab-room" class={`tab-panel${activeTab === 'room' ? ' active' : ''}`}>
      <section id="room-section">
        <h2 class="panel-title">Share Printer</h2>
        <p class="room-hint">{receiverHint}</p>
        {roomUrl && <QRCode id="room-qr" value={roomUrl.href} size={200} fgColor="#292524" bgColor="transparent" />}
        <p class="room-id-display">{roomId}</p>
        <span class={`peer-status${isConnected ? ' connected' : ''}`}>
          <span class="peer-count">{peerText}</span>
        </span>
      </section>
    </div>
  )
}
