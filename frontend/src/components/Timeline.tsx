import {Footprints,Utensils,Flag} from 'lucide-react';
import type {RouteStep} from '../types/campus';
export default function Timeline({steps}:{steps:RouteStep[]}){return <div className="timeline">{steps.map((s,i)=><div key={i}><span className="timeline-icon">{s.type==='walk'?<Footprints size={15}/>:<Utensils size={15}/>}</span><span>{s.label}</span><strong>{s.minutes} min</strong></div>)}<div><span className="timeline-icon"><Flag size={15}/></span><span>You're in class. Crisis averted.</span></div></div>}
