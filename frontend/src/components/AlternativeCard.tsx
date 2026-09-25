import {Coffee, Pizza, BookOpen, CupSoda, Navigation, ArrowUpRight} from 'lucide-react';
import type {Alternative} from '../data/survivalApi';

const ICON = {coffee: Coffee, study: BookOpen, vending: CupSoda, travel: Navigation, panic: Navigation, food: Pizza};
const CLASS = {'GOOD OPTION': 'safe', 'QUICK SNACK': 'safe', 'TIGHT': 'tight', 'TOO RISKY': 'screwed'};

export default function AlternativeCard({alt, onClick}:{alt: Alternative; onClick: () => void}) {
  const Icon = ICON[(alt.stop?.kind as keyof typeof ICON) ?? alt.mode] ?? Pizza;
  return <button className="alternative" onClick={onClick}>
    <span className="alt-icon"><Icon size={20}/></span>
    <div><strong>{alt.title}</strong><small>{alt.detail}</small></div>
    <span className={'alt-status ' + (CLASS[alt.badge] ?? 'safe')}>{alt.badge}</span>
    <ArrowUpRight size={16}/>
  </button>;
}
