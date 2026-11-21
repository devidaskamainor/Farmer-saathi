import { Link } from 'react-router-dom';
import { UserRound, Cloud, Droplets } from 'lucide-react';
import useRequest from '../../hooks/useRequest.js';
import Card from '../common/Card.jsx';
import LoadingBox from '../common/LoadingBox.jsx';
import ErrorNotice from '../common/ErrorNotice.jsx';
import MetaLine from '../common/MetaLine.jsx';

export default function PlannerPanel({ compact = false }) {
  const plan = useRequest('/planner');
  return <Card className={`planner-card ${compact ? 'planner-card-compact' : ''}`}>
    <div className="card-head planner-heading">
      <div><span className="eyebrow">PERSONALIZED FARM PLANNER</span><h2>Seven-day irrigation outlook</h2></div>
      <Link className="subtle-button" to="/profile"><UserRound size={15} />Farm details</Link>
    </div>
    {plan.loading ? <LoadingBox label="Combining your saved farm details with the forecast…" /> : plan.error ? <ErrorNotice retry={plan.load}>{plan.error}</ErrorNotice> : <>
      {plan.data.forecastUnavailable
        ? <div className="alert alert-error" role="status"><Cloud size={17} />{plan.data.forecastUnavailableMessage}</div>
        : <div className="planner-recommendation"><Droplets size={18} /><p>{plan.data.recommendation}</p></div>}
      {plan.data.forecast.length > 0 && <div className="planner-days" aria-label="Seven-day rainfall forecast">
        {plan.data.forecast.map(day => <div className="planner-day" key={day.date}>
          <span>{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</span>
          <b>{Number.isFinite(day.rainMm) ? `${day.rainMm} mm` : '—'}</b>
          <small>{Number.isFinite(day.maxC) ? `${Math.round(day.maxC)}°C max` : 'Temperature unavailable'} · {day.conditions}</small>
        </div>)}
      </div>}
      {plan.data.alerts.length > 0 && <div className="planner-alerts">
        <h3>Weather and farming risks</h3>
        {plan.data.alerts.slice(0, compact ? 3 : 8).map(alert => <article className={`planner-alert planner-alert-${alert.severity}`} key={alert.id}>
          <div><b>{alert.title}</b><span>{alert.affectedCrop} · {alert.period} · {alert.severity}</span></div>
          <p>{alert.reason}</p><p>{alert.action}</p><small>Source: {alert.source}</small>
        </article>)}
      </div>}
      {plan.data.alerts.length === 0 && plan.data.forecast.length > 0 && <p className="small-muted">No configured general weather threshold was met. Thresholds are not crop- or region-specific and do not guarantee safe field conditions.</p>}
      {plan.data.alerts.length > 0 && <p className="small-muted">These are general configurable weather indicators, not crop-specific or regional risk diagnoses.</p>}
      {plan.data.missingInformation.length > 0 && <div className="planner-missing"><b>Information that would improve this plan</b><span>{plan.data.missingInformation.join(' · ')}</span></div>}
      {plan.data.soilMoisture && <p className="planner-measurement">Soil moisture: {plan.data.soilMoisture.percent}% · entered by you on {plan.data.soilMoisture.measuredAt}. This is not a live sensor reading.</p>}
      {plan.data.reviewDays.length > 0 && <p className="planner-review-days">Soil-moisture review days: {plan.data.reviewDays.map(day => day.date).join(', ')}. These are review prompts, not irrigation instructions.</p>}
      <MetaLine source={plan.data.forecastSource || 'Weather forecast unavailable'} time={plan.data.fetchedAt} />
    </>}
  </Card>;
}
