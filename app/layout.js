import './globals.css';
export const metadata={title:'RX Studio OS · Future Press',description:'RX Design Hub multi-brand publishing command centre',robots:{index:false,follow:false}};
export const viewport={width:'device-width',initialScale:1,themeColor:[{media:'(prefers-color-scheme: light)',color:'#eef2f8'},{media:'(prefers-color-scheme: dark)',color:'#070b12'}]};
export default function RootLayout({children}){return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;}
