import type { User } from '@/types';
export const API_URL=process.env.NEXT_PUBLIC_API_URL||'http://localhost:4000';
const TOKEN='signspeak_session';
export const getToken=()=>typeof window==='undefined'?null:localStorage.getItem(TOKEN);
export const setToken=(token:string)=>localStorage.setItem(TOKEN,token);
export const clearToken=()=>localStorage.removeItem(TOKEN);

// Keep HTTP requests in one place so UI components only deal with data.
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const token=getToken();
  const response=await fetch(`${API_URL}${path}`,{
    ...options, headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{ }),...options.headers},
    cache:'no-store'
  });
  const result=await response.json().catch(()=>({error:'The server sent an unexpected response.'}));
  if(!response.ok)throw new Error(result.error||`Request failed (${response.status}).`);
  return result as T;
}
export type AuthResponse={token:string;user:User};
