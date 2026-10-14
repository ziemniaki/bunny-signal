/* BUNNY SIGNAL — deterministic composition + native Web Audio synthesis. */
(function(root){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const TRACKS=[
    {id:'kick',name:'Kick',sub:'ANALOG PULSE',color:'#d6c1f0',volume:.88},
    {id:'snare',name:'Snare',sub:'NOISE + BODY',color:'#edb0be',volume:.65},
    {id:'hat',name:'Hats',sub:'METAL DUST',color:'#e7cc93',volume:.52},
    {id:'bass',name:'Bass',sub:'FM / SUB',color:'#abcfa6',volume:.74,pitched:true},
    {id:'bell',name:'Bells',sub:'GLASS OPERATORS',color:'#a9c7e7',volume:.62,pitched:true},
    {id:'cloud',name:'Cloud',sub:'GRANULAR HAZE',color:'#c5b7e8',volume:.45,pitched:true}
  ];
  const SCALES={minor:[0,2,3,5,7,8,10],major:[0,2,4,5,7,9,11],pentatonic:[0,3,5,7,10],dorian:[0,2,3,5,7,9,10],hirajoshi:[0,2,3,7,8]};
  const PRESETS={
    candy:{bpm:164,swing:.12,key:50,scale:'minor',fm:.38,tone:.72,grain:.45,bloom:.38,density:.65,mutation:.22,glitch:.3,modDepth:.35,crush:.14,delay:.28,space:.43,volume:.68},
    hyper:{bpm:192,swing:.04,key:53,scale:'pentatonic',fm:.75,tone:.84,grain:.3,bloom:.22,density:.9,mutation:.48,glitch:.62,modDepth:.38,crush:.45,delay:.24,space:.28,volume:.62},
    glass:{bpm:128,swing:.19,key:57,scale:'hirajoshi',fm:.22,tone:.58,grain:.66,bloom:.75,density:.45,mutation:.16,glitch:.14,modDepth:.26,crush:.05,delay:.46,space:.68,volume:.72},
    moon:{bpm:96,swing:.24,key:48,scale:'dorian',fm:.5,tone:.37,grain:.75,bloom:.85,density:.4,mutation:.15,glitch:.2,modDepth:.45,crush:.2,delay:.38,space:.74,volume:.74}
  };
  function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
  function euclidean(hits,steps=16,rotation=0){hits=Math.round(clamp(hits,0,steps));return Array.from({length:steps},(_,i)=>((i+rotation)%steps*hits)%steps<hits);}
  function noteMidi(degree,key,scale){const s=SCALES[scale]||SCALES.minor,n=s.length;return key+Math.floor(degree/n)*12+s[((degree%n)+n)%n];}
  const noteNames=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  function noteName(midi){midi=Math.round(midi);return noteNames[((midi%12)+12)%12]+(Math.floor(midi/12)-1);}
  function hz(midi){return 440*Math.pow(2,(midi-69)/12);}
  function generateScene(seed,preset='candy',scene=0,density=PRESETS[preset]?.density||.65){
    const rng=random((seed+scene*9137)>>>0),n=16;
    const bassRhythm=euclidean(Math.round(5+density*7),n,scene%3),bellRhythm=euclidean(Math.round(3+density*5),n,2+scene),hatRhythm=euclidean(Math.round(6+density*8),n,0);
    const motif=[0,2,4,2,6,4,1,2],motifShift=scene===0?0:[0,3,5,4][scene];
    return TRACKS.map((tr,track)=>Array.from({length:n},(_,i)=>{
      let on=false,degree=0,vel=.6,prob=1,ratchet=1;
      if(track===0){on=[0,8].includes(i)||([3,6,10,14].includes(i)&&rng()<density+.13);vel=i===0?1:.68+rng()*.22;}
      if(track===1){on=i===4||i===12||(i===15&&rng()<density*.5);vel=[4,12].includes(i)?.8:.4;prob=i===15?.7:1;}
      if(track===2){on=hatRhythm[i];vel=i%2===0?.4+rng()*.25:.25+rng()*.18;prob=i%4===0?1:.9;ratchet=preset==='hyper'&&i%4===3?2:1;}
      if(track===3){on=bassRhythm[i];degree=(i%8===0?0:(rng()<.67?motif[Math.floor(i/2)%8]:Math.floor(rng()*7)))+motifShift-7;vel=.58+rng()*.2;prob=i===0?1:.92;}
      if(track===4){on=bellRhythm[i];degree=motif[(i+scene*2)%8]+7+(rng()<.16?7:0)+motifShift;vel=.44+rng()*.22;prob=.82+scene*.02;ratchet=rng()<.07?2:1;}
      if(track===5){on=i===0||(i===8&&preset!=='hyper');degree=motifShift;vel=.46;prob=.96;}
      return{on,degree,vel,prob,ratchet};
    }));
  }
  function newSession(preset='candy',seed=831){return{version:1,preset,seed,scene:0,params:{...PRESETS[preset]},evolve:true,autoScene:false,tracks:TRACKS.map(t=>({volume:t.volume,mute:false,solo:false,lock:false})),scenes:Array.from({length:4},(_,i)=>generateScene(seed,preset,i)),patches:[{source:'lfo',target:'tone'},{source:'xy',target:'fm'}]};}
  function validateSession(value){
    if(!value||value.version!==1||!Array.isArray(value.scenes)||value.scenes.length!==4)throw Error('This is not a Bunny Signal session.');
    const preset=Object.hasOwn(PRESETS,value.preset)?value.preset:'candy',s=newSession(preset,Math.round(Number(value.seed)||831)>>>0);
    for(const k of Object.keys(s.params)){const v=value.params?.[k];if(k==='scale'){if(Object.hasOwn(SCALES,v))s.params[k]=v;}else if(Number.isFinite(v)){s.params[k]=k==='bpm'?clamp(v,65,220):k==='key'?Math.round(clamp(v,48,59)):k==='swing'?clamp(v,0,.42):clamp(v);}}
    s.scene=Math.round(clamp(Number(value.scene)||0,0,3));s.evolve=!!value.evolve;s.autoScene=!!value.autoScene;
    s.scenes=value.scenes.map(scene=>{if(!Array.isArray(scene)||scene.length!==6)throw Error('The voice data is incomplete.');return scene.map(row=>{if(!Array.isArray(row)||row.length!==16)throw Error('A pattern needs sixteen steps.');return row.map(c=>({on:!!c?.on,degree:Math.round(clamp(Number(c?.degree)||0,-14,28)),vel:clamp(Number(c?.vel)||.6,.15,1),prob:clamp(Number.isFinite(c?.prob)?c.prob:1,.1,1),ratchet:Math.round(clamp(Number(c?.ratchet)||1,1,4))}));});});
    s.tracks=s.tracks.map((t,i)=>({...t,volume:clamp(Number.isFinite(value.tracks?.[i]?.volume)?value.tracks[i].volume:t.volume),mute:!!value.tracks?.[i]?.mute,solo:!!value.tracks?.[i]?.solo,lock:!!value.tracks?.[i]?.lock}));
    if(Array.isArray(value.patches))s.patches=value.patches.slice(0,12).filter(p=>['lfo','env','random','xy'].includes(p?.source)&&['tone','fm','grain','space','crush'].includes(p?.target)).map(p=>({source:p.source,target:p.target})).filter((p,i,a)=>a.findIndex(q=>q.source===p.source&&q.target===p.target)===i);
    return s;
  }
  function modulate(session,time,step,xy={x:0,y:0,active:false}){
    const p={...session.params},rng=random(session.seed+Math.floor(time*p.bpm/60*4)*8731);
    const signals={lfo:Math.sin(time*p.bpm/60*Math.PI/2),env:Math.exp(-(step%4)*1.35)*2-1,random:rng()*2-1,xy:xy.active?xy.x*2-1:0};
    for(const cable of session.patches)p[cable.target]=clamp(p[cable.target]+signals[cable.source]*p.modDepth*.43);
    if(xy.active){p.crush=clamp(p.crush+xy.x*.5);p.delay=clamp(p.delay+xy.y*.45);p.space=clamp(p.space+xy.y*.35);}
    return p;
  }
  function stepDuration(params,step){return 60/params.bpm/4*(step%2?1-params.swing:1+params.swing);}
  function mutate(session,bar){
    const rng=random(session.seed+bar*49217),scene=session.scenes[session.scene],scaleLen=SCALES[session.params.scale].length;
    for(let tr=0;tr<6;tr++){
      if(session.tracks[tr].lock)continue;
      const changes=rng()<session.params.mutation?2:1;
      for(let c=0;c<changes;c++){
        if(rng()>session.params.mutation*.7)continue;
        const i=Math.floor(rng()*16),step=scene[tr][i];
        if(tr<3){if((tr===0&&[0,8].includes(i))||(tr===1&&[4,12].includes(i)))continue;step.on=!step.on;step.vel=.28+rng()*.5;step.ratchet=rng()<session.params.glitch*.22?2:1;}
        else{if(rng()<.6)step.degree+=rng()<.5?-1:1;else step.on=!step.on;step.degree=clamp(step.degree,tr===3?-scaleLen*2:0,tr===3?scaleLen:scaleLen*3);}
      }
    }
  }
  function createNoise(ctx,duration=1,seed=351){const b=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=b.getChannelData(0),rng=random(seed);for(let i=0;i<data.length;i++)data[i]=rng()*2-1;return b;}
  function createCloud(ctx){const b=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),d=b.getChannelData(0),rng=random(1664);let pink=0;for(let i=0;i<d.length;i++){const t=i/ctx.sampleRate;pink=.98*pink+.02*(rng()*2-1);d[i]=(.42*Math.sin(2*Math.PI*261.626*t+2.5*Math.sin(2*Math.PI*523.251*t))+.23*Math.sin(2*Math.PI*392.44*t)+.12*Math.sin(2*Math.PI*790.22*t)+pink*.5)*(.62+.38*Math.sin(t*Math.PI/2));}return b;}
  function reverseBuffer(ctx,b){const out=ctx.createBuffer(b.numberOfChannels,b.length,b.sampleRate);for(let c=0;c<b.numberOfChannels;c++){const a=b.getChannelData(c),d=out.getChannelData(c);for(let i=0;i<a.length;i++)d[i]=a[a.length-i-1];}return out;}
  function impulse(ctx){const b=ctx.createBuffer(2,Math.floor(ctx.sampleRate*2.2),ctx.sampleRate),rng=random(9128);for(let c=0;c<2;c++){const d=b.getChannelData(c);let z=0;for(let i=0;i<d.length;i++){const t=i/ctx.sampleRate;z=.6*z+.4*(rng()*2-1);d[i]=z*Math.pow(1-t/2.2,2.5)*(t<.012?0:1);if(i===Math.round((.03+c*.012)*ctx.sampleRate))d[i]+=.28;}}return b;}
  class Engine{
    constructor(ctx,offline=false){this.ctx=ctx;this.offline=offline;this.sources=new Set();this.last={};this.sample=null;this.sampleReverse=null;this.noise=createNoise(ctx);this.cloud=createCloud(ctx);this.noiseReverse=reverseBuffer(ctx,this.noise);this.cloudReverse=reverseBuffer(ctx,this.cloud);this.buildGraph();}
    buildGraph(){
      const c=this.ctx;this.input=c.createGain();this.hp=c.createBiquadFilter();this.hp.type='highpass';this.hp.frequency.value=26;this.toneFilter=c.createBiquadFilter();this.toneFilter.type='lowpass';this.toneFilter.Q.value=.55;
      this.color=c.createWaveShaper();const curve=new Float32Array(8192);for(let i=0;i<curve.length;i++){let x=i*2/(curve.length-1)-1;curve[i]=Math.tanh(x*1.1)/Math.tanh(1.1);}this.color.curve=curve;this.color.oversample='2x';
      this.dry=c.createGain();this.dry.gain.value=.8;this.crushSend=c.createGain();this.crushSend.gain.value=0;this.crusher=c.createWaveShaper();this.crusher.oversample='none';
      this.input.connect(this.hp);this.hp.connect(this.toneFilter);this.toneFilter.connect(this.color);this.color.connect(this.dry);this.color.connect(this.crusher);this.crusher.connect(this.crushSend);
      this.mix=c.createGain();this.dry.connect(this.mix);this.crushSend.connect(this.mix);
      this.delaySend=c.createGain();this.delayL=c.createDelay(2);this.delayR=c.createDelay(2);this.feedback=c.createGain();this.feedback.gain.value=.36;this.echoFilter=c.createBiquadFilter();this.echoFilter.type='lowpass';this.echoFilter.frequency.value=4400;this.echoOut=c.createGain();this.echoOut.gain.value=.68;
      this.panL=c.createStereoPanner();this.panL.pan.value=-.72;this.panR=c.createStereoPanner();this.panR.pan.value=.72;
      this.color.connect(this.delaySend);this.delaySend.connect(this.delayL);this.delayL.connect(this.panL);this.panL.connect(this.echoOut);this.delayL.connect(this.delayR);this.delayR.connect(this.panR);this.panR.connect(this.echoOut);this.delayR.connect(this.echoFilter);this.echoFilter.connect(this.feedback);this.feedback.connect(this.delayL);this.echoOut.connect(this.mix);
      this.reverbSend=c.createGain();this.reverb=c.createConvolver();this.reverb.buffer=impulse(c);this.reverbOut=c.createGain();this.reverbOut.gain.value=.72;this.color.connect(this.reverbSend);this.reverbSend.connect(this.reverb);this.reverb.connect(this.reverbOut);this.reverbOut.connect(this.mix);
      this.compressor=c.createDynamicsCompressor();this.compressor.threshold.value=-14;this.compressor.knee.value=12;this.compressor.ratio.value=4;this.compressor.attack.value=.003;this.compressor.release.value=.14;
      this.safety=c.createWaveShaper();const safe=new Float32Array(8192);for(let i=0;i<safe.length;i++)safe[i]=Math.tanh((i*2/(safe.length-1)-1)*1.5)/1.5;this.safety.curve=safe;this.safety.oversample='2x';
      this.master=c.createGain();this.master.gain.value=.65;this.analyser=c.createAnalyser();this.analyser.fftSize=1024;this.analyser.smoothingTimeConstant=.76;this.mix.connect(this.compressor);this.compressor.connect(this.safety);this.safety.connect(this.master);this.master.connect(this.analyser);this.analyser.connect(c.destination);
      this.splitter=c.createChannelSplitter(2);this.meterL=c.createAnalyser();this.meterR=c.createAnalyser();this.meterL.fftSize=this.meterR.fftSize=256;this.master.connect(this.splitter);this.splitter.connect(this.meterL,0);this.splitter.connect(this.meterR,1);
      this.buses=TRACKS.map(t=>{const g=c.createGain();g.gain.value=t.volume;g.connect(this.input);return g;});this.setCrushCurve(.15);
    }
    async initWorklet(){if(!this.ctx.audioWorklet)return;try{await this.ctx.audioWorklet.addModule('crusher.js');const node=new AudioWorkletNode(this.ctx,'bunny-crusher',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});this.color.disconnect(this.crusher);this.crusher.disconnect();this.crusher=node;this.color.connect(node);node.connect(this.crushSend);this.worklet=true;}catch(e){this.worklet=false;}}
    setCrushCurve(amount){const bits=Math.round(12-amount*8),levels=Math.pow(2,bits),curve=new Float32Array(4096);for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=Math.round(Math.tanh(x*(1+amount*3))*levels)/levels;}this.crusher.curve=curve;}
    setSample(buffer){this.sample=buffer;this.sampleReverse=buffer?reverseBuffer(this.ctx,buffer):null;}
    update(p,tracks,time=this.ctx.currentTime){
      const t=Math.max(time,this.ctx.currentTime),smooth=(param,v)=>param.setTargetAtTime(v,t,.018),wet=p.crush*.75;
      smooth(this.master.gain,p.volume*.88);smooth(this.dry.gain,1-wet*.7);smooth(this.crushSend.gain,wet);smooth(this.toneFilter.frequency,Math.min(this.ctx.sampleRate*.44,180+Math.pow(p.tone,2)*17500));smooth(this.delaySend.gain,p.delay*.48);smooth(this.reverbSend.gain,p.space*.53);smooth(this.feedback.gain,.15+p.delay*.46);
      const delay=60/p.bpm*.75;smooth(this.delayL.delayTime,delay);smooth(this.delayR.delayTime,delay*.6667);
      if(this.worklet){smooth(this.crusher.parameters.get('bits'),12-p.crush*9);smooth(this.crusher.parameters.get('rate'),1-p.crush*.93);}
      else if(Math.abs((this.last.crush??-1)-p.crush)>.065){this.setCrushCurve(p.crush);this.last.crush=p.crush;}
      const solo=tracks.some(tr=>tr.solo);tracks.forEach((tr,i)=>smooth(this.buses[i].gain,tr.mute||(solo&&!tr.solo)?0:tr.volume));
    }
    source(s,t,d,nodes=[]){this.sources.add(s);s.onended=()=>{this.sources.delete(s);try{s.disconnect();nodes.forEach(n=>n.disconnect());}catch(e){}};s.start(t);s.stop(t+Math.max(.01,d));return s;}
    env(g,t,d,amp,attack=.003,reverse=false){g.gain.setValueAtTime(.00001,t);if(reverse){g.gain.exponentialRampToValueAtTime(Math.max(.0001,amp),t+d*.86);g.gain.exponentialRampToValueAtTime(.00001,t+d);}else{g.gain.exponentialRampToValueAtTime(Math.max(.0001,amp),t+Math.min(attack,d*.3));g.gain.exponentialRampToValueAtTime(.00001,t+d);}}
    noiseVoice(track,t,d,amp,freq,type,reverse=false){const c=this.ctx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=reverse?this.noiseReverse:this.noise;f.type=type;f.frequency.value=freq;f.Q.value=.75;this.env(g,t,d,amp,.001,reverse);s.connect(f);f.connect(g);g.connect(this.buses[track]);this.source(s,t,d+.012,[f,g]);}
    kick(t,vel,p,fx={}){
      const c=this.ctx,o=c.createOscillator(),g=c.createGain(),factor=fx.pitch||1;o.type='sine';o.frequency.setValueAtTime(155*factor,t);o.frequency.exponentialRampToValueAtTime(47*factor,t+.115);this.env(g,t,.32+.1*p.bloom,.81*vel,.001);o.connect(g);g.connect(this.buses[0]);this.source(o,t,.5,[g]);this.noiseVoice(0,t,.014,.12*vel,3000,'highpass');
    }
    snare(t,vel,p,fx={}){
      this.noiseVoice(1,t,.105+.08*p.bloom,.33*vel,1750,'bandpass',fx.reverse);this.noiseVoice(1,t+.011,.07,.13*vel,3800,'highpass',fx.reverse);const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.setValueAtTime(190*(fx.pitch||1),t);o.frequency.exponentialRampToValueAtTime(125*(fx.pitch||1),t+.07);this.env(g,t,.12,.19*vel,.002,fx.reverse);o.connect(g);g.connect(this.buses[1]);this.source(o,t,.15,[g]);
    }
    hat(t,vel,p,fx={}){
      const d=.023+.035*p.bloom;this.noiseVoice(2,t,d,.16*vel,6200,'highpass',fx.reverse);const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type='square';o.frequency.value=6239*(fx.pitch||1);this.env(g,t,d,.012*vel,.001);o.connect(g);g.connect(this.buses[2]);this.source(o,t,d+.01,[g]);
    }
    bass(t,vel,midi,p,fx={}){
      const c=this.ctx,o=c.createOscillator(),mod=c.createOscillator(),depth=c.createGain(),g=c.createGain(),f=c.createBiquadFilter(),sub=c.createOscillator(),sg=c.createGain(),frequency=hz(midi)*(fx.pitch||1),d=.13+p.bloom*.16;
      o.type='sine';o.frequency.value=frequency;mod.type='sine';mod.frequency.value=frequency*(p.fm>.6?2.002:1.001);depth.gain.setValueAtTime(frequency*(.25+p.fm*7),t);depth.gain.exponentialRampToValueAtTime(frequency*.08,t+d);mod.connect(depth);depth.connect(o.frequency);f.type='lowpass';f.Q.value=1.1;f.frequency.setValueAtTime(Math.min(9500,650+p.tone*5600),t);f.frequency.exponentialRampToValueAtTime(130+p.tone*1200,t+d);this.env(g,t,d,.31*vel,.006,fx.reverse);o.connect(f);f.connect(g);g.connect(this.buses[3]);sub.type='sine';sub.frequency.value=frequency;this.env(sg,t,d,.13*vel,.004);sub.connect(sg);sg.connect(this.buses[3]);this.source(mod,t,d+.05,[depth]);this.source(o,t,d+.05,[f,g]);this.source(sub,t,d+.05,[sg]);
    }
    bell(t,vel,midi,p,fx={}){
      const c=this.ctx,o=c.createOscillator(),m=c.createOscillator(),depth=c.createGain(),g=c.createGain(),pan=c.createStereoPanner(),frequency=hz(midi)*(fx.pitch||1),d=.28+p.bloom*.95;
      o.type='sine';o.frequency.value=frequency;m.type='sine';m.frequency.value=frequency*(2.001+p.fm*.31);depth.gain.setValueAtTime(frequency*(.25+p.fm*2.2),t);depth.gain.exponentialRampToValueAtTime(frequency*.02,t+d*.75);m.connect(depth);depth.connect(o.frequency);this.env(g,t,d,.16*vel,.003,fx.reverse);pan.pan.value=fx.pan||Math.sin(midi*1.31)*.55;o.connect(g);g.connect(pan);pan.connect(this.buses[4]);this.source(m,t,d+.05,[depth]);this.source(o,t,d+.05,[g,pan]);
    }
    grains(t,vel,midi,p,fx={}){
      const c=this.ctx,b=fx.reverse?(this.sampleReverse||this.cloudReverse):(this.sample||this.cloud),rng=random(Math.round(t*1e5)+midi*311);const rate=clamp(hz(midi)/261.626*(fx.pitch||1),.08,6),d=.05+p.bloom*.13,count=3+Math.round(p.bloom*3);
      for(let i=0;i<count;i++){const start=t+i*(.028+p.bloom*.035),s=c.createBufferSource(),g=c.createGain(),pan=c.createStereoPanner(),length=Math.min(d,b.duration/rate*.8);s.buffer=b;s.playbackRate.value=rate*(.985+rng()*.03);const offset=clamp(p.grain*b.duration+(rng()-.5)*.28,0,Math.max(0,b.duration-length*s.playbackRate.value-.01));g.gain.setValueAtTime(.00001,start);g.gain.linearRampToValueAtTime(.08*vel/count*3,start+length*.28);g.gain.linearRampToValueAtTime(.00001,start+length);pan.pan.value=(rng()*2-1)*.8;s.connect(g);g.connect(pan);pan.connect(this.buses[5]);this.sources.add(s);s.onended=()=>{this.sources.delete(s);s.disconnect();g.disconnect();pan.disconnect();};s.start(start,offset);s.stop(start+length+.005);}
      // The cloud's tonal anchor keeps granular fragments inside the harmony.
      for(let i=0;i<2;i++){const o=c.createOscillator(),g=c.createGain(),pan=c.createStereoPanner();o.type='triangle';o.frequency.value=hz(midi+[0,7][i])*(fx.pitch||1);o.detune.value=i===0?-7:7;const length=.5+p.bloom*.65;this.env(g,t,length,.055*vel,.15);pan.pan.value=i===0?-.45:.45;o.connect(g);g.connect(pan);pan.connect(this.buses[5]);this.source(o,t,length+.03,[g,pan]);}
    }
    trigger(track,t,vel,degree,p,fx={}){const midi=noteMidi(degree,p.key,p.scale);if(track===0)this.kick(t,vel,p,fx);if(track===1)this.snare(t,vel,p,fx);if(track===2)this.hat(t,vel,p,fx);if(track===3)this.bass(t,vel,midi,p,fx);if(track===4)this.bell(t,vel,midi,p,fx);if(track===5)this.grains(t,vel,midi,p,fx);}
    stop(){for(const s of this.sources){try{s.stop(this.ctx.currentTime+.018);}catch(e){}}this.sources.clear();this.master.gain.cancelScheduledValues(this.ctx.currentTime);this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.007);}
    async close(){this.stop();if(!this.offline)await this.ctx.close();}
  }
  function scheduleStep(engine,session,step,bar,time,rng,performance={}){
    const p=modulate(session,time,step,performance.xy),duration=stepDuration(p,step),triggers=[],index=performance.reverse?15-step:step;
    const fx={reverse:!!performance.reverse,pitch:performance.tape?clamp(Math.exp(-(time-(performance.tapeStart||time))*3),.1,1):1};
    if(performance.sparkle){p.space=clamp(p.space+.25);p.tone=clamp(p.tone+.2);}engine.update(p,session.tracks,time);
    const hasSolo=session.tracks.some(tr=>tr.solo);
    session.scenes[session.scene].forEach((row,tr)=>{
      const cell=row[index],track=session.tracks[tr];if(!cell.on||track.mute||(hasSolo&&!track.solo)||rng()>cell.prob)return;
      if(tr>=2&&tr<5&&step%4!==0&&rng()>clamp(.24+p.density*.95))return;
      let ratchets=cell.ratchet;
      if(tr<5&&rng()<p.glitch*.13&&step%4===3)ratchets=Math.max(ratchets,2);
      if(performance.stutter&&tr!==5)ratchets=tr<3?4:2;
      for(let r=0;r<ratchets;r++){const offset=r*duration/ratchets,velocity=cell.vel*(r===0?1:.65);engine.trigger(tr,time+offset,velocity,cell.degree,p,fx);}
      triggers.push(tr);
    });
    if(performance.sparkle&&step%2===0){engine.trigger(4,time,.35,14+[0,2,4,6][Math.floor(step/2)%4],p,fx);triggers.push(4);}
    return{duration:duration*(performance.tape?1/clamp(fx.pitch,.28,1):1),triggers,params:p};
  }
  function wav(buffer){const channels=buffer.numberOfChannels,frames=buffer.length,bytes=44+frames*channels*2,array=new ArrayBuffer(bytes),v=new DataView(array);let offset=0;const str=s=>{for(let i=0;i<s.length;i++)v.setUint8(offset++,s.charCodeAt(i));},u16=n=>{v.setUint16(offset,n,true);offset+=2;},u32=n=>{v.setUint32(offset,n,true);offset+=4;};str('RIFF');u32(bytes-8);str('WAVE');str('fmt ');u32(16);u16(1);u16(channels);u32(buffer.sampleRate);u32(buffer.sampleRate*channels*2);u16(channels*2);u16(16);str('data');u32(frames*channels*2);const data=Array.from({length:channels},(_,c)=>buffer.getChannelData(c));for(let i=0;i<frames;i++)for(let c=0;c<channels;c++){const x=clamp(data[c][i],-1,1);v.setInt16(offset,x<0?x*32768:x*32767,true);offset+=2;}return array;}
  const api={TRACKS,SCALES,PRESETS,clamp,random,euclidean,noteMidi,noteName,hz,generateScene,newSession,validateSession,modulate,stepDuration,mutate,Engine,scheduleStep,wav};
  root.BunnyAudio=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
