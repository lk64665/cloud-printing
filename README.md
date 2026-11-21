# Cloud Printing

Choose and format a photo on your phone, preview the printed page, then submit the PDF to your laptop. Existing PDFs open a page-by-page preview and can be submitted as-is. The laptop saves every PDF before attempting to print.

## Use the website

Open the [hosted website](https://cloud-printing-nine.vercel.app/) on the laptop, keep the tab open, and scan the QR in **Share Printer** with your phone. Choose and format your photo, tap **Preview**, then tap **Submit**. The laptop browser starts a PDF download using its download settings. **Download again** is available if automatic downloads are blocked. Use **Open PDF to print** and the PDF viewer’s Print button for a connected printer.

## Optional Windows receiver for unattended printing

Use Node.js 22. In the project folder, install and build the app.

```powershell
npm.cmd ci
npm.cmd run build
```

Start the receiver. The laptop QR code points to the repository’s [deployed sender site](https://cloud-printing-nine.vercel.app/) by default.

```powershell
npm.cmd run receiver
```

Open the address shown in the terminal (by default, http://127.0.0.1:4321) **on the laptop**. Scan its QR with your phone's camera, or open the same HTTPS sender site on the phone and enter the four-character code. Keep the laptop's receiver and browser tab open. The phone and laptop pair through Trystero and exchange the file over WebRTC. The receiver listens on the laptop's loopback interface.

If you use a different deployment, set `$env:PRINT_SENDER_URL = 'https://your-sender-site.example/'` before starting the receiver. Use the same version of the app on both devices. For unattended printing, use the local receiver URL on the laptop.

Choose a photo, set its paper size, orientation, margins and fit, and tap **Preview**. Tap **Submit** to send the prepared PDF. The phone displays the laptop's confirmation. Files go to **Downloads / Cloud Printing** by default. The receiver accepts PDFs up to 25 MB.

### Optional physical printer

Install [SumatraPDF](https://www.sumatrapdfreader.org/download-free-pdf-viewer) on the laptop. Before starting the receiver, set the exact printer name from Windows **Settings → Bluetooth & devices → Printers & scanners** and the path to your copy of SumatraPDF.

```powershell
$env:PRINT_PRINTER = 'Your physical printer name'
$env:SUMATRA_PDF_PATH = 'C:\Program Files\SumatraPDF\SumatraPDF.exe'
npm.cmd run receiver
```

Set `PRINT_SAVE_DIR` before starting the receiver to choose another save folder. Leave `PRINT_PRINTER` unset for save-only mode. Printer status comes from Windows and depends on the driver. A print confirmation means the job was submitted. The paper tray must have matching stock, and physical printer margins may clip edge-to-edge layouts. The PDF remains saved when a printer is unavailable or the print submission fails.

## Development and hosting

`npm run dev` starts the Astro development server for UI work. Run `npm run build` and `npm run receiver` to test receiving and saving. Deploy the build's `dist/` folder to an HTTPS static host for the phone. The GitHub Pages workflow builds the sender site on pushes to `main`. For a project URL with a path prefix, set the repository variable `PAGES_BASE_PATH` to that path (for example, `/cloud-printing`), or leave it unset for a root URL.

## License

[ISC](LICENSE)
