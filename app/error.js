'use client';
import { useEffect } from 'react';
export default function ErrorPage({error,reset}){
  useEffect(()=>{console.error('RX Studio route error',error);},[error]);
  return <main className="system-screen system-error"><div className="system-code">RX / RECOVERY / 01</div><div className="system-orbit error-orbit"><span/><span/><span/><b>!</b></div><h1>Press system interrupted.</h1><p>The interface recovered before an unsafe action could continue.</p><small>{error?.digest?`Incident ${error.digest}`:'No publishing request was sent.'}</small><div className="system-actions"><button onClick={reset}>Retry safely</button><button onClick={()=>window.location.assign('/')}>Return to command centre</button></div></main>;
}
