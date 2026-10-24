import {useCallback,useRef,useEffect} from 'react';
import {VoiceBeam} from 'voice-glow';
import {useReducedMotion} from 'motion/react';
import {Mic} from 'lucide-react';
import ThoughtLine from '@/components/effects/ThoughtLine';
import {useAppAppearance} from './useAppAppearance';
const StatusLine=ThoughtLine as React.ComponentType<any>;
export default function VoiceSurface({stream,recording,processing,phase,children}:{stream:MediaStream|null;recording:boolean;processing:boolean;phase:string;children:React.ReactNode}){
 const reduce=useReducedMotion();const {dark,limited}=useAppAppearance();const started=useRef(performance.now());
 useEffect(()=>{if(processing)started.current=performance.now()},[processing]);
 // voice-glow0.3 exposes motion; its advertised processing shortcut isn't in the free npm API.
 const beamMotion=useCallback(()=>processing?{gather:1,offset:Math.sin((performance.now()-started.current)/1100)*.38,heldLevel:.36,stretch:.12}:null,[processing]);
 return <VoiceBeam className="voice-beam-host" type="default" stream={recording?stream:null} colorVariant="ocean" theme={dark?'dark':'light'} active={(recording||processing)&&!limited} paused={!!reduce} strength={limited?0:.45} idle={0} motion={beamMotion} staticColors reach={.85}>
  <div className="voice-surface"><span className="voice-surface-mic" aria-hidden="true"><Mic size={25}/></span>{processing?<StatusLine working label={phase==='extracting'?'ترتيب البيانات…':phase==='processing'?'معالجة التسجيل…':'تحويل التسجيل إلى نص…'} glyph="dot" steps={phase==='extracting'?['قراءة التسجيل','ترتيب بيانات الصنف']:phase==='processing'?['معالجة التسجيل']:['قراءة التسجيل']} collapsible={false} collapseOnSettle showTimer fontSize={13} shimmer={!reduce} />:children}</div>
 </VoiceBeam>;
}
