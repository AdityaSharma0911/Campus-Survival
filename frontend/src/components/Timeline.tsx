import {Footprints, Utensils, Coffee, BookOpen, CupSoda, Flag} from 'lucide-react';
import type {LiveStep} from '../data/survivalApi';

const KIND_ICON: Record<string, typeof Footprints> = {
  coffee: Coffee, study: BookOpen, vending: CupSoda, food: Utensils, dining: Utensils
};

export default function Timeline({steps}:{steps: LiveStep[]}) {
  return <div className="timeline">
    {steps.map((s, i) => {
      const Icon = s.type === 'walk' ? Footprints : (KIND_ICON[s.kind ?? ''] ?? Utensils);
      return <div key={i}>
        <span className="timeline-icon"><Icon size={15}/></span>
        <span>{s.label}</span>
        <strong>{s.minutes} min</strong>
      </div>;
    })}
    <div>
      <span className="timeline-icon"><Flag size={15}/></span>
      <span>You're in class. Crisis averted.</span>
    </div>
  </div>;
}
