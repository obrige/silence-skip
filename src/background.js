const api = typeof browser !== 'undefined' ? browser : chrome;
const isFirefox = typeof browser !== 'undefined';
const tabs = new Map();
async function getMedia(tabId) {
  if (isFirefox) {
    // Firefox: tabCapture.capture() returns a MediaStream of the active tab directly.
    // Note: Firefox captures the currently active tab, not a specified tabId.
    return api.tabCapture.capture({ audio: true, video: false });
  }
  if (api.tabCapture && api.tabCapture.getMediaStreamId) {
    const streamId = await api.tabCapture.getMediaStreamId({ tabId });
    return navigator.mediaDevices.getUserMedia({ audio: { mandatory: { chromeMediaSourceId: streamId, chromeMediaSource: 'tab' } } });
  }
  return api.tabCapture.capture(tabId, { audio: true, video: false });
}
function setupAnalyser(stream) {
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0;
  src.connect(analyser);
  return { ctx, analyser, data: new Float32Array(analyser.fftSize), stream, enabled: true, silenceStartT: null, lastSkipAt: 0, thresholdDB: -45, minSilenceMs: 300, jumpMs: 1000, skipped: 0 };
}
async function startCapture(tabId) {
  try {
    if (!api.tabCapture) { console.error('[silence-skip] tabCapture API not available'); return null; }
    const stream = await getMedia(tabId);
    const state = setupAnalyser(stream);
    tabs.set(tabId, state);
    tick(tabId);
    return state;
  } catch (e) {
    console.error('[silence-skip] capture failed:', e);
    return null;
  }
}
function tick(tabId) {
  const s = tabs.get(tabId);
  if (!s || !s.enabled) return;
  if (s.analyser && s.data) {
    s.analyser.getFloatTimeDomainData(s.data);
    let sum = 0;
    for (let i = 0; i < s.data.length; i++) sum += s.data[i] * s.data[i];
    const rms = Math.sqrt(sum / s.data.length);
    const thr = Math.pow(10, s.thresholdDB / 20);
    api.tabs.sendMessage(tabId, { type: 'rms', rms, db: 20 * Math.log10(rms || 1e-10) }).catch(() => {});
    if (rms < thr) {
      if (s.silenceStartT === null) s.silenceStartT = performance.now();
      const silenceDur = performance.now() - s.silenceStartT;
      if (silenceDur > s.minSilenceMs + 150 && (performance.now() - s.lastSkipAt) > 350) {
        api.tabs.sendMessage(tabId, { type: 'skip', jumpMs: s.jumpMs }).catch(() => {});
        s.lastSkipAt = performance.now();
        s.silenceStartT = performance.now();
        s.skipped++;
      }
    } else { s.silenceStartT = null; }
  }
  setTimeout(() => tick(tabId), 60);
}
api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : undefined;
  if (!tabId) return;
  if (msg.type === 'init') {
    if (!tabs.has(tabId)) startCapture(tabId).then(s => sendResponse({ ok: !!s }));
    else sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'toggle') { const s = tabs.get(tabId); if (s) { s.enabled = !s.enabled; sendResponse({ enabled: s.enabled }); } }
  if (msg.type === 'set-threshold') { const s = tabs.get(tabId); if (s) s.thresholdDB = msg.value; }
  if (msg.type === 'set-minsilence') { const s = tabs.get(tabId); if (s) s.minSilenceMs = msg.value; }
  if (msg.type === 'set-jump') { const s = tabs.get(tabId); if (s) s.jumpMs = msg.value; }
});
api.tabs.onRemoved.addListener((tabId) => {
  const s = tabs.get(tabId);
  if (s) { s.stream ? s.stream.getTracks().forEach(t => t.stop()) : null; s.ctx ? s.ctx.close() : null; tabs.delete(tabId); }
});
