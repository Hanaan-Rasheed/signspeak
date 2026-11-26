'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
// Browser-specific typings are declared here to avoid adding another package.
type Result={isFinal:boolean;0:{transcript:string}};
type SpeechEvent={resultIndex:number;results:ArrayLike<Result>};
type SpeechError={error:string};
type Recognizer={continuous:boolean;interimResults:boolean;lang:string;onresult:((e:SpeechEvent)=>void)|null;onerror:((e:SpeechError)=>void)|null;onend:(()=>void)|null;onstart:(()=>void)|null;start:()=>void;stop:()=>void;abort:()=>void};
type SpeechWindow=Window & {SpeechRecognition?:new()=>Recognizer;webkitSpeechRecognition?:new()=>Recognizer};
export function useSpeechCaptions(onFinal:(text:string)=>void,onInterim:(text:string)=>void,lang='en-IN'){
 const[active,setActive]=useState(false);const[supported,setSupported]=useState(true);const[error,setError]=useState('');
 const recognizer=useRef<Recognizer|null>(null);const wants=useRef(false);const finalCallback=useRef(onFinal);const interimCallback=useRef(onInterim);const retry=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{finalCallback.current=onFinal;interimCallback.current=onInterim;},[onFinal,onInterim]);
 useEffect(()=>{
  const w=window as SpeechWindow;const SR=w.SpeechRecognition||w.webkitSpeechRecognition;
  if(!SR){setSupported(false);setError('Speech recognition is not available in this browser. Try a recent version of Chrome or Edge.');return;}
  const rec=new SR();rec.continuous=true;rec.interimResults=true;rec.lang=lang;
  rec.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const item=e.results[i];if(item.isFinal){const text=item[0].transcript.trim();if(text)finalCallback.current(text);}else interim+=item[0].transcript;}interimCallback.current(interim);};
  rec.onstart=()=>{setActive(true);setError('');};
  rec.onerror=e=>{if(['not-allowed','service-not-allowed','audio-capture'].includes(e.error)){wants.current=false;setError('Microphone access failed. Check browser permission and input device.');}else if(e.error!=='no-speech'&&e.error!=='aborted'){setError(`Speech recognition: ${e.error}`);}};
  rec.onend=()=>{setActive(false);interimCallback.current('');if(wants.current)retry.current=setTimeout(()=>{try{rec.start();}catch{}},600);};
  recognizer.current=rec;
  return()=>{wants.current=false;if(retry.current)clearTimeout(retry.current);rec.onend=null;rec.onresult=null;rec.onerror=null;rec.abort();recognizer.current=null;};
 },[lang]);
 const start=useCallback(()=>{if(!recognizer.current)return;setError('');wants.current=true;try{recognizer.current.start();}catch{}},[]);
 const stop=useCallback(()=>{wants.current=false;if(retry.current)clearTimeout(retry.current);recognizer.current?.stop();setActive(false);},[]);
 return {active,supported,error,start,stop};
}
