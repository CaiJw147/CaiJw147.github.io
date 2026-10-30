/* A small geographic tile viewport. No photograph coordinates are inferred. */
(() => {
  'use strict';
  const limit = (v, a, b) => Math.max(a, Math.min(b, v));
  class AtlasMap {
    constructor(element, { onPick, onSelect, kind = 'photographs' } = {}) {
      this.element = element;
      this.zoom = 10;
      this.center = [32.0603, 118.7969];
      this.locations = [];
      this.draft = null;
      this.selected = null;
      this.editing = false;
      this.areas = [];this.areaOrigin = null;
      this.onPick = onPick;
      this.onSelect = onSelect;
      this.kind = kind;
      element.dataset.mapLanguage = 'en';
      element.dataset.mapProvider = 'Esri World Street Map';
      this.tiles = new Map();
      this.element.innerHTML = '<div class="map-tiles" aria-hidden="true"></div><div class="map-markers"></div>' +
        '<div class="map-zoom"><button type="button" aria-label="Zoom in">+</button><button type="button" aria-label="Zoom out">−</button></div>' +
        '<div class="map-empty">No confirmed photograph locations yet</div>' +
        '<div class="map-offline" hidden>Map tiles could not load. Location review is still available.</div>' +
        '<div class="map-attribution"><a href="https://www.esri.com/en-us/legal/terms/data-attributions" target="_blank" rel="noopener">Tiles © Esri · Sources: Esri, HERE, Garmin, OpenStreetMap contributors</a></div>';
      if(kind === 'places') element.querySelector('.map-empty').textContent = 'Only confirmed area references appear here';
      this.tileLayer = element.querySelector('.map-tiles');
      this.markerLayer = element.querySelector('.map-markers');
      element.querySelectorAll('.map-zoom button').forEach((button, index) => {
        button.addEventListener('click', () => this.setZoom(this.zoom + (index ? -1 : 1)));
      });
      element.addEventListener('pointerdown', event => {
        if (event.target.closest('button,a')) return;
        this.drag = { x: event.clientX, y: event.clientY, center: this.project(this.center), moved: false };
        element.setPointerCapture(event.pointerId);
      });
      element.addEventListener('pointermove', event => {
        if (!this.drag) return;
        const dx = event.clientX - this.drag.x, dy = event.clientY - this.drag.y;
        if (Math.hypot(dx, dy) > 5) this.drag.moved = true;
        this.center = this.unproject([this.drag.center[0] - dx, this.drag.center[1] - dy]);
        this.render();
      });
      element.addEventListener('pointerup', event => {
        const drag = this.drag;
        this.drag = null;
        if (drag && !drag.moved && this.editing) {
          const rect = element.getBoundingClientRect();
          const center = this.project(this.center);
          this.onPick?.(this.unproject([center[0] + event.clientX - rect.left - rect.width / 2,
            center[1] + event.clientY - rect.top - rect.height / 2]));
        }
      });
      element.addEventListener('pointercancel', () => { this.drag = null; });
      element.addEventListener('lostpointercapture', () => { this.drag = null; });
      element.addEventListener('wheel', event => {
        event.preventDefault();
        if (Date.now() - (this.lastZoom || 0) < 160) return;
        this.lastZoom = Date.now();
        this.setZoom(this.zoom + (event.deltaY < 0 ? 1 : -1));
      }, { passive: false });
      element.tabIndex = 0;
      element.setAttribute('role', 'region');
      element.setAttribute('aria-label', (kind === 'places' ? 'Places map with English labels.' : 'Photograph locations map with English labels.') + ' Drag to move; plus and minus to zoom.');
      element.addEventListener('keydown', event => {
        if (event.target !== element) return;
        if (event.key === '+' || event.key === '=') this.setZoom(this.zoom + 1);
        else if (event.key === '-') this.setZoom(this.zoom - 1);
        else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          const point = this.project(this.center);
          point[0] += event.key === 'ArrowLeft' ? -90 : event.key === 'ArrowRight' ? 90 : 0;
          point[1] += event.key === 'ArrowUp' ? -90 : event.key === 'ArrowDown' ? 90 : 0;
          this.center = this.unproject(point);
          this.render();
        }
      });
      this.observer = new ResizeObserver(() => this.render());
      this.observer.observe(element);
      this.render();
    }
    project([lat, lng]) {
      const size = 256 * 2 ** this.zoom;
      const sine = Math.sin(limit(lat, -85.0511, 85.0511) * Math.PI / 180);
      return [(lng + 180) / 360 * size, (.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * size];
    }
    unproject([x, y]) {
      const size = 256 * 2 ** this.zoom;
      const lng = ((x / size * 360 - 180 + 540) % 360) - 180;
      const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * limit(y / size, 0, 1)))) * 180 / Math.PI;
      return [lat, lng];
    }
    setView(center, zoom = this.zoom) {
      this.center = [...center];
      this.zoom = limit(zoom, 2, 18);
      this.render();
    }
    setZoom(zoom) { this.zoom = limit(zoom, 2, 18); this.render(); }
    setAreas(areas, origin) { this.areas=areas;this.areaOrigin=origin;this.render(); }
    fitAreas(){
      if(!this.areas.length)return;
      for(let zoom=12;zoom>=3;zoom--){this.zoom=zoom;const bounds=this.areas.map(a=>{const p=this.project(a.center),r=a.radiusKm*256*2**zoom/(40075.016686*Math.cos(a.center[0]*Math.PI/180));return[p[0]-r,p[1]-r,p[0]+r,p[1]+r];});
        if(this.areaOrigin){const p=this.project(this.areaOrigin.center);bounds.push([p[0],p[1],p[0],p[1]]);}
        const left=Math.min(...bounds.map(b=>b[0])),top=Math.min(...bounds.map(b=>b[1])),right=Math.max(...bounds.map(b=>b[2])),bottom=Math.max(...bounds.map(b=>b[3]));
        if(right-left<this.element.clientWidth-80&&bottom-top<this.element.clientHeight-70){this.center=this.unproject([(left+right)/2,(top+bottom)/2]);this.render();return;}
      }
      this.render();
    }
    setData(locations, selected, draft, editing) {
      this.locations = locations;
      this.selected = selected;
      this.draft = draft;
      this.editing = editing;
      this.element.classList.toggle('is-placing', editing);
      this.render();
    }
    render() {
      const width = this.element.clientWidth, height = this.element.clientHeight;
      if (!width || !height) return;
      const center = this.project(this.center);
      const left = center[0] - width / 2, top = center[1] - height / 2;
      const count = 2 ** this.zoom;
      const visible = new Set();
      for (let y = Math.floor(top / 256); y <= Math.floor((top + height) / 256); y++) {
        if (y < 0 || y >= count) continue;
        for (let x = Math.floor(left / 256); x <= Math.floor((left + width) / 256); x++) {
          const key = `${this.zoom}/${x}/${y}`;
          visible.add(key);
          let tile = this.tiles.get(key);
          if (!tile) {
            tile = document.createElement('img');
            tile.alt = '';
            tile.draggable = false;
            tile.referrerPolicy = 'strict-origin-when-cross-origin';
            tile.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${this.zoom}/${y}/${((x % count) + count) % count}`;
            tile.addEventListener('error', () => { this.element.querySelector('.map-offline').hidden = false; });
            tile.addEventListener('load', () => { this.element.querySelector('.map-offline').hidden = true; });
            this.tileLayer.append(tile);
            this.tiles.set(key, tile);
          }
          tile.style.left = `${Math.round(x * 256 - left)}px`;
          tile.style.top = `${Math.round(y * 256 - top)}px`;
        }
      }
      this.tiles.forEach((tile, key) => { if (!visible.has(key)) { tile.remove(); this.tiles.delete(key); } });
      this.markerLayer.replaceChildren();
      for(const area of this.areas){
        const [x,y]=this.project(area.center),radius=area.radiusKm*256*2**this.zoom/(40075.016686*Math.cos(area.center[0]*Math.PI/180));
        const circle=document.createElement('div');circle.className='map-visited-area';circle.dataset.area=area.id;circle.style.left=`${x-left-radius}px`;circle.style.top=`${y-top-radius}px`;circle.style.width=circle.style.height=`${radius*2}px`;circle.setAttribute('aria-hidden','true');this.markerLayer.append(circle);
        const label=document.createElement('button');label.type='button';label.className='map-area-label';label.dataset.area=area.id;label.dataset.copyId='places.area.'+area.id;label.textContent=area.label;label.style.left=`${x-left+(area.labelOffset?.[0]||0)}px`;label.style.top=`${y-top+(area.labelOffset?.[1]||0)}px`;label.setAttribute('aria-label',area.label+', visited area');label.addEventListener('click',()=>this.setView(area.center,Math.min(13,this.zoom+1)));this.markerLayer.append(label);
      }
      if(this.areaOrigin){const [x,y]=this.project(this.areaOrigin.center),origin=document.createElement('span');origin.className='map-origin';origin.style.left=`${x-left}px`;origin.style.top=`${y-top}px`;const label=document.createElement('span');label.textContent=this.areaOrigin.label;label.dataset.copyId='places.origin';origin.append(label);this.markerLayer.append(origin);}
      // Shift only labels when nearby names collide; geographic circles keep
      // their real projected centers, including on the narrower phone map.
      if(this.areas.length){
        const bounds=this.element.getBoundingClientRect(),origin=this.markerLayer.querySelector('.map-origin>span'),occupied=[];
        if(origin){const r=origin.getBoundingClientRect();occupied.push({l:r.left-bounds.left,t:r.top-bounds.top,r:r.right-bounds.left,b:r.bottom-bounds.top});}
        for(const label of this.markerLayer.querySelectorAll('.map-area-label')){
          const baseX=parseFloat(label.style.left),baseY=parseFloat(label.style.top),w=label.offsetWidth,h=label.offsetHeight;
          if(baseX<0||baseX>width||baseY<0||baseY>height)continue;
          const offsets=[[0,0],[0,-36],[0,36],[-42,-30],[42,-30],[-42,30],[42,30],[-74,0],[74,0]];
          for(const [dx,dy]of offsets){
            const x=baseX+dx,y=baseY+dy,box={l:x-w/2,t:y-h/2,r:x+w/2,b:y+h/2+4};
            if(box.l<6||box.r>width-6||box.t<6||box.b>height-6)continue;
            if(occupied.some(o=>box.l<o.r+5&&box.r>o.l-5&&box.t<o.b+5&&box.b>o.t-5))continue;
            label.style.left=x+'px';label.style.top=y+'px';occupied.push(box);break;
          }
        }
      }
      const groups = [];
      this.locations.forEach(location => {
        const [px, py] = this.project(location.coordinates);
        const point = [px - left, py - top];
        if (point[0] < -50 || point[0] > width + 50 || point[1] < -50 || point[1] > height + 50) return;
        let group = groups.find(item => Math.hypot(item.point[0] - point[0], item.point[1] - point[1]) < 48);
        if (!group) { group = { point, locations: [] }; groups.push(group); }
        group.locations.push(location);
      });
      groups.forEach(group => {
        const current = group.locations.find(item => item.id === this.selected) || group.locations[0];
        const button = document.createElement('button');
        button.type = 'button';
        button.className = (this.kind === 'places' ? 'map-place-marker' : 'map-photo-marker') + (group.locations.some(item => item.id === this.selected) ? ' is-selected' : '');
        button.style.left = `${group.point[0]}px`;
        button.style.top = `${group.point[1]}px`;
        button.setAttribute('aria-label', this.kind === 'places' ? current.label + ', area reference' : `${current.label}, ${group.locations.length} photograph${group.locations.length === 1 ? '' : 's'}`);
        if(this.kind === 'places')button.textContent=current.label;
        else{const img = document.createElement('img'); img.src = window.atlasMediaURL(current.src); img.alt = ''; button.append(img);}
        if (group.locations.length > 1 && this.kind !== 'places') {
          const badge = document.createElement('span'); badge.textContent = group.locations.length; button.append(badge);
        }
        button.addEventListener('click', () => {
          this.onSelect?.(group.locations.map(item => item.id));
          if (group.locations.length > 1 && this.zoom < 16) this.setView(current.coordinates, this.zoom + 2);
        });
        this.markerLayer.append(button);
      });
      if (this.draft) {
        const [x, y] = this.project(this.draft);
        const dot = document.createElement('div');
        dot.className = 'map-draft';
        dot.style.left = `${x - left}px`; dot.style.top = `${y - top}px`;
        dot.textContent = 'Proposed location'; this.markerLayer.append(dot);
      }
      this.element.querySelector('.map-empty').hidden = this.locations.length > 0 || this.areas.length>0 || !!this.areaOrigin || !!this.draft;
    }
    destroy() { this.observer.disconnect(); }
  }
  window.AtlasMap = AtlasMap;
})();
