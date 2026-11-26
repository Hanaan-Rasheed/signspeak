import type { Metadata } from 'next';
import { Lexend } from 'next/font/google';
import { AuthProvider } from '@/lib/auth';
import './globals.css';
const lexend=Lexend({subsets:['latin'],display:'swap'});
export const metadata:Metadata={title:{default:'SignSpeak — Every word, every sign',template:'%s | SignSpeak'},description:'Live classroom captions and browser-based demo sign recognition for more accessible learning.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body className={lexend.className}><AuthProvider>{children}</AuthProvider></body></html>}
