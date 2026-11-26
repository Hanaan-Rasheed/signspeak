'use client';
import { useEffect,useState,type FormEvent } from 'react';
import { motion,useReducedMotion,useScroll,useTransform } from 'motion/react';
import { useRouter } from 'next/navigation';
import { ArrowRight,AudioLines,Hand,Mic,Play,Radio,Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth';
const SCRIPT='Today we will learn how photosynthesis turns sunlight into energy for the plant.';
export default function Hero(){
 const [typed,setTyped]=useState('');const[code,setCode]=useState('');const[showSign,setShowSign]=useState(false);
 const reduce=useReducedMotion();const router=useRouter();const{user}=useAuth();
 const{scrollY}=useScroll();const move=useTransform(scrollY,[0,650],[0,-70]);
 useEffect(()=>{
  if(reduce){setTyped(SCRIPT);setShowSign(true);return;}
  let i=0;const timer=setInterval(()=>{i++;setTyped(SCRIPT.slice(0,Math.min(i,SCRIPT.length)));setShowSign(i>=48&&i<SCRIPT.length+28);if(i>SCRIPT.length+32)i=0;},65);
  return ()=>clearInterval(timer);
 },[reduce]);
 function join(e:FormEvent){e.preventDefault();const value=code.trim().toUpperCase();if(/^[A-Z0-9]{6}$/.test(value))router.push(`/room/${value}/watch`);}
 return <section className="hero wrap" id="top">
   <div className="hero-copy">
     <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:.65}} className="eyebrow"><Sparkles size={15}/> A brighter way to learn together</motion.div>
     <motion.h1 initial={{opacity:0,y:26}} animate={{opacity:1,y:0}} transition={{delay:.12,duration:.7}}>Every word.<br/>Every sign.<br/><span className="gradient-text">Every student.</span></motion.h1>
     <motion.p className="hero-desc" initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{delay:.24}}>Live captions and supported sign gestures, brought together in one beautifully accessible classroom.</motion.p>
     <motion.div className="hero-actions" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.38}}><button className="btn btn-primary" onClick={()=>router.push(user?'/dashboard':'/login')}>Start teaching <ArrowRight size={18}/></button><a className="btn btn-ghost" href="#experience"><Play size={16}/> Explore the experience</a></motion.div>
     <form onSubmit={join} className="join-inline"><span className="join-label">JOIN A CLASS <small>No install required</small></span><input aria-label="Six-character classroom code" value={code} maxLength={6} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} placeholder="ABC123" pattern="[A-Z0-9]{6}" required/><button type="submit" aria-label="Join classroom"><ArrowRight size={20}/></button></form>
     <div className="trust-line"><span className="trust-dot"/> Built for clarity, privacy and participation</div>
   </div>
   <motion.div className="hero-art" style={reduce?undefined:{y:move}}><div className="aurora-orb orb-a"/><div className="aurora-orb orb-b"/>
    <motion.div className="preview-window" initial={{opacity:0,scale:.92,y:35}} animate={{opacity:1,scale:1,y:0}} transition={{type:'spring',stiffness:85,damping:15,delay:.2}}>
      <div className="preview-top"><span><span className="preview-dot"/> LIVE CLASSROOM PREVIEW</span><span className="preview-demo">SIMULATED DEMO</span></div>
      <div className="preview-caption"><div className="preview-label"><Mic size={17}/> TEACHER SPEAKING <span className="live-pill"><Radio size={13}/> LIVE</span></div><p>{typed}<span className="cursor"/></p><div className="wave-bars" aria-hidden="true">{Array.from({length:23},(_,i)=><i key={i} style={{height:`${8+(i*19%28)}px`}}/>)}</div></div>
      <div className="preview-bottom"><div className="camera-sim"><div className="camera-corners"><Hand size={58} strokeWidth={1.3}/></div><span>Hand tracking preview</span></div><div className="preview-sign"><span className="sign-icon"><Hand size={24}/></span><div><small>STUDENT SIGN INPUT</small><strong>{showSign?'Question detected':'Waiting for a sign…'}</strong></div></div></div>
    </motion.div>
    <motion.div className="float-note note-one" animate={reduce?{}:{y:[0,-10,0]}} transition={{duration:5,repeat:Infinity,ease:'easeInOut'}}><AudioLines size={18}/> Real-time captions</motion.div>
    <motion.div className="float-note note-two" animate={reduce?{}:{y:[0,9,0]}} transition={{duration:6,repeat:Infinity,ease:'easeInOut'}}><span>✦</span> Accessible by design</motion.div>
   </motion.div>
  </section>
}
