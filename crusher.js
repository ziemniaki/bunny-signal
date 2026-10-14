/* Stereo, sample-and-hold bit reduction. No allocations in the audio callback. */
class BunnyCrusher extends AudioWorkletProcessor {
  static get parameterDescriptors(){return[{name:'bits',defaultValue:10,minValue:3,maxValue:16,automationRate:'k-rate'},{name:'rate',defaultValue:.8,minValue:.03,maxValue:1,automationRate:'k-rate'}];}
  constructor(){super();this.phase=new Float64Array(2);this.held=new Float64Array(2);}
  process(inputs,outputs,params){const input=inputs[0],output=outputs[0],levels=2**params.bits[0],rate=params.rate[0];for(let c=0;c<output.length;c++){const src=input[c]||input[0],dst=output[c];if(!src){dst.fill(0);continue;}for(let i=0;i<dst.length;i++){this.phase[c]+=rate;if(this.phase[c]>=1){this.phase[c]-=1;this.held[c]=Math.round(Math.tanh(src[i]*1.8)*levels)/levels;}dst[i]=this.held[c];}}return true;}
}
registerProcessor('bunny-crusher',BunnyCrusher);
