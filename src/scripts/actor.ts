import { createActor, fromCallback } from 'xstate'
import { createBrowserInspector } from '@statelyai/inspect'
import { joinRoom } from 'trystero/nostr'
import type { ActionSender, JsonValue } from 'trystero'
import { printerPartyMachine } from './machine'
import type { FileMetadata, AppEvent, RoomActorInput, FileTransferActorInput } from './machine'
import { generateRoomId, isValidRoomId } from './utils'

const inspector = createBrowserInspector({ autoStart: false })
let sendFile: ActionSender<ArrayBuffer> | undefined
export const receiverConfig: Promise<{ senderUrl: string } | null> =
  ['127.0.0.1', 'localhost'].includes(location.hostname)
    ? fetch('./api/receiver')
      .then(async response => {
        if (!response.ok) return null
        const config = await response.json()
        return typeof config.senderUrl === 'string' ? config : null
      })
      .catch(() => null)
    : Promise.resolve(null)

let onReceipt: ((peerId: string, jobId: string, message: string) => void) | undefined

function downloadPdf(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function saveReceivedFile(data: ArrayBuffer, metadata: FileMetadata) {
  const params = new URLSearchParams({ name: metadata.name })
  if (metadata.paper) params.set('paper', metadata.paper)
  const response = await fetch(`./api/print?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf' },
    body: data,
    signal: AbortSignal.timeout(75_000),
  })
  const result = await response.json()
  if (typeof result.message !== 'string') throw new Error('Invalid response from the laptop receiver.')
  return result.message
}

const roomActorImpl = fromCallback<AppEvent, RoomActorInput>(({ input, sendBack }) => {
  const room = joinRoom({ appId: 'printer-party', relayRedundancy: 10 }, input.roomId)
  const [announceReceiver, getReceiver] = room.makeAction<string>('receiver')
  const [askForReceiver, getReceiverRequest] = room.makeAction<string>('receiver-req')
  const [postFile, getFile] = room.makeAction<ArrayBuffer>('file')
  const [postReceipt, getReceipt] = room.makeAction<{ jobId: string; message: string }>('receipt')

  const offerReceiver = (peerId: string) => {
    void announceReceiver('', peerId).catch(console.error)
  }

  room.onPeerJoin((peerId) => {
    if (input.receiving) {
      sendBack({ type: 'PEER_JOINED', peerId })
      offerReceiver(peerId)
    } else {
      void askForReceiver('', peerId).catch(console.error)
    }
  })
  room.onPeerLeave((peerId) => sendBack({ type: 'PEER_LEFT', peerId }))

  if (input.receiving) {
    getReceiverRequest((_, peerId) => offerReceiver(peerId))
    getFile(async (data, peerId, rawMetadata) => {
      const metadata = rawMetadata as unknown as FileMetadata | undefined
      if (!metadata || typeof metadata.jobId !== 'string' || typeof metadata.name !== 'string') return
      let message: string
      try {
        if (await receiverConfig) {
          message = await saveReceivedFile(data, metadata)
        } else if (data.byteLength > 25 * 1024 * 1024 ||
          new TextDecoder().decode(data.slice(0, 5)) !== '%PDF-') {
          message = 'The laptop rejected the file. Send a PDF up to 25 MB.'
        } else {
          const stem = metadata.name.replace(/\.pdf$/i, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().slice(0, 120)
          const file = new File([data], (stem || 'document') + '.pdf', { type: 'application/pdf' })
          sendBack({ type: 'PDF_RECEIVED', file })
          downloadPdf(file)
          message = 'Received by the laptop. Check its browser downloads.'
        }
      } catch (error) {
        console.error('Receiving PDF:', error)
        message = 'The laptop could not confirm saving the PDF. Check the site open on the laptop.'
      }
      void postReceipt({ jobId: metadata.jobId, message }, peerId).catch(console.error)
    })
  } else {
    sendFile = postFile
    getReceiver((_, peerId) => sendBack({ type: 'PEER_JOINED', peerId }))
    getReceipt(({ jobId, message }, peerId) => onReceipt?.(peerId, jobId, message))
  }

  return () => {
    room.leave()
    if (!input.receiving) sendFile = undefined
  }
})

const fileTransferActorImpl = fromCallback<AppEvent, FileTransferActorInput>(({ input, sendBack }) => {
  const postFile = sendFile
  const jobId = crypto.randomUUID()
  let active = true
  let timeout: ReturnType<typeof setTimeout> | undefined

  function finish(message: string) {
    if (active) sendBack({ type: 'SEND_DONE', message })
  }

  onReceipt = (peerId, receivedJobId, message) => {
    if (peerId === input.peerId && receivedJobId === jobId) finish(message)
  }
  const metadata: FileMetadata = {
    jobId,
    name: input.file.name,
    type: input.file.type,
    size: input.file.size,
    paper: input.paper,
  }

  if (postFile) {
    timeout = setTimeout(() => finish('No confirmation from the laptop. Check its save folder before retrying.'), 120_000)
    void input.file.arrayBuffer().then(async buffer => {
      if (!active) return
      await postFile(buffer, input.peerId, metadata as unknown as JsonValue, percent => {
        if (active) sendBack({ type: 'SEND_PROGRESS', percent })
      })
    }).catch(() => finish('The transfer failed. Check the laptop before retrying.'))
  } else {
    finish('The laptop disconnected. Reconnect before submitting.')
  }

  return () => {
    active = false
    clearTimeout(timeout)
    onReceipt = undefined
  }
})

const hashRoomId = location.hash.slice(1).toLowerCase()
const joinRoomId = isValidRoomId(hashRoomId) ? hashRoomId : ''
if (joinRoomId) history.replaceState(null, '', location.pathname + location.search)

export const actor = createActor(
  printerPartyMachine.provide({
    actors: {
      printerRoomActor: roomActorImpl,
      printingRoomActor: roomActorImpl,
      fileTransferActor: fileTransferActorImpl,
    },
  }),
  { input: { initialRoomId: generateRoomId() }, inspect: inspector.inspect },
)

actor.start()
if (joinRoomId) actor.send({ type: 'JOIN_ROOM', roomId: joinRoomId })

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.shiftKey && event.key === 'X') inspector.start()
})

const mq = window.matchMedia('(max-width: 640px)')
mq.addEventListener('change', (event) => {
  if (event.matches) actor.send({ type: 'SWITCH_TAB', tab: 'print' })
})
