import {Sparkles,ChevronDown,Check} from 'lucide-react';
import {useState} from 'react';
export default function AIReasoning({reasons}:{reasons:string[]}){const [open,setOpen]=useState(false);return <div className="reasoning"><button onClick={()=>setOpen(!open)} aria-expanded={open}><span><Sparkles size={16}/> Why did AI choose this?</span><span>{open?'Hide reasoning':'Show AI reasoning'}<ChevronDown size={15}/></span></button>{open&&<div className="reasons">{reasons.map(r=><p key={r}><Check size={15}/>{r}</p>)}<small>Demo explanation generated from mock route data.</small></div>}</div>}
