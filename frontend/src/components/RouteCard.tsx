import {MapPin, Footprints, Navigation, ArrowUpRight, ExternalLink} from 'lucide-react';
import type {LiveRecommendation} from '../data/survivalApi';

/** Real origin -> optional pit stop -> real destination, with the planner's own walking times. */
export default function RouteCard({result, expanded, onExpand}:{
  result: LiveRecommendation; expanded: boolean; onExpand: () => void;
}) {
  const stop = result.stop;
  const walkSteps = result.steps.filter(s => s.type === 'walk');
  const firstLeg = walkSteps[0]?.minutes ?? result.steps[0]?.minutes ?? 0;
  const lastLeg  = walkSteps.length > 1 ? walkSteps[walkSteps.length - 1].minutes : null;
  const stopStep = result.steps.find(s => s.type === 'food');

  return <section className="route-card">
    <div className="route-heading">
      <h2>Your route</h2>
      <span><Footprints size={13}/> WALKING</span>
    </div>

    <div className="route-map">
      <span className="map-caption">INDIANAPOLIS</span>

      <div className="route-stop start">
        <span className="location-node"><MapPin size={17}/></span>
        <div><small>YOU ARE HERE</small><strong>{result.origin?.short ?? result.origin?.name ?? '—'}</strong></div>
      </div>

      <div className="map-connector"><span><Footprints size={13}/> {firstLeg} min walk</span></div>

      {stop && <>
        <div className="route-stop mid">
          <span className="location-node gold-node"><span className="tiny-dot"/></span>
          <div>
            <small>YOUR PIT STOP{stopStep ? ` · ${stopStep.minutes} MIN` : ''}</small>
            <strong>{stop.name}</strong>
            {stop.closesAt && <small className="stop-meta">Closes {stop.closesAt}</small>}
          </div>
        </div>
        {lastLeg !== null && <div className="map-connector second"><span><Footprints size={13}/> {lastLeg} min walk</span></div>}
      </>}

      <div className="route-stop end">
        <span className="location-node dark-node"><Navigation size={15}/></span>
        <div><small>NEXT CLASS</small><strong>{result.destination?.short ?? result.destination?.name ?? '—'}</strong></div>
      </div>

      <span className="north">N ↑</span>
      <span className="map-note">Straight-line schematic · times are routed walking estimates</span>
    </div>

    <div className="route-footer">
      <span><b>{result.totalMinutes} min</b> door to door</span>
      <span className="route-actions">
        {result.mapsUrl && <a href={result.mapsUrl} target="_blank" rel="noreferrer">Open in Maps <ExternalLink size={14}/></a>}
        <button onClick={onExpand}>{expanded ? 'Hide steps' : 'View route'} <ArrowUpRight size={16}/></button>
      </span>
    </div>
  </section>;
}
