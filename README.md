# Cloud Printing

Select a PDF or supported image on your phone. Set the paper size, orientation, margins, and print sides, then tap **Preview**. PDFs also support page ranges and 1, 2, or 4 pages per sheet. A photo is a single page and has a fit or crop option. **Submit** sends the exact previewed PDF to the laptop. Changing a setting requires a new preview.

## Use the website

Open the [hosted website](https://cloud-printing-nine.vercel.app/) on the laptop, keep the tab open, and scan the QR in **Share Printer** with your phone. Choose an image or PDF, apply the print settings, tap **Preview**, and then tap **Submit**. The laptop browser starts a PDF download using its download settings. **Download again** is available if automatic downloads are blocked. Use **Open PDF to print** and choose the printer in the browser’s print dialog.

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

Choose a file, set the layout and tap **Preview** to review the pages before submitting. Tap **Submit** to send the prepared PDF. The phone displays the laptop's confirmation. Files go to **Downloads / Cloud Printing** by default. The receiver accepts PDFs up to 25 MB.

### Optional physical printer

Install [SumatraPDF](https://www.sumatrapdfreader.org/download-free-pdf-viewer) on the laptop. Before starting the receiver, set the path to your copy of SumatraPDF.

```powershell
$env:SUMATRA_PDF_PATH = 'C:\Program Files\SumatraPDF\SumatraPDF.exe'
npm.cmd run receiver
```

On the laptop receiver page, choose the output device from **Share Printer → Printer**. Use **Refresh printers** after adding or reconnecting a printer, or choose **Save PDF only**. The selection applies to new jobs and lasts until the receiver restarts. Set `PRINT_PRINTER` to a Windows printer name if you want a startup selection. Set `PRINT_SAVE_DIR` to choose another save folder. Single-sided and duplex choices travel as PDF print preferences. SumatraPDF uses these preferences on supported printers. In browser-only mode, verify the sides setting in the print dialog. Printer status comes from Windows and depends on the driver. A print confirmation means the job was submitted. The paper tray must have matching stock, and physical printer margins may clip edge-to-edge layouts. The PDF remains saved when a printer is unavailable or the print submission fails.

## Development and hosting

`npm run dev` starts the Astro development server for UI work. Run `npm run build` and `npm run receiver` to test receiving and saving. Deploy the build's `dist/` folder to an HTTPS static host for the phone. The GitHub Pages workflow builds the sender site on pushes to `main`. For a project URL with a path prefix, set the repository variable `PAGES_BASE_PATH` to that path (for example, `/cloud-printing`), or leave it unset for a root URL.

## Contributing

### Local setup

Clone the repository and start the development server from the project directory:

```powershell
git clone https://github.com/lk64665/cloud-printing.git
cd cloud-printing
npm.cmd ci
npm.cmd run dev
```

Open the local URL printed by Astro. For end-to-end receiver testing, stop the development server and follow the Windows receiver instructions above.

### Contribution checklist

- Use Node.js 22 and run `npm ci` to install the locked dependencies.
- Create a feature branch and use `npm run dev` to test interface changes locally.
- Run `npm run build` before opening a pull request. For receiver changes, also run `npm run receiver` and verify that a sample PDF is saved correctly.
- Describe the changes and manual verification steps in your pull request. Use sample documents without personal information when testing.

## License

[ISC](LICENSE)

## Troubleshooting

- If the receiver fails to start, check `node --version` (Node 22) and run `npm.cmd ci` from the project directory before rebuilding.
- If pairing fails, keep the receiver running, reopen `http://127.0.0.1:4321` on the Windows computer, and scan the current QR code again. Check internet connectivity on both devices.
- If a printer is missing, confirm it is installed in Windows and refresh the printer list.
- If printing fails, check the Downloads/Cloud Printing folder for the saved PDF before retrying to avoid duplicate prints.
- For upload failures, confirm the PDF is within the 25 MB limit.

### Printer connectivity and Windows print queue

- For USB printers, check the cable and try another USB port. For network printers, verify the printer is connected to the laptop's network and that Windows can reach it. Check the printer display for paper jams, empty trays, or other errors.
- In PowerShell, run `Get-Printer | Select-Object Name, PrinterStatus, PortName` to inspect the installed devices and verify that the selected printer name matches the Windows queue.
- Open **Settings → Bluetooth & devices → Printers & scanners**, select the printer, and print a Windows test page. If the test page fails, resolve the Windows driver or connectivity issue before troubleshooting the receiver.
- Open the printer's queue and check for paused, offline, or stuck jobs. Cancel only jobs you recognize and no longer need; check whether a job has already printed before submitting it again.
- Check the Windows Print Spooler with `Get-Service -Name Spooler`. If the service is stopped, start it from an elevated PowerShell with `Start-Service -Name Spooler`. If it is unresponsive, an administrator can run `Restart-Service -Name Spooler` after checking with other users, since restarting it can interrupt active printing.
- If saving works but unattended printing fails, verify that `SUMATRA_PDF_PATH` points to an existing executable and test printing the saved PDF manually with SumatraPDF using the same printer.

### Receiver transfer diagnostics

- Try a small, non-sensitive sample PDF with **Save PDF only** selected to isolate file transfer and saving from physical printer problems.
- On the laptop, check the local receiver endpoint with `Test-NetConnection -ComputerName 127.0.0.1 -Port 4321` (substitute the actual configured port if different). This only tests local TCP connectivity, not WebRTC pairing.
- If pairing succeeds but submission stalls, inspect the laptop browser's developer console and receiver terminal for errors. Check whether the phone reports confirmation and whether a PDF appears in the configured save directory. If saving fails, check available disk space and write permissions for that directory.
- If WebRTC connections fail on a restricted campus or guest network, try another trusted network and check whether network policy blocks peer-to-peer connections or relay traffic. Keep the receiver bound to loopback; do not expose its local port or disable the firewall to troubleshoot phone pairing.

## Before Printing

- Keep the Windows print receiver running.
- Make sure both devices have internet access.
- Preview your document before submitting it.
- Verify the selected printer before printing.
- If printing fails, check the saved PDF in the Downloads/Cloud Printing folder before retrying.
