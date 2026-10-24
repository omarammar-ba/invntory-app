import {useCallback,useEffect,useRef,useState} from 'react';
// Browser speech is a provisional preview only; final extraction uses Whisper or explicitly edited text.
export function useLiveTranscript(){
 const recognition=useRef<any>(null),run=useRef(0);
 const [text,setText]=useState(''),[available,setAvailable]=useState(false);
 const stop=useCallback(()=>{run.current++;const r=recognition.current;recognition.current=null;if(r){r.onresult=null;r.onerror=null;r.onend=null;try{r.abort()}catch{}}},[]);
 const start=useCallback(()=>{
  stop();setText('');setAvailable(false);
  const Constructor=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!Constructor)return;
  const id=run.current;try{const r=new Constructor();recognition.current=r;r.lang='ar-JO';r.continuous=true;r.interimResults=true;
   r.onresult=(e:any)=>{if(run.current!==id)return;const parts=[];for(let i=0;i<e.results.length;i++)parts.push(e.results[i][0].transcript);setAvailable(true);setText(parts.join(' '))};
   r.onerror=()=>{if(run.current===id)setAvailable(false)};r.onend=()=>{if(run.current===id)setAvailable(false)};
   r.start();
  }catch{setAvailable(false)}
 },[stop]);
 useEffect(()=>stop,[stop]);return {text,available,start,stop};
}
