/* One cancellable coordinator for the persistent river, routes and cyclist. */
(() => {
'use strict';
const $=id=>document.getElementById(id),atlas=$('atlas'),canvas=$('river'),ctx=canvas.getContext('2d',{alpha:false});
const motion=matchMedia('(prefers-reduced-motion: reduce)'),scene=createAtlasWorld(),stations=ATLAS_WORLD_LAYOUT,stops=scene.stops;
const labelMeasure=document.createElement('canvas').getContext('2d');
const TRAVEL_SLOWDOWN=1.2,DOOR_PAUSE=850;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=v=>v*v*(3-2*v),lerp=(a,b,t)=>a+(b-a)*t;
let phase='cover',ready=false,camera=0,width=1440,height=900,worldY=180,transition=null,pointer=null,active=null,current='story',stopKey='story';
let cyclistX=0,cyclistY=444,cyclistScreen=.5,facing=1,ambient=0,last=0,savedFocus=null,wheelTimer,portalCache='',lastCharacter=0,suppressPortalClickUntil=0;
let transport='cycle',parkedBicycle=null,loopReady=false;
const scrolls=new Map(),portalByKey=new Map(),cameraFor=x=>clamp(x,0,scene.world.width-200)-width/2;
const coverCamera=()=>Math.min(-1550-width/2,-width-180),center=()=>camera+width/2;
const sound=name=>window.atlasSound?.effect(name),stationFor=id=>stations.find(s=>s.id===id);
const nearest=(x,items=stops)=>items.reduce((a,b)=>Math.abs(b.center-x)<Math.abs(a.center-x)?b:a);
function setPhase(next){
 phase=next;atlas.dataset.phase=next;const explore=next==='explore';
 $('world-interface').hidden=!explore;$('world-interface').inert=!explore;$('world-interface').setAttribute('aria-hidden',String(!explore));
 $('cover').hidden=next!=='cover'&&next!=='entering';$('cover').inert=next!=='cover';$('cover').setAttribute('aria-hidden',String(next!=='cover'));
 $('entry-controls').hidden=next!=='entering'&&next!=='looping';
 $('pause-loop').hidden=next!=='looping';
 $('skip').setAttribute('aria-label',next==='looping'?'Skip the return ride':'Skip introduction');
 if(next!=='ending'&&$('ending').open)$('ending').close();
 canvas.setAttribute('aria-label',next==='cover'?'A quiet stone bridge outside the river town. A cyclist waits on the left. Press Play to enter.':'An original two-dimensional river town. Use section links, buildings, arrow keys or drag the river to explore.');updateControls();
}
function stopTravel(){if(transition?.mode==='ferry'&&transition.pose!=='cycle')transport='foot';transition=null;cyclistY=atlasGroundAt(cyclistX);atlas.dataset.transition='idle';updateControls();}
function updateControls(){
 const traveling=!!transition&&phase==='explore';$('journey-controls').hidden=!traveling;
 $('pause-visit').hidden=false;$('skip-visit').hidden=false;$('resume-journey').hidden=true;$('leave-journey').hidden=false;
 $('pause-visit').textContent=transition?.paused?'Resume':'Pause';
 $('pause-loop').textContent=transition?.paused?'Resume ride':'Pause ride';
 $('journey-message').textContent=transition?.paused?'Journey paused':transition?.mode==='arrival'?transition.target.title:transition?.mode==='ferry'?'Across the water':`Along the river to ${transition?.target?.title||'the bridge'}`;
 atlas.dataset.journey=traveling?'active':'none';
}
function resize(){
 const r=atlas.getBoundingClientRect(),old=center(),narrow=r.width<650&&r.height>r.width;
 height=narrow?1100:900;width=Math.round(height*r.width/r.height);worldY=narrow?248:180;
 canvas.width=width;canvas.height=height;ctx.imageSmoothingEnabled=false;
 if(phase==='cover'){camera=coverCamera();cyclistX=camera+width*.18;}
 else if(phase==='entering'||phase==='looping')finishEntry(false);
 else{camera=cameraFor(old);if(!transition)cyclistX=center();}
 portalCache='';position();
}
function buildPortals(){
 const fragment=document.createDocumentFragment();
 stops.forEach(stop=>{
  const b=document.createElement('button');b.className='portal main-portal'+(stop.signWidth?' has-sign':'');b.dataset.station=stop.id;b.dataset.stop=stop.key;
  b.setAttribute('aria-label',`Visit ${stop.title}`);
  const label=document.createElement('span');label.className='portal-label';label.textContent=stop.title;b.append(label);
  b.addEventListener('click',()=>{if(pointer?.moved)return;selectSection(stop.id,true,true);});
  fragment.append(b);portalByKey.set(stop.key,b);
 });$('portals').replaceChildren(fragment);
}
function position(){
 const nearestMain=nearest(center(),stations);if(!transition&&!active)current=nearestMain.id;
 const cache=`${Math.round(camera)}:${width}:${height}:${phase}:${current}:${stopKey}:${active}:${!!transition}`;if(cache===portalCache)return;portalCache=cache;
 stops.forEach(stop=>{
  const b=portalByKey.get(stop.key),x=stop.range[0]-camera,w=stop.range[1]-stop.range[0];if(!b)return;
  const visible=x+w>0&&x<width;b.hidden=!visible;
  if(visible){b.style.left=`${x/width*100}%`;b.style.width=`${w/width*100}%`;b.style.top=`${(worldY+stop.verticalRange[0])/height*100}%`;b.style.height=`${(stop.verticalRange[1]-stop.verticalRange[0])/height*100}%`;}
  if(visible&&stop.main){const label=b.querySelector('.portal-label'),ratio=canvas.clientHeight/height;label.style.top=`${((stop.labelY||stop.verticalRange[0])-stop.verticalRange[0])*ratio-(stop.signWidth?0:31)}px`;if(stop.signWidth){labelMeasure.font='16px "Weapon Get 2"';const size=Math.min(14,(stop.signWidth-12)*16/labelMeasure.measureText(label.textContent).width);label.style.fontSize=`${size*ratio}px`;label.style.width=`${stop.signWidth*ratio}px`;label.style.height=`${20*ratio}px`;}}
  b.classList.toggle('is-stop',stop.key===stopKey&&!transition);
 });
 document.querySelectorAll('.world-header [data-section]').forEach(b=>{const selected=b.dataset.section===(active||current);b.classList.toggle('is-current',selected);if(selected)b.setAttribute('aria-current','location');else b.removeAttribute('aria-current');});
 document.querySelector('.world-header nav').style.setProperty('--route-progress',clamp(stations.findIndex(s=>s.id===(active||current))/4,0,1));
 $('location').textContent=transition?transition.target?.title||'Along the river':nearest(center()).title;
 $('pan-left').disabled=center()<=stops[0].center+4;$('pan-right').disabled=center()>=stops.at(-1).center-4;
 const aboutX=stations[0].center-camera;
 $('about-entrance').hidden=phase!=='explore'||active!==null||!!transition||aboutX<70||aboutX>width-70;
 $('about-entrance').style.left=`${clamp(aboutX/width*100,18,82)}%`;
 const dock=scene.ferryChannel,nearLeft=Math.abs(center()-dock.left)<650,nearRight=Math.abs(center()-dock.right)<650,boatX=nearRight?dock.right:dock.left;
 $('board-ferry').hidden=phase!=='explore'||!!active||!!transition||(!nearLeft&&!nearRight)||boatX-camera<60||boatX-camera>width-60;
 $('board-ferry').style.left=`${(boatX-camera)/width*100}%`;$('board-ferry').style.top=`${(worldY+570)/height*100}%`;
 const bike=scene.loopRestart,showBike=loopReady&&phase==='explore'&&!active&&!transition&&bike.bikeX-camera>-70&&bike.bikeX-camera<width+70;
 $('loop-bicycle').hidden=!showBike;
 if(showBike){$('loop-bicycle').style.left=`${(bike.bikeX-camera-58)/width*100}%`;$('loop-bicycle').style.top=`${(worldY+bike.ground-102)/height*100}%`;$('loop-bicycle').style.width=`${116/width*100}%`;$('loop-bicycle').style.height=`${108/height*100}%`;}
}
function writeHistory(view,section=null,replace=false,consume=true){
 const state={river:true,view,section,center:center(),actorX:cyclistX,stopKey,current,transport,parkedBicycle,loopReady},hash=view==='chapter'?section:view==='ending'?'ending':view==='cover'?'':'river',url=new URL(location.href);url.hash=hash;
 if(consume)['post','photo','album','copy','at','view','story'].forEach(k=>url.searchParams.delete(k));history[replace?'replaceState':'pushState'](state,'',url);
}
function closeReader(){
 if(active){scrolls.set(active,$('chapter').scrollTop);window.atlasReader.suspend();window.atlasSound?.leaveBand();}
 if($('chapter').open)$('chapter').close();active=null;
}
function showChapter(station,gesture=false,historyMode=true){
 if(phase!=='explore')setPhase('explore');closeReader();active=station.id;current=station.id;stopKey=station.id;
 savedFocus=portalByKey.get(station.id)||document.querySelector(`[data-section="${station.id}"]`);
 $('chapter').dataset.section=station.id;$('chapter-title').textContent=station.title;$('chapter-place').textContent=station.place;
 const has=window.atlasReader.open(station.id);$('chapter').classList.toggle('has-content',has);$('chapter-description').hidden=has;$('chapter-empty').hidden=true;$('content-stage').hidden=!has;
 if(!has)$('chapter-description').textContent='I make photographs, write, and work with music. This river brings those ways of seeing together.';
 $('continue-journey').hidden=false;$('continue-journey').setAttribute('aria-label',station.id==='places'?'Next, to the closing bridge':`Next, to ${stations[stations.indexOf(station)+1]?.title}`);
 if(!$('chapter').open)$('chapter').showModal();$('chapter').scrollTop=scrolls.get(station.id)||0;$('close-chapter').focus({preventScroll:true});
 if(station.id==='music')window.atlasSound?.enterBand(gesture);sound('door');if(historyMode)writeHistory('chapter',station.id);position();
}
function arrive(target,open,gesture,historyMode=true,holdAtDoor=false){
 camera=cameraFor(target.center);cyclistX=target.center;cyclistY=atlasGroundAt(cyclistX);stopKey=target.key||target.id;current=target.id||'places';transition=null;atlas.dataset.transition='idle';position();updateControls();
 const portal=portalByKey.get(stopKey);portal?.classList.add('at-destination');setTimeout(()=>portal?.classList.remove('at-destination'),650);$('status').textContent=`Arrived at ${target.title}.`;sound('click');
 if(open&&holdAtDoor&&!motion.matches){
  transition={from:target.center,to:target.center,target,elapsed:0,duration:DOOR_PAUSE,mode:'arrival',pose:'standing',paused:false,done:()=>showChapter(stationFor(target.id),gesture,historyMode)};
  atlas.dataset.transition='arrival';updateControls();position();
 }
 else if(open)showChapter(stationFor(target.id),gesture,historyMode);
 else{if(historyMode)writeHistory('river');if(phase==='explore'&&!pointer)($('about-entrance').hidden?portal:$('get-inside'))?.focus({preventScroll:true});}
}
function startTravel(target,{open=false,gesture=false,duration=2200,mode,historyMode=true}={}){
 stopTravel();closeReader();releasePointer();setPhase('explore');const from=cyclistX,focusOffset=center()-from;
 const fromWater=from>scene.ferryChannel.start&&from<scene.ferryChannel.end,crosses=(from<scene.ferryChannel.start&&target.center>scene.ferryChannel.end)||(from>scene.ferryChannel.end&&target.center<scene.ferryChannel.start),ferry=mode==='ferry'||crosses||fromWater;
 const done=()=>{if(ferry)transport='foot';arrive(target,open,gesture,historyMode,open&&(gesture||duration>0));};if(motion.matches||duration===0){done();return;}
 const distance=Math.abs(target.center-from),direction=target.center>from?1:-1,travelMode=ferry?'ferry':transport==='foot'?'run':'ride';
 transition={from,to:target.center,target,focusOffset,elapsed:0,duration:(ferry?11000:transport==='foot'?Math.max(duration,Math.min(6500,1200+distance*1.6)):duration)*TRAVEL_SLOWDOWN,mode:travelMode,done,paused:false,approachTransport:transport,fromWater,direction,pose:transport==='foot'?'run':'cycle'};cyclistX=from;facing=direction;atlas.dataset.transition=ferry?'ferry':travelMode;updateControls();position();
 sound(ferry?'water':transport==='cycle'?'bell':'click');
}
function selectSection(id,animate=true,gesture=false,historyMode=true){const target=stationFor(id);if(!target||!ready)return;if(gesture)window.atlasSound?.unlock();if(id==='work'&&gesture)window.atlasReader.useGallery();startTravel(target,{open:true,gesture,duration:animate&&Math.abs(center()-target.center)>12?Math.min(3600,1400+Math.abs(center()-target.center)*.35):0,historyMode});}
function goToStop(stop,gesture=false){if(gesture)window.atlasSound?.unlock();const distance=Math.abs(center()-stop.center);startTravel(stop,{duration:distance<=12?0:Math.min(3600,1400+distance*.35),gesture});}
function stepStop(direction){
 if(phase!=='explore'||active)return;const x=transition?.target?.center??center(),stop=direction>0?stations.find(s=>s.center>x+12):[...stations].reverse().find(s=>s.center<x-12);if(stop)goToStop(stop,true);
}
function snapToNearest(){if(phase==='explore'&&!active){if(loopReady&&center()>stations.at(-1).center+500){writeHistory('river');position();return;}goToStop(nearest(center()));}}
function next(gesture=true){const index=stations.findIndex(s=>s.id===(active||current));if(index>=stations.length-1){endJourney();return;}selectSection(stations[Math.max(0,index+1)].id,true,gesture);}
function showEnding(historyMode=true){loopReady=true;transport='foot';current='places';stopKey='places';cyclistX=scene.loopRestart.standingX;cyclistY=444;camera=cameraFor(scene.loopRestart.bikeX+100);setPhase('ending');if(!$('ending').open)$('ending').showModal();$('ending-replay').focus();if(historyMode)writeHistory('ending');sound('water');}
function endJourney(){
 closeReader();stopTravel();setPhase('explore');const target={center:transport==='cycle'?scene.loopRestart.bikeX:scene.loopRestart.standingX,title:'The closing bridge',id:'places'};
 const done=()=>{
  camera=cameraFor(target.center);cyclistX=target.center;cyclistY=atlasGroundAt(cyclistX);
  if(motion.matches){showEnding();return;}
  transition={from:target.center,to:target.center,target,cameraStart:camera,duration:2300,elapsed:0,mode:'farewell',done:showEnding,paused:false};
  atlas.dataset.transition='farewell';updateControls();
 };
 if(motion.matches){done();return;}transition={from:cyclistX,to:target.center,target,focusOffset:center()-cyclistX,duration:3300*TRAVEL_SLOWDOWN,elapsed:0,mode:transport==='foot'?'run':'ride',done,paused:false};sound(transport==='cycle'?'bell':'click');updateControls();
}
function startLoopRide(){
 if(!ready)return;window.atlasSound?.unlock();closeReader();stopTravel();releasePointer();
 const bike=scene.loopRestart,fromCamera=camera;loopReady=false;transport='cycle';parkedBicycle=null;facing=1;cyclistX=bike.bikeX;cyclistY=444;setPhase('looping');sound('bell');
 if(motion.matches){finishEntry();return;}
 const ride=()=>{transition={from:bike.bikeX,to:scene.loopPeriod+stations[0].center,target:stations[0],elapsed:0,duration:7200*TRAVEL_SLOWDOWN,mode:'loop',paused:false,done:finishEntry};};
 transition={from:bike.bikeX,to:bike.bikeX,target:stations[0],elapsed:0,duration:950,mode:'mount',cameraStart:fromCamera,paused:false,done:ride};$('skip').focus({preventScroll:true});
}
function finishEntry(focus=true){
 stopTravel();loopReady=false;camera=cameraFor(stations[0].center);cyclistX=stations[0].center;lastCharacter=cyclistX;facing=1;cyclistY=444;cyclistScreen=.5;current='story';stopKey='story';setPhase('explore');position();writeHistory('river');$('status').textContent='You have arrived at About. Explore freely or get inside.';if(focus)$('get-inside').focus({preventScroll:true});
}
function play(){if(phase!=='cover'||!ready)return;window.atlasSound?.unlock();sound('bell');if(motion.matches){finishEntry();return;}setPhase('entering');transition={from:cyclistX,to:stations[0].center,target:stations[0],elapsed:0,duration:5800,mode:'entry',paused:false,done:finishEntry};$('skip').focus({preventScroll:true});}
function replay(push=true){stopTravel();closeReader();loopReady=false;transport='cycle';parkedBicycle=null;camera=coverCamera();cyclistX=camera+width*.18;cyclistY=atlasGroundAt(cyclistX);cyclistScreen=.18;facing=1;setPhase('cover');position();$('play').focus({preventScroll:true});if(push)writeHistory('cover');}
function returnToRiver(push=true){stopTravel();closeReader();position();if(push)writeHistory('river',null,true);const candidate=savedFocus?.isConnected&&!savedFocus.hidden?savedFocus:document.querySelector(`[data-section="${current}"]`);candidate?.focus({preventScroll:true});$('status').textContent='Back at the same river position.';}
function releasePointer(){const id=pointer?.id;pointer=null;atlas.classList.remove('dragging');if(id!==undefined&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}
function advance(dt){
 const tr=transition;if(!tr||tr.paused)return;tr.elapsed+=dt;const t=clamp(tr.elapsed/tr.duration,0,1);let x=lerp(tr.from,tr.to,ease(t)),y=atlasGroundAt(x);
 if(tr.mode==='mount'){x=scene.loopRestart.bikeX;y=444;tr.poseProgress=1-ease(t);camera=lerp(tr.cameraStart,x-width/2,ease(t));cyclistScreen=.5;}
 else if(tr.mode==='loop'){camera=x-width/2;cyclistScreen=.5;}
 else if(tr.mode==='farewell'){camera=lerp(tr.cameraStart,cameraFor(scene.loopRestart.bikeX+100),ease(t));cyclistScreen=.5;}
 else if(tr.mode==='entry'){cyclistScreen=lerp(.18,.5,ease(t));camera=x-width*cyclistScreen;}
 else if(tr.mode==='ferry'){
  const dock=scene.ferryChannel,fg=scene.ferryGeometry,dir=tr.direction,a=dir>0?dock.left:dock.right,b=dir>0?dock.right:dock.left,cycled=tr.approachTransport==='cycle'&&!tr.fromWater,bikeX=a-dir*150,approachX=cycled?bikeX:a-dir*80;
  tr.poseProgress=0;tr.seatProgress=0;tr.boatX=t<.39?a:b;
  if(tr.fromWater&&t<.65){x=lerp(tr.from,b,ease(t/.65));y=fg.deckWorldY;tr.pose='passenger';tr.seatProgress=1;tr.boatX=x;transport='foot';}
  else if(t<.14){x=lerp(tr.from,approachX,ease(t/.14));y=444;tr.pose=cycled?'cycle':'run';}
  else if(t<.22&&cycled){x=bikeX;y=444;tr.pose='dismount';tr.poseProgress=(t-.14)/.08;transport='foot';parkedBicycle={x:bikeX,y:444,direction:dir};}
  else if(t<.34){const begin=cycled?.22:.14,u=(t-begin)/(.34-begin),start=cycled?bikeX+dir*30:approachX;if(u<.32){x=lerp(start,a+fg.stairOffset,ease(u/.32));y=444;}else{const step=ease((u-.32)/.68);x=lerp(a+fg.stairOffset,a,step);y=lerp(444,fg.deckWorldY,step);}tr.pose='boarding';transport='foot';}
  else if(t<.39){x=a;y=fg.deckWorldY;tr.pose='sit-down';tr.seatProgress=ease((t-.34)/.05);transport='foot';}
  else if(t<.65){x=lerp(a,b,ease((t-.39)/.26));y=fg.deckWorldY;tr.pose='passenger';tr.seatProgress=1;tr.boatX=x;transport='foot';}
  else if(t<.70){x=b;y=fg.deckWorldY;tr.pose='stand-up';tr.seatProgress=1-ease((t-.65)/.05);transport='foot';}
  else if(t<.80){const u=ease((t-.70)/.10);x=lerp(b,b+fg.stairOffset,u);y=lerp(fg.deckWorldY,444,u);tr.pose='disembark';transport='foot';}
  else{x=lerp(b+fg.stairOffset,tr.to,ease((t-.80)/.20));y=atlasGroundAt(x);tr.pose='run';transport='foot';}
  const boatFocus=tr.fromWater&&t<.65?1:t<.27?0:t<.34?ease((t-.27)/.07):t<.70?1:t<.80?1-ease((t-.70)/.10):0;
  const boatCenter=(scene.ferryGeometry.leftOffset+scene.ferryGeometry.rightOffset)/2;
  tr.boarded=['sit-down','passenger','stand-up'].includes(tr.pose);camera=cameraFor(x+(tr.pose==='dismount'?dir*30*ease(tr.poseProgress):0)+boatCenter*boatFocus+(tr.focusOffset||0)*(1-ease(Math.min(t/.16,1))));cyclistScreen=.5;
 }else{camera=cameraFor(x+(tr.focusOffset||0)*(1-ease(Math.min(t/.18,1))));cyclistScreen=.5;}
 cyclistX=x;cyclistY=y;if(t>=1){transition=null;tr.done?.();}
}
function drawPart(image,start){const sx=Math.max(0,Math.floor(camera-start)),dx=Math.max(0,Math.floor(start-camera)),w=Math.min(image.width-sx,width-dx);if(w>0)ctx.drawImage(image,sx,0,w,600,dx,worldY,w,600);}
function render(time){
 const dt=Math.min(time-last||16,50);last=time;if(!document.hidden){if(!motion.matches)ambient+=dt;advance(dt);}
 const gradient=ctx.createLinearGradient(0,worldY,0,worldY+398);gradient.addColorStop(0,'#536a80');gradient.addColorStop(.63,'#8a9c9e');gradient.addColorStop(1,'#c3b295');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);ctx.fillStyle='#294b55';ctx.fillRect(0,worldY+529,width,height);
 drawPart(scene.approach.image,scene.approach.start);drawPart(scene.world,0);if(transition?.mode==='loop')drawPart(scene.world,scene.loopPeriod);
 for(let n=0;n<88;n++){const x=(n*137+ambient*.013-camera*.58)%(width+90),y=worldY+540+n*23%Math.max(34,height-worldY-550);ctx.fillStyle=n%7?'#43686a':'#8a9e8a';ctx.globalAlpha=.32+Math.sin(ambient/1500+n)*.14;ctx.fillRect(Math.round((x+width+90)%(width+90)-40),y,9+n%5*7,1+n%2);}ctx.globalAlpha=1;
 drawAtlasTrees(ctx,camera,worldY,ambient);
 const channel=scene.ferryChannel,fg=scene.ferryGeometry,onWater=cyclistX>channel.start&&cyclistX<channel.end,boatXs=transition?.mode==='ferry'?[transition.boatX??(facing>0?channel.left:channel.right)]:onWater?[cyclistX]:[channel.left,channel.right];
 const drift=(channel.start+channel.end)/2+Math.sin(ambient/18000)*200;
 if(drift-camera>-110&&drift-camera<width+110)drawAtlasTealBoat(ctx,drift-camera,worldY+390,ambient);
 const delta=cyclistX-lastCharacter;if(phase==='cover'||phase==='looping')facing=1;else if(Math.abs(delta)>.03)facing=delta>0?1:-1;
 const artTime=transition?.paused?transition.frozenArtTime??ambient:ambient,moving=transition?.mode!=='arrival'&&(Math.abs(delta)>.02||transition?.paused&&transition.wasMoving)&&!motion.matches;
 const seated=['sit-down','passenger','stand-up'].includes(transition?.pose)||onWater&&!transition;
 const inFrontOfBoat=seated||transition?.mode==='ferry'&&['boarding','disembark'].includes(transition.pose)&&cyclistY>444.5;
 if(!document.hidden&&parkedBicycle&&Math.abs(parkedBicycle.x-camera-width/2)<width/2+100)drawAtlasCyclist(ctx,parkedBicycle.x-camera,worldY+parkedBicycle.y,0,false,parkedBicycle.direction,1,false);
 // The closing bicycle is a permanent riverside prop. During mounting/riding
 // (or a cyclist's dismount), that same bicycle is drawn by the actor pose.
 const closingBikeX=scene.loopRestart.bikeX-camera;
 if(!document.hidden&&closingBikeX>-80&&closingBikeX<width+80&&phase!=='looping'&&!(transition?.mode==='farewell'&&transport==='cycle'))drawAtlasCyclist(ctx,closingBikeX,worldY+444,0,false,1,1,false);
 const drawCharacter=()=>{
 if(document.hidden)return;
 if(transition?.mode==='mount')drawAtlasDismount(ctx,scene.loopRestart.bikeX-camera,worldY+444,transition.poseProgress,1,1,true);
 else if(transition?.mode==='farewell'||phase==='ending')drawAtlasFarewell(ctx,cyclistX-camera,worldY+cyclistY,transition?.elapsed??2300,transport==='cycle');
 else if(transition?.pose==='dismount')drawAtlasDismount(ctx,cyclistX-camera,worldY+cyclistY,transition.poseProgress,facing,1,false);
 else if(seated){const bob=Math.round(Math.sin(ambient/1100)*.75)*2;drawAtlasFerryPassenger(ctx,cyclistX-camera,worldY+fg.deckWorldY+bob,transition?.seatProgress??1);}
 else if(transport==='foot'&&transition?.pose!=='cycle')drawAtlasPedestrian(ctx,cyclistX-camera,worldY+cyclistY,artTime,moving,facing,1,transition?.pose==='run'||transition?.mode==='run');
 else drawAtlasCyclist(ctx,cyclistX-camera,worldY+cyclistY,artTime,moving,facing,1,true,atlasRoadTiltAt(cyclistX));
 };
 // The promenade is behind the foreground ferry. Only a passenger or someone
 // using the open stern stairs belongs in front of the boat's cabin and roof.
 if(!inFrontOfBoat)drawCharacter();
 boatXs.forEach(x=>{if(x-camera>-fg.rightOffset&&x-camera<width-fg.leftOffset)drawAtlasBoat(ctx,x-camera,worldY+fg.deckWorldY,ambient);});
 if(inFrontOfBoat)drawCharacter();
 lastCharacter=cyclistX;position();requestAnimationFrame(render);
}
buildPortals();
$('play').addEventListener('click',play);$('skip').addEventListener('click',()=>finishEntry());$('replay').addEventListener('click',()=>replay());
$('pause-loop').addEventListener('click',()=>{if(phase!=='looping'||!transition)return;transition.paused=!transition.paused;if(transition.paused){transition.frozenArtTime=ambient;transition.wasMoving=transition.mode==='loop';}updateControls();});
$('cover-work').addEventListener('click',e=>{e.preventDefault();selectSection('work',false,true);});document.querySelectorAll('[data-section]').forEach(b=>b.addEventListener('click',()=>selectSection(b.dataset.section,true,true)));
[$('get-inside'),$('about-photo')].forEach(b=>b.addEventListener('click',()=>selectSection('story',false,true)));
$('world-next').addEventListener('click',()=>next());$('continue-journey').addEventListener('click',()=>{sound('page');next();});$('close-chapter').addEventListener('click',()=>returnToRiver());$('chapter').addEventListener('cancel',e=>{e.preventDefault();returnToRiver();});
$('pause-visit').addEventListener('click',()=>{if(transition){transition.paused=!transition.paused;if(transition.paused){transition.frozenArtTime=ambient;transition.wasMoving=transition.mode!=='arrival'&&!['dismount','passenger'].includes(transition.pose);}updateControls();}});$('skip-visit').addEventListener('click',()=>{const tr=transition;if(!tr)return;transition=null;camera=cameraFor(tr.to);cyclistX=tr.to;tr.done?.();});$('leave-journey').addEventListener('click',()=>{stopTravel();snapToNearest();});
$('pan-left').addEventListener('click',()=>stepStop(-1));$('pan-right').addEventListener('click',()=>stepStop(1));
$('board-ferry').addEventListener('click',()=>{window.atlasSound?.unlock();startTravel(stationFor(center()<8350?'notes':'music'),{mode:'ferry',gesture:true,duration:6500});});
$('ending-work').addEventListener('click',()=>selectSection('work',true,true));$('ending-explore').addEventListener('click',()=>{setPhase('explore');writeHistory('river');position();$('loop-bicycle').focus({preventScroll:true});});$('ending-replay').addEventListener('click',startLoopRide);$('loop-bicycle').addEventListener('click',startLoopRide);$('ending').addEventListener('cancel',e=>{e.preventDefault();$('ending-explore').click();});
// Pointer observation begins on both canvas and facade hit areas. A tap is
// left to the accessible button; only a real drag takes pointer capture.
atlas.addEventListener('pointerdown',e=>{
 if(phase!=='explore'||active||(e.target!==canvas&&!e.target.closest('.portal')))return;
 stopTravel();pointer={x:e.clientX,y:e.clientY,camera,actorOffset:cyclistX-center(),id:e.pointerId,moved:false,portal:!!e.target.closest('.portal')};
},true);
atlas.addEventListener('pointermove',e=>{
 if(!pointer)return;const dx=e.clientX-pointer.x;
 if(Math.hypot(dx,e.clientY-pointer.y)>6&&!pointer.moved){pointer.moved=true;try{canvas.setPointerCapture(e.pointerId);}catch{/* Synthetic or cancelled pointers can still finish locally. */}}
 if(pointer.moved){e.preventDefault();atlas.classList.add('dragging');camera=clamp(pointer.camera-dx*width/canvas.clientWidth,stops[0].center-width/2,(loopReady?scene.loopRestart.bikeX+300:stops.at(-1).center)-width/2);cyclistX=center()+pointer.actorOffset;cyclistY=atlasGroundAt(cyclistX);position();}
},true);
atlas.addEventListener('pointerup',e=>{
 const drag=pointer;if(!drag)return;releasePointer();
 if(drag.moved){suppressPortalClickUntil=performance.now()+220;e.preventDefault();snapToNearest();return;}
 if(drag.portal)return;
 const r=canvas.getBoundingClientRect(),x=camera+(e.clientX-r.left)/r.width*width,y=(e.clientY-r.top)/r.height*height-worldY;
 if(loopReady&&Math.abs(x-scene.loopRestart.bikeX)<60&&y>=340&&y<=454){startLoopRide();return;}
 const fg=scene.ferryGeometry;if(y>=fg.deckWorldY-fg.deckY&&y<=fg.deckWorldY-fg.deckY+fg.height&&[scene.ferryChannel.left,scene.ferryChannel.right].some(b=>x>=b+fg.leftOffset&&x<=b+fg.rightOffset)){$('board-ferry').click();return;}
 const hit=stops.find(s=>x>=s.range[0]&&x<=s.range[1]&&y>=s.verticalRange[0]&&y<=s.verticalRange[1]);if(hit)selectSection(hit.id,true,true);
},true);
atlas.addEventListener('click',e=>{if(performance.now()<suppressPortalClickUntil&&e.target.closest('.portal')){e.preventDefault();e.stopImmediatePropagation();}},true);
atlas.addEventListener('pointercancel',()=>{if(pointer){releasePointer();snapToNearest();}},true);
canvas.addEventListener('lostpointercapture',()=>{if(pointer){releasePointer();snapToNearest();}});
window.addEventListener('blur',()=>{if(pointer){releasePointer();snapToNearest();}});
canvas.addEventListener('wheel',e=>{if(phase!=='explore'||active||!(e.shiftKey||Math.abs(e.deltaX)>3))return;e.preventDefault();stopTravel();const actorOffset=cyclistX-center();camera=clamp(camera+(e.shiftKey?e.deltaY:e.deltaX),stops[0].center-width/2,(loopReady?scene.loopRestart.bikeX+300:stops.at(-1).center)-width/2);cyclistX=center()+actorOffset;cyclistY=atlasGroundAt(cyclistX);clearTimeout(wheelTimer);wheelTimer=setTimeout(snapToNearest,180);},{passive:false});
window.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select')||e.ctrlKey||e.metaKey||e.altKey)return;if((phase==='entering'||phase==='looping')&&e.key==='Escape'){finishEntry();return;}if(document.querySelector('dialog[open]'))return;if(phase==='explore'){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();stepStop(e.key==='ArrowRight'?1:-1);}if(e.key==='Escape'&&transition){stopTravel();snapToNearest();}}});
function restoreRoute(event){
 if(!ready)return;stopTravel();closeReader();const saved=event?.state?.river?event.state:null,hash=location.hash.slice(1);
 if(saved){const station=stationFor(saved.current)||stations[0],savedCenter=stops.some(s=>s.key===saved.stopKey)?saved.center:station.center;camera=cameraFor(savedCenter);cyclistX=Number.isFinite(saved.actorX)?saved.actorX:savedCenter;cyclistY=atlasGroundAt(cyclistX);current=station.id;stopKey=station.id;transport=saved.transport==='foot'?'foot':'cycle';loopReady=!!saved.loopReady;parkedBicycle=saved.parkedBicycle&&Number.isFinite(saved.parkedBicycle.x)?saved.parkedBicycle:null;}
 if(stationFor(hash)){setPhase('explore');if(!saved){camera=cameraFor(stationFor(hash).center);cyclistX=stationFor(hash).center;}showChapter(stationFor(hash),false,false);}
 else if(hash==='ending'){showEnding(false);}
 else if(hash==='river'){setPhase('explore');if(!saved){const requested=stops.find(s=>s.key===new URLSearchParams(location.search).get('at'))||stations[0];camera=cameraFor(requested.center);cyclistX=requested.center;cyclistY=atlasGroundAt(cyclistX);current=requested.id;stopKey=requested.key||requested.id;}position();(portalByKey.get(stopKey)||document.querySelector(`[data-section="${current}"]`))?.focus({preventScroll:true});}
 else replay(false);
}
window.addEventListener('popstate',restoreRoute);window.addEventListener('hashchange',()=>{if((active||'')!==location.hash.slice(1)&&!history.state?.river)restoreRoute();});
motion.addEventListener('change',()=>{if(motion.matches&&transition){if(phase==='looping'){finishEntry();return;}const tr=transition;transition=null;camera=cameraFor(tr.to);cyclistX=tr.to;tr.done?.();}});window.addEventListener('resize',resize);
window.atlasJourney={select:id=>selectSection(id,false,false),next:()=>next(false),snapshot:()=>({phase,camera,center:center(),current,stopKey,active,transport,parkedBicycle,loopReady,cyclist:{x:cyclistX,y:cyclistY,facing},transition:transition?{mode:transition.mode,pose:transition.pose,poseProgress:transition.poseProgress,seatProgress:transition.seatProgress,target:transition.target.id,elapsed:transition.elapsed,duration:transition.duration,paused:transition.paused,boatX:transition.boatX}:null,stops:stops.length,order:stations.map(s=>s.id),size:[width,height]})};
setPhase('cover');resize();requestAnimationFrame(render);
atlasLoading.ready.then(()=>{ready=true;portalCache='';$('play').disabled=false;requestAnimationFrame(()=>{atlasLoading.reveal();if(location.hash)restoreRoute();else if(new URLSearchParams(location.search).get('frame')==='arrival')finishEntry(false);else writeHistory('cover',null,true,false);});});
})();
