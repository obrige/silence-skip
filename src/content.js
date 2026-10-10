const api = typeof browser !== 'undefined' ? browser : chrome;
if (window.__silenceSkipInjected) { } else {
  window.__silenceSkipInjected = true;
  const state = { enabled: true, skipped: 0, savedSec: 0, rms: 0, db: -60, thresholdDB: -45, minSilenceMs: 300, jumpMs: 1000, video: null };
  function watchVideo() {
    if (state.video) return;
    const v = document.querySelector('video');
    if (v) { state.video = v; v.addEventListener('play', () => api.runtime.sendMessage({ type: 'init' }).catch(() => {})); }
  }
  new MutationObserver(watchVideo).observe(document.body, { childList: true, subtree: true });
  watchVideo();
  api.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'rms') { state.rms = msg.rms; state.db = msg.db; updateMeter(); }
    else if (msg.type === 'skip') {
      const v = state.video; if (!v) return;
      const from = v.currentTime;
      const target = Math.min(from + (msg.jumpMs / 1000), v.duration - 0.05);
      v.currentTime = target; state.skipped++; state.savedSec += (target - from); updateStats();
    }
  });
  injectUI();
  function injectUI() {
    const panel = document.createElement('div');
    panel.id = 'silence-skip-panel';
    panel.innerHTML = '<div class="ssp-header"><div class="ssp-logo">SKIP</div><span class="ssp-title">Silence Skip</span><span class="ssp-state-dot active" id="ssp-state"></span><span class="ssp-toggle" id="ssp-toggle">v</span></div><div class="ssp-body" id="ssp-body"><div class="ssp-row"><label>THR</label><input type="range" id="ssp-threshold" min="0" max="100" value="60"><span class="ssp-value" id="ssp-threshold-val">-36 dB</span></div><div class="ssp-row"><label>MIN</label><input type="range" id="ssp-minsilence" min="100" max="2000" value="300"><span class="ssp-value" id="ssp-minsilence-val">300 ms</span></div><div class="ssp-row"><label>JMP</label><input type="range" id="ssp-jump" min="300" max="3000" value="1000"><span class="ssp-value" id="ssp-jump-val">1.0 s</span></div><div class="ssp-meter"><div class="ssp-meter-fill" id="ssp-meter-fill"></div></div><div class="ssp-stats"><div class="ssp-stat"><div class="ssp-stat-value" id="ssp-skipped">0</div><div class="ssp-stat-label">SKIP</div></div><div class="ssp-stat"><div class="ssp-stat-value success" id="ssp-saved">0.0s</div><div class="ssp-stat-label">SAVE</div></div></div><button class="ssp-btn ssp-btn-primary active" id="ssp-toggle-btn">Skip: ON</button><div class="ssp-actions-row"><button class="ssp-btn ssp-btn-ghost" id="ssp-jump-btn">Next</button><button class="ssp-btn ssp-btn-ghost" id="ssp-skip10">+10s</button></div></div><span class="ssp-mini-info" id="ssp-mini-info">0</span>';
    document.body.appendChild(panel);
    bindEvents();
    api.runtime.sendMessage({ type: 'init' }).catch(() => {});
  }
  function bindEvents() {
    const $ = id => document.getElementById(id);
    const ssp_thr = $('ssp-threshold'), ssp_min = $('ssp-minsilence'), ssp_jmp = $('ssp-jump');
    function syncThr() { const v = parseFloat(ssp_thr.value); state.thresholdDB = -60 + (v / 100) * 40; $('ssp-threshold-val').textContent = state.thresholdDB.toFixed(0) + ' dB'; api.runtime.sendMessage({ type: 'set-threshold', value: state.thresholdDB }); }
    function syncMin() { state.minSilenceMs = parseFloat(ssp_min.value); $('ssp-minsilence-val').textContent = state.minSilenceMs + ' ms'; api.runtime.sendMessage({ type: 'set-minsilence', value: state.minSilenceMs }); }
    function syncJmp() { state.jumpMs = parseFloat(ssp_jmp.value); $('ssp-jump-val').textContent = (state.jumpMs / 1000).toFixed(1) + ' s'; api.runtime.sendMessage({ type: 'set-jump', value: state.jumpMs }); }
    ssp_thr.addEventListener('input', syncThr); ssp_min.addEventListener('input', syncMin); ssp_jmp.addEventListener('input', syncJmp);
    syncThr(); syncMin(); syncJmp();
    $('ssp-toggle-btn').addEventListener('click', () => {
      api.runtime.sendMessage({ type: 'toggle' }, (resp) => {
        state.enabled = resp?.enabled ?? false;
        const btn = $('ssp-toggle-btn');
        btn.textContent = state.enabled ? 'Skip: ON' : 'Skip: OFF';
        btn.classList.toggle('active', state.enabled);
        $('ssp-state').className = 'ssp-state-dot ' + (state.enabled ? 'active' : 'idle');
      });
    });
    $('ssp-jump-btn').addEventListener('click', () => { const v = state.video; if (v) v.currentTime = Math.min(v.currentTime + 3, v.duration - 0.05); });
    $('ssp-skip10').addEventListener('click', () => { const v = state.video; if (v) v.currentTime = Math.min(v.currentTime + 10, v.duration - 0.05); });
    $('ssp-toggle').addEventListener('click', () => { $('ssp-body').classList.toggle('collapsed'); $('ssp-toggle').textContent = $('ssp-body').classList.contains('collapsed') ? '^' : 'v'; });
    document.addEventListener('fullscreenchange', () => {
      const panel = $('ssp-mini-info').parentElement;
      const fsEl = document.fullscreenElement;
      if (fsEl) { panel.classList.add('ssp-watermark'); fsEl.appendChild(panel); panel.style.position = 'absolute'; }
      else { panel.classList.remove('ssp-watermark'); document.body.appendChild(panel); panel.style.position = 'fixed'; }
    });
  }
  function updateMeter() { const el = document.getElementById('ssp-meter-fill'); if (!el) return; const pct = Math.max(0, Math.min(100, ((state.db + 60) / 60) * 100)); el.style.width = pct + '%'; const mini = document.getElementById('ssp-mini-info'); if (mini) mini.textContent = state.skipped; }
  function updateStats() { const sk = document.getElementById('ssp-skipped'); const sv = document.getElementById('ssp-saved'); if (sk) sk.textContent = state.skipped; if (sv) sv.textContent = state.savedSec.toFixed(1) + 's'; const mini = document.getElementById('ssp-mini-info'); if (mini) mini.textContent = state.skipped; }
}