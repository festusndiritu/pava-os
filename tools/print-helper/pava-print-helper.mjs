#!/usr/bin/env node
/**
 * PAVA print helper — receives raw ESC/POS bytes from the web app over
 * http://127.0.0.1 and sends them to a Windows printer as a RAW spooler job.
 * No dependencies; needs Node 18+ and Windows PowerShell (built into Windows).
 *
 *   GET  /health               -> {"ok":true}
 *   GET  /printers             -> [{"name":"...","isDefault":true}, ...]
 *   POST /print?printer=NAME   -> body = ESC/POS bytes (empty NAME = default printer)
 *
 * Settings (environment variables):
 *   PAVA_PORT             default 9101
 *   PAVA_ALLOWED_ORIGINS  comma-separated web app origins allowed to print,
 *                         e.g. https://your-app.vercel.app,http://localhost:3000
 *   PAVA_PRINTER          printer used when the request names none
 *   PAVA_DRY_RUN=1        write each job to ./dry-run instead of printing
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PAVA_PORT || 9101);
const ORIGINS = (process.env.PAVA_ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const DEFAULT_PRINTER = process.env.PAVA_PRINTER || '';
const DRY_RUN = process.env.PAVA_DRY_RUN === '1';
const MAX_BYTES = 1024 * 1024;

const PS_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct DOC_INFO_1 { public string pDocName; public string pOutputFile; public string pDatatype; }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool OpenPrinter(string name, out IntPtr h, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern int StartDocPrinter(IntPtr h, int level, ref DOC_INFO_1 di);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr h, byte[] buf, int count, out int written);
  public static void Send(string printer, byte[] data) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero))
      throw new Exception("Cannot open printer '" + printer + "' (Windows error " + Marshal.GetLastWin32Error() + ")");
    try {
      DOC_INFO_1 di = new DOC_INFO_1();
      di.pDocName = "PAVA receipt"; di.pOutputFile = null; di.pDatatype = "RAW";
      if (StartDocPrinter(h, 1, ref di) == 0) throw new Exception("StartDocPrinter failed (" + Marshal.GetLastWin32Error() + ")");
      try {
        if (!StartPagePrinter(h)) throw new Exception("StartPagePrinter failed (" + Marshal.GetLastWin32Error() + ")");
        int written;
        if (!WritePrinter(h, data, data.Length, out written) || written != data.Length)
          throw new Exception("WritePrinter failed (" + Marshal.GetLastWin32Error() + ")");
        EndPagePrinter(h);
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
  }
}
"@
$name = $env:PAVA_PRINTER
if (-not $name) { $name = (Get-CimInstance Win32_Printer | Where-Object { $_.Default }).Name }
if (-not $name) { throw 'No printer name given and this PC has no default printer.' }
[RawPrinter]::Send($name, [System.IO.File]::ReadAllBytes($env:PAVA_FILE))
`;

let scriptPath = null;
async function ensureScript() {
  if (!scriptPath) {
    scriptPath = join(tmpdir(), 'pava-rawprint.ps1');
    await writeFile(scriptPath, PS_SCRIPT, 'utf8');
  }
  return scriptPath;
}

function runPowerShell(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', ...args], {
      env: { ...process.env, ...env },
      windowsHide: true,
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => reject(new Error(`Could not start PowerShell: ${e.message}`)));
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(err.trim() || `PowerShell exited with ${code}`))));
  });
}

async function listPrinters() {
  const out = await runPowerShell([
    '-Command',
    'Get-CimInstance Win32_Printer | Select-Object Name,Default | ConvertTo-Json -Compress',
  ]);
  if (!out.trim()) return [];
  const parsed = JSON.parse(out);
  return (Array.isArray(parsed) ? parsed : [parsed]).map((p) => ({ name: p.Name, isDefault: !!p.Default }));
}

// One job at a time, in the order received, so two quick sales never interleave.
let queue = Promise.resolve();
function enqueue(job) {
  const run = queue.then(job, job);
  queue = run.catch(() => {});
  return run;
}

async function printBytes(printer, bytes) {
  const name = printer || DEFAULT_PRINTER;
  if (DRY_RUN) {
    await mkdir('dry-run', { recursive: true });
    const file = join('dry-run', `job-${Date.now()}.bin`);
    await writeFile(file, bytes);
    console.log(`[dry-run] ${bytes.length} bytes -> ${file} (printer: ${name || 'default'})`);
    return;
  }
  const file = join(tmpdir(), `pava-job-${randomUUID()}.bin`);
  await writeFile(file, bytes);
  try {
    await runPowerShell(['-File', await ensureScript()], { PAVA_PRINTER: name, PAVA_FILE: file });
    console.log(`printed ${bytes.length} bytes on "${name || 'default printer'}"`);
  } finally {
    unlink(file).catch(() => {});
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BYTES) {
        reject(Object.assign(new Error('Print job too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const send = (status, body, type = 'text/plain') => {
    res.writeHead(status, { 'Content-Type': type });
    res.end(body);
  };

  if (origin) {
    if (!ORIGINS.includes(origin.replace(/\/+$/, ''))) return send(403, `Origin ${origin} is not allowed. Add it to PAVA_ALLOWED_ORIGINS.`);
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') return send(204, '');

  const url = new URL(req.url || '/', 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && url.pathname === '/health') return send(200, JSON.stringify({ ok: true, dryRun: DRY_RUN }), 'application/json');
    if (req.method === 'GET' && url.pathname === '/printers') {
      return send(200, JSON.stringify(DRY_RUN ? [{ name: 'dry-run', isDefault: true }] : await listPrinters()), 'application/json');
    }
    if (req.method === 'POST' && url.pathname === '/print') {
      const bytes = await readBody(req);
      if (bytes.length === 0) return send(400, 'Empty print job');
      await enqueue(() => printBytes(url.searchParams.get('printer') || '', bytes));
      return send(200, 'ok');
    }
    return send(404, 'Not found');
  } catch (e) {
    console.error(e);
    return send(e.status || 500, e.message || 'Print failed');
  }
});

// 127.0.0.1 only: nothing else on the network can reach this.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`PAVA print helper listening on http://127.0.0.1:${PORT}${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`Allowed origins: ${ORIGINS.join(', ')}`);
});
