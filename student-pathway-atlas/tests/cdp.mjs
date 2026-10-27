// Dev only: a tiny Chrome DevTools Protocol driver (no npm packages). Launches headless Chrome, opens pages at a set
// viewport, evaluates JS, and collects every console message and uncaught exception.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || ({ darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })[process.platform] || 'google-chrome';

export async function launch(port = 9333) {
  if (process.env.PSE_PORT) port = Number(process.env.PSE_PORT);  // run every suite on one agreed port
  const dir = mkdtempSync(join(process.env.PSE_TMP || tmpdir(), 'pse-cdp-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    '--allow-file-access-from-files', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  let ver = null;
  for (let i = 0; i < 200 && !ver; i++) {
    await new Promise(r => setTimeout(r, 150));
    try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch (e) { /* not up yet */ }
  }
  if (!ver) throw new Error('Chrome did not start');
  // close ends Chrome and deletes its throwaway profile (they fill the disk otherwise)
  const clean = () => { try { rmSync(dir, { recursive: true, force: true }); } catch (e) { /* already gone */ } };
  proc.once('exit', clean);
  return { port, proc, close: () => { if (proc.exitCode === null) proc.kill(); else clean(); } };
}

export async function page(browser, url, { width = 375, height = 812, mobile = width < 768, dark = false, calm = false } = {}) {
  const t = await (await fetch(`http://127.0.0.1:${browser.port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const logs = [];
  const waiters = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); return; }
    if (m.method === 'Runtime.consoleAPICalled') logs.push({ type: m.params.type, text: m.params.args.map(a => a.value ?? a.description ?? '').join(' ') });
    if (m.method === 'Runtime.exceptionThrown') logs.push({ type: 'exception', text: (m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text });
    if (m.method === 'Log.entryAdded') logs.push({ type: 'log-' + m.params.entry.level, text: m.params.entry.text + ' ' + (m.params.entry.url || '') });
    waiters.slice().forEach(w => { if (w.method === m.method) { waiters.splice(waiters.indexOf(w), 1); w.res(m.params); } });
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const once = method => new Promise(res => waiters.push({ method, res }));
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const feats = [];
  feats.push({ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' });  // light is asked for too: the Mac's own setting must not leak in
  if (calm) feats.push({ name: 'prefers-reduced-motion', value: 'reduce' });
  if (feats.length) await send('Emulation.setEmulatedMedia', { features: feats });
  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url });
  await loaded;
  const api = {
    logs, send,
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
      if (r.exceptionDetails) throw new Error('eval: ' + ((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text));
      return r.result.value;
    },
    async goto(u) { const l = once('Page.loadEventFired'); await send('Page.navigate', { url: u }); await l; },
    async reload() { const l = once('Page.loadEventFired'); await send('Page.reload', {}); await l; },
    async resize(w, h, mob = w < 768) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: mob }); },
    async shot(path) { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); (await import('node:fs')).writeFileSync(path, Buffer.from(r.data, 'base64')); },
    async close() { try { await fetch(`http://127.0.0.1:${browser.port}/json/close/${t.id}`); } catch (e) { /* gone */ } ws.close(); }
  };
  return api;
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
