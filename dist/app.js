const hero=document.querySelector('.hero');
const sculpture=document.querySelector('.hero-object');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
hero.addEventListener('pointermove',event=>{if(reduced.matches||event.pointerType!=='mouse')return;const r=hero.getBoundingClientRect();const x=(event.clientX-r.left)/r.width-.5;const y=(event.clientY-r.top)/r.height-.5;sculpture.style.setProperty('--px',`${x*24}px`);sculpture.style.setProperty('--py',`${y*16}px`);sculpture.style.setProperty('--rot',`${x*5}deg`);});
hero.addEventListener('pointerleave',()=>{['--px','--py','--rot'].forEach(p=>sculpture.style.removeProperty(p));});
