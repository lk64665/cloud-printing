import { execFile } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdir, open, realpath, rename, stat, unlink } from 'node:fs/promises'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const site = fileURLToPath(new URL('../dist', import.meta.url))
const saveFolder = resolve(process.env.PRINT_SAVE_DIR || resolve(homedir(), 'Downloads', 'Cloud Printing'))
let selectedPrinter = process.env.PRINT_PRINTER?.trim() || ''
const sumatra = process.env.SUMATRA_PDF_PATH || 'SumatraPDF.exe'
const host = '127.0.0.1'
const port = Number(process.env.PRINT_PORT || 4321)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PRINT_PORT must be an integer between 1 and 65535.')
}
const origin = `http://${host}:${port}`
const senderUrl = process.env.PRINT_SENDER_URL?.trim() || 'https://cloud-printing-nine.vercel.app/'
const maximumSize = 25 * 1024 * 1024
const paperSizes = new Map([['A4', 'A4'], ['Letter', 'letter'], ['A5', 'A5'], ['Legal', 'legal']])
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
}

const sender = new URL(senderUrl)
if (sender.protocol !== 'https:' || sender.username || sender.password) {
  throw new Error('PRINT_SENDER_URL must be a public HTTPS URL.')
}
try {
  await stat(resolve(site, 'index.html'))
} catch {
  throw new Error('Build the site with npm run build before starting the receiver.')
}

function reply(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(body))
}

async function savePdf(name, data) {
  const stem = name.replace(/\.pdf$/i, '').replace(/[^\p{L}\p{N} _-]/gu, '_')
    .replace(/^[. ]+|[. ]+$/g, '').slice(0, 90) || 'document'
  await mkdir(saveFolder, { recursive: true })
  const temporary = resolve(saveFolder, `.${crypto.randomUUID()}.tmp`)
  const file = await open(temporary, 'wx')
  try {
    try {
      await file.writeFile(data)
    } finally {
      await file.close()
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const destination = resolve(saveFolder, `${stem}-${stamp}-${crypto.randomUUID().slice(0, 8)}.pdf`)
    await rename(temporary, destination)
    return destination
  } catch (error) {
    await unlink(temporary).catch(() => {})
    throw error
  }
}

async function listPrinters() {
  if (process.platform !== 'win32') return []
  const { stdout } = await run('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    "$ErrorActionPreference = 'Stop'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Printer | Select-Object Name, PortName, WorkOffline, PrinterStatus, DetectedErrorState | ConvertTo-Json -Compress",
  ], { windowsHide: true, timeout: 10_000 })
  if (!stdout.trim()) return []

  return [JSON.parse(stdout)].flat()
    .filter(printer => printer?.Name &&
      !/^(FILE:|PORTPROMPT:|NUL:|SHRFAX:)/i.test(printer.PortName ?? '') &&
      !/^(Microsoft Print to PDF|Microsoft XPS Document Writer(?: v4)?|Fax|OneNote(?: for Windows 10| \(Desktop\))?|Send to OneNote.*)$/i.test(printer.Name))
    .map(printer => ({
      name: printer.Name,
      available: !printer.WorkOffline && printer.PrinterStatus !== 7 && printer.DetectedErrorState !== 9,
    }))
    .sort((first, second) => first.name.localeCompare(second.name))
}

async function printPdf(path, paper, printerName) {
  if (!printerName || process.platform !== 'win32') return 'Saved on the laptop.'
  try {
    const printers = await listPrinters()
    if (!printers.some(printer => printer.name === printerName && printer.available)) {
      return 'Saved on the laptop. The selected printer is unavailable.'
    }

    const settings = paper ? `noscale,paper=${paper}` : 'noscale'
    await run(sumatra, ['-silent', '-print-to', printerName, '-print-settings', settings, path], {
      windowsHide: true, timeout: 45_000,
    })
    return 'Saved on the laptop and sent to the printer.'
  } catch (error) {
    console.error('Printing failed:', error.message)
    return 'Saved on the laptop. The print job could not be confirmed.'
  }
}

async function receivePdf(request, response, url) {
  if (request.headers.origin !== origin || request.headers['content-type'] !== 'application/pdf') {
    reply(response, 403, { message: 'Use the laptop receiver page to save a PDF.' })
    return
  }
  const printer = selectedPrinter
  const length = Number(request.headers['content-length'])
  if (!Number.isInteger(length) || length <= 0 || length > maximumSize) {
    reply(response, 413, { message: 'The PDF must be between 1 byte and 25 MB.' })
    return
  }
  const chunks = []
  let total = 0
  for await (const chunk of request) {
    total += chunk.length
    if (total > maximumSize) {
      reply(response, 413, { message: 'The PDF is larger than 25 MB.' })
      return
    }
    chunks.push(chunk)
  }
  const data = Buffer.concat(chunks)
  if (data.subarray(0, 5).toString() !== '%PDF-') {
    reply(response, 415, { message: 'The received file is not a PDF.' })
    return
  }
  const path = await savePdf(url.searchParams.get('name') || 'document', data)
  console.log(`Saved ${path}`)
  const message = await printPdf(path, paperSizes.get(url.searchParams.get('paper')), printer)
  reply(response, 200, { message })
}

const server = createServer(async (request, response) => {
  if (request.headers.host !== `${host}:${port}`) {
    reply(response, 403, { message: 'Use the receiver URL printed in the terminal.' })
    return
  }
  let url
  try {
    url = new URL(request.url, origin)
    decodeURIComponent(url.pathname)
  } catch {
    reply(response, 400, { message: 'Invalid request URL.' })
    return
  }
  try {
    if (url.pathname === '/api/receiver' && request.method === 'GET') {
      reply(response, 200, { senderUrl })
      return
    }
    if (url.pathname === '/api/printers' && request.method === 'GET') {
      reply(response, 200, { printers: await listPrinters(), selectedPrinter })
      return
    }
    if (url.pathname === '/api/printers' && request.method === 'POST') {
      if (request.headers.origin !== origin) {
        reply(response, 403, { message: 'Use the laptop receiver page to select a printer.' })
        return
      }
      const name = url.searchParams.get('name')
      if (name === null || (name && !(await listPrinters()).some(printer => printer.name === name && printer.available))) {
        reply(response, 409, { message: 'That printer is unavailable. Refresh the printer list.' })
        return
      }
      selectedPrinter = name
      reply(response, 200, { selectedPrinter })
      return
    }
    if (url.pathname === '/api/print' && request.method === 'POST') {
      await receivePdf(request, response, url)
      return
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      reply(response, 405, { message: 'Method not allowed.' })
      return
    }
    const path = resolve(site, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`)
    if (!path.startsWith(site + sep) || !(await realpath(path)).startsWith(site + sep) || !(await stat(path)).isFile()) {
      reply(response, 404, { message: 'Page not found.' })
      return
    }
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(path)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    })
    if (request.method === 'HEAD') response.end()
    else createReadStream(path).on('error', () => response.destroy()).pipe(response)
  } catch (error) {
    if (error.code === 'ENOENT' && request.method !== 'POST') {
      reply(response, 404, { message: 'Page not found.' })
      return
    }
    console.error('Receiver:', error.message)
    if (!response.headersSent) reply(response, 500, { message: 'Could not save or serve the file.' })
    else response.destroy()
  }
})

server.listen(port, host, () => {
  console.log(`Open ${origin} on the laptop. Files are saved to ${saveFolder}.`)
  console.log(`Phone sender site: ${senderUrl}`)
})
