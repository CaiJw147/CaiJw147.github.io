/* The cover is released only after the generated, allowlisted asset manifest
 * has downloaded, passed integrity checks, and decoded its images. */
(() => {
  'use strict';
  const screen = document.getElementById('loading-screen');
  const progress = document.getElementById('loading-progress');
  const percent = document.getElementById('loading-percent');
  const message = document.getElementById('loading-message');
  const retry = document.getElementById('loading-retry');
  const atlas = document.getElementById('atlas');
  const completed = new Set();
  const loadedBytes = new Map();
  const images = new Map();
  const media = new Map();
  let manifest;
  const turntable = document.getElementById('loading-character');
  const turnContext = turntable.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let turnFrame;
  function rotate(time) {
    turnContext.clearRect(0, 0, 224, 224);
    window.drawAtlasTurntable?.(turnContext, 112, 178, reduced.matches ? 0 : time / 1100, 1.7);
    if (!screen.hidden) turnFrame = requestAnimationFrame(rotate);
  }
  turnFrame = requestAnimationFrame(rotate);
  let resolveReady;
  let running = false;
  let requiresReload = false;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const diagnostics = { state: 'loading', loaded: 0, total: 0, verifiedBytes: 0, failures: 0 };
  window.atlasLoading = { ready, images, media, diagnostics };
  // Retain verified compressed bytes for this document's lifetime. Chapters
  // use these Blob URLs, independent of HTTP cache eviction or revalidation.
  window.atlasMediaURL = path => window.atlasLoading.media.get(path) || path;

  function update() {
    const totalBytes = manifest?.assets.reduce((sum, asset) => sum + asset.bytes, 0) || 1;
    const bytes = [...loadedBytes.values()].reduce((sum, value) => sum + value, 0);
    // Verification/decoding is part of completion, not just byte transfer.
    const ratio = manifest ? (bytes / totalBytes * .88 + completed.size / manifest.assets.length * .12) : 0;
    const value = Math.min(99, Math.floor(ratio * 100));
    progress.value = value;
    percent.textContent = `${value}%`;
    diagnostics.loaded = completed.size;
    diagnostics.total = manifest?.assets.length || 0;
  }

  async function download(asset) {
    const response = await fetch(asset.url, { cache: diagnostics.failures ? 'reload' : 'force-cache', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('Asset unavailable');
    const reader = response.body?.getReader();
    const chunks = [];
    let received = 0;
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        loadedBytes.set(asset.url, Math.min(received, asset.bytes));
        update();
      }
    } else {
      const value = new Uint8Array(await response.arrayBuffer());
      chunks.push(value);
      received = value.byteLength;
    }
    if (received !== asset.bytes) throw new Error('Incomplete asset');
    const blob = new Blob(chunks, { type: asset.type });
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== asset.sha256) throw new Error('Asset changed');
    if (asset.type.startsWith('image/')) {
      // Decode with bounded concurrency and release large portfolio bitmaps.
      // Only the small world sprites stay decoded for the Canvas renderer.
      if (asset.url.startsWith('assets/world/')) {
        const image = new Image();
        image.src = asset.url;
        await image.decode();
        images.set(asset.url, image);
      } else if ('createImageBitmap' in window) {
        const bitmap = await createImageBitmap(blob);
        bitmap.close();
      } else {
        const localURL = URL.createObjectURL(blob);
        try {
          const image = new Image();
          image.src = localURL;
          await image.decode();
        } finally { URL.revokeObjectURL(localURL); }
      }
      if (asset.url.startsWith('media/')) media.set(asset.url, URL.createObjectURL(blob));
    }
    loadedBytes.set(asset.url, asset.bytes);
    completed.add(asset.url);
    diagnostics.verifiedBytes += asset.bytes;
    update();
  }

  async function start() {
    if (running) return;
    running = true;
    retry.hidden = true;
    screen.setAttribute('aria-busy', 'true');
    diagnostics.state = 'loading';
    message.textContent = 'Preparing the river';
    try {
      if (!manifest) {
        const response = await fetch('asset-manifest.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('Manifest unavailable');
        const fullManifest = await response.json();
        window.atlasLoading.assets = fullManifest.assets;
        diagnostics.lazy = fullManifest.assets.filter(asset => asset.critical === false).length;
        manifest = { ...fullManifest, assets: fullManifest.assets.filter(asset => asset.critical !== false) };
      }
      const queue = manifest.assets.filter(asset => !completed.has(asset.url));
      const failures = [];
      let cursor = 0;
      async function worker() {
        while (cursor < queue.length) {
          const asset = queue[cursor++];
          try { await download(asset); }
          catch { loadedBytes.delete(asset.url); failures.push(asset.url); }
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
      if (failures.length) throw new Error('Some assets could not load');
      await document.fonts.ready;
      if (!window.atlasReader || !window.createAtlasWorld) {
        requiresReload = true;
        throw new Error('Interface unavailable');
      }
      diagnostics.state = 'prepared';
      message.textContent = 'The river is ready';
      resolveReady();
    } catch {
      diagnostics.failures++;
      diagnostics.state = 'error';
      screen.setAttribute('aria-busy', 'false');
      message.textContent = 'Some files could not load. Please try again.';
      retry.hidden = false;
      retry.focus({ preventScroll: true });
    } finally { running = false; }
  }

  let reviewContinue;
  window.atlasLoading.reveal = () => {
    progress.value = 100;
    percent.textContent = '100%';
    diagnostics.state = 'ready';
    screen.setAttribute('aria-busy', 'false');
    if (new URLSearchParams(location.search).get('review') === 'loading') {
      if (!reviewContinue) {
        reviewContinue = document.createElement('button'); reviewContinue.className = 'loading-review-continue'; reviewContinue.textContent = 'Continue to the cover';
        reviewContinue.addEventListener('click', () => { const url = new URL(location.href); url.searchParams.delete('review'); history.replaceState(history.state, '', url); window.atlasLoading.reveal(); });
        screen.append(reviewContinue);
      }
      return;
    }
    atlas.inert = false;
    atlas.removeAttribute('aria-hidden');
    screen.hidden = true;
    cancelAnimationFrame(turnFrame);
    document.getElementById('play').focus({ preventScroll: true });
  };
  retry.addEventListener('click', () => requiresReload ? location.reload() : start());
  start();
})();
