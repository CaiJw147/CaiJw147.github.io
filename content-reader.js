/* Public reader. Selected media and editorial content are preserved. */
(() => {
  'use strict';
  const data = window.ATLAS_CONTENT;
  const stage = document.getElementById('content-stage');
  const photos = data.photographs;
  const albums = data.albums.map(album => ({ ...album, images: album.photos.map(id => photos.find(photo => photo.id === id)) }));
  const albumByPhoto = new Map(albums.flatMap(album => album.photos.map(id => [id, album])));
  const storageKey = 'atlas-location-review-v1';
  const presets = {
    nanjing: { label: 'Nanjing', coordinates: [32.0603, 118.7969], precision: 'city', zoom: 10 },
    gaochun: { label: 'Gaochun, Nanjing', coordinates: [31.3271, 118.8921], precision: 'area', zoom: 11 },
    macau: { label: 'Macau', coordinates: [22.1987, 113.5439], precision: 'city', zoom: 12 }
  };
  const state = {
    section: null, photographyView: 'gallery', photo: 0,
    post: null, postImages: new Map(), reviewOpen: false, draft: null,
    mapView: null, placesMapView: null, cluster: null, scrolls: new Map(), locations: {},
    barPositions: [], barsPaused: false, barsMonochrome: true
  };
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
    photos.forEach(photo => {
      const item = stored[photo.id];
      if (item && typeof item.label === 'string' && Array.isArray(item.coordinates) &&
          item.coordinates.length === 2 && item.coordinates.every(Number.isFinite) &&
          Math.abs(item.coordinates[0]) <= 85 && Math.abs(item.coordinates[1]) <= 180 &&
          ['city', 'area', 'public-place'].includes(item.precision)) state.locations[photo.id] = item;
    });
  } catch { /* A blocked browser store leaves the study usable without persistence. */ }
  let map = null;
  let strips = null;
  let journalSpace = null;
  let thumbnailAlbum = null;
  let expanded = null;
  let journalIntro = false;
  let postPointer = null;
  let journalVisit = 0;
  const $ = id => document.getElementById(id);
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function button(text, className, action, label) {
    const element = node('button', className, text);
    element.type = 'button';
    if (label) element.setAttribute('aria-label', label);
    element.addEventListener('click', action);
    return element;
  }
  function picture(image, alt, eager = false) {
    const element = node('img');
    element.src = window.atlasMediaURL(image.src);
    element.alt = alt;
    element.width = image.width;
    element.height = image.height;
    element.loading = eager ? 'eager' : 'lazy';
    element.decoding = 'async';
    return element;
  }
  function date(value, full = false) {
    if (!value) return '';
    const instant = new Date(value.replace(' ', 'T') + '+08:00');
    const label = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Shanghai' }).format(instant);
    return full ? label + ' · ' + value.slice(11, 16) : label;
  }
  function selectEntryImage(entry, index) {
    state.postImages.set(entry.id, index); renderPost();
  }
  function expandPortfolio(index, origin) {
    const photo = photos[index], album = albumByPhoto.get(photo.id);
    expand(album.images, album.images.findIndex(image => image.id === photo.id), origin, album);
  }
  function announce(text) { $('status').textContent = text; }
  function saveScroll() {
    [stage, $('journal-post-content')].forEach(root => {
      const scroll = root?.querySelector('[data-scroll-key]');
      if (scroll) state.scrolls.set(scroll.dataset.scrollKey, scroll.scrollTop);
    });
  }
  function scrollSurface(key, className = '') {
    const element = node('div', 'reader-scroll ' + className);
    element.dataset.scrollKey = key;
    requestAnimationFrame(() => { if (element.isConnected) element.scrollTop = state.scrolls.get(key) || 0; });
    return element;
  }
  function revealStory(id) {
    const item=document.getElementById('place-story-'+id),surface=item?.closest('.reader-scroll');
    if(surface)surface.scrollTo({top:surface.scrollTop+item.getBoundingClientRect().top-surface.getBoundingClientRect().top-25,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }
  function disposeMap() {
    if (!map) return;
    state[map.kind === 'places' ? 'placesMapView' : 'mapView'] = { center: [...map.center], zoom: map.zoom };
    map.destroy();
    map = null;
  }
  function disposeWall() { if (strips) state.barPositions = strips.destroy(); strips = null; }
  function disposeJournal() { journalSpace?.destroy(); journalSpace = null; }
  function toolbar() { const bar = node('div', 'reader-toolbar'); stage.append(bar); return bar; }
  function descriptionSpace() {
    const space = node('div', 'reader-description-space');
    const text = state.section === 'notes' ? 'A field of moments, kept in words and photographs.' : 'Photographs gathered along the way. Follow an image, or enter an album.';
    space.append(node('p', '', text)); stage.append(space);
  }
  function setGalleryView(view) {
    state.photographyView = view;
    render();
  }
  function galleryToolbar() {
    const bar = toolbar();
    const tabs = node('div', 'view-switch');
    tabs.setAttribute('aria-label', 'Photography view');
    ['Gallery', 'Map'].forEach(label => {
      const view = label.toLowerCase();
      const tab = button(label, state.photographyView === view ? 'is-active' : '', () => setGalleryView(view));
      tab.setAttribute('aria-pressed', String(state.photographyView === view));
      tabs.append(tab);
    });
    if (state.section === 'places') bar.append(node('span', 'small-note', 'Photographs and their places'));
    else bar.append(tabs);
    if (state.section === 'work' && state.photographyView === 'gallery') {
      const actions = node('div', 'strip-toolbar-actions');
      const monochrome = button('', 'monochrome-switch', () => {
        state.barsMonochrome = !state.barsMonochrome;
        stage.querySelector('.photography-bars')?.classList.toggle('is-monochrome', state.barsMonochrome);
        monochrome.setAttribute('aria-checked', String(state.barsMonochrome));
      }, 'Black and white display');
      monochrome.setAttribute('role', 'switch'); monochrome.setAttribute('aria-checked', String(state.barsMonochrome));
      const track = node('span', 'switch-track'); track.setAttribute('aria-hidden', 'true');
      monochrome.append(node('span', 'switch-label', 'Black & white'), track); actions.append(monochrome);
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const pause = button(reduced ? 'Motion reduced' : state.barsPaused ? 'Play motion' : 'Pause motion', 'text-button', () => {
        state.barsPaused = !state.barsPaused; strips?.setPaused(state.barsPaused);
        pause.textContent = state.barsPaused ? 'Play motion' : 'Pause motion'; pause.setAttribute('aria-pressed', String(state.barsPaused));
      });
      pause.disabled = reduced; pause.setAttribute('aria-pressed', String(state.barsPaused)); actions.append(pause); bar.append(actions);
    }
  }
  function renderGallery() {
    descriptionSpace();
    galleryToolbar();
    const page = scrollSurface('photography', 'photography-page'); stage.append(page);
    const bars = node('div', 'photography-bars' + (state.barsMonochrome ? ' is-monochrome' : '')); page.append(bars);
    strips = new window.AtlasPhotoStrips(bars, photos, {
      positions: state.barPositions, paused: state.barsPaused,
      onOpen: index => { state.photo = index; expandPortfolio(index, 'gallery'); }
    });
    const section = node('section', 'photography-albums'); section.append(node('h3', '', 'Albums'));
    const grid = node('div', 'album-grid');
    albums.forEach(album => {
      const card = button('', 'album-card', () => {
        expand(album.images, 0, 'gallery', album);
      }, `Open album: ${album.title}`);
      card.dataset.album = album.id;
      const title = node('span', '', album.title); title.dataset.copyId = 'album.' + album.id;
      card.append(picture(album.images[0], '', true), title); grid.append(card);
    });
    section.append(grid); page.append(section);
    const groups = window.atlasCopy?.catalogue.filter(item => item.type === 'photo-group' && window.atlasCopy.get(item.id).merge) || [];
    if (groups.length) {
      const sequences = node('section', 'photography-albums source-sequences'); sequences.append(node('h3', '', 'Sequences'));
      const grid = node('div', 'album-grid');
      groups.forEach(group => {
        const images = group.images.map(item => photos.find(photo => photo.id === item.id)).filter(Boolean);
        if (!images.length) return;
        const title = window.atlasCopy.text(group.id, group.proposed);
        const album = { id: group.id, title, images };
        const card = button('', 'album-card', () => expand(images, 0, 'gallery', album), 'Open sequence: ' + title);
        card.append(picture(images[0], '', false), node('span', '', title)); grid.append(card);
      });
      sequences.append(grid); page.append(sequences);
    }
  }
  function mappedPhotos() {
    return photos.filter(photo => state.locations[photo.id]).map(photo => ({ ...photo, ...state.locations[photo.id] }));
  }
  function syncMap() { map?.setData(mappedPhotos(), photos[state.photo].id, state.draft?.coordinates, state.reviewOpen); }
  function persistLocations() {
    try { localStorage.setItem(storageKey, JSON.stringify(state.locations)); return true; }
    catch { return false; }
  }
  function exportLocations() {
    const payload = { version: 1, locations: Object.entries(state.locations).map(([photograph, value]) => ({ photograph, ...value })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'atlas-location-review.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function renderMap() {
    if (state.section === 'work') descriptionSpace();
    galleryToolbar();
    const layout = node('div', 'photography-map-layout' + (state.reviewOpen ? ' is-reviewing' : ''));
    const viewport = node('div', 'photography-map');
    const side = node('aside', 'map-sidebar');
    const photo = photos[state.photo];
    const saved = state.locations[photo.id];
    const imageButton = button('', 'map-selected-photo', () => expandPortfolio(state.photo, 'map'), 'Enlarge selected photograph');
    imageButton.append(picture(photo, `Photograph ${state.photo + 1}`, true));
    side.append(imageButton);
    const summary = node('div', 'map-photo-summary');
    summary.append(node('h3', '', saved ? saved.label : 'Not placed yet'));
    summary.append(node('p', 'small-note', saved ? `${saved.precision === 'public-place' ? 'Public place' : saved.precision === 'city' ? 'City' : 'Area'}` : 'A location has not been added for this photograph.'));
    side.append(summary);
    if (false) { // Location editing stays in the local study.
      const form = node('form', 'location-form');
      const presetLabel = node('label', '', 'Start with a place');
      const preset = node('select'); preset.id = 'location-preset';
      preset.append(new Option('Choose a place…', ''));
      Object.entries(presets).forEach(([key, value]) => preset.append(new Option(value.label, key)));
      presetLabel.append(preset); form.append(presetLabel);
      const nameLabel = node('label', '', 'Display name');
      const name = node('input'); name.id = 'location-name'; name.type = 'text'; name.maxLength = 100;
      name.placeholder = 'City, area, or public landmark'; name.value = saved?.label || '';
      nameLabel.append(name); form.append(nameLabel);
      const precisionLabel = node('label', '', 'Location detail');
      const precision = node('select'); precision.id = 'location-precision';
      [['city', 'City'], ['area', 'Area'], ['public-place', 'Public place']].forEach(([key, label]) => precision.append(new Option(label, key)));
      precision.value = saved?.precision || 'city'; precisionLabel.append(precision); form.append(precisionLabel);
      const help = node('p', 'location-help', saved ? 'This location is confirmed. Choose a new place to change it.' : 'Choose a place above, or click the map, then confirm.');
      help.id = 'location-help'; form.append(help);
      const actions = node('div', 'location-actions');
      const confirm = button(saved ? 'Save location' : 'Confirm location', 'solid-button', () => {});
      confirm.type = 'submit'; confirm.id = 'confirm-location'; confirm.disabled = !saved;
      actions.append(confirm);
      if (saved) actions.append(button('Remove', 'text-button', () => {
        delete state.locations[photo.id]; state.draft = null; persistLocations(); render(); announce('Location removed.');
      }));
      form.append(actions);
      const setDraft = coordinates => {
        state.draft = { coordinates };
        help.textContent = 'Proposed location. It will appear with the photograph after you confirm.';
        confirm.disabled = !name.value.trim(); syncMap();
      };
      preset.addEventListener('change', () => {
        const value = presets[preset.value];
        if (!value) return;
        name.value = value.label; precision.value = value.precision;
        setDraft(value.coordinates); map.setView(value.coordinates, value.zoom);
      });
      name.addEventListener('input', () => { confirm.disabled = !((state.draft || saved) && name.value.trim()); });
      form.addEventListener('submit', event => {
        event.preventDefault();
        const coordinates = state.draft?.coordinates || saved?.coordinates;
        if (!coordinates || !name.value.trim()) return;
        state.locations[photo.id] = { label: name.value.trim(), coordinates: [...coordinates], precision: precision.value, confirmed: true };
        state.draft = null;
        const persisted = persistLocations();
        render();
        const message = stage.querySelector('.location-help');
        if (message) message.textContent = persisted ? 'Location saved in this browser. Export the review to keep a separate copy.' : 'Location kept for this session. Export the review to keep a copy.';
        announce('Location confirmed.');
      });
      side.append(form);
      if (photo.suggestion && !saved) {
        const suggested = presets[photo.suggestion];
        const suggestion = button(`Review suggestion: ${suggested.label}`, 'suggestion-button', () => {
          preset.value = photo.suggestion; preset.dispatchEvent(new Event('change'));
        });
        side.append(suggestion, node('p', 'small-note', 'Suggested from the original caption; not yet confirmed.'));
      }
      const nextUnplaced = button('Next unplaced photograph', 'text-button next-unplaced', () => {
        const index = photos.findIndex((item, index) => index > state.photo && !state.locations[item.id]);
        const fallback = photos.findIndex(item => !state.locations[item.id]);
        state.photo = index >= 0 ? index : Math.max(0, fallback); state.draft = null; render();
      });
      side.append(nextUnplaced);
      const footer = node('div', 'review-export');
      footer.append(button('Export location review', 'text-button', exportLocations));
      footer.append(node('p', 'small-note', 'Your confirmations stay in this browser and do not change the source archive.'));
      side.append(footer);
      viewport.dataset.pickable = 'true';
      viewport._setDraft = setDraft;
    }
    layout.append(viewport, side);
    stage.append(layout);
    map = new window.AtlasMap(viewport, {
      onPick: coordinates => viewport._setDraft?.(coordinates),
      onSelect: ids => { state.photo = photos.findIndex(item => item.id === ids[0]); state.cluster = ids; state.draft = null; render(); }
    });
    if (state.mapView) map.setView(state.mapView.center, state.mapView.zoom);
    else if (saved) map.setView(saved.coordinates, saved.precision === 'city' ? 10 : 13);
    syncMap();
    const strip = node('div', 'map-photo-strip');
    strip.setAttribute('aria-label', 'Choose a photograph to locate');
    const items = state.cluster ? photos.filter(item => state.cluster.includes(item.id)) : photos;
    items.forEach(item => {
      const index = photos.indexOf(item);
      const thumb = button('', 'map-strip-item' + (index === state.photo ? ' is-selected' : ''), () => {
        state.photo = index; state.draft = null;
        const location = state.locations[item.id];
        if (location) state.mapView = { center: location.coordinates, zoom: map.zoom };
        render();
      }, `Review photograph ${index + 1}${state.locations[item.id] ? ', location confirmed' : ', not placed'}`);
      thumb.append(picture(item, '', index < 6));
      if (state.locations[item.id]) thumb.append(node('span', 'placed-indicator', '✓'));
      strip.append(thumb);
    });
    stage.append(strip);
  }
  function renderJournal() {
    descriptionSpace();
    const bar = toolbar(); bar.classList.add('journal-toolbar');
    const tools = node('div', 'journal-space-tools');
    const zoom = node('div', 'journal-space-zoom');
    zoom.append(button('−', '', () => journalSpace?.zoom(.8), 'Zoom Journal out'), button('+', '', () => journalSpace?.zoom(1.25), 'Zoom Journal in'), button('Fit all', 'fit-journal', () => journalSpace?.fit()));
    tools.append(zoom); bar.append(tools);
    const viewport = node('div', 'journal-space');
    stage.append(viewport);
    journalSpace = new window.AtlasJournalSpace(viewport, data.journal, { onOpen: openPost });
    viewport.append(node('span', 'journal-space-hint', 'Drag to explore · Scroll to zoom'));
  }
  function openPost(entry, index = 0) {
    postPointer = null;
    state.post = entry.id;
    state.postImages.set(entry.id, index); renderPost();
    if (!$('journal-post').open) $('journal-post').showModal();
    $('close-journal-post').focus();
  }
  function closePost() {
    const wasIntro = journalIntro;
    journalIntro = false;
    $('chapter').classList.remove('is-journal-covered');
    $('journal-post').classList.remove('is-journal-intro');
    $('journal-intro-hint').hidden = true;
    saveScroll(); $('journal-post').close(); state.post = null; $('journal-post-content').replaceChildren();
    if (wasIntro && state.section === 'notes') document.querySelector('.journal-space')?.focus({ preventScroll: true });
  }
  function openJournalIntroduction(token) {
    if (token !== journalVisit || state.section !== 'notes' || !$('chapter').open) return;
    const entry = data.journal.find(item => item.id === data.journalPresentation.intro_entry);
    if (!entry) return;
    journalIntro = true;
    $('chapter').classList.add('is-journal-covered');
    state.scrolls.delete('entry-' + entry.id);
    $('journal-post').classList.add('is-journal-intro');
    $('journal-intro-hint').hidden = false;
    openPost(entry);
  }
  document.addEventListener('keydown', event => {
    if (!journalIntro || event.ctrlKey || event.metaKey || ['Control', 'Alt', 'Meta', 'Shift'].includes(event.key)) return;
    if(event.target.closest('#sound-controls')||event.target.matches('input,textarea,select'))return;
    event.preventDefault(); event.stopImmediatePropagation(); closePost();
  }, true);
  $('journal-post').addEventListener('pointerdown', event => {
    postPointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  }, { passive: true });
  $('journal-post').addEventListener('pointermove', event => {
    if (postPointer?.id === event.pointerId && Math.hypot(event.clientX - postPointer.x, event.clientY - postPointer.y) > 8) postPointer.moved = true;
  }, { passive: true });
  $('journal-post').addEventListener('pointercancel', () => { if (postPointer) postPointer.moved = true; });
  $('journal-post').addEventListener('click', event => {
    if (!$('journal-post').open || $('photograph-viewer').open) return;
    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    if (!target || target.closest('#sound-controls')) return;
    if (!journalIntro) {
      if (event.defaultPrevented || target.closest('button,a,input,textarea,select,[role="button"]')) return;
      if (postPointer?.moved) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && $('journal-post').contains(selection.anchorNode)) return;
    }
    postPointer = null;
    event.preventDefault(); event.stopImmediatePropagation(); closePost();
  }, true);
  function renderPost() {
    saveScroll();
    const entry = data.journal.find(item => item.id === state.post);
    if (!entry) return;
    $('journal-post').dataset.entry = entry.id;
    const page = scrollSurface('entry-' + entry.id, 'journal-entry-page');
    const article = node('article', 'journal-article');
    const visuals = node('section', 'entry-visuals');
    const imageIndex = Math.min(state.postImages.get(entry.id) || 0, entry.images.length - 1);
    const grid = node('div', 'entry-photo-grid' + (entry.images.length === 1 ? ' is-single' : [2, 4].includes(entry.images.length) ? ' is-pair' : ''));
    grid.setAttribute('aria-label', 'Photographs in this entry');
    entry.images.forEach((image, index) => {
      const tile = button('', 'entry-grid-photo' + (index === imageIndex ? ' is-selected' : ''), () => {
        selectEntryImage(entry, index); expand(entry.images, index, 'entry');
      }, `Enlarge photograph ${index + 1} of ${entry.images.length}`);
      const img = picture(image, 'Photograph accompanying this entry', index < 9); img.dataset.copyAlt = `image.journal.${entry.id}.${index}`;
      tile.append(img); grid.append(tile);
    });
    visuals.append(grid);
    const copy = node('div', 'entry-copy');
    if (!entry.hideReaderDate) copy.append(node('time', 'entry-date', date(entry.displayDate || entry.published, !entry.parts && !entry.isCollection)));
    const parts = entry.parts ? [...entry.parts].sort((a, b) => a.published.localeCompare(b.published)) : [entry];
    parts.forEach(content => copy.append(renderTextPart(content)));
    article.append(visuals, copy);
    page.append(article); $('journal-post-content').replaceChildren(page);
  }
  function renderTextPart(content) {
    const section = node('section', 'entry-text-part');
    const reading = node('div', 'entry-reading' + (/[\u3400-\u9fff]/.test(content.caption) ? ' is-bilingual' : ''));
    const original = node('div', 'original-text');
    if (reading.classList.contains('is-bilingual')) original.append(node('span', 'reading-language', 'Original'));
    const text = node(content.quotation ? 'blockquote' : 'p', 'original-caption', content.originalDisplay || content.caption);
    text.lang = /[\u3400-\u9fff]/.test(content.caption) ? 'zh' : 'en';
    text.dataset.copyId = 'journal.' + content.id + '.original';
    original.append(text);
    if (reading.classList.contains('is-bilingual')) {
      const translation = node('div', 'translation-space');
      translation.lang = 'en';
      const translated = node(content.quotation ? 'blockquote' : 'p', 'translated-caption', content.translation);
      translated.dataset.copyId = 'journal.' + content.id + '.english';
      translation.append(node('span', 'reading-language', 'English'), translated);
      reading.append(translation);
    }
    reading.append(original);
    section.append(reading);
    const social = node('footer', 'entry-social');
    if (content.likes !== null && content.likes !== undefined) social.append(node('p', 'entry-like-count', `♡  ${content.likes} likes`));
    const observed = content.peopleRole === 'observed_likers';
    social.append(node('p', 'people-label', observed ? 'Liked by' : 'Friends'));
    const people = node('div', 'entry-people');
    content.people.forEach(person => {
      const item = node('div', 'entry-person');
      const avatar = node('img', 'person-avatar'); avatar.src = window.atlasMediaURL(person.avatar); avatar.alt = ''; avatar.loading = 'lazy';
      const name = node('span', 'person-name');
      person.parts.forEach(part => {
        if (part.text) name.append(document.createTextNode(part.text));
        else if (part.image) { const emoji = node('img', 'name-emoji'); emoji.src = window.atlasMediaURL(part.image); emoji.alt = ''; name.append(emoji); }
      });
      item.append(avatar, name); people.append(item);
    });
    if (content.likes > content.people.length) {
      const more = node('span', 'people-more', '…'); more.setAttribute('role', 'img'); more.setAttribute('aria-label', 'More profiles'); people.append(more);
    }
    social.append(people); section.append(social); return section;
  }
  function renderAbout() {
    const page = scrollSurface('about', 'about-page');
    const figure = node('figure', 'about-figure');
    const visual = button('', 'about-image', () => expand([{ src: 'media/about-haoran-shoulder.webp', width: 6000, height: 4000 }], 0, 'about'), 'Enlarge the portrait of Haoran Xu');
    visual.append(picture({ src: 'media/about-haoran-shoulder.webp', width: 6000, height: 4000 }, 'Haoran Xu in glasses and a navy jacket.', true));
    const caption = node('figcaption', '', 'Haoran Xu'); caption.dataset.copyId = 'image.about.shoulder';
    figure.append(visual, caption);
    const copy = node('div', 'about-copy');
    copy.append(node('h3', '', 'A few ways of seeing.'), node('p', '', 'I make photographs, write, and work with music.'), node('p', '', 'This river brings those different parts of my life into the same place. You can follow it in order, or stop wherever something catches your attention.'));
    page.append(figure, copy); stage.append(page);
  }
  function renderBand() {
    const page = scrollSurface('band', 'band-page band-editorial');
    const opening = node('section', 'band-opening-layout');
    const introduction = node('div', 'band-opening-copy');
    introduction.append(node('p', 'band-position', 'The fifth person'), node('h3', '', 'Outside the spotlight.\nInside the sound.'), node('p', '', 'My place in the band is often behind the scenes: rhythm guitar, drums, recording, and the camera.'));
    const hero = button('', 'band-hero band-opening', () => expand([data.bandHero], 0, 'band'), 'Enlarge the opening guitar photograph');
    hero.append(picture(data.bandHero, 'A guitar being played in the snow.', true));
    opening.append(introduction, hero); page.append(opening);
    const sound = node('section', 'band-recording-layout');
    const sequence = data.band.flatMap(entry => entry.images);
    const stagePhoto = sequence.find(image => image.src === 'media/c5ce6ef4589c30e7e3407d37.jpg');
    const stageFigure = node('figure','band-recording-figure');
    const stageButton = button('','band-recording-photo',()=>expand(sequence,sequence.indexOf(stagePhoto),'band'),'Enlarge the stage photograph');
    const stageImage=picture(stagePhoto,'Stage lights above a drummer and guitarists.',true);stageImage.dataset.copyAlt='image.band.'+sequence.indexOf(stagePhoto);stageButton.append(stageImage);
    const stageCaption=node('figcaption','','From the band archive.');stageCaption.dataset.copyId='band.recording.caption';stageFigure.append(stageButton,stageCaption);
    const soundCopy=node('div','band-recording-copy');
    soundCopy.append(node('h3', '', 'A foundation you can hear.'), node('p', '', 'I play and record rhythm guitar and drums: the pulse and harmonic structure beneath the performance. For large shows, I also build backing tracks, including recorded guitar and bass parts.'));
    soundCopy.append(window.atlasSound.createPlayer());sound.append(stageFigure,soundCopy);page.append(sound);
    const contrast = node('section', 'band-contrast');
    const outside = node('div', 'band-absence');
    outside.append(node('h3', '', 'Out of the frame'), node('p', '', 'At large performances, I am not on stage. I am crouched below it, photographing the people who are.'));
    const inside = node('div', 'band-presence');
    inside.append(node('h3', '', 'In the room'), node('p', '', 'The rhythm guitar coming through the speakers is the part I recorded. The photographs that become the band’s visual memory are the frames I made.'));
    contrast.append(outside, inside); page.append(contrast);
    const photographs = node('section', 'band-photo-story');
    photographs.append(node('h3', '', 'A memory you can see.'), node('p', '', 'All the formal photographs of the band in this section were taken by me. My guitar is in the backing track; my camera is in the record of the night.'));
    const grid = node('div', 'band-editorial-grid');
    sequence.forEach((image,index) => {
      if(image===stagePhoto)return;
      const tile = button('', 'band-editorial-photo', () => expand(sequence,index,'band'), `Enlarge band photograph ${index+1}`);
      const img = picture(image, 'A photograph from the band archive.', index<3); img.dataset.copyAlt = `image.band.${index}`;
      tile.append(img); grid.append(tile);
    });
    photographs.append(grid);page.append(photographs);
    const closing = node('p', 'band-closing', 'I am not the person the spotlight finds. But I am there in what the room hears, and in what it remembers.');
    page.append(closing);stage.append(page);
  }
  function renderPlaces() {
    const page=scrollSurface('places-stories','places-stories');page.dataset.layout='running-cycling';
    const opening=node('header','places-opening'),lead=node('p','','Running, riding, and following my curiosity.');lead.dataset.copyId='places.introduction';opening.append(lead);page.append(opening);
    for(const story of data.placesStories||[]){
      const article=node('article','place-story is-'+story.kind);article.id='place-story-'+story.id;article.dataset.placeStory=story.id;
      const figure=node('figure','place-story-figure'),images=[story.image,...story.supportingImages||[]],gallery=node('div','place-photo-pair');gallery.style.gridTemplateColumns=images.map(im=>(im.width/im.height)+'fr').join(' ');
      images.forEach((image,index)=>{const photo=button('','place-story-photo',()=>expand(images,index,'places'),'Enlarge '+story.title+' photograph');const img=picture(image,index===0?story.imageAlt:'A second photograph from '+story.context,true);img.dataset.copyAlt=index===0?'places.'+story.id+'.image':'places.'+story.id+'.supporting.'+(index-1);photo.append(img);gallery.append(photo);});
      const caption=node('figcaption','',story.imageCaption);caption.dataset.copyId='places.'+story.id+'.caption';figure.append(gallery,caption);
      const copy=node('section','place-story-copy'),context=node('p','place-story-context',story.context);context.dataset.copyId='places.'+story.id+'.context';
      const title=node('h3','',story.title);title.dataset.copyId='places.'+story.id+'.title';copy.append(context,title);
      if(story.body){const body=node('p','place-story-body',story.body);body.dataset.copyId='places.'+story.id+'.body';copy.append(body);}
      if(story.result){const result=node('p','place-story-result',story.result);result.dataset.copyId='places.'+story.id+'.result';copy.append(result);}
      if(story.metrics){const metrics=node('div','cycling-metrics');for(const metric of story.metrics){const row=node('p','cycling-metric'),value=node('span','cycling-metric-value',metric.value),note=node('span','cycling-metric-note',metric.note);value.dataset.copyId='places.'+story.id+'.'+metric.id+'.value';note.dataset.copyId='places.'+story.id+'.'+metric.id+'.note';row.append(value,note);metrics.append(row);}copy.append(metrics);}
      article.append(figure,copy);page.append(article);
    }
    const geography=node('section','places-geography'),heading=node('div','places-geography-heading');
    const mapTitle=node('h3','','Starting from Nanjing');mapTitle.dataset.copyId='places.map.title';heading.append(mapTitle,button('See all places','',()=>map?.fitAreas()));geography.append(heading);
    const viewport=node('div','photography-map places-map');geography.append(viewport);
    const note=node('p','places-map-note',data.placesJourney.mapNote);note.dataset.copyId='places.map.note';geography.append(note);page.append(geography);stage.append(page);
    map=new window.AtlasMap(viewport,{kind:'places'});map.setAreas(data.placesJourney.areas,data.placesJourney.origin);
    if(state.placesMapView)map.setView(state.placesMapView.center,state.placesMapView.zoom);
    else {const mountedMap=map;requestAnimationFrame(()=>{if(map===mountedMap&&state.section==='places')mountedMap.fitAreas();});}
    const requested=data.placesStories.find(s=>s.id===new URLSearchParams(location.search).get('story'));if(requested)requestAnimationFrame(()=>revealStory(requested.id));
  }
  function render() {
    saveScroll(); disposeMap(); disposeWall(); disposeJournal(); stage.replaceChildren();
    if (state.section === 'places') renderPlaces();
    else if (state.section === 'work') {
      if (state.photographyView === 'map') renderMap(); else renderGallery();
    } else if (state.section === 'story') renderAbout();
    else if (state.section === 'notes') renderJournal();
    else if (state.section === 'music') renderBand();
  }
  function drawExpanded() {
    const exhibition = expanded.origin === 'gallery' || expanded.origin === 'map';
    const image = expanded.images[expanded.index];
    $('photograph-viewer').classList.toggle('is-exhibition', exhibition);
    $('photograph-viewer').dataset.photo = image.id || '';
    $('expanded-photograph').src = window.atlasMediaURL(image.src);
    $('expanded-photograph').alt = `Photograph ${expanded.index + 1} of ${expanded.images.length}`;
    $('image-position').hidden = exhibition;
    $('image-position').textContent = exhibition ? '' : `${String(expanded.index + 1).padStart(2, '0')} / ${expanded.images.length}`;
    $('image-previous').disabled = expanded.images.length === 1 || (!exhibition && expanded.index === 0);
    $('image-next').disabled = expanded.images.length === 1 || (!exhibition && expanded.index === expanded.images.length - 1);
    $('neighbor-previous').hidden = !exhibition || expanded.images.length === 1;
    $('neighbor-next').hidden = !exhibition || expanded.images.length === 1;
    $('photograph-sidebar').hidden = !exhibition;
    $('album-thumbnails').hidden = !exhibition;
    if (exhibition) {
      $('neighbor-previous').querySelector('img').src = window.atlasMediaURL(expanded.images[(expanded.index - 1 + expanded.images.length) % expanded.images.length].src);
      $('neighbor-next').querySelector('img').src = window.atlasMediaURL(expanded.images[(expanded.index + 1) % expanded.images.length].src);
      drawPhotographSidebar(image, expanded.album);
      drawAlbumThumbnails();
    }
  }
  function drawAlbumThumbnails() {
    const strip = $('album-thumbnails');
    if (thumbnailAlbum !== expanded.album.id) {
      strip.replaceChildren(); thumbnailAlbum = expanded.album.id;
      expanded.images.forEach((image, index) => {
        const thumb = button('', 'album-thumbnail', () => {
          expanded.index = index; drawExpanded();
        }, `View photograph ${index + 1} in ${expanded.album.title}`);
        thumb.append(picture(image, '', true)); strip.append(thumb);
      });
    }
    [...strip.children].forEach((thumb, index) => {
      const selected = index === expanded.index;
      thumb.classList.toggle('is-selected', selected); thumb.setAttribute('aria-pressed', String(selected));
    });
    requestAnimationFrame(() => strip.children[expanded?.index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  }
  function drawPhotographSidebar(photo, album) {
    const sidebar = $('photograph-sidebar'); sidebar.replaceChildren();
    sidebar.append(node('span', 'photo-section-label', 'Photography'), node('h2', 'photo-sidebar-title', album.title));
    const location = node('section', 'photo-place');
    location.append(node('h3', '', 'Location'), node('p', '', window.atlasCopy?.address('photo.' + photo.id) || state.locations[photo.id]?.label || 'Location not set'));
    photoMapButton.hidden = !state.locations[photo.id]; photoMapButton.textContent = 'Show on Map';
    location.append(photoMapButton); sidebar.append(location);
    const introduction = node('section', 'photo-introduction');
    const descriptions = { 'light-experiments': 'Light, colour, and the traces they leave.', 'river-and-bridges': 'Water, crossings, and the river’s edge.', 'street-observations': 'Small observations from the street.', 'lands': 'A little time in the open air.', 'portraits': 'People, seen through the camera.', 'architecture': 'Built spaces and the lines that hold them.', 'sports': 'Bodies, gestures, and movement.' };
    const caption = node('p', 'photo-caption', photo.description || descriptions[album.id] || ''); caption.dataset.copyId = 'photo.' + photo.id;
    introduction.append(caption); sidebar.append(introduction);
  }
  function stepExpanded(direction) {
    if (!expanded) return;
    const exhibition = expanded.origin === 'gallery' || expanded.origin === 'map';
    const index = expanded.index + direction;
    if (exhibition) expanded.index = (index + expanded.images.length) % expanded.images.length;
    else if (index >= 0 && index < expanded.images.length) expanded.index = index;
    drawExpanded();
  }
  function expand(images, index, origin, album = null) {
    expanded = { images, index, origin, album, returnFocus: document.activeElement };
    $('photograph-viewer').dataset.section = origin === 'band' ? 'music' : origin === 'entry' ? 'notes' : origin === 'about' ? 'story' : origin === 'places' ? 'places' : 'work';
    $('photograph-viewer').classList.toggle('is-band-view', origin === 'band');
    strips?.setSuspended(true);
    $('close-photograph').setAttribute('aria-label', origin === 'gallery' ? 'Close photograph and return to Gallery' : origin === 'map' ? 'Close photograph and return to Map' : 'Close photograph');
    drawExpanded(); $('photograph-viewer').showModal(); $('close-photograph').focus();
  }
  function closeExpanded() {
    if (!expanded) return;
    const { origin, index, images, returnFocus } = expanded;
    const portfolioIndex = photos.findIndex(photo => photo.id === images[index].id);
    $('photograph-viewer').close(); expanded = null;
    if (origin === 'gallery') { state.photo = portfolioIndex; strips?.setSuspended(false); }
    if (origin === 'map') { state.photo = portfolioIndex; render(); }
    if (origin === 'entry' && state.post) selectEntryImage(data.journal.find(entry => entry.id === state.post), index);
    requestAnimationFrame(() => {
      if (origin === 'entry' && $('journal-post').open) $('journal-post-content').querySelectorAll('.entry-grid-photo')[index]?.focus({ preventScroll: true });
      else if (origin === 'map' && $('chapter').open) stage.querySelector('.map-selected-photo')?.focus({ preventScroll: true });
      else if ($('chapter').open && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    });
  }
  const photoMapButton = button('Show on Map', 'image-map-link', () => {
    const index = photos.findIndex(photo => photo.id === expanded.images[expanded.index].id);
    closeExpanded(); state.photo = index; state.photographyView = 'map';
    const location = state.locations[photos[index].id];
    state.reviewOpen = false;
    if (location) state.mapView = { center: location.coordinates, zoom: location.precision === 'city' ? 10 : 13 };
    render();
  });
  photoMapButton.hidden = true;
  $('close-journal-post').addEventListener('click', closePost);
  $('journal-post').addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); closePost(); });
  $('close-photograph').addEventListener('click', closeExpanded);
  $('photograph-viewer').addEventListener('cancel', event => { event.preventDefault(); closeExpanded(); });
  $('image-previous').addEventListener('click', () => stepExpanded(-1));
  $('image-next').addEventListener('click', () => stepExpanded(1));
  $('neighbor-previous').addEventListener('click', () => stepExpanded(-1));
  $('neighbor-next').addEventListener('click', () => stepExpanded(1));
  window.addEventListener('keydown', event => {
    if (expanded && ['ArrowLeft', 'ArrowRight'].includes(event.key) && !event.target.matches('input,textarea,select')) {
      event.preventDefault();
      stepExpanded(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  window.atlasReader = {
    useGallery() { state.photographyView = 'gallery'; },
    open(section) {
      const token = ++journalVisit;
      $('chapter').classList.toggle('is-band', section === 'music');
      const supported = ['story', 'work', 'notes', 'music', 'places'].includes(section);
      if (!supported) { saveScroll(); disposeMap(); disposeWall(); disposeJournal(); state.section = section; stage.replaceChildren(); return false; }
      saveScroll(); state.section = section;
      if (section === 'work' && new URLSearchParams(location.search).get('view') === 'map') state.photographyView = 'map';
      render();
      const query = new URLSearchParams(location.search);
      if (section === 'notes') {
        const requested = data.journal.find(entry => entry.id === query.get('post'));
        if (requested) requestAnimationFrame(() => { if (token === journalVisit) openPost(requested); });
        else requestAnimationFrame(() => openJournalIntroduction(token));
      }
      if (section === 'work') {
        const album = albums.find(album => album.id === query.get('album'));
        if (album) requestAnimationFrame(() => { if (token === journalVisit) expand(album.images, 0, 'gallery', album); });
        const requested = photos.findIndex(photo => photo.id === query.get('photo'));
        if (requested >= 0) requestAnimationFrame(() => { if (token === journalVisit) expandPortfolio(requested, 'gallery'); });
      }
      return true;
    },
    suspend() {
      journalVisit++;
      saveScroll();
      if (expanded) closeExpanded();
      if ($('journal-post').open) closePost();
      disposeMap(); disposeWall(); disposeJournal();
    }
  };
})();
