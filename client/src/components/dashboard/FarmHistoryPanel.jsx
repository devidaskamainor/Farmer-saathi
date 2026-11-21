import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, LoaderCircle, Save, Pencil, Trash2, Sprout
} from 'lucide-react';
import { api, errorMessage } from '../../services/api.js';
import useRequest from '../../hooks/useRequest.js';
import Card from '../common/Card.jsx';
import Field from '../common/Field.jsx';
import ErrorNotice from '../common/ErrorNotice.jsx';
import LoadingBox from '../common/LoadingBox.jsx';

export function emptyActivity() {
  return { crop: '', eventType: 'observation', eventDate: localDateInput(), amount: '', unit: '', notes: '' };
}

export function localDateInput() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatActivityDate(value) {
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function FarmHistoryPanel({ compact = false }) {
  const history = useRequest('/farmers/history');
  const [form, setForm] = useState(emptyActivity());
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  function resetForm() {
    setForm(emptyActivity());
    setEditingId('');
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const request = editingId
        ? api.put(`/farmers/history/${editingId}`, form)
        : api.post('/farmers/history', form);
      await request;
      setNotice(editingId ? 'Farm record updated.' : 'Farm record saved.');
      resetForm();
      await history.load();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function remove(activity) {
    if (!window.confirm(`Remove this ${activity.eventType} record for ${activity.crop}?`)) return;
    setError('');
    setNotice('');
    try {
      await api.delete(`/farmers/history/${activity.id}`);
      setNotice('Farm record removed.');
      if (editingId === activity.id) resetForm();
      await history.load();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  const activities = history.data?.activities || [];
  return <Card className="farm-history-card">
    <div className="card-head"><div><span className="eyebrow">FARM PROGRESS</span><h2>{compact ? 'Recent farm activity' : 'Farm activity history'}</h2></div>{compact && <Link className="text-link" to="/profile">Manage records <ArrowRight size={14} /></Link>}</div>
    {!compact && <form className="farm-activity-form" onSubmit={submit}>
      <div className="field-grid three-fields">
        <Field label="Crop" value={form.crop} onChange={crop => setForm(old => ({ ...old, crop }))} maxLength={100} required />
        <label className="field"><span>Activity</span><select value={form.eventType} onChange={event => setForm(old => ({ ...old, eventType: event.target.value }))}>
          <option value="sowing">Sowing</option><option value="irrigation">Irrigation</option><option value="fertilizer">Fertilizer application</option><option value="observation">Crop observation</option><option value="disease">Disease symptoms</option><option value="harvest">Harvest / yield</option>
        </select></label>
        <Field label="Date" type="date" value={form.eventDate} onChange={eventDate => setForm(old => ({ ...old, eventDate }))} required />
      </div>
      <div className="field-grid">
        <Field label="Amount (optional)" type="number" min="0" max="999999999.999" step="any" value={form.amount} onChange={amount => setForm(old => ({ ...old, amount }))} placeholder="Only if known" />
        <Field label="Unit (optional)" value={form.unit} onChange={unit => setForm(old => ({ ...old, unit }))} maxLength={40} placeholder="e.g. kg, mm, bags" />
      </div>
      <label className="field"><span>Notes (optional)</span><textarea rows="3" maxLength="1000" value={form.notes} onChange={event => setForm(old => ({ ...old, notes: event.target.value }))} /></label>
      {error && <ErrorNotice>{error}</ErrorNotice>}{notice && <div className="alert alert-success" role="status"><Check size={16} />{notice}</div>}
      <div className="farm-history-actions"><button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}{editingId ? 'Save changes' : 'Add farm record'}</button>{editingId && <button className="subtle-button" type="button" onClick={resetForm}>Cancel edit</button>}</div>
    </form>}
    {history.loading ? <LoadingBox label="Loading your farm records…" /> : history.error ? <ErrorNotice retry={history.load}>{history.error}</ErrorNotice> : activities.length === 0
      ? <div className="empty-state"><Sprout size={24} /><p>No farm activity recorded yet. Historical information appears after you add a record.</p></div>
      : <ol className="farm-timeline">{activities.slice(0, compact ? 5 : 100).map(activity => <li key={activity.id}>
        <span className="farm-timeline-dot" />
        <div className="farm-timeline-body">
          <div className="farm-timeline-heading"><b>{activity.crop} · {activity.eventType.replaceAll('_', ' ')}</b><time dateTime={activity.eventDate}>{formatActivityDate(activity.eventDate)}</time></div>
          {activity.amount != null && <span className="farm-timeline-amount">{activity.amount} {activity.unit}</span>}
          {activity.notes && <p>{activity.notes}</p>}
        </div>
        {!compact && <div className="farm-timeline-actions">
          <button type="button" className="subtle-button" aria-label={`Edit ${activity.crop} ${activity.eventType} record`} onClick={() => { setEditingId(activity.id); setForm({ crop: activity.crop, eventType: activity.eventType, eventDate: String(activity.eventDate).slice(0, 10), amount: activity.amount ?? '', unit: activity.unit || '', notes: activity.notes || '' }); setError(''); setNotice(''); }}><Pencil size={14} />Edit</button>
          <button type="button" className="subtle-button" aria-label={`Remove ${activity.crop} ${activity.eventType} record`} onClick={() => remove(activity)}><Trash2 size={14} />Remove</button>
        </div>}
      </li>)}</ol>}
  </Card>;
}
