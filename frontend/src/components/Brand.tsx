import Link from 'next/link';
import { Hand } from 'lucide-react';
export default function Brand({small=false}:{small?:boolean}){
 return <Link href="/" className="brand"><span className="brand-symbol"><Hand size={small?19:22}/></span><span>Sign<span className="brand-accent">Speak</span></span></Link>;
}
