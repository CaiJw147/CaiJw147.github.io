/* Text is bound as text, never HTML. Original content data remain immutable. */
(() => {
 'use strict';
 const photoGroups=new Map();
 const key='haoran-copy-overrides-v1',records=new Map(),bindings=new WeakMap(),attributeBindings=new WeakMap();
 let overrides=Object.create(null),catalogue=[],queued=false,roots=new Set(),highlightTimer;
 document.documentElement.classList.toggle('is-editor-preview',new URLSearchParams(location.search).has('editor'));
 const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');};
 const resolve=(id,fallback)=>overrides[id]?.text??overrides[photoGroups.get(id)]?.text??fallback;
 function clean(raw){
  const input=raw?.overrides||raw||{},out=Object.create(null);if(typeof input!=='object'||Array.isArray(input))throw Error('Invalid overrides');
  for(const [id,item] of Object.entries(input)){
   if(!/^[a-zA-Z0-9._:-]{1,180}$/.test(id)||!item||typeof item!=='object')continue;
   const v={};if(typeof item.text==='string')v.text=item.text.slice(0,30000);if(typeof item.address==='string')v.address=item.address.slice(0,240);if(typeof item.merge==='boolean')v.merge=item.merge;if(typeof item.confirmed==='boolean')v.confirmed=item.confirmed;if(typeof item.needsAddress==='boolean')v.needsAddress=item.needsAddress;
   out[id]=v;
  }return out;
 }
 function readDraft(){try{return clean(JSON.parse(localStorage.getItem(key)||'{}'));}catch{return Object.create(null);}}
 const section=el=>el.closest('#chapter')?.dataset.section||el.closest('#journal-post')&&'notes'||el.closest('#photograph-viewer')?.dataset.section||el.closest('#ending')&&'ending'||el.closest('#loading-screen')&&'loading'||el.closest('#cover')&&'cover'||'river';
 const linkFor=area=>['story','work','music','notes','places'].includes(area)?`index.html#${area}`:area==='ending'?'index.html#ending':area==='river'?'index.html#river':area==='loading'?'index.html?review=loading':'index.html';
 function register(id,current,el,attribute=''){
  const area=section(el),location=attribute?`${el.tagName.toLowerCase()} · ${attribute}`:el.closest('button')?'Button':el.tagName.toLowerCase();
  if(!records.has(id))records.set(id,{id,type:current.length>80?'copy':'ui',category:area,location:`${area} / ${location}`,current,proposed:current,description:attribute?`Accessible ${attribute} text for ${area}.`:`${location==='Button'?'Action label':'Reading text'} in ${area}.`,link:linkFor(area),needsAddress:false,pending:false,locations:[]});
  const entry=records.get(id);
  const stop=el.closest('[data-stop]')?.dataset.stop;
  if(stop)entry.link='index.html?at='+stop+'#river';
  if(area==='work'&&el.closest('.photography-map-layout,.map-photo-strip,.map-toolbar-actions'))entry.link='index.html?view=map#work';
  const post=el.closest('#journal-post')?.dataset.entry,photo=el.closest('#photograph-viewer')?.dataset.photo;
  if(post)entry.link='index.html?post='+post+'#notes';else if(photo&&area==='work')entry.link='index.html?photo='+photo+'#work';
  const where=`${area} / ${location}`;if(!entry.locations.includes(where))entry.locations.push(where);
 }
 function textNode(node){
  const el=node.parentElement;if(!el||el.closest('script,style,noscript,[data-copy-ignore]'))return;
  let b=bindings.get(node),value=node.nodeValue;if(b&&value===b.written)return;
  const current=value.trim();if(!current||/^\d+(?:%|:\d+|\s*\/\s*\d+)?$/.test(current)||current==='×'||current==='…'||current==='→'||current==='←')return;
  const explicit=el.dataset.copyId&&el.dataset.copyAuto!==el.dataset.copyId?el.dataset.copyId:null,id=explicit||`text.${hash(current)}`;
  register(id,current,el);const proposed=resolve(id,undefined);
  const written=typeof proposed==='string'?value.replace(current,proposed):value;
  bindings.set(node,{id,base:value,written});el.dataset.copyId=id;if(!explicit)el.dataset.copyAuto=id;
  if(node.nodeValue!==written)node.nodeValue=written;
 }
 function attributes(el){
  if(el.closest('script,style,[data-copy-ignore]'))return;
  let map=attributeBindings.get(el);if(!map){map=new Map();attributeBindings.set(el,map);}
  for(const name of ['aria-label','alt','placeholder','title']){
   const value=el.getAttribute(name);if(!value)continue;const b=map.get(name);if(b&&value===b.written)continue;
   const id=(name==='alt'&&el.dataset.copyAlt)||`${name.replace('aria-','')}.${hash(value)}`;register(id,value,el,name);
   const written=overrides[id]?.text??value;map.set(name,{id,base:value,written});if(value!==written)el.setAttribute(name,written);
  }
 }
 function scan(root=document.body){
  if(!root?.isConnected)return;
  if(root.nodeType===Node.TEXT_NODE){textNode(root);return;}
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(walker.nextNode())textNode(walker.currentNode);
  if(root instanceof Element)attributes(root);root.querySelectorAll?.('[aria-label],[alt],[placeholder],[title]').forEach(attributes);
 }
 function schedule(root){roots.add(root);if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;const current=roots;roots=new Set();for(const root of current)scan(root);highlight();});}
 function apply(){
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);while(walker.nextNode()){
   const n=walker.currentNode,b=bindings.get(n);if(b){const out=resolve(b.id,b.base);b.written=out;if(n.nodeValue!==out)n.nodeValue=out;}else textNode(n);
  }
  document.querySelectorAll('[aria-label],[alt],[placeholder],[title]').forEach(el=>{const map=attributeBindings.get(el);if(map)for(const [attr,b] of map){const out=resolve(b.id,b.base);b.written=out;if(el.getAttribute(attr)!==out)el.setAttribute(attr,out);}else attributes(el);});
  document.dispatchEvent(new CustomEvent('atlas-copy-changed'));
 }
 function highlight(){
  const id=new URLSearchParams(location.search).get('copy');if(!id)return;
  const el=[...document.querySelectorAll('[data-copy-id]')].find(el=>el.dataset.copyId===id&&el.getClientRects().length);
  if(el&&!el.classList.contains('copy-highlight')){el.classList.add('copy-highlight');const surface=el.closest('.reader-scroll');if(surface){surface.scrollTop+=el.getBoundingClientRect().top-surface.getBoundingClientRect().top-surface.clientHeight*.3;}else if(!el.closest('dialog'))el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});clearTimeout(highlightTimer);highlightTimer=setTimeout(()=>el.classList.remove('copy-highlight'),5500);}
 }
 function set(raw){overrides=clean(raw);localStorage.setItem(key,JSON.stringify({version:1,overrides}));apply();}
 window.atlasCopy={key,hash,scan,records,get catalogue(){return catalogue;},get:id=>overrides[id]||{},text:resolve,address:id=>overrides[id]?.address||overrides[photoGroups.get(id)]?.address||'',set,clean,export:()=>({version:1,overrides}),bind:(el,id)=>{el.dataset.copyId=id;scan(el);return el;}};
 new MutationObserver(changes=>{for(const c of changes)schedule(c.type==='characterData'?c.target:c.target);}).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','alt','placeholder','title']});
 overrides=readDraft();scan();
 window.addEventListener('storage',e=>{if(e.key===key){overrides=readDraft();apply();}});
 window.atlasCopy.ready=Promise.all([
  fetch('copy-overrides.json',{cache:'no-store'}).then(r=>r.ok?r.json():{}).then(raw=>{overrides=Object.assign(clean(raw),readDraft());apply();}).catch(()=>{}),
  fetch('photo-groups.json',{cache:'no-store'}).then(r=>r.ok?r.json():{}).then(raw=>{catalogue=raw.items||[];for(const item of catalogue)if(item.type==='photo-group')for(const image of item.images||[])photoGroups.set('photo.'+image.id,item.id);apply();}).catch(()=>{})
 ]);
})();
