/* Three independent, reversible strips. Original image bytes are untouched. */
(() => {
  'use strict';
  class AtlasPhotoStrips {
    constructor(element, photos, { onOpen, positions = [], paused = false } = {}) {
      this.element = element;
      this.photos = photos;
      this.onOpen = onOpen;
      this.paused = paused;
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
      this.rows = [];
      this.keyboardNavigation = false;
      this.onKeyboard = event => { if (event.key === 'Tab') this.keyboardNavigation = true; };
      this.onPointer = () => { this.keyboardNavigation = false; this.rows.forEach(row => { row.focused = false; }); };
      window.addEventListener('keydown', this.onKeyboard, true);
      window.addEventListener('pointerdown', this.onPointer, true);
      for (let number = 0; number < 3; number++) {
        const row = document.createElement('div');
        row.className = 'photograph-strip';
        row.tabIndex = 0;
        row.setAttribute('role', 'group');
        row.setAttribute('aria-label', `Photograph strip ${number + 1}. Scroll horizontally to explore.`);
        const track = document.createElement('div'); track.className = 'photograph-strip-track'; row.append(track);
        const model = { element: row, track, width: 0, ratio: positions[number] || 0, hovered: false, focused: false, pointer: null, holdUntil: 0, direction: number === 1 ? -1 : 1 };
        const members = photos.map((photo, index) => ({ photo, index })).filter(item => item.index % 3 === number);
        for (let copy = 0; copy < 3; copy++) {
          const group = document.createElement('div'); group.className = 'photograph-strip-group';
          if (copy !== 1) group.setAttribute('aria-hidden', 'true');
          members.forEach(({ photo, index }) => {
            const button = document.createElement('button'); button.type = 'button';
            button.className = 'strip-photograph';
            button.dataset.photograph = photo.id;
            button.dataset.ratio = photo.width / photo.height;
            button.dataset.original = String(copy === 1);
            button.setAttribute('aria-label', `Open photograph ${index + 1}`);
            if (copy !== 1) button.tabIndex = -1;
            const image = document.createElement('img');
            image.src = window.atlasMediaURL(photo.src); image.alt = ''; image.width = photo.width; image.height = photo.height;
            image.decoding = 'async'; image.loading = copy === 1 ? 'eager' : 'lazy'; image.draggable = false;
            button.append(image);
            button.addEventListener('click', event => {
              if (model.suppressClick) { event.preventDefault(); return; }
              this.onOpen?.(index);
            });
            group.append(button);
          });
          track.append(group);
        }
        row.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') model.hovered = true; });
        row.addEventListener('pointerleave', () => { model.hovered = false; });
        row.addEventListener('focusin', () => { model.focused = this.keyboardNavigation; });
        row.addEventListener('focusout', () => { requestAnimationFrame(() => { model.focused = this.keyboardNavigation && row.contains(document.activeElement); }); });
        row.addEventListener('wheel', event => {
          event.preventDefault(); row.scrollLeft += event.deltaX || event.deltaY; model.holdUntil = performance.now() + 1800;
        }, { passive: false });
        row.addEventListener('pointerdown', event => {
          model.focused = false;
          model.pointer = { x: event.clientX, scroll: row.scrollLeft, moved: false, type: event.pointerType, id: event.pointerId };
          model.suppressClick = false;
        });
        row.addEventListener('pointermove', event => {
          const pointer = model.pointer;
          if (!pointer) return;
          const delta = event.clientX - pointer.x;
          if (Math.abs(delta) > 6) {
            pointer.moved = true; model.suppressClick = true;
            if (pointer.type === 'mouse') {
              row.setPointerCapture(pointer.id); row.scrollLeft = pointer.scroll - delta;
            }
          }
        });
        const release = () => {
          model.pointer = null; model.holdUntil = performance.now() + 1500;
          setTimeout(() => { model.suppressClick = false; }, 0);
        };
        row.addEventListener('pointerup', release);
        row.addEventListener('pointercancel', release);
        row.addEventListener('lostpointercapture', release);
        row.addEventListener('keydown', event => {
          if (event.target === row && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
            event.preventDefault(); row.scrollLeft += row.clientWidth * (event.key === 'ArrowRight' ? .35 : -.35);
            model.holdUntil = performance.now() + 1800;
          }
        });
        this.rows.push(model); element.append(row);
      }
      this.observer = new ResizeObserver(() => this.layout()); this.observer.observe(element); this.layout();
      this.lastFrame = performance.now();
      const animate = time => {
        const dt = Math.min(time - this.lastFrame, 50); this.lastFrame = time;
        this.rows.forEach(row => {
          const stopped = this.paused || this.suspended || this.reduced.matches || document.hidden || row.hovered || row.focused || row.pointer || time < row.holdUntil;
          row.element.dataset.paused = String(!!stopped);
          row.element.dataset.focused = String(row.focused);
          if (!stopped && row.width) {
            row.position = (row.position ?? row.element.scrollLeft) + row.direction * dt * .028;
            if (row.position >= row.width * 2) row.position -= row.width;
            if (row.position < row.width * .2) row.position += row.width;
            row.element.scrollLeft = row.position;
          } else row.position = row.element.scrollLeft;
        });
        this.frame = requestAnimationFrame(animate);
      };
      this.frame = requestAnimationFrame(animate);
    }
    layout() {
      this.rows.forEach(row => {
        const height = row.element.clientHeight;
        if (!height) return;
        if (row.width) row.ratio = ((row.element.scrollLeft % row.width) + row.width) % row.width / row.width;
        row.track.querySelectorAll('.strip-photograph').forEach(button => { button.style.width = `${height * Number(button.dataset.ratio)}px`; });
        row.width = row.track.firstElementChild.getBoundingClientRect().width;
        if (row.width) { row.position = row.width * (1 + row.ratio); row.element.scrollLeft = row.position; }
      });
    }
    setPaused(value) { this.paused = value; }
    setSuspended(value) { this.suspended = value; }
    destroy() {
      cancelAnimationFrame(this.frame); this.observer.disconnect();
      window.removeEventListener('keydown', this.onKeyboard, true);
      window.removeEventListener('pointerdown', this.onPointer, true);
      return this.rows.map(row => row.width ? ((row.element.scrollLeft % row.width) + row.width) % row.width / row.width : 0);
    }
  }
  window.AtlasPhotoStrips = AtlasPhotoStrips;
})();
