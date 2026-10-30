/* Local sound only. No AudioContext is created until a deliberate gesture. */
(() => {
 'use strict';
 const audio=document.createElement('audio');audio.preload='none';audio.id='band-recording';audio.setAttribute('aria-label','G10 — Anyone');
 const source='media/audio/g10-anyone.mp3',key='haoran-sound-v1';
 let recordingURL=null,recordingPromise=null;
 let master=.45,muted=false,context=null,bus=null,voices=[],noise=null,fadeFrame=null,token=0,inBand=false,unlocked=false,player=null,lastEffect=0,preparing=false;
 try{const v=JSON.parse(localStorage.getItem(key)||'{}');if(Number.isFinite(v.volume))master=Math.max(0,Math.min(1,v.volume));muted=!!v.muted;}catch{}
 const panel=document.createElement('details');panel.id='sound-controls';
 panel.innerHTML='<summary aria-label="Sound settings"><span class="sound-state">Sound</span><span aria-hidden="true">♫</span></summary><div class="sound-popover"><button type="button" id="sound-mute" aria-pressed="false">Mute</button><label>Volume<input id="sound-volume" type="range" min="0" max="100" value="45" aria-label="Global sound volume"></label></div>';
 document.body.append(panel);document.body.append(audio);
 const loadingScreen=document.getElementById('loading-screen');panel.hidden=!loadingScreen.hidden;
 new MutationObserver(()=>{panel.hidden=!loadingScreen.hidden;}).observe(loadingScreen,{attributes:true,attributeFilter:['hidden']});
 const mute=panel.querySelector('#sound-mute'),volume=panel.querySelector('#sound-volume'),label=panel.querySelector('.sound-state');
 function persist(){try{localStorage.setItem(key,JSON.stringify({volume:master,muted}));}catch{}}
 function update(){
  label.textContent=muted||master===0?'Muted':'Sound';mute.textContent=muted?'Unmute':'Mute';mute.setAttribute('aria-pressed',String(muted));volume.value=String(Math.round(master*100));
  if(!fadeFrame&&!preparing)audio.volume=muted?0:master*.8;if(bus&&context)bus.gain.setTargetAtTime(muted?0:master*(audio.paused ? .17 : .018),context.currentTime,.05);persist();updatePlayer();
 }
 function unlock(){
  unlocked=true;
  if(!context){const AC=window.AudioContext||window.webkitAudioContext;if(AC){context=new AC();bus=context.createGain();bus.gain.value=master*.17;bus.connect(context.destination);}}
  if(context?.state==='suspended')context.resume().catch(()=>{});update();
 }
 function clearVoices(){voices.forEach(n=>{try{n.stop();}catch{}try{n.disconnect();}catch{}});voices=[];}
 function noiseBuffer(){
  if(noise)return noise;noise=context.createBuffer(1,context.sampleRate,context.sampleRate);const a=noise.getChannelData(0);let seed=98713;
  for(let i=0;i<a.length;i++){seed=(seed*16807)%2147483647;a[i]=seed/1073741824-1;}return noise;
 }
 function effect(name){
  if(!unlocked||!context||context.state!=='running'||muted||master===0||document.hidden)return;
  const now=performance.now();if(now-lastEffect<65)return;lastEffect=now;clearVoices();
  const t=context.currentTime,duck=audio.paused?1:.1;bus.gain.setValueAtTime(master*.17*duck,t);
  function tone(freq,duration,level,type='sine',end=freq){
   const o=context.createOscillator(),g=context.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);
   g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(level,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(bus);o.start(t);o.stop(t+duration+.01);voices.push(o);o.onended=()=>{o.disconnect();g.disconnect();voices=voices.filter(v=>v!==o);};
  }
  function hiss(duration,cutoff,level){
   const n=context.createBufferSource(),f=context.createBiquadFilter(),g=context.createGain();n.buffer=noiseBuffer();f.type='lowpass';f.frequency.value=cutoff;
   g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(level,t+.06);g.gain.exponentialRampToValueAtTime(.0001,t+duration);n.connect(f);f.connect(g);g.connect(bus);n.start(t);n.stop(t+duration);voices.push(n);n.onended=()=>{n.disconnect();f.disconnect();g.disconnect();voices=voices.filter(v=>v!==n);};
  }
  if(name==='bell'){tone(1110,.56,.38);tone(1665,.33,.13);}
  else if(name==='water')hiss(.78,470,.43);
  else if(name==='page')hiss(.14,2400,.25);
  else if(name==='door'){tone(155,.18,.21,'triangle',77);hiss(.13,700,.16);}
  else tone(590,.045,.19,'sine',390);
 }
 function fade(to,duration,done){
  cancelAnimationFrame(fadeFrame);const from=audio.volume,start=performance.now();
  function frame(now){const t=Math.min(1,(now-start)/duration);audio.volume=Math.max(0,Math.min(1,from+(to-from)*t));if(t<1)fadeFrame=requestAnimationFrame(frame);else{fadeFrame=null;done?.();}}
  fadeFrame=requestAnimationFrame(frame);
 }
 const time=n=>Number.isFinite(n)?`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`:'0:00';
 let status='Ready to play';
 function updatePlayer(){
  if(!player?.isConnected)return;
  const b=player.querySelector('.music-toggle'),seek=player.querySelector('.music-seek');b.textContent=audio.paused?'Play':'Pause';b.setAttribute('aria-pressed',String(!audio.paused));
  seek.max=Number.isFinite(audio.duration)?audio.duration:1;seek.value=Number.isFinite(audio.currentTime)?audio.currentTime:0;seek.disabled=!Number.isFinite(audio.duration);
  player.querySelector('.music-time').textContent=`${time(audio.currentTime)} / ${time(audio.duration)}`;player.querySelector('.music-status').textContent=status;
 }
 async function recordingSource(){
  if(recordingURL)return recordingURL;
  if(!recordingPromise)recordingPromise=(async()=>{
   const response=await fetch(source,{cache:'force-cache'});if(!response.ok)throw Error('Recording unavailable');
   const blob=await response.blob(),expected=window.atlasLoading?.assets?.find(asset=>asset.url===source);
   if(expected){
    if(blob.size!==expected.bytes)throw Error('Incomplete recording');
    const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
    const value=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
    if(value!==expected.sha256)throw Error('Recording changed');
   }
   recordingURL=URL.createObjectURL(blob);return recordingURL;
  })().catch(error=>{recordingPromise=null;throw error;});
  return recordingPromise;
 }
 async function playMusic(){
  const request=++token;preparing=true;cancelAnimationFrame(fadeFrame);fadeFrame=null;
  audio.volume=0;status='Buffering…';updatePlayer();
  try{
   const url=await recordingSource();if(request!==token||!inBand)return;
   if(audio.src!==url||audio.error){audio.src=url;audio.load();}
   await audio.play();if(request!==token)return;if(!inBand){audio.pause();audio.currentTime=0;return;}
   preparing=false;status='Playing';fade(muted?0:master*.8,1250);update();
  }catch(e){if(request!==token)return;preparing=false;status=e.name==='NotAllowedError'?'Press Play to listen.':'Unable to play. Press Play to try again.';updatePlayer();}
 }
 function enterBand(){inBand=true;audio.currentTime=0;playMusic();}
 function leaveBand(immediate=false){
  inBand=false;token++;preparing=false;status='Ready to play';
  if(immediate||audio.paused){cancelAnimationFrame(fadeFrame);fadeFrame=null;audio.pause();audio.currentTime=0;updatePlayer();update();return;}
  fade(0,420,()=>{audio.pause();audio.currentTime=0;status='Ready to play';update();});
 }
 function createPlayer(){
  player=document.createElement('section');player.className='music-player';player.setAttribute('aria-label','G10 — Anyone music player');
  player.innerHTML='<div class="music-player-heading"><h3>G10 — Anyone</h3><span class="music-status" role="status">Ready to play</span></div><div class="music-player-controls"><button type="button" class="music-toggle" aria-pressed="false">Play</button><label class="music-seek-label"><span class="screen-reader">Recording position</span><input class="music-seek" type="range" min="0" max="1" value="0" step="0.1" aria-label="Recording position" disabled></label><span class="music-time">0:00 / 0:00</span></div>';
  player.querySelector('.music-toggle').addEventListener('click',()=>{unlock();if(audio.paused){inBand=true;playMusic();}else{token++;preparing=false;cancelAnimationFrame(fadeFrame);fadeFrame=null;audio.pause();status='Paused';update();}});
  player.querySelector('.music-seek').addEventListener('input',e=>{if(Number.isFinite(audio.duration))audio.currentTime=Number(e.target.value);updatePlayer();});
  updatePlayer();return player;
 }
 ['timeupdate','durationchange','loadedmetadata','pause','play','ended'].forEach(e=>audio.addEventListener(e,()=>{if(e==='ended')status='Finished';updatePlayer();if(e==='play'||e==='pause'||e==='ended')update();}));
 audio.addEventListener('waiting',()=>{status='Buffering…';updatePlayer();});audio.addEventListener('playing',()=>{status='Playing';updatePlayer();});
 audio.addEventListener('error',()=>{status='Unable to load the recording. Press Play to retry.';updatePlayer();});
 mute.addEventListener('click',()=>{unlock();muted=!muted;cancelAnimationFrame(fadeFrame);fadeFrame=null;update();});volume.addEventListener('input',()=>{const requested=Number(volume.value)/100;unlock();master=requested;cancelAnimationFrame(fadeFrame);fadeFrame=null;update();});
 panel.querySelector('summary').addEventListener('click',()=>{if(document.querySelector('#atlas')?.dataset.phase!=='cover')unlock();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearVoices();if(inBand||!audio.paused||preparing||fadeFrame)leaveBand(true);}});
 document.addEventListener('click',e=>{if(unlocked&&e.target.closest('button')&&!e.target.closest('.music-player,#sound-controls'))effect('click');});
 new MutationObserver(()=>{
  const top=[...document.querySelectorAll('dialog[open]')].at(-1);const destination=top||document.body;
  if(panel.parentElement!==destination){panel.open=false;destination.append(panel);}
 }).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
 setInterval(()=>{if(unlocked&&!document.hidden&&document.querySelector('#atlas')?.dataset.phase==='explore'&&!document.querySelector('dialog[open]')&&audio.paused)effect('water');},16000);
 window.atlasSound={unlock,effect,enterBand,leaveBand,createPlayer,snapshot:()=>({unlocked,context:context?.state||'none',inBand,paused:audio.paused,time:audio.currentTime,volume:master,muted,src:audio.getAttribute('src'),source:recordingURL?source:null,status,duck:audio.paused?1:.1,voices:voices.length})};update();
})();
