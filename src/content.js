const api = typeof browser !== 'undefined' ? browser : chrome;
if (window.__silenceSkipInjected) { } else {
  window.__silenceSkipInjected = true;
  const state = {
    enabled: true, skipped: 0, savedSec: 0, rms: 0, db: -60,
    thresholdDB: -40, minSilenceMs: 400, jumpMs: 800,
    video: null, audioCtx: null, analyser: null, data: null,
    silenceStartT: null, lastSkipAt: 0, running: false,
    panelInjected: false
  };

  function hasMedia() {
    return !!(document.querySelector('video') || document.querySelector('audio'));
  }

  function tryInject() {
    if (state.panelInjected || !hasMedia()) return;
    state.panelInjected = true;
    injectUI();
  }

  function watchVideo() {
    if (state.video) return;
    const v = document.querySelector('video') || document.querySelector('audio');
    if (v) {
      state.video = v;
      v.addEventListener('play', startAnalysis);
      if (!v.paused) startAnalysis();
    }
  }

  function startAnalysis() {
    if (state.analyser || !state.video) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const src = ctx.createMediaElementSource(state.video);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      if (ctx.state === 'suspended') ctx.resume();
      state.audioCtx = ctx;
      state.analyser = analyser;
      state.data = new Float32Array(analyser.fftSize);
      state.running = true;
      console.log('[silence-skip] audio analysis started');
      tick();
    } catch (e) {
      console.error('[silence-skip] audio analysis failed:', e);
    }
  }

  function tick() {
    if (!state.running) return;
    const v = state.video;
    if (v && state.enabled && !v.paused && state.analyser && state.data) {
      state.analyser.getFloatTimeDomainData(state.data);
      let sum = 0;
      for (let i = 0; i < state.data.length; i++) sum += state.data[i] * state.data[i];
      const rms = Math.sqrt(sum / state.data.length);
      state.rms = rms;
      state.db = 20 * Math.log10(rms || 1e-10);
      updateMeter();
      const thr = Math.pow(10, state.thresholdDB / 20);
      if (rms < thr) {
        if (state.silenceStartT === null) state.silenceStartT = performance.now();
        const silenceDur = performance.now() - state.silenceStartT;
        if (silenceDur > state.minSilenceMs + 150 && (performance.now() - state.lastSkipAt) > 350) {
          const from = v.currentTime;
          const target = Math.min(from + (state.jumpMs / 1000), v.duration - 0.05);
          v.currentTime = target;
          state.skipped++;
          state.savedSec += (target - from);
          state.lastSkipAt = performance.now();
          state.silenceStartT = performance.now();
          updateStats();
        }
      } else { state.silenceStartT = null; }
    }
    setTimeout(tick, 60);
  }

  // 初始检测 + 动态检测（SPA 页面视频可能后加载）
  tryInject();
  const mediaObserver = new MutationObserver(() => { tryInject(); watchVideo(); });
  mediaObserver.observe(document.documentElement, { childList: true, subtree: true });
  watchVideo();

  function injectUI() {
    const panel = document.createElement('div');
    panel.id = 'silence-skip-panel';
    panel.innerHTML = '<div class="ssp-header"><div class="ssp-logo">⏭</div><span class="ssp-title">Silence Skip</span><span class="ssp-state-dot active" id="ssp-state"></span><span class="ssp-toggle" id="ssp-toggle">▾</span><span class="ssp-mini-info" id="ssp-mini-info">0跳</span></div><div class="ssp-body" id="ssp-body"><div class="ssp-row"><label>阈值</label><input type="range" id="ssp-threshold" min="0" max="100" value="50"><span class="ssp-value" id="ssp-threshold-val">-40 dB</span></div><div class="ssp-row"><label>静音</label><input type="range" id="ssp-minsilence" min="100" max="2000" value="400"><span class="ssp-value" id="ssp-minsilence-val">400 ms</span></div><div class="ssp-row"><label>跳步</label><input type="range" id="ssp-jump" min="300" max="3000" value="800"><span class="ssp-value" id="ssp-jump-val">0.8 s</span></div><div class="ssp-meter"><div class="ssp-meter-fill" id="ssp-meter-fill"></div></div><div class="ssp-stats"><div class="ssp-stat"><div class="ssp-stat-value" id="ssp-skipped">0</div><div class="ssp-stat-label">跳过</div></div><div class="ssp-stat"><div class="ssp-stat-value success" id="ssp-saved">0.0s</div><div class="ssp-stat-label">节省</div></div></div><button class="ssp-btn ssp-btn-primary active" id="ssp-toggle-btn">跳过静音：开</button><div class="ssp-actions-row"><button class="ssp-btn ssp-btn-ghost" id="ssp-jump-btn">下个有声点</button><button class="ssp-btn ssp-btn-ghost" id="ssp-skip10">+10秒</button></div></div>';
    document.body.appendChild(panel);
    bindEvents();
  }
  function bindEvents() {
    const $ = id => document.getElementById(id);
    const ssp_thr = $('ssp-threshold'), ssp_min = $('ssp-minsilence'), ssp_jmp = $('ssp-jump');
    function syncThr() { const v = parseFloat(ssp_thr.value); state.thresholdDB = -60 + (v / 100) * 40; $('ssp-threshold-val').textContent = state.thresholdDB.toFixed(0) + ' dB'; }
    function syncMin() { state.minSilenceMs = parseFloat(ssp_min.value); $('ssp-minsilence-val').textContent = state.minSilenceMs + ' ms'; }
    function syncJmp() { state.jumpMs = parseFloat(ssp_jmp.value); $('ssp-jump-val').textContent = (state.jumpMs / 1000).toFixed(1) + ' s'; }
    ssp_thr.addEventListener('input', syncThr); ssp_min.addEventListener('input', syncMin); ssp_jmp.addEventListener('input', syncJmp);
    syncThr(); syncMin(); syncJmp();
    $('ssp-toggle-btn').addEventListener('click', () => {
      state.enabled = !state.enabled;
      const btn = $('ssp-toggle-btn');
      btn.textContent = state.enabled ? '跳过静音：开' : '跳过静音：关';
      btn.classList.toggle('active', state.enabled);
      $('ssp-state').className = 'ssp-state-dot ' + (state.enabled ? 'active' : 'idle');
    });
    $('ssp-jump-btn').addEventListener('click', () => { const v = state.video; if (v) v.currentTime = Math.min(v.currentTime + 3, v.duration - 0.05); });
    $('ssp-skip10').addEventListener('click', () => { const v = state.video; if (v) v.currentTime = Math.min(v.currentTime + 10, v.duration - 0.05); });
    $('ssp-toggle').addEventListener('click', () => {
      $('ssp-body').classList.toggle('collapsed');
      $('ssp-toggle').textContent = $('ssp-body').classList.contains('collapsed') ? '▴' : '▾';
    });
    document.addEventListener('fullscreenchange', () => {
      const panel = $('ssp-mini-info').parentElement.parentElement;
      const fsEl = document.fullscreenElement;
      if (fsEl) { panel.classList.add('ssp-watermark'); fsEl.appendChild(panel); panel.style.position = 'absolute'; }
      else { panel.classList.remove('ssp-watermark'); document.body.appendChild(panel); panel.style.position = 'fixed'; }
    });
  }
  function updateMeter() {
    const el = document.getElementById('ssp-meter-fill'); if (!el) return;
    const pct = Math.max(0, Math.min(100, ((state.db + 60) / 60) * 100));
    el.style.width = pct + '%';
    const mini = document.getElementById('ssp-mini-info'); if (mini) mini.textContent = state.skipped + '跳';
  }
  function updateStats() {
    const sk = document.getElementById('ssp-skipped'); const sv = document.getElementById('ssp-saved');
    if (sk) sk.textContent = state.skipped;
    if (sv) sv.textContent = state.savedSec.toFixed(1) + 's';
    const mini = document.getElementById('ssp-mini-info'); if (mini) mini.textContent = state.skipped + '跳';
  }
}
