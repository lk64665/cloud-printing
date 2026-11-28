# Contributor guide

## Commands

Use Node.js 22 and install dependencies with `npm ci`.

- `npm run dev`: Astro development server.
- `npm run build`: static production build in `dist/`.
- `npm run preview`: preview the static build.
- `npm run receiver`: local receiver; build the frontend first.

No test runner or linter script is currently configured. Run the production build for changes, then verify the affected flow. Receiver printing requires Windows and optional SumatraPDF; see README.md for setup.

## Architecture

Cloud Printing uses Astro, Preact components, TypeScript, XState, and Trystero's Nostr relay strategy for WebRTC pairing. The static website runs on an HTTPS host. The optional receiver serves the built website and local API on the laptop's loopback interface.

Key files:

- `src/pages/index.astro`: application entry and page structure.
- `src/components/SendSection.tsx`: file selection, print settings, preview preparation, and submission.
- `src/components/PdfPreview.tsx`: PDF.js preview and page navigation.
- `src/scripts/formatPhoto.ts`: format images into a single-page PDF.
- `src/scripts/printLayout.ts`: PDF loading, page ranges, multiple pages per sheet, and PDF print preferences.
- `src/scripts/machine.ts`: application state machine and event types.
- `src/scripts/actor.ts`: room actors, transfers, receipts, and receiver integration.
- `src/scripts/utils.ts`: four-character room-code generation and validation.
- `server/print-receiver.mjs`: local PDF saving, Windows printer discovery, and optional unattended printing.
- `public/sw.js`: service worker caching.

## File flow

1. The laptop creates a four-character room code and displays a QR link.
2. The sender joins using that link, QR scan, or a room code.
3. The sender selects a PDF or image, chooses print settings, and prepares a PDF preview. PDFs support page ranges and 1, 2, or 4 pages per sheet.
4. Submit sends the prepared PDF with a job ID and metadata over WebRTC.
5. In browser mode, the laptop downloads the PDF and provides an option to open it for manual printing.
6. With the local receiver, the laptop posts the PDF to its local API for saving and optional SumatraPDF printing.
7. A receipt identifies the job and reports the laptop's result to the sender.

Changing print settings requires a new preview. Prepared PDFs are limited to 25 MB. Browser-only receiving validates the size and PDF signature; the local receiver applies its own checks. Do not assume browser receipt means physical printing succeeded.

Keep the local receiver bound to loopback. Use a small sample PDF without personal information when verifying transfer and printing.
