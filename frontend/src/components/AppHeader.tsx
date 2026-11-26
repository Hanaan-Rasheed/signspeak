'use client';
import Link from 'next/link';
import {LogOut,LayoutDashboard,BookText} from 'lucide-react';
import {useRouter} from 'next/navigation';
import Brand from '@/components/Brand';
import {useAuth} from '@/lib/auth';
export default function AppHeader(){const{user,logout}=useAuth();const router=useRouter();return <header className="app-header"><div className="wrap app-header-content"><Brand small/><nav aria-label="Workspace navigation"><Link href="/dashboard"><LayoutDashboard size={16}/> Dashboard</Link><Link href="/lectures"><BookText size={16}/> Lectures</Link></nav><div className="header-account"><span className="account-avatar">{user?.name.slice(0,1).toUpperCase()}</span><span className="account-name">{user?.name}</span><button onClick={()=>{logout();router.push('/')}} title="Log out" aria-label="Log out"><LogOut size={18}/></button></div></div></header>}
