import { useEffect, useState } from 'react';
import { auth } from '@/services/firebase';
export interface ProviderQuota { remaining: number | null; limit: number | null; tokensPerMinute: number | null; observedAt: number; }
export interface VoiceUsage { speech?: ProviderQuota; analysis?: ProviderQuota; }
const eventName='inventory-voice-quota';
const key=(uid:string)=>`inventory-voice-quota-v1:${uid}`;
const valid=(q:any):q is ProviderQuota => q && typeof q.observedAt==='number' && Number.isFinite(q.observedAt) && ['remaining','limit','tokensPerMinute'].every(k=>q[k]===null||(typeof q[k]==='number'&&Number.isFinite(q[k])&&q[k]>=0));
function read(uid?:string):VoiceUsage { try { const v=uid?JSON.parse(localStorage.getItem(key(uid))||'{}'):{};return Object.fromEntries(Object.entries(v).filter(([,q])=>valid(q)&&Date.now()-(q as ProviderQuota).observedAt<15*60*1000)); }catch{return {}} }
export function publishVoiceUsage(usage:VoiceUsage) {
 const uid=auth.currentUser?.uid;if(!uid)return;
 const cleaned:VoiceUsage={...read(uid)};for(const stage of ['speech','analysis'] as const)if(valid(usage?.[stage]))cleaned[stage]=usage[stage];
 try{localStorage.setItem(key(uid),JSON.stringify(cleaned))}catch{}
 window.dispatchEvent(new Event(eventName));
}
export function quotaFromHeaders(headers:Headers):ProviderQuota {
 const num=(name:string)=>{const s=headers.get(name);if(s===null||s.trim()==='')return null;const n=Number(s);return Number.isFinite(n)&&n>=0?n:null};
 return {remaining:num('x-ratelimit-remaining-requests'),limit:num('x-ratelimit-limit-requests'),tokensPerMinute:num('x-ratelimit-remaining-tokens'),observedAt:Date.now()};
}
export function useVoiceQuota(uid?:string) {
 const [usage,setUsage]=useState<VoiceUsage>(()=>read(uid));
 useEffect(()=>{const update=()=>setUsage(read(uid));update();window.addEventListener(eventName,update);const timer=setInterval(update,60000);return()=>{window.removeEventListener(eventName,update);clearInterval(timer)}},[uid]);
 return usage;
}
