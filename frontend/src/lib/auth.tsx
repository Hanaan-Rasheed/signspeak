'use client';
import { createContext,useCallback,useContext,useEffect,useState,type ReactNode } from 'react';
import { api,clearToken,getToken,setToken,type AuthResponse } from '@/lib/api';
import type { User } from '@/types';
type AuthContext={user:User|null;loading:boolean;login:(email:string,password:string)=>Promise<void>;register:(data:{name:string;email:string;password:string;role:'teacher'|'student'})=>Promise<void>;logout:()=>void};
const Context=createContext<AuthContext|null>(null);
export function AuthProvider({children}:{children:ReactNode}){
  const[user,setUser]=useState<User|null>(null);
  const[loading,setLoading]=useState(true);
  useEffect(()=>{
    if(!getToken()){setLoading(false);return;}
    api<{user:User}>('/api/auth/me').then(v=>setUser(v.user)).catch(()=>clearToken()).finally(()=>setLoading(false));
  },[]);
  const login=useCallback(async(email:string,password:string)=>{
    const data=await api<AuthResponse>('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})});
    setToken(data.token);setUser(data.user);
  },[]);
  const register=useCallback(async(data:{name:string;email:string;password:string;role:'teacher'|'student'})=>{
    const result=await api<AuthResponse>('/api/auth/register',{method:'POST',body:JSON.stringify(data)});
    setToken(result.token);setUser(result.user);
  },[]);
  const logout=useCallback(()=>{clearToken();setUser(null);},[]);
  return <Context.Provider value={{user,loading,login,register,logout}}>{children}</Context.Provider>;
}
export function useAuth(){const context=useContext(Context);if(!context)throw new Error('Wrap the page in AuthProvider');return context;}
