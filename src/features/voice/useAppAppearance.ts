import {useEffect,useState} from 'react';
export function useAppAppearance(){
 const [dark,setDark]=useState(()=>document.documentElement.classList.contains('dark'));
 const [limited,setLimited]=useState(()=>window.matchMedia('(prefers-reduced-transparency: reduce), (forced-colors: active)').matches);
 useEffect(()=>{const observer=new MutationObserver(()=>setDark(document.documentElement.classList.contains('dark')));observer.observe(document.documentElement,{attributes:true,attributeFilter:['class']});const media=window.matchMedia('(prefers-reduced-transparency: reduce), (forced-colors: active)');const update=()=>setLimited(media.matches);media.addEventListener('change',update);return()=>{observer.disconnect();media.removeEventListener('change',update)}},[]);
 return {dark,limited};
}
