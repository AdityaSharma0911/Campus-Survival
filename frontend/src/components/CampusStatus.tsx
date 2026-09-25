import {useEffect, useState} from 'react';
import {getCampusStatus} from '../data/survivalApi';

type Row = {label: string; value: string; busy: boolean};

export default function CampusStatus({rows}:{rows?: Row[]}) {
  const [fetched, setFetched] = useState<Row[] | null>(null);

  useEffect(() => {
    if (rows) return;
    let alive = true;
    getCampusStatus().then(r => alive && setFetched(r as Row[])).catch(() => {});
    return () => {alive = false};
  }, [rows]);

  const data = rows ?? fetched;

  return <section className="campus-status">
    <div><h2>Campus status</h2><span>{data ? 'LIVE' : '—'}</span></div>
    {data
      ? data.map(r => <div key={r.label}>
          <span>{r.label}</span>
          <strong><i className={'tiny-dot ' + (r.busy ? 'busy' : '')}/>{r.value}</strong>
        </div>)
      : <div><span>Status</span><strong>Unavailable</strong></div>}
  </section>;
}
