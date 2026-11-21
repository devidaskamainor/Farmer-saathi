import { ShieldCheck } from 'lucide-react';

export function MetaLine({ source, time }) {
  const attribution = source === 'Open-Meteo' ? (
    <>
      Weather data by{' '}
      <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
        Open-Meteo
      </a>
      , adapted under{' '}
      <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
        CC BY 4.0
      </a>
      ; location data by{' '}
      <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
        GeoNames
      </a>
      .
    </>
  ) : (
    source || 'Source provided by data service'
  );

  return (
    <div className="data-meta">
      <span>
        <ShieldCheck size={13} /> {attribution}
      </span>
      <span>{time ? `Updated ${new Date(time).toLocaleString()}` : 'Forecast date shown on each day'}</span>
    </div>
  );
}

export default MetaLine;

