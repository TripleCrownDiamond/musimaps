/* Capture CDP : force le thème (light/dark), attend la carte, screenshot.
 * Usage : node scripts/cdp-shot.mjs <theme> <url> <out.png> [w] [h]
 */
const theme = process.argv[2] ?? 'light';
const url = process.argv[3] ?? 'http://localhost:5199/globe';
const out = process.argv[4] ?? '/tmp/shot.png';
const w = Number(process.argv[5] ?? 1280);
const h = Number(process.argv[6] ?? 800);
const PORT = 9223;

async function main() {
  // Tab dédiée, profil frais (pas de localStorage persistant).
  const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  let tab = tabs.find((t) => t.type === 'page');
  if (!tab) {
    const created = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
    tab = created;
  }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg.result);
    }
  };
  await new Promise((r) => (ws.onopen = r));

  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 9000));

  // Force le thème puis rechargement propre.
  await send('Runtime.evaluate', {
    expression: `localStorage.setItem('musimaps.theme', '${theme}'); document.documentElement.dataset.theme='${theme}';`,
  });
  await send('Page.reload', { ignoreCache: true });
  await new Promise((r) => setTimeout(r, 14000));

  // Attends que la carte soit chargée (canvas présent + tuiles).
  for (let i = 0; i < 20; i++) {
    const res = await send('Runtime.evaluate', {
      expression: `!!document.querySelector('.mapboxgl-canvas')`,
      returnByValue: true,
    });
    if (res.result.value) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  await new Promise((r) => setTimeout(r, 4000));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(`OK ${out} (${w}x${h}, theme=${theme})`);
  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
