import {Zap, X, Check, ArrowRight} from 'lucide-react';
import type {PanicOption} from '../data/survivalApi';

export default function ScrewedMode({panic, onPick, onClose}:{
  panic: {availableMinutes: number; yourMove: {title: string; detail: string}; options: PanicOption[]} | null;
  onPick: (o: PanicOption) => void;
  onClose: () => void;
}) {
  if (!panic) return <section className="emergency-panel">
    <div className="section-line">
      <span className="emergency-badge"><Zap size={15}/> I'M SCREWED</span>
      <button aria-label="Close emergency mode" onClick={onClose}><X size={20}/></button>
    </div>
    <h2>Tell me how long you've got.</h2>
    <p>Try: <em>"4 minutes to get from Campus Center to Innovation Hall"</em></p>
  </section>;

  return <section className="emergency-panel">
    <div className="section-line">
      <span className="emergency-badge"><Zap size={15}/> I'M SCREWED</span>
      <button aria-label="Close emergency mode" onClick={onClose}><X size={20}/></button>
    </div>

    <h2>You have <em>{panic.availableMinutes} minutes.</em><br/>Let's make the right call.</h2>

    <div className="emergency-options">
      {panic.options.map(o =>
        <div key={o.label} className={o.recommended ? 'direct-option' : ''} onClick={() => onPick(o)} role="button" tabIndex={0}>
          {o.makesIt ? <Check size={18}/> : <X size={18}/>}
          <div>
            <strong>{o.label}</strong>
            <small>{o.detail}{o.note ? ` · ${o.note}` : ''}</small>
          </div>
          <b>{o.minutes} min{o.delta >= 0 ? ` · ${o.delta} spare` : ` · ${Math.abs(o.delta)} late`}</b>
        </div>
      )}
    </div>

    <div className="your-move">
      <div>
        <span className="eyebrow">YOUR MOVE</span>
        <h3>{panic.yourMove.title}</h3>
        <p>{panic.yourMove.detail}</p>
      </div>
      {panic.options[0] && <button className="primary" onClick={() => onPick(panic.options[0])}>
        Take this route <ArrowRight size={17}/>
      </button>}
    </div>
  </section>;
}
