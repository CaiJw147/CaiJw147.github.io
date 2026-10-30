/* A spacious eye-shaped field with a fixed opening scale. */
(() => {
  'use strict';
  const DEFAULT_SCALE = .68;
  const COLUMN_STEP = 362;
  const ROW_STEP = 217;
  function stableHash(value) {
    let hash = 2166136261;
    for (const letter of value) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619);
    return hash >>> 0;
  }
  function textWeight(entry) {
    return Math.max(entry.caption.replace(/\s/g, '').length, (entry.translation || '').length * .44);
  }
  function positions(entries) {
    const rows = [3, 6, 9, 6, 3];
    while (rows.reduce((a, b) => a + b, 0) < entries.length) rows[2] += 2;
    const slots = rows.flatMap((count, row) => Array.from({ length: count }, (_, column) => {
      const columnOffset = column - (count - 1) / 2, rowOffset = row - 2;
      const x = columnOffset * COLUMN_STEP, y = rowOffset * ROW_STEP;
      // Retain the earlier tie order while changing only spatial distances.
      const tie = stableHash(`${columnOffset * 342}:${rowOffset * 204}`);
      return { x, y, row, tie, distance: columnOffset ** 2 + rowOffset ** 2 };
    })).sort((a, b) => a.distance - b.distance || a.tie - b.tie);
    const featured = window.ATLAS_CONTENT.journalPresentation;
    const priority = [featured.center_entry, ...featured.featured_entries];
    const rank = entry => priority.includes(entry.id) ? priority.indexOf(entry.id) : priority.length;
    const ranked = [...entries].sort((a, b) => rank(a) - rank(b) || textWeight(b) - textWeight(a) || stableHash(a.id) - stableHash(b.id));
    const placed = new Map();
    ranked.forEach((entry, index) => placed.set(entry.id, { ...slots[index], peripheral: index >= Math.ceil(entries.length * .7) }));
    return placed;
  }
  function previewImages(entry) {
    const horizontal = entry.images.findIndex(image => image.width > image.height);
    const main = Number.isInteger(entry.coverIndex) ? entry.coverIndex : horizontal >= 0 ? horizontal : 0;
    if (entry.images.length < 4) return [main];
    const rest = entry.images.map((image, index) => index).filter(index => index !== main);
    return [main, ...rest.slice(0, 3)];
  }
  class AtlasJournalSpace {
    constructor(viewport, entries, { onOpen } = {}) {
      this.viewport = viewport;
      this.entries = entries;
      this.onOpen = onOpen;
      // Chapter entry always uses the owner's reference size, independent of
      // prior zoom, Fit all, viewport dimensions, and saved reading state.
      this.transform = { x: 0, y: 0, scale: DEFAULT_SCALE };
      this.world = document.createElement('div'); this.world.className = 'journal-space-world'; viewport.append(this.world);
      this.items = [];
      const arrangement = positions(entries);
      entries.forEach(entry => {
          const { x, y, peripheral, distance, row } = arrangement.get(entry.id);
          const item = document.createElement('button'); item.type = 'button'; item.className = 'journal-cover-cluster';
          item.dataset.entry = entry.id;
          item.dataset.peripheral = String(peripheral); item.dataset.distance = String(distance);
          item.dataset.row = String(row); item.dataset.textWeight = String(textWeight(entry));
          const date = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Shanghai' }).format(new Date((entry.displayDate || entry.published).replace(' ', 'T') + '+08:00'));
          item.setAttribute('aria-label', `Open Journal entry from ${date}`);
          const width = 324, height = 174;
          item.style.left = `${x}px`; item.style.top = `${y}px`; item.style.width = `${width}px`; item.style.height = `${height}px`;
          const mosaic = document.createElement('span'); mosaic.className = 'journal-cover-mosaic' + (entry.images.length < 4 ? ' is-single' : '');
          previewImages(entry).forEach((imageIndex, index) => {
            const image = entry.images[imageIndex];
            const frame = document.createElement('span'); frame.className = index ? 'journal-cover-detail' : 'journal-cover-main';
            frame.dataset.entryImage = String(imageIndex);
            const img = document.createElement('img'); img.src = window.atlasMediaURL(image.src); img.alt = ''; img.width = image.width; img.height = image.height;
            img.style.objectPosition = image.previewPosition || '50% 50%';
            img.draggable = false; img.decoding = 'async'; frame.append(img); mosaic.append(frame);
          });
          item.append(mosaic);
          const content = entry.parts ? entry.parts[entry.previewPart ?? 0] : entry;
          const details = document.createElement('span'); details.className = 'journal-preview-details';
          const excerpt = document.createElement('span'); excerpt.className = 'journal-preview-excerpt'; excerpt.lang = 'en'; excerpt.dataset.copyId = 'journal.' + content.id + (content.translation ? '.english' : '.original');
          excerpt.textContent = (window.atlasCopy?.text('journal.' + content.id + (content.translation ? '.english' : '.original'), content.translation || content.caption) || '').replace(/\s+/g, ' ').trim();
          details.append(excerpt);
          if (content.likes !== null && content.likes !== undefined) {
            const likes = document.createElement('span'); likes.className = 'journal-preview-likes'; likes.textContent = `♡ ${content.likes}`; details.append(likes);
          }
          item.append(details);
          const placePreview = () => {
            const panel = viewport.getBoundingClientRect(), bounds = item.getBoundingClientRect();
            const apparentScale = Math.max(.8, this.transform.scale);
            item.classList.toggle('preview-above', bounds.bottom + 44 * apparentScale > panel.bottom - 8);
            item.classList.toggle('preview-align-end', bounds.left + width * apparentScale > panel.right - 8);
          };
          item.addEventListener('pointerenter', placePreview);
          item.addEventListener('click', event => {
            if (this.suppressClick && event.detail !== 0) { event.preventDefault(); return; }
            const image = Number(event.target.closest('[data-entry-image]')?.dataset.entryImage ?? previewImages(entry)[0]);
            onOpen?.(entry, image);
          });
          item.addEventListener('focus', () => {
            if (!item.matches(':focus-visible')) return;
            const bounds = item.getBoundingClientRect(), panel = viewport.getBoundingClientRect();
            if (bounds.left < panel.left + 25 || bounds.right > panel.right - 25 || bounds.top < panel.top + 25 || bounds.bottom > panel.bottom - 25) {
              this.transform.x = -x * this.transform.scale; this.transform.y = -y * this.transform.scale; this.render();
            }
            placePreview();
          });
          this.world.append(item); this.items.push({ element: item, x, y, width, height });
      });
      viewport.tabIndex = 0; viewport.setAttribute('role', 'region');
      viewport.setAttribute('aria-label', 'Journal image constellation. Drag to explore, scroll to zoom, or tab through the entries.');
      viewport.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        if (event.pointerType === 'mouse') event.preventDefault();
        this.pointer = { x: event.clientX, y: event.clientY, from: { ...this.transform }, id: event.pointerId };
        this.suppressClick = false;
      });
      viewport.addEventListener('pointermove', event => {
        if (!this.pointer) return;
        const dx = event.clientX - this.pointer.x, dy = event.clientY - this.pointer.y;
        if (Math.hypot(dx, dy) > 6) {
          event.preventDefault();
          this.suppressClick = true; viewport.setPointerCapture(this.pointer.id);
          this.transform.x = this.pointer.from.x + dx; this.transform.y = this.pointer.from.y + dy;
          viewport.classList.add('is-dragging'); this.render();
        }
      });
      const release = () => {
        this.pointer = null; viewport.classList.remove('is-dragging');
      };
      viewport.addEventListener('dragstart', event => event.preventDefault());
      viewport.addEventListener('selectstart', event => event.preventDefault());
      viewport.addEventListener('pointerup', release); viewport.addEventListener('pointercancel', release); viewport.addEventListener('lostpointercapture', release);
      viewport.addEventListener('wheel', event => {
        event.preventDefault();
        const rect = viewport.getBoundingClientRect();
        this.zoom(Math.exp(-event.deltaY * .0015), [event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2]);
      }, { passive: false });
      viewport.addEventListener('keydown', event => {
        if (event.target !== viewport) return;
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
          event.preventDefault();
          this.transform.x += event.key === 'ArrowLeft' ? 110 : event.key === 'ArrowRight' ? -110 : 0;
          this.transform.y += event.key === 'ArrowUp' ? 110 : event.key === 'ArrowDown' ? -110 : 0; this.render();
        }
      });
      this.observer = new ResizeObserver(() => this.render());
      this.observer.observe(viewport); this.render();
    }
    render() {
      const { x, y, scale } = this.transform;
      this.world.style.transform = `translate(${this.viewport.clientWidth / 2 + x}px, ${this.viewport.clientHeight / 2 + y}px) scale(${scale})`;
      this.world.style.setProperty('--preview-scale', String(Math.max(1, .8 / scale)));
    }
    zoom(factor, anchor = [0, 0]) {
      const old = this.transform.scale, scale = Math.min(1.8, Math.max(.08, old * factor));
      this.transform.x = anchor[0] - (anchor[0] - this.transform.x) * scale / old;
      this.transform.y = anchor[1] - (anchor[1] - this.transform.y) * scale / old;
      this.transform.scale = scale; this.render();
    }
    fit() {
      if (!this.items.length) return;
      const left = Math.min(...this.items.map(item => item.x - item.width / 2));
      const right = Math.max(...this.items.map(item => item.x + item.width / 2));
      const top = Math.min(...this.items.map(item => item.y - item.height / 2));
      const bottom = Math.max(...this.items.map(item => item.y + item.height / 2));
      const scale = Math.min((this.viewport.clientWidth - 55) / (right - left), (this.viewport.clientHeight - 55) / (bottom - top), 1);
      this.transform = { scale, x: -(left + right) / 2 * scale, y: -(top + bottom) / 2 * scale }; this.render();
    }
    destroy() { this.observer.disconnect(); return { ...this.transform }; }
  }
  window.AtlasJournalSpace = AtlasJournalSpace;
})();
