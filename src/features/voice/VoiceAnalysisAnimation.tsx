import { motion, useReducedMotion } from 'motion/react';
import { Sparkles } from 'lucide-react';
export default function VoiceAnalysisAnimation() {
 const reduce=useReducedMotion();
 return <div className="voice-analysis-art" aria-hidden="true"><motion.svg viewBox="0 0 100 100" animate={reduce?undefined:{rotate:360}} transition={{duration:8,repeat:Infinity,ease:'linear'}}><motion.circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" initial={false} animate={reduce?{pathLength:.7}:{pathLength:[.24,.8,.24],pathOffset:[0,.5,1]}} transition={{duration:3.2,repeat:Infinity,ease:'easeInOut'}} /></motion.svg><Sparkles size={28}/><div className="voice-analysis-bars">{[0,1,2,3,4].map(i=><motion.i key={i} animate={reduce?undefined:{scaleY:[.45,1,.45]}} transition={{duration:1.1,delay:i*.12,repeat:Infinity,ease:'easeInOut'}} />)}</div></div>;
}
