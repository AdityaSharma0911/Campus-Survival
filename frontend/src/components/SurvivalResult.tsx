import {Check, ArrowUpRight, Sandwich, Coffee, BookOpen, Navigation, Clock3} from 'lucide-react';
import type {LiveRecommendation} from '../data/survivalApi';
import RiskIndicator from './RiskIndicator';

const ICON = {food: Sandwich, coffee: Coffee, study: BookOpen, travel: Navigation, panic: Navigation};
const NOUN = {food: 'food', coffee: 'coffee', study: 'a study break', travel: 'the walk', panic: 'the walk'};

export default function SurvivalResult({result, onRoute}:{
  result: LiveRecommendation; onRoute: () => void;
}) {
  const Icon = ICON[result.mode] ?? Sandwich;
  const stop = result.stop;

  const headline = result.risk === 'safe' ? 'Good timing. Great plan.'
    : result.risk === 'tight' ? 'You can make it. Just.'
    : 'Class comes first.';

  const sub = result.risk === 'screwed'
    ? `This won't fit your ${result.availableMinutes}-minute window — you'd be ${Math.abs(result.bufferMinutes)} min late.`
    : `You have enough time for ${NOUN[result.mode] ?? 'this'} and your next class.`;

  return <section className="result-card">
    <div className={'result-status ' + result.risk}>
      <span className="check-circle"><Check size={14}/></span>
      {result.risk === 'safe' ? 'YOU CAN MAKE IT' : result.risk === 'tight' ? 'CUTTING IT CLOSE' : 'SKIP THE DETOUR'}
    </div>

    <h2>{headline}</h2>
    <p>{sub}</p>

    <div className="recommendation">
      <span className="food-icon"><Icon size={25}/></span>
      <div>
        <span className="eyebrow">{result.risk === 'screwed' ? 'SELECTED OPTION' : 'YOUR BEST MOVE'}</span>
        <h3>{result.location}</h3>
        <small>
          {stop?.closesAt
            ? <><span className="tiny-dot"/> Open until {stop.closesAt}</>
            : <><span className="tiny-dot"/> Open now</>}
          <span>·</span>
          {stop ? 'On your route' : 'Direct route'}
          {stop?.lunchRush && <> <span>·</span> Lunch rush</>}
        </small>
      </div>
      <span className="best-tag">{result.risk === 'screwed' ? 'Too far' : 'Best option'}</span>
    </div>

    <div className="result-bottom">
      <RiskIndicator risk={result.risk} buffer={result.bufferMinutes}/>
      <div className="total">
        <Clock3 size={17}/>
        <b>{result.totalMinutes} minutes</b>
        <span>Total trip time</span>
        <button onClick={onRoute}>VIEW ROUTE <ArrowUpRight size={15}/></button>
      </div>
    </div>
  </section>;
}
