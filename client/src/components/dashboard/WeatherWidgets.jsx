import { Cloud, CloudRain, Sun } from 'lucide-react';

export function Metric({ icon: Icon, label, value }) {
  return (
    <div className="weather-metric">
      <Icon size={16} />
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export function WeatherIcon({ conditions = '', size = 21 }) {
  const value = conditions.toLowerCase();
  const Icon = /rain|storm|drizzle|snow|shower/.test(value)
    ? CloudRain
    : /cloud|overcast|fog|mist/.test(value)
      ? Cloud
      : Sun;
  return <Icon size={size} />;
}

export function PriceRow({ row }) {
  return (
    <div className="price-row">
      <div>
        <b>{row.commodity || 'Commodity'}</b>
        <span>{[row.market, row.district, row.marketDate || 'Date not reported'].filter(Boolean).join(' · ')}</span>
      </div>
      <div className="price-right">
        <b>{row.modalPrice == null ? '—' : `₹${row.modalPrice.toLocaleString('en-IN')}`}</b>
        <span>{row.priceUnit || 'Unit not reported'}</span>
      </div>
    </div>
  );
}
