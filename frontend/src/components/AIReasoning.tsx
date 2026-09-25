import {Sparkles, ChevronDown, Check, XCircle} from 'lucide-react';
import {useState} from 'react';

export default function AIReasoning({reasons, narration, rejected, ai}:{
  reasons: string[];
  narration?: string;
  rejected?: {id: string; location: string; code: string; reason: string}[];
  ai?: {intent: string; narration: string; errors: string[]};
}) {
  const [open, setOpen] = useState(false);
  const source = ai?.intent === 'gemini' ? 'Gemini parsed your sentence' : 'Rule-based parser (no AI key set)';

  return <div className="reasoning">
    {narration && <p className="narration">{narration}</p>}

    <button onClick={() => setOpen(!open)} aria-expanded={open}>
      <span><Sparkles size={16}/> Why did AI choose this?</span>
      <span>{open ? 'Hide reasoning' : 'Show AI reasoning'}<ChevronDown size={15}/></span>
    </button>

    {open && <div className="reasons">
      {reasons.map(r => <p key={r}><Check size={15}/>{r}</p>)}

      {!!rejected?.length && <>
        <h4 className="rejected-head">Ruled out</h4>
        {rejected.slice(0, 6).map(r =>
          <p key={r.id} className="rejected"><XCircle size={15}/>{r.location} — {r.reason}</p>
        )}
      </>}

      <small>{source}. Every number above was computed in JavaScript from campus coordinates and opening hours — the model never does the arithmetic.</small>
    </div>}
  </div>;
}
