'use client';
import { useEffect,type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import type { Role } from '@/types';
export default function Protected({children,role}:{children:ReactNode;role?:Role}){
  const{user,loading}=useAuth();const router=useRouter();
  useEffect(()=>{if(!loading&&(!user||(role&&user.role!==role)))router.replace(user?'/dashboard':'/login');},[loading,user,role,router]);
  if(loading||!user||(role&&user.role!==role))return <main className="loading-page"><div className="spinner"/>Checking your session…</main>;
  return <>{children}</>;
}
