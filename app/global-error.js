'use client';
export default function GlobalError({reset}){
  return <html lang="en"><body><main className="system-screen system-error"><div className="system-code">RX / CORE RECOVERY</div><div className="system-orbit error-orbit"><span/><span/><span/><b>!</b></div><h1>RX Studio needs a clean restart.</h1><p>Your saved database work is untouched.</p><div className="system-actions"><button onClick={reset}>Restart interface</button><button onClick={()=>window.location.reload()}>Reload application</button></div></main></body></html>;
}
