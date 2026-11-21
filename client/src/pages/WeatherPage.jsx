import { Link } from 'react-router-dom';
import { MapPin, Droplets, Wind, CloudRain, ShieldCheck } from 'lucide-react';
import useFarm from '../hooks/useFarm.js';
import useRequest from '../hooks/useRequest.js';
import PageTitle from '../components/common/PageTitle.jsx';
import Card from '../components/common/Card.jsx';
import LoadingBox from '../components/common/LoadingBox.jsx';
import ErrorNotice from '../components/common/ErrorNotice.jsx';
import MetaLine from '../components/common/MetaLine.jsx';
import { Metric, WeatherIcon } from '../components/dashboard/WeatherWidgets.jsx';

export default function WeatherPage() {
  const { farmer } = useFarm();
  const weather = useRequest('/weather');

  return <>
    <PageTitle
      eyebrow="WEATHER ASSISTANT"
      title="Plan with the forecast"
      description="Forecasts are fetched from a weather service. Farming suggestions are estimates, not observations of your field."
      action={<Link className="subtle-button" to="/profile"><MapPin size={15} />{[farmer?.district, farmer?.state].filter(Boolean).join(', ') || 'Set location'}</Link>}
    />
    <Card className="content-card">
      {weather.loading ? <LoadingBox /> : weather.error ? <ErrorNotice retry={weather.load}>{weather.error}</ErrorNotice> : <>
        <div className="weather-detail-top">
          <div className="weather-big-icon"><WeatherIcon conditions={weather.data.current.conditions} size={31} /></div>
          <div>
            <span className="eyebrow">{weather.data.location}</span>
            <div className="big-temperature">{Math.round(weather.data.current.temperatureC)}°<span>C</span></div>
            <p className="capitalize">{weather.data.current.conditions}</p>
          </div>
          <div className="weather-detail-metrics">
            <Metric icon={Droplets} label="Humidity" value={`${weather.data.current.humidity}%`} />
            <Metric icon={Wind} label="Wind" value={`${weather.data.current.windSpeedMs} m/s`} />
            <Metric icon={CloudRain} label="Rainfall" value={`${weather.data.current.rainfallMm} mm`} />
          </div>
        </div>
        <div className="section-heading compact-heading">
          <div><span className="eyebrow">NEXT DAYS</span><h2>{weather.data.forecast.length}-day forecast</h2></div>
          <span className="small-muted">Local forecast dates</span>
        </div>
        <div className="forecast-grid">
          {weather.data.forecast.map(day => (
            <div className="forecast-day" key={day.date}>
              <span>{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</span>
              <WeatherIcon conditions={day.conditions} size={21} />
              <b>{Math.round(day.maxC)}° <i>{Math.round(day.minC)}°</i></b>
              <span className="forecast-rain"><Droplets size={13} />{day.rainMm} mm rain</span>
              <span className="forecast-condition">{day.conditions}</span>
            </div>
          ))}
        </div>
        {(() => {
          const rainyDay = weather.data.forecast.find(day => day.rainMm > 0);
          return (
            <div className="weather-advisory">
              <div className="advisory-icon"><ShieldCheck size={18} /></div>
              <div>
                <b>{rainyDay ? `Rain is forecast for ${new Date(`${rainyDay.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}` : 'Use the forecast as a planning aid'}</b>
                <p>{rainyDay ? `The service reports ${rainyDay.rainMm} mm of forecast rain for that date. Check drainage and field moisture before planning irrigation; local conditions may differ.` : 'No rainfall is listed in the returned forecast. Check soil moisture before irrigating; forecast detail may not reflect your exact village.'}</p>
              </div>
            </div>
          );
        })()}
        <MetaLine source={weather.data.source} time={weather.data.fetchedAt} />
      </>}
    </Card>
  </>;
}
