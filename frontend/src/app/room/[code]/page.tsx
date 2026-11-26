'use client';
import {use,useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,Check,Copy,Hand,Mic,MicOff,Radio,Users,Wifi,WifiOff} from 'lucide-react';
import Protected from '@/components/Protected';
import AppHeader from '@/components/AppHeader';
import CaptionBoard from '@/components/CaptionBoard';
import {useSpeechCaptions} from '@/hooks/useSpeechCaptions';
import {useRoom} from '@/hooks/useRoom';
import {api} from '@/lib/api';
import {useRouter} from 'next/navigation';
function TeacherRoom({code}:{code:string}){
 const{socket,connected,count,interim,segments,room,error}=useRoom(code);
 const[lang,setLang]=useState('en-IN'),[copied,setCopied]=useState(false),[ending,setEnding]=useState(false),[localError,setLocalError]=useState('');const router=useRouter();
 const onFinal=useCallback((text:string)=>{socket?.emit('caption:final',{id:crypto.randomUUID(),text});},[socket]);
 const onInterim=useCallback((text:string)=>{socket?.emit('caption:interim',{text});},[socket]);
 const speech=useSpeechCaptions(onFinal,onInterim,lang);
 useEffect(()=>{if(!connected&&speech.active)speech.stop();},[connected,speech.active,speech.stop]);
 const signs=segments.filter(s=>s.kind==='sign').slice(-5).reverse();
 async function endClass(){if(!confirm('End this classroom? Students can still review saved captions.'))return;setEnding(true);speech.stop();try{await api(`/api/rooms/${code}/end`,{method:'POST'});router.push('/dashboard');}catch(e){setLocalError(e instanceof Error?e.message:'Unable to end classroom');}finally{setEnding(false);}}
 async function copy(){await navigator.clipboard.writeText(code);setCopied(true);setTimeout(()=>setCopied(false),1500);}
 return <><AppHeader/><main className="workspace wrap"><div className="room-page-top"><div><Link href="/dashboard" className="back-link"><ArrowLeft size={16}/> Dashboard</Link><h1>{room?.title||'Your classroom'}</h1><p>Teacher control room · <strong>{code}</strong></p></div><div className="room-top-actions"><span className={connected?'connection-state':'connection-state offline'}>{connected?<Wifi size={15}/>:<WifiOff size={15}/>} {connected?'Connected':'Reconnecting'}</span><button onClick={copy} className="btn btn-outline">{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'Copied':code}</button><button className="btn btn-danger" disabled={ending||room?.status==='ended'} onClick={endClass}>End class</button></div></div><div className="room-stats"><span><Users size={17}/> {count} students connected</span><span><Radio size={17}/> {room?.status==='ended'?'Class ended':speech.active?'Captioning live':'Waiting to start'}</span><span>Language: <select value={lang} disabled={speech.active} onChange={e=>setLang(e.target.value)} aria-label="Caption language"><option value="en-IN">English (India)</option><option value="hi-IN">Hindi</option><option value="en-US">English (US)</option></select></span></div><div className="class-grid"><div className="class-primary"><CaptionBoard segments={segments} interim={interim}/><div className="mic-toolbar"><span className="mic-info"><Mic size={20}/><span><strong>Microphone controls</strong><small>Speech is recognized in your browser.</small></span></span><button className={speech.active?'btn btn-danger':'btn btn-primary'} onClick={speech.active?speech.stop:speech.start} disabled={!connected||room?.status==='ended'||!speech.supported}>{speech.active?<><MicOff size={18}/> Stop captions</>:<><Mic size={18}/> Start captions</>}</button></div>{(speech.error||error||localError)&&<p className="form-error" role="alert">{speech.error||error||localError}</p>}</div><aside className="class-side"><section className="side-card"><div className="side-card-head"><span><Hand size={20}/> Student sign requests</span><span className="mini-tag">{signs.length} recent</span></div>{signs.length?signs.map(s=><div key={s.id} className="sign-entry"><span className="sign-entry-icon"><Hand size={20}/></span><span><strong>{s.text}</strong><small>{new Date(s.createdAt).toLocaleTimeString()}</small></span></div>):<p className="side-empty">Recognized demo gestures will appear here when students use their cameras.</p>}</section><section className="side-card tip-card"><strong>Invite students</strong><p>Share code <b>{code}</b>, or send them this link:</p><button className="text-link" onClick={()=>navigator.clipboard.writeText(`${location.origin}/room/${code}/watch`)}>Copy student link <Copy size={15}/></button></section></aside></div></main></>;
}
export default function TeacherRoomPage({params}:{params:Promise<{code:string}>}){const{code}=use(params);return <Protected role="teacher"><TeacherRoom code={code.toUpperCase()}/></Protected>}
