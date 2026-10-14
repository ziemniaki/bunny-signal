(function(){
  'use strict';
  const A=window.BunnyAudio,$=id=>document.getElementById(id),$$=s=>Array.from(document.querySelectorAll(s));
  const STORE='bunny-signal.session.v1',PARAMS=['fm','tone','grain','bloom','density','mutation','glitch','modDepth','crush','delay','space','volume'];
  let state=A.newSession(),engine=null,playing=false,starting=false,clockTimer=null,nextTime=0,step=0,bar=0,rng=A.random(831),queue=[],queuedScene=null,selectedSource=null,history=[],persistTimer,toastTimer,lastKick=-10,lastStep=-1;
  let recordSaving=false,recorder=null,recordChunks=[],recordDestination=null,recordTime=0,sampleBuffer=null,vizNight=false,calm=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let perf={stutter:false,reverse:false,tape:false,sparkle:false,tapeStart:0,xy:{x:0,y:0,active:false}},edit=null,rendering=false;
  const knobs={},seqButtons=[],trackRows=[],rulerButtons=[];
  try{const saved=localStorage.getItem(STORE);if(saved)state=A.validateSession(JSON.parse(saved));}catch(e){/* A damaged local draft must not prevent playing. */}
  $('calmMotion').checked=calm;
  const toast=(message)=>{$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3300);};
  function persist(){clearTimeout(persistTimer);persistTimer=setTimeout(()=>{try{localStorage.setItem(STORE,JSON.stringify(state));}catch(e){$('footerStatus').textContent='LOCAL SAVE FULL · DOWNLOAD YOUR SESSION';}},200);}
  function checkpoint(){history.push(JSON.stringify(state));if(history.length>24)history.shift();$('undoBtn').disabled=false;}
  function undo(){if(!history.length){toast('No edits to undo yet.');return;}state=A.validateSession(JSON.parse(history.pop()));syncUI();persist();toast('One happy accident undone.');}
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  function saveSession(){download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),`bunny-signal-${state.seed}.json`);toast('Your little universe, saved.');}
  function showDialog(id){const d=$(id);if(!d.open)d.showModal();}
  async function ensureEngine(){
    if(engine&&engine.ctx.state!=='closed'){await engine.ctx.resume();return engine;}
    const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)throw Error('This browser cannot synthesize audio. Try Safari, Chrome, or Firefox.');
    // Create and resume in the gesture callback, before awaiting module loading.
    const c=new AudioCtx({latencyHint:'interactive'});engine=new A.Engine(c);await c.resume();await engine.initWorklet();if(sampleBuffer)engine.setSample(sampleBuffer);
    c.onstatechange=()=>{if(playing&&c.state==='suspended'){stop();toast('Audio paused. Press play to continue.');}};return engine;
  }
  async function start(){
    if(playing||starting)return;starting=true;$('playLabel').textContent='WAKING UP…';
    try{await ensureEngine();playing=true;step=0;bar=0;nextTime=engine.ctx.currentTime+.06;rng=A.random(state.seed);queue=[];lastStep=-1;engine.update(state.params,state.tracks);clockTimer=setInterval(schedule,25);schedule();updateTransport();}
    catch(e){toast(e.message||'Audio could not start. Tap play to try again.');$('playLabel').textContent='LET’S PLAY';}
    finally{starting=false;}
  }
  function stop(){
    playing=false;clearInterval(clockTimer);clockTimer=null;queue=[];if(engine)engine.stop();if(recorder&&recorder.state==='recording')stopRecording();perf.stutter=perf.reverse=perf.tape=perf.sparkle=false;$$('.performance-pads button').forEach(b=>b.classList.remove('active'));highlight(-1,[]);lastStep=-1;updateTransport();
  }
  function togglePlay(){if(playing)stop();else start();}
  function updateTransport(){
    $('playBtn').classList.toggle('playing',playing);$('playBtn').setAttribute('aria-label',playing?'Stop':'Play');$('playLabel').textContent=playing?'STOP THE NOISE':'LET’S PLAY';$('playBtn').querySelector('.play-icon').textContent=playing?'■':'▶';
    document.querySelector('.clock').classList.toggle('live',playing);$('engineStatus').innerHTML=`<i></i> ${playing?'AUDIO LIVE':engine?'READY TO PLAY':'ENGINE SLEEPING'}`;$('vizTag').textContent=playing?'BUNNY HAS ENTERED THE CHAT ♡':'WAITING FOR THE BEAT ♡';
    if(!playing)$('barClock').textContent='01 : 01';
  }
  function schedule(){
    if(!playing||!engine)return;const now=engine.ctx.currentTime;
    // Skip stale work after a device stall. Never try to play missed notes in a burst.
    if(nextTime<now-.15){nextTime=now+.03;queue=[];}
    while(nextTime<now+.1){
      if(step===0){
        if(queuedScene!==null){state.scene=queuedScene;queuedScene=null;syncScenes();renderGrid();persist();}
        else if(state.autoScene&&bar>0&&bar%4===0){state.scene=(state.scene+1)%4;syncScenes();renderGrid();persist();}
        if(state.evolve&&bar>0&&bar%2===0){A.mutate(state,bar);renderGrid();persist();}
      }
      const scheduled=A.scheduleStep(engine,state,step,bar,nextTime,rng,perf);queue.push({time:nextTime,step,bar,triggers:scheduled.triggers});nextTime+=scheduled.duration;step=(step+1)%16;if(step===0)bar++;
    }
  }
  function highlight(index,triggers){
    if(lastStep>=0){for(let tr=0;tr<6;tr++)seqButtons[tr][lastStep]?.classList.remove('playhead');rulerButtons[lastStep]?.classList.remove('active');}
    if(index>=0){for(let tr=0;tr<6;tr++)seqButtons[tr][index].classList.add('playhead');rulerButtons[index].classList.add('active');}
    trackRows.forEach((r,i)=>r.classList.toggle('triggered',triggers.includes(i)));lastStep=index;
  }
  function buildGrid(){
    for(let i=0;i<16;i++){const n=document.createElement('span');n.className='step-number'+(i%4===0?' quarter':'');n.textContent=String(i+1).padStart(2,'0');$('ruler').appendChild(n);rulerButtons.push(n);}
    A.TRACKS.forEach((tr,track)=>{
      const row=document.createElement('div');row.className='seq-row';row.style.setProperty('--track-color',tr.color);
      row.innerHTML=`<div class="track-info"><i class="track-indicator"></i><div class="track-name"><button title="Audition ${tr.name}">${tr.name}</button><small>${tr.sub}</small><input class="track-volume" type="range" min="0" max="1" step="0.01" aria-label="${tr.name} volume"></div><button class="track-ctl mute" aria-label="Mute ${tr.name}" title="Mute">M</button><button class="track-ctl solo" aria-label="Solo ${tr.name}" title="Solo">S</button><button class="track-ctl lock" aria-label="Lock ${tr.name} pattern" title="Protect from generation">◇</button></div><div class="steps"></div>`;
      row.querySelector('.track-name button').addEventListener('click',()=>audition(track));
      ['mute','solo','lock'].forEach(k=>row.querySelector('.'+k).addEventListener('click',()=>{checkpoint();state.tracks[track][k]=!state.tracks[track][k];renderGrid();if(engine)engine.update(state.params,state.tracks);persist();}));
      const volume=row.querySelector('.track-volume');volume.value=state.tracks[track].volume;volume.addEventListener('pointerdown',checkpoint);volume.addEventListener('input',()=>{state.tracks[track].volume=Number(volume.value);if(engine)engine.update(state.params,state.tracks);persist();});
      const buttons=[];
      for(let i=0;i<16;i++){
        const b=document.createElement('button');b.className='step';b.setAttribute('aria-label',`${tr.name}, step ${i+1}`);b.innerHTML='<span class="step-label"></span><i class="velocity-line"></i><span class="ratchet-label"></span>';
        let longTimer=null,longPressed=false,startPoint=null;
        b.addEventListener('pointerdown',e=>{if(e.button!==0)return;longPressed=false;startPoint={x:e.clientX,y:e.clientY};longTimer=setTimeout(()=>{longPressed=true;openStep(track,i);},460);});
        b.addEventListener('pointermove',e=>{if(startPoint&&Math.hypot(e.clientX-startPoint.x,e.clientY-startPoint.y)>9){clearTimeout(longTimer);startPoint=null;}});
        const cancel=()=>{clearTimeout(longTimer);startPoint=null;};b.addEventListener('pointerup',cancel);b.addEventListener('pointercancel',cancel);b.addEventListener('pointerleave',cancel);
        b.addEventListener('click',e=>{if(longPressed){longPressed=false;return;}if(e.shiftKey){openStep(track,i);return;}checkpoint();const cell=state.scenes[state.scene][track][i];cell.on=!cell.on;renderGrid();persist();if(cell.on&&!playing)audition(track,cell);});
        b.addEventListener('contextmenu',e=>{e.preventDefault();cancel();openStep(track,i);});row.querySelector('.steps').appendChild(b);buttons.push(b);
      }
      seqButtons.push(buttons);trackRows.push(row);$('sequencerGrid').appendChild(row);
    });
  }
  function renderGrid(){
    const solo=state.tracks.some(t=>t.solo);
    A.TRACKS.forEach((tr,i)=>{
      const row=trackRows[i],track=state.tracks[i];row.classList.toggle('muted',track.mute||(solo&&!track.solo));['mute','solo','lock'].forEach(k=>{const b=row.querySelector('.'+k);b.classList.toggle('active',track[k]);b.setAttribute('aria-pressed',String(track[k]));if(k==='lock')b.textContent=track.lock?'◆':'◇';});row.querySelector('.track-volume').value=track.volume;
      state.scenes[state.scene][i].forEach((c,j)=>{const b=seqButtons[i][j],label=tr.pitched?A.noteName(A.noteMidi(c.degree,state.params.key,state.params.scale)):'';b.classList.toggle('active',c.on);b.setAttribute('aria-pressed',String(c.on));b.querySelector('.step-label').textContent=c.on?label:'';b.querySelector('.velocity-line').style.width=c.on?(c.vel*76)+'%':'0';b.querySelector('.ratchet-label').textContent=c.on&&c.ratchet>1?c.ratchet:'';b.title=`${tr.name} ${j+1}${label?' · '+label:''} · ${Math.round(c.vel*100)}% velocity · ${Math.round(c.prob*100)}% chance. Hold to edit.`;});
    });
  }
  async function audition(track,cell){try{await ensureEngine();engine.update(state.params,state.tracks);cell=cell||{vel:.75,degree:track===3?-7:track===4?7:0};engine.trigger(track,engine.ctx.currentTime+.01,cell.vel,cell.degree,state.params,{});}catch(e){toast(e.message);}}
  function openStep(track,index){
    checkpoint();edit={track,index,scene:state.scene};const cell=state.scenes[edit.scene][track][index];cell.on=true;const pitched=!!A.TRACKS[track].pitched;$('stepTitle').textContent=`${A.TRACKS[track].name} · ${String(index+1).padStart(2,'0')}`;$('stepNoteWrap').hidden=!pitched;
    $('stepNote').replaceChildren();const length=A.SCALES[state.params.scale].length;for(let d=-2*length;d<=4*length;d++){const o=document.createElement('option');o.value=d;o.textContent=A.noteName(A.noteMidi(d,state.params.key,state.params.scale));$('stepNote').appendChild(o);}$('stepNote').value=cell.degree;
    $('stepVelocity').value=cell.vel;$('stepProbability').value=cell.prob;$('stepRatchet').value=cell.ratchet;stepOutputs();renderGrid();showDialog('stepDialog');
  }
  function stepOutputs(){$('stepVelocityValue').textContent=Math.round(Number($('stepVelocity').value)*100)+'%';$('stepProbabilityValue').textContent=Math.round(Number($('stepProbability').value)*100)+'%';}
  function editStep(){if(!edit)return;const cell=state.scenes[edit.scene][edit.track][edit.index];cell.degree=Number($('stepNote').value);cell.vel=Number($('stepVelocity').value);cell.prob=Number($('stepProbability').value);cell.ratchet=Number($('stepRatchet').value);stepOutputs();renderGrid();persist();}
  function buildKnobs(){
    $$('.knob-control').forEach(container=>{
      const param=container.dataset.param,label=container.dataset.label;
      container.innerHTML=`<div class="dial" tabindex="0" role="slider" aria-label="${label}" aria-valuemin="0" aria-valuemax="100"><svg class="dial-svg" viewBox="0 0 60 60"><path d="M13 46a23 23 0 1 1 34 0" fill="none" stroke="#b8bcb2" stroke-width="1.6" stroke-linecap="round"/><path class="dial-arc" d="M13 46a23 23 0 1 1 34 0" fill="none" stroke="#283536" stroke-width="2.3" stroke-linecap="round" pathLength="100"/></svg><div class="dial-body"></div></div><span class="knob-label">${label}</span><output class="knob-output"></output>`;
      const dial=container.querySelector('.dial');knobs[param]={container,dial,arc:container.querySelector('.dial-arc'),out:container.querySelector('output')};let drag=null;
      dial.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();checkpoint();drag={y:e.clientY,value:state.params[param]};dial.setPointerCapture(e.pointerId);});
      dial.addEventListener('pointermove',e=>{if(!drag)return;setParam(param,A.clamp(drag.value+(drag.y-e.clientY)/(e.shiftKey?550:145)));});
      const release=()=>{drag=null;};dial.addEventListener('pointerup',release);dial.addEventListener('pointercancel',release);
      dial.addEventListener('wheel',e=>{e.preventDefault();setParam(param,A.clamp(state.params[param]-Math.sign(e.deltaY)*(e.shiftKey?.005:.025)));},{passive:false});
      dial.addEventListener('keydown',e=>{if(['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();checkpoint();const v=e.key==='Home'?0:e.key==='End'?1:state.params[param]+(['ArrowUp','ArrowRight'].includes(e.key)?1:-1)*(e.shiftKey?.01:.05);setParam(param,A.clamp(v));}});
      dial.addEventListener('dblclick',()=>{checkpoint();setParam(param,A.PRESETS[state.preset][param]);toast(`${label.toLowerCase()} reset.`);});
    });
  }
  function updateKnob(param){const k=knobs[param],v=state.params[param];k.dial.style.setProperty('--angle',(-135+v*270)+'deg');k.arc.setAttribute('stroke-dasharray',`${v*100} 100`);k.out.textContent=String(Math.round(v*100)).padStart(2,'0');k.dial.setAttribute('aria-valuenow',Math.round(v*100));k.dial.setAttribute('aria-valuetext',Math.round(v*100)+'%');}
  function setParam(param,value){state.params[param]=value;if(knobs[param])updateKnob(param);if(engine)engine.update(A.modulate(state,engine.ctx.currentTime,lastStep<0?0:lastStep,perf.xy),state.tracks);persist();}
  function syncScenes(){$$('.scene').forEach(b=>{const i=Number(b.dataset.scene);b.classList.toggle('active',i===state.scene);b.classList.toggle('queued',i===queuedScene);b.setAttribute('aria-pressed',String(i===state.scene));});}
  function syncUI(){
    $('bpm').value=state.params.bpm;$('keySelect').value=state.params.key;$('scaleSelect').value=state.params.scale;$('swing').value=state.params.swing;$('swingValue').textContent=Math.round(state.params.swing*100)+'%';$('preset').value=state.preset;$('evolve').checked=state.evolve;$('autoScene').checked=state.autoScene;$('seedLabel').textContent='SEED '+String(state.seed).padStart(4,'0');PARAMS.forEach(updateKnob);syncScenes();renderGrid();renderPatches();if(engine)engine.update(state.params,state.tracks);
  }
  function regenerate(){
    checkpoint();const seed=window.crypto?.getRandomValues?crypto.getRandomValues(new Uint32Array(1))[0]%999999:Math.floor(Math.random()*999999);state.seed=seed;
    for(let scene=0;scene<4;scene++){const generated=A.generateScene(seed,state.preset,scene,state.params.density);for(let track=0;track<6;track++)if(!state.tracks[track].lock)state.scenes[scene][track]=generated[track];}
    rng=A.random(seed);syncUI();persist();toast('A new little universe. Same you.');
  }
  function changePreset(preset){checkpoint();const seed=state.seed,locks=state.tracks.map(t=>t.lock),oldScenes=state.scenes;state=A.newSession(preset,seed);locks.forEach((lock,tr)=>{if(lock){state.tracks[tr].lock=true;for(let s=0;s<4;s++)state.scenes[s][tr]=oldScenes[s][tr];}});queuedScene=null;syncUI();persist();toast($('preset').selectedOptions[0].textContent+' is on the air.');}
  const patchColors={lfo:'#ac8dda',env:'#98b96f',random:'#dfaa7c',xy:'#dc8daf'};
  function renderPatches(){
    $$('.port').forEach(b=>{const connected=state.patches.some(p=>p.source===b.dataset.source||p.target===b.dataset.target);b.classList.toggle('connected',connected);b.classList.toggle('pending',b.dataset.source===selectedSource);});
    $('patchList').replaceChildren();state.patches.forEach((patch,i)=>{const chip=document.createElement('span');chip.className='patch-chip';chip.style.borderColor=patchColors[patch.source]+'88';const label=document.createTextNode(patch.source.toUpperCase()+' → '+patch.target.toUpperCase()+' '),remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label',`Remove ${patch.source} to ${patch.target} cable`);remove.addEventListener('click',()=>{checkpoint();state.patches.splice(i,1);renderPatches();persist();});chip.append(label,remove);$('patchList').appendChild(chip);});requestAnimationFrame(drawCables);
  }
  function drawCables(){
    const area=$('patchArea').getBoundingClientRect();$('cables').setAttribute('viewBox',`0 0 ${area.width||400} ${area.height||94}`);$('cables').replaceChildren();
    state.patches.forEach((patch,index)=>{const s=document.querySelector(`[data-source="${patch.source}"] i`),d=document.querySelector(`[data-target="${patch.target}"] i`);if(!s||!d)return;const a=s.getBoundingClientRect(),b=d.getBoundingClientRect(),x1=a.left+a.width/2-area.left,y1=a.top+a.height/2-area.top,x2=b.left+b.width/2-area.left,y2=b.top+b.height/2-area.top,path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M ${x1} ${y1} C ${x1+18-index*3} ${y1+53}, ${x2-18+index*3} ${y2-35}, ${x2} ${y2}`);path.setAttribute('stroke',patchColors[patch.source]);path.classList.add('cable');$('cables').appendChild(path);});
  }
  $$('.port[data-source]').forEach(b=>b.addEventListener('click',()=>{selectedSource=selectedSource===b.dataset.source?null:b.dataset.source;renderPatches();if(selectedSource)toast(`${selectedSource.toUpperCase()} selected. Tap a destination jack.`);}));
  $$('.port[data-target]').forEach(b=>b.addEventListener('click',()=>{if(!selectedSource){toast('Pick a source jack first.');return;}checkpoint();const target=b.dataset.target,existing=state.patches.findIndex(p=>p.source===selectedSource&&p.target===target);if(existing>=0)state.patches.splice(existing,1);else if(state.patches.length<12)state.patches.push({source:selectedSource,target});else toast('Twelve cables is a very full patch. Unplug one first.');selectedSource=null;renderPatches();persist();}));
  function setXY(x,y,active=true){perf.xy={x:A.clamp(x),y:A.clamp(y),active};$('xyPad').classList.toggle('engaged',active);$('xyCursor').style.left=perf.xy.x*100+'%';$('xyCursor').style.bottom=perf.xy.y*100+'%';$('xyReadout').textContent=`X ${perf.xy.x.toFixed(2)} / Y ${perf.xy.y.toFixed(2)}`;$('xyPad').setAttribute('aria-valuenow',Math.round(perf.xy.x*100));$('xyPad').setAttribute('aria-valuetext',`Crunch ${Math.round(perf.xy.x*100)}%, space ${Math.round(perf.xy.y*100)}%`);if(engine)engine.update(A.modulate(state,engine.ctx.currentTime,lastStep<0?0:lastStep,perf.xy),state.tracks);}
  let xyDragging=false;const xyEvent=e=>{const r=$('xyPad').getBoundingClientRect();setXY((e.clientX-r.left)/r.width,1-(e.clientY-r.top)/r.height);};
  $('xyPad').addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();xyDragging=true;$('xyPad').setPointerCapture(e.pointerId);xyEvent(e);});$('xyPad').addEventListener('pointermove',e=>{if(xyDragging)xyEvent(e);});
  const releaseXY=()=>{xyDragging=false;if(!$('xyLatch').checked)setXY(0,0,false);};$('xyPad').addEventListener('pointerup',releaseXY);$('xyPad').addEventListener('pointercancel',releaseXY);$('xyLatch').addEventListener('change',()=>{if(!$('xyLatch').checked&&!xyDragging)setXY(0,0,false);});
  $('xyPad').addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape'].includes(e.key)){e.preventDefault();if(e.key==='Escape'){setXY(0,0,false);return;}setXY(perf.xy.x+(e.key==='ArrowRight'?.05:e.key==='ArrowLeft'?-.05:0),perf.xy.y+(e.key==='ArrowUp'?.05:e.key==='ArrowDown'?-.05:0));}});
  function setPerformance(fx,on){perf[fx]=on;if(fx==='tape'&&on)perf.tapeStart=engine?.ctx.currentTime||0;const b=document.querySelector(`[data-fx="${fx}"]`);b?.classList.toggle('active',on);b?.setAttribute('aria-pressed',String(on));}
  $$('.performance-pads button').forEach(b=>{const fx=b.dataset.fx;b.setAttribute('aria-pressed','false');b.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();b.setPointerCapture(e.pointerId);setPerformance(fx,true);});['pointerup','pointercancel','lostpointercapture'].forEach(event=>b.addEventListener(event,()=>setPerformance(fx,false)));b.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();setPerformance(fx,true);}});b.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();setPerformance(fx,false);}});b.addEventListener('blur',()=>setPerformance(fx,false));});
  async function record(){
    if(recorder?.state==='recording'){stopRecording();return;}
    if(recordSaving)return;
    if(!window.MediaRecorder){toast('Live recording is unavailable here. Export a WAV instead.');return;}
    try{if(!playing)await start();if(!engine||!playing)return;const formats=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'],mime=formats.find(m=>MediaRecorder.isTypeSupported(m));
      if(!recordDestination){recordDestination=engine.ctx.createMediaStreamDestination();engine.master.connect(recordDestination);}recordChunks=[];recorder=new MediaRecorder(recordDestination.stream,mime?{mimeType:mime}:undefined);recorder.ondataavailable=e=>{if(e.data.size)recordChunks.push(e.data);};
      recorder.onstop=()=>{recordSaving=false;const type=recorder.mimeType||recordChunks[0]?.type||'audio/webm',ext=type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':'webm';download(new Blob(recordChunks,{type}),`bunny-live-${Date.now()}.${ext}`);$('recordBtn').classList.remove('recording');$('recordBtn').innerHTML='<i></i> REC';$('recordBtn').setAttribute('aria-label','Start live recording');toast('Your live take is ready.');};
      recorder.start(250);recordTime=engine.ctx.currentTime;$('recordBtn').classList.add('recording');$('recordBtn').setAttribute('aria-label','Stop and download live recording');toast('Recording your live take. Tap REC again to save.');
    }catch(e){toast('Live recording could not start. WAV export is ready to use.');}
  }
  function stopRecording(){if(recorder?.state==='recording'){recordSaving=true;recorder.stop();$('recordBtn').innerHTML='<i></i> SAVING';}}
  async function renderWav(){
    if(rendering)return;rendering=true;$('renderBtn').disabled=true;$('exportStatus').textContent='Rendering your little universe…';
    try{
      await new Promise(resolve=>setTimeout(resolve,25));const snapshot=A.validateSession(JSON.parse(JSON.stringify(state))),bars=Number($('exportLength').value),chain=$('exportChain').checked;
      const Context=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!Context)throw Error('WAV rendering is unavailable in this browser. Try REC for a live take.');
      const loopSeconds=bars*4*60/snapshot.params.bpm,roundTrip=60/snapshot.params.bpm*1.25,feedback=.15+snapshot.params.delay*.46,tail=Math.min(10,Math.max(2.8,1.4+roundTrip*Math.log(.008)/Math.log(feedback))),ctx=new Context(2,Math.ceil((loopSeconds+tail+.04)*44100),44100),offline=new A.Engine(ctx,true),random=A.random(snapshot.seed);
      if(sampleBuffer)offline.setSample(sampleBuffer);await offline.initWorklet();let time=.04;for(let b=0;b<bars;b++){if(chain)snapshot.scene=Math.floor(b/4)%4;for(let s=0;s<16;s++){const event=A.scheduleStep(offline,snapshot,s,b,time,random,{xy:{...perf.xy}});time+=event.duration;}}
      // The renderer uses the worklet where available and a quantizer elsewhere.
      const buffer=await ctx.startRendering(),blob=new Blob([A.wav(buffer)],{type:'audio/wav'});download(blob,`bunny-signal-${snapshot.preset}-${snapshot.params.bpm}bpm-${bars}bars.wav`);$('exportStatus').textContent='Your WAV is ready. ♡';toast('Stereo WAV rendered. Your bunny approves.');
    }catch(e){$('exportStatus').textContent=e.message||'The render did not complete. Try a shorter loop.';}
    finally{rendering=false;$('renderBtn').disabled=false;}
  }
  async function loadSample(file){
    if(!file)return;if(file.size>20*1024*1024){toast('Feed the Cloud a sound smaller than 20 MB.');return;}
    try{await ensureEngine();const buffer=await engine.ctx.decodeAudioData(await file.arrayBuffer());if(buffer.duration<.02)throw Error('That sound is too short to make a cloud.');
      if(buffer.duration>30){sampleBuffer=engine.ctx.createBuffer(buffer.numberOfChannels,engine.ctx.sampleRate*30,engine.ctx.sampleRate);for(let c=0;c<buffer.numberOfChannels;c++)sampleBuffer.copyToChannel(buffer.getChannelData(c).subarray(0,sampleBuffer.length),c);}else sampleBuffer=buffer;
      engine.setSample(sampleBuffer);$('sampleLabel').textContent=file.name;$('clearSample').hidden=false;toast(buffer.duration>30?'The first 30 seconds are in the Cloud.':'Sound loaded. The Cloud is now yours.');
    }catch(e){toast(e.message||'That sound could not be decoded. Try a WAV or MP3.');}
  }
  $('sampleInput').addEventListener('change',e=>loadSample(e.target.files[0]));$('clearSample').addEventListener('click',()=>{sampleBuffer=null;engine?.setSample(null);$('sampleInput').value='';$('sampleLabel').textContent='FEED THE CLOUD';$('clearSample').hidden=true;toast('The original cloud is back.');});
  const preventDrop=e=>{e.preventDefault();};document.addEventListener('dragover',preventDrop);document.addEventListener('drop',e=>{e.preventDefault();const file=e.dataTransfer.files[0];if(file&&(/audio\//.test(file.type)||/\.(wav|mp3|ogg|m4a|aac|flac)$/i.test(file.name)))loadSample(file);else if(file)toast('Drop an audio file to feed the granular Cloud.');});
  $('sessionInput').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>1024*1024)throw Error('That session file is too large.');const imported=A.validateSession(JSON.parse(await f.text()));checkpoint();state=imported;queuedScene=null;syncUI();persist();$('sessionDialog').close();toast('Welcome back to this universe.');}catch(err){toast(err.message||'That session could not be opened.');}e.target.value='';});
  $('resetBtn').addEventListener('click',()=>{checkpoint();state=A.newSession();queuedScene=null;syncUI();persist();$('sessionDialog').close();toast('A fresh little beginning.');});
  $('playBtn').addEventListener('click',togglePlay);$('recordBtn').addEventListener('click',record);$('generateBtn').addEventListener('click',regenerate);$('undoBtn').addEventListener('click',undo);$('preset').addEventListener('change',e=>changePreset(e.target.value));
  $('bpm').addEventListener('change',e=>{checkpoint();state.params.bpm=Math.round(A.clamp(Number(e.target.value)||164,65,220));e.target.value=state.params.bpm;if(engine)engine.update(state.params,state.tracks);persist();});
  $('keySelect').addEventListener('change',e=>{checkpoint();state.params.key=Number(e.target.value);renderGrid();persist();});$('scaleSelect').addEventListener('change',e=>{checkpoint();state.params.scale=e.target.value;renderGrid();persist();});$('swing').addEventListener('pointerdown',checkpoint);$('swing').addEventListener('input',e=>{state.params.swing=Number(e.target.value);$('swingValue').textContent=Math.round(state.params.swing*100)+'%';persist();});
  ['evolve','autoScene'].forEach(id=>$(id).addEventListener('change',e=>{checkpoint();state[id]=e.target.checked;persist();}));
  $$('.scene').forEach(b=>b.addEventListener('click',()=>{const scene=Number(b.dataset.scene);if(playing){queuedScene=scene;syncScenes();toast(`Scene ${'ABCD'[scene]} lands on the next bar.`);}else{state.scene=scene;syncScenes();renderGrid();persist();}}));
  ['stepNote','stepVelocity','stepProbability','stepRatchet'].forEach(id=>$(id).addEventListener('input',editStep));$('stepDialog').addEventListener('close',()=>{edit=null;persist();});
  $('sessionBtn').addEventListener('click',()=>showDialog('sessionDialog'));$('exportBtn').addEventListener('click',()=>showDialog('exportDialog'));$('helpBtn').addEventListener('click',()=>showDialog('helpDialog'));$('renderBtn').addEventListener('click',renderWav);$('downloadSession').addEventListener('click',saveSession);$('saveSessionBtn').addEventListener('click',saveSession);
  $$('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  $('vizTheme').addEventListener('click',()=>{vizNight=!vizNight;$('vizTheme').textContent=vizNight?'☀':'☾';$('vizTheme').setAttribute('aria-label',vizNight?'Switch visualizer to day colors':'Switch visualizer to night colors');});$('calmMotion').addEventListener('change',e=>{calm=e.target.checked;});
  document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)||e.target.closest('[role=slider]')||document.querySelector('dialog[open]'))return;if(e.code==='Space'){e.preventDefault();if(!e.repeat)togglePlay();}if(e.key.toLowerCase()==='r'&&!e.repeat)regenerate();if(e.key.toLowerCase()==='g'){e.preventDefault();setPerformance('stutter',true);}if(!e.repeat&&['k','b','l'].includes(e.key.toLowerCase()))audition({k:0,b:3,l:4}[e.key.toLowerCase()]);});document.addEventListener('keyup',e=>{if(e.key.toLowerCase()==='g')setPerformance('stutter',false);});
  window.addEventListener('blur',()=>{$$('.performance-pads button').forEach(b=>setPerformance(b.dataset.fx,false));});document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing){stop();toast('Paused while you were away.');}});window.addEventListener('pagehide',()=>{try{localStorage.setItem(STORE,JSON.stringify(state));}catch(e){}if(playing)stop();});

  // A vector-drawn companion. Every spectrum bar reads the audio analyser;
  // its pose follows the clock, kick envelope, and measured signal energy.
  const canvas=$('bunnyCanvas'),ctx=canvas.getContext('2d');let width=338,height=346,dpr=1,energy=0,fft=new Uint8Array(512),wave=new Uint8Array(1024),meterLeft=new Uint8Array(256),meterRight=new Uint8Array(256),lastFrame=0;
  function resize(){const r=canvas.getBoundingClientRect();width=r.width||338;height=r.height||346;dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);drawCables();}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe($('visualizer'));resizeObserver.observe($('patchArea'));
  function ellipse(x,y,rx,ry,color,rotation=0,line=true){ctx.beginPath();ctx.ellipse(x,y,rx,ry,rotation,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();if(line){ctx.strokeStyle='#55506a';ctx.lineWidth=1.8;ctx.stroke();}}
  function path(points,color,line=1.8){ctx.beginPath();points(ctx);ctx.strokeStyle=color;ctx.lineWidth=line;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
  function star(x,y,size,color,rot=0){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?size*.44:size;const px=Math.cos(a)*r,py=Math.sin(a)*r;i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);}ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.restore();}
  function bunny(time,bounce,beat){
    const motion=calm?0:1,sway=playing?Math.sin(time*state.params.bpm/60*Math.PI)*.055:Math.sin(time*.9)*.018;
    ctx.save();ctx.translate(width/2,height*.54);const scale=Math.min(width/315,height/330);ctx.scale(scale,scale);
    ellipse(0,89,51,8,vizNight?'#131328':'#bca7d038',0,false);
    ctx.translate(0,-bounce*motion*13);ctx.rotate(sway*motion);
    const leg=motion*(playing?Math.sin(time*state.params.bpm/60*Math.PI)*8:0);
    // Little stomping feet and lavender stage outfit.
    ellipse(-22,78-leg*.45,18,12,'#fff6e4',-.12);ellipse(22,78+leg*.45,18,12,'#fff6e4',.12);
    ellipse(0,40,32,41,'#c7b2ed');ellipse(0,45,21,28,'#d9c9f6',0,false);
    star(0,38,13,'#effaa6',sway*-2);path(c=>{c.moveTo(-7,64);c.quadraticCurveTo(0,70,7,64);},'#aa91ca',1.2);
    const arm=motion*(playing?Math.sin(time*state.params.bpm/60*Math.PI)*.3:-.09);
    ctx.save();ctx.translate(-31,25);ctx.rotate(-.5+arm);ellipse(-9,2,13,21,'#fff6e4',-.3);ellipse(-12,-4,6,8,'#efb6c7',-.3,false);ctx.restore();
    ctx.save();ctx.translate(31,25);ctx.rotate(.5+arm);ellipse(9,2,13,21,'#fff6e4',.3);ellipse(12,-4,6,8,'#efb6c7',.3,false);ctx.restore();
    // Floppy ears pivot independently of the head.
    ctx.save();ctx.translate(-23,-74);ctx.rotate(-.2-motion*(.1+beat*.1)*Math.sin(time*3));ellipse(-2,-32,13,45,'#fff6e4',-.09);ellipse(-2,-35,6,31,'#efb6c7',-.09,false);ctx.restore();
    ctx.save();ctx.translate(23,-74);ctx.rotate(.2+motion*.14*Math.sin(time*2.8+.8));ellipse(3,-33,13,44,'#fff6e4',.09);ellipse(3,-35,6,30,'#efb6c7',.09,false);ctx.restore();
    ellipse(0,-39,50,42,'#fff6e4');ellipse(-35,-24,10,6,'#efadc0',.1,false);ellipse(35,-24,10,6,'#efadc0',-.1,false);
    // A tiny headset, with two genuinely oversized ear cups.
    path(c=>{c.moveTo(-46,-36);c.bezierCurveTo(-52,-93,52,-93,46,-36);},'#736388',8);path(c=>{c.moveTo(-46,-36);c.bezierCurveTo(-52,-93,52,-93,46,-36);},'#b5e5ca',4.5);
    ellipse(-47,-35,10,18,'#a5dac3',-.1);ellipse(47,-35,10,18,'#a5dac3',.1);path(c=>{c.moveTo(-50,-41);c.lineTo(-50,-29);c.moveTo(50,-41);c.lineTo(50,-29);},'#ecfff2',2);
    const blink=Math.sin(time*.62)> .997;
    if(playing||blink){path(c=>{c.moveTo(-27,-41);c.quadraticCurveTo(-20,-47,-13,-41);c.moveTo(13,-41);c.quadraticCurveTo(20,-47,27,-41);},'#54475e',2.8);}else{ellipse(-20,-42,3.1,4.8,'#54475e',0,false);ellipse(20,-42,3.1,4.8,'#54475e',0,false);ellipse(-19,-44,1,1,'#fff',0,false);ellipse(21,-44,1,1,'#fff',0,false);}
    ctx.beginPath();ctx.moveTo(-3,-32);ctx.quadraticCurveTo(0,-28,3,-32);ctx.quadraticCurveTo(0,-36,-3,-32);ctx.fillStyle='#b87592';ctx.fill();path(c=>{c.moveTo(0,-30);c.lineTo(0,-25);c.quadraticCurveTo(-5,-19,-9,-25);c.moveTo(0,-25);c.quadraticCurveTo(5,-19,9,-25);},'#63506a',1.7);
    if(playing&&beat>.65&&!calm){star(-65,-58,7,'#f29aba',time);star(63,-73,5,'#cbea98',-time);}
    ctx.restore();
  }
  function visualizer(time){
    ctx.setTransform(dpr,0,0,dpr,0,0);const night=vizNight,bg=night?'#24233c':'#eee3f5',grid=night?'#302e4b':'#e5d7ee';ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
    const cell=width/12;ctx.fillStyle=grid;for(let y=0;y<height/cell;y++)for(let x=0;x<12;x++)if((x+y)%2===0)ctx.fillRect(x*cell,y*cell,cell,cell);
    const g=ctx.createRadialGradient(width/2,height*.48,15,width/2,height*.49,width*.47);g.addColorStop(0,night?'#7b6cc040':'#fff8ec9a');g.addColorStop(1,night?'#24233c00':'#fff8ec00');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
    ctx.strokeStyle=night?'#9387bc22':'#c4add444';ctx.lineWidth=1;ctx.beginPath();ctx.arc(width/2,height*.43,width*.36,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(width/2,height*.43,width*.43,0,Math.PI*2);ctx.stroke();
    const audioTime=engine?.ctx.currentTime||0,beat=playing?Math.exp(-Math.max(0,audioTime-lastKick)*10):0,bounce=playing?(beat*.72+energy*.28):0;
    for(let i=0;i<16;i++){const a=i*2.399,x=width*.5+Math.cos(a)*(width*.37+(i%3)*7),y=height*.46+Math.sin(a)*(height*.34),size=2+(i%3);if(i%4===0)star(x,y,size+2,night?'#9180bd':'#c8acd8',calm?0:time*.1);else{ctx.fillStyle=i%2?night?'#bd829a88':'#f0b5cd':'#b6cca2';ctx.fillRect(x,y,size,size);}}
    bunny(time,bounce,beat);
    // The spectrum and trace are measured from the actual master signal.
    const bottom=height-44,barWidth=width/46;for(let i=0;i<40;i++){const bin=Math.min(fft.length-1,Math.round(Math.pow(i/39,1.65)*220)+2),value=playing?fft[bin]/255:0,h=3+value*26;ctx.fillStyle=[night?'#a48cd2':'#ac92c9',night?'#dd93b2':'#dfa3bd',night?'#b9dd8b':'#b8cfa2'][i%3];ctx.fillRect(width*.07+i*barWidth,bottom-h,barWidth*.54,h);}
    ctx.beginPath();for(let i=0;i<160;i++){const x=width*.07+i/159*width*.86,y=height-80+(playing?(wave[Math.floor(i/160*wave.length)]-128)/128*12:Math.sin(i*.15)*1.2);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.strokeStyle=night?'#cda4dd55':'#b4a0c155';ctx.lineWidth=1;ctx.stroke();
    if(playing&&!calm&&state.params.glitch>.3){const r=A.random(Math.floor(time*7)+state.seed);if(r()<state.params.glitch*.3){for(let i=0;i<3;i++){ctx.fillStyle=['#aaddcc66','#efb2ce88','#b2a0dc66'][i];ctx.fillRect(r()*width,r()*height*.85,8+r()*25,2);}}}
    $('vizTag').style.color=night?'#d6b6e7':'#6e5b7f';$('visualizer').style.background=bg;
  }
  function animationFrame(ms){
    requestAnimationFrame(animationFrame);if(ms-lastFrame<30)return;lastFrame=ms;const time=ms/1000;
    if(engine){engine.analyser.getByteFrequencyData(fft);engine.analyser.getByteTimeDomainData(wave);let sum=0;for(let i=0;i<wave.length;i++){const v=(wave[i]-128)/128;sum+=v*v;}energy=energy*.72+Math.sqrt(sum/wave.length)*3*.28;}
    else energy=0;
    if(playing&&engine){while(queue.length&&queue[0].time<=engine.ctx.currentTime){const event=queue.shift();highlight(event.step,event.triggers);$('barClock').textContent=`${String(event.bar+1).padStart(2,'0')} : ${String(event.step+1).padStart(2,'0')}`;if(event.triggers.includes(0))lastKick=event.time;if(event.step===0){const glyphRandom=A.random(state.seed+event.bar*71);$('chaosGlyph').textContent=Array.from({length:12},()=>['▁','▂','▃','▄','▅','▆','▇'][Math.floor(glyphRandom()*7)]).join(' ');}}
      if(recorder?.state==='recording'){const seconds=Math.floor(engine.ctx.currentTime-recordTime);const label=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;if($('recordBtn').textContent.trim()!==label)$('recordBtn').innerHTML=`<i></i> ${label}`;}
    }
    if(engine){engine.meterL.getByteTimeDomainData(meterLeft);engine.meterR.getByteTimeDomainData(meterRight);for(const [data,id] of [[meterLeft,'meterL'],[meterRight,'meterR']]){let sum=0;for(let i=0;i<data.length;i++)sum+=((data[i]-128)/128)**2;$(id).style.width=Math.min(100,Math.sqrt(sum/data.length)*350)+'%';}}else{$('meterL').style.width=$('meterR').style.width='0%';}visualizer(time);
  }
  buildGrid();buildKnobs();syncUI();updateTransport();$('undoBtn').disabled=true;resize();requestAnimationFrame(animationFrame);
  // Expose diagnostics without enabling any extra audio or network activity.
  window.bunnyStudio={getState:()=>JSON.parse(JSON.stringify(state)),get playing(){return playing;},get engine(){return engine;},start,stop,renderWav,regenerate,validate:A.validateSession};
})();
