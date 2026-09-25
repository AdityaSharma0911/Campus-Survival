import {useEffect, useState, useCallback} from 'react';
import {Sparkles, ArrowUpRight, MapPin, ArrowLeft, Check, AlertTriangle} from 'lucide-react';
import Header from './components/Header';
import SearchBox from './components/SearchBox';
import QuickActions from './components/QuickActions';
import SurvivalResult from './components/SurvivalResult';
import RouteCard from './components/RouteCard';
import Timeline from './components/Timeline';
import AIReasoning from './components/AIReasoning';
import AlternativeCard from './components/AlternativeCard';
import CampusStatus from './components/CampusStatus';
import ScrewedMode from './components/ScrewedMode';
import {
  getSurvivalRecommendation, getPlaces, getCurrentLocation,
  type LiveRecommendation, type LivePlace, type Alternative, type PanicOption
} from './data/survivalApi';

// Every building named here exists in backend/src/campus.js. Verified against
// the planner: Tower Dining, 4 min walk / 8 min to-go / 10 min to class, 3 min buffer.
export const demoQuery =
  "I have 25 minutes between my classes and I'm hungry. I'm at North Hall and my next class is at Innovation Hall.";

export default function App() {
  const [query, setQuery]       = useState('');
  const [view, setView]         = useState('Survive');
  const [result, setResult]     = useState<LiveRecommendation | null>(null);
  const [loading, setLoading]   = useState(true);
  const [emergency, setEmergency] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sample, setSample]     = useState(true);
  const [error, setError]       = useState('');
  const [places, setPlaces]     = useState<LivePlace[]>([]);

  const submit = useCallback(async (q = query, {isSample = false} = {}) => {
    if (!q.trim()) return;
    setView('Survive'); setQuery(q); setLoading(true); setEmergency(false); setError(''); setExpanded(false);
    try {
      // GPS only matters when no building is named; the planner ignores it otherwise.
      const location = await getCurrentLocation().catch(() => null);
      const r = await getSurvivalRecommendation(q, {location});
      setResult(r);
      setSample(isSample);
      if (r.panic) setEmergency(true);
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t plan that trip. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  // Load a real plan on first paint so the first thing anyone sees is live data.
  useEffect(() => { void submit(demoQuery, {isSample: true}); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    let alive = true;
    getPlaces().then(p => alive && setPlaces(p)).catch(() => {});
    return () => {alive = false};
  }, []);

  // Clicking a panic option or an alternative swaps in that full plan.
  function pickAlternative(alt: Alternative) {
    if (!result) return;
    setResult({...result, ...alt, alternatives: result.alternatives, panic: result.panic});
    setSample(false); setEmergency(false); setExpanded(false);
  }
  function pickPanicOption(o: PanicOption) {
    if (!result) return;
    setResult({...result, steps: o.steps, location: o.location, totalMinutes: o.minutes,
      bufferMinutes: o.delta, risk: o.makesIt ? (o.delta <= 3 ? 'tight' : 'safe') : 'screwed'});
    setEmergency(false); setExpanded(true);
  }

  function showRoute() {
    setExpanded(true);
    setTimeout(() => document.getElementById('route-details')?.scrollIntoView({behavior: 'smooth', block: 'center'}), 50);
  }

  const directory = places.filter(p => view === 'Campus' ? true : p.kind !== 'building');

  return <>
    <Header view={view} onView={setView}/>
    <main>
      {view === 'Survive' ? <>
        <section className="hero">
          <div className="eyebrow hero-eyebrow"><span className="tiny-dot"/> YOUR DAY. UNDER CONTROL.</div>
          <h1>What's your <span>situation?</span></h1>
          <p>Tell us what you're trying to do. We'll figure out the fastest way to survive it.</p>
          <SearchBox
            query={query} setQuery={setQuery}
            onSubmit={() => void submit()} loading={loading}
            onDemo={() => void submit(demoQuery, {isSample: true})}
            onEmergency={() => void submit("I'm screwed — 4 minutes to get from Campus Center to Innovation Hall")}
          />
        </section>

        <QuickActions onChoose={q => void submit(q)}/>

        <section className="plan-section" aria-live="polite">
          <div className="section-line">
            <h2><Sparkles size={17}/> {emergency ? 'Emergency game plan' : 'Your survival plan'}</h2>
            <span>
              {sample ? 'A LITTLE PREVIEW OF WHAT’S POSSIBLE' : 'MADE FOR YOUR NEXT MOVE'}
              {result?.computedAt && <span className="demo-tag">{result.computedAt}</span>}
            </span>
          </div>

          {error && <p className="error-card" role="alert"><AlertTriangle size={16}/> {error}</p>}

          {loading
            ? <div className="loading">
                <span className="loader"/>
                <h2>PLANNING YOUR SURVIVAL</h2>
                <p>One sec. We're connecting the dots.</p>
                <div>{['Walking time', 'Food options', 'Opening hours', 'Campus route'].map(t =>
                  <span key={t}><Check size={14}/>{t}</span>)}</div>
              </div>
            : emergency && result?.panic
            ? <ScrewedMode panic={result.panic} onPick={pickPanicOption} onClose={() => setEmergency(false)}/>
            : result
            ? <>
                <div className="plan-grid">
                  <SurvivalResult result={result} onRoute={showRoute}/>
                  <RouteCard result={result} expanded={expanded} onExpand={() => setExpanded(!expanded)}/>
                </div>
                {expanded && <div id="route-details" className="route-details">
                  <h2>Your trip, step by step</h2>
                  <Timeline steps={result.steps}/>
                </div>}
                {!!result.assumptions?.length && <p className="assumptions">
                  {result.assumptions.join(' · ')}
                </p>}
                <AIReasoning
                  reasons={result.reason} narration={result.narration}
                  rejected={result.rejected} ai={result.ai}
                />
              </>
            : !error && <p>Ask a question to get started.</p>}
        </section>

        <div className="bottom-grid">
          <section className="alternatives">
            <div className="section-line"><h2>Other options</h2><span>Every minute matters.</span></div>
            {result?.alternatives?.length
              ? result.alternatives.map(alt =>
                  <AlternativeCard key={alt.title} alt={alt} onClick={() => pickAlternative(alt)}/>)
              : <p className="empty">No other options fit this window.</p>}
          </section>
          <CampusStatus rows={result?.campusStatus}/>
        </div>
      </> : <section className="directory">
        <button className="back" onClick={() => setView('Survive')}><ArrowLeft size={16}/> Back to survival</button>
        <span className="eyebrow">INDIANAPOLIS CAMPUS</span>
        <h1>{view === 'Campus' ? 'Know your campus.' : 'Find your next stop.'}</h1>
        <p>{view === 'Campus'
          ? 'Your campus landmarks, all in one place.'
          : 'Food, coffee, and a little space to focus.'} Hours are checked against today.</p>

        <div className="directory-grid">
          {directory.map(p => <button key={p.id} onClick={() => {
            const q = p.kind === 'building'
              ? `I have 10 minutes to get to class from ${p.name}.`
              : `I have 25 minutes and I want to go to ${p.name}.`;
            void submit(q);
          }}>
            <MapPin size={23}/>
            <span className="eyebrow">{p.kind}</span>
            <h2>{p.name}</h2>
            <small className={p.openNow === false ? 'closed' : 'open'}>
              {p.status ?? (p.openNow === false ? 'Closed' : p.openNow ? 'Open' : '—')}
              {p.hoursToday ? ` · ${p.hoursToday}` : ''}
            </small>
            <span>Plan from here <ArrowUpRight size={16}/></span>
          </button>)}
          {!directory.length && <p className="empty">Loading campus directory…</p>}
        </div>

        <CampusStatus/>
      </section>}

      <footer>
        <span className="footer-brand">CAMPUS <b>SURVIVAL</b></span>
        <span>Less panic. More campus.</span>
        <span>Built for the in-between. <span className="tiny-dot"/> Indianapolis</span>
      </footer>
    </main>
  </>;
}
