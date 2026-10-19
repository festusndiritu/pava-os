# PAVA print helper (Windows, USB receipt printer)

Prints receipts straight to the thermal printer — no print dialog, exact
length, automatic cut, logo — by sending ESC/POS bytes to the Windows print
spooler as a RAW job. The normal printer driver stays installed.

1. Install Node 18+ on the till PC (the project already uses Node 24).
2. Edit `start-print-helper.bat`: put the web app's address in
   `PAVA_ALLOWED_ORIGINS` (exactly as shown in the browser's address bar, no
   path). Leave `PAVA_PRINTER` empty to use the PC's default printer, or set
   the printer's name as shown in Windows > Printers & scanners.
3. Double-click the `.bat`. To start it with Windows, put a shortcut to it in
   `shell:startup`.
4. In the app: Settings > Receipt printer > Print helper > Find printers >
   Print test page. Tick "Print automatically when a sale completes" if wanted.

The first time, Chrome may ask to allow access to devices on the local network
for the app's address — choose Allow.

Dry run (no printer needed): `set PAVA_DRY_RUN=1`, start the helper, print from
the app; each job is saved under `dry-run\` as raw ESC/POS bytes.
