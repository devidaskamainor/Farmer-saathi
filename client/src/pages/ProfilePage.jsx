import { useState, useEffect } from 'react';
import { UserRound, Sprout, Check, LoaderCircle, Save, ShieldCheck } from 'lucide-react';
import { api, errorMessage } from '../services/api.js';
import useFarm from '../hooks/useFarm.js';
import { languageConfig, languageOptions } from '../config/languages.js';
import { words } from '../config/translations.js';
import PageTitle from '../components/common/PageTitle.jsx';
import Card from '../components/common/Card.jsx';
import Field from '../components/common/Field.jsx';
import ErrorNotice from '../components/common/ErrorNotice.jsx';
import FarmHistoryPanel from '../components/dashboard/FarmHistoryPanel.jsx';

export function farmerToForm(farmer = {}) {
  return {
    name: farmer.name || '',
    state: farmer.state || '',
    district: farmer.district || '',
    village: farmer.village || '',
    preferredLanguage: farmer.preferredLanguage || 'en',
    farmSize: farmer.farmSize ?? '',
    soilType: farmer.soil?.type || '',
    nitrogen: farmer.soil?.nitrogen ?? '',
    phosphorus: farmer.soil?.phosphorus ?? '',
    potassium: farmer.soil?.potassium ?? '',
    ph: farmer.soil?.ph ?? '',
    moisturePct: farmer.soil?.moisturePct ?? '',
    moistureMeasuredAt: farmer.soil?.moistureMeasuredAt || '',
    planCrop: farmer.farmPlan?.crop || farmer.currentCrops?.[0] || '',
    growthStage: farmer.farmPlan?.growthStage || '',
    sowingDate: farmer.farmPlan?.sowingDate || '',
    irrigationMethod: farmer.farmPlan?.irrigationMethod || '',
    irrigationFacilities: farmer.irrigationFacilities?.join(', ') || '',
    currentCrops: farmer.currentCrops?.join(', ') || ''
  };
}

export function optionalNumber(value) {
  return value === '' ? undefined : Number(value);
}

export function splitList(value) {
  return value.split(',').map(part => part.trim()).filter(Boolean).slice(0, 20);
}

export default function ProfilePage() {
  const { farmer, setFarmer } = useFarm();
  const [form, setForm] = useState(() => farmerToForm(farmer));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const languageDefinition = languageConfig[form.preferredLanguage] || languageConfig.en;

  useEffect(() => { setForm(farmerToForm(farmer)); }, [farmer]);
  const set = (key, value) => setForm(old => ({ ...old, [key]: value }));

  async function submit(event) {
    event.preventDefault(); setSaved(false); setError(''); setBusy(true);
    const body = {
      name: form.name, state: form.state, district: form.district, village: form.village,
      preferredLanguage: form.preferredLanguage, farmSize: form.farmSize ? Number(form.farmSize) : null,
      soil: { type: form.soilType, nitrogen: optionalNumber(form.nitrogen), phosphorus: optionalNumber(form.phosphorus), potassium: optionalNumber(form.potassium), ph: optionalNumber(form.ph), moisturePct: optionalNumber(form.moisturePct), moistureMeasuredAt: form.moistureMeasuredAt || undefined },
      farmPlan: { crop: form.planCrop, growthStage: form.growthStage, sowingDate: form.sowingDate, irrigationMethod: form.irrigationMethod },
      irrigationFacilities: splitList(form.irrigationFacilities), currentCrops: splitList(form.currentCrops)
    };
    try {
      const { data } = await api.put(`/farmers/profile/${farmer._id}`, body);
      setFarmer(data.farmer);
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return <><PageTitle eyebrow="YOUR FARM PROFILE" title="Keep your farm details close" description="Saathi uses saved details to avoid asking you the same questions again. Add only what you know." />
    <Card className="profile-form-card"><form onSubmit={submit} className="form-stack"><div className="profile-section-title"><span className="profile-section-icon"><UserRound size={18} /></span><div><h2>About you and your farm</h2><p>These details stay linked to your account.</p></div></div>
      <div className="field-grid"><Field label="Farmer name" value={form.name} onChange={v => set('name', v)} required /><Field label="Email address" value={farmer?.email || ''} onChange={() => {}} type="email" disabled /></div>
      <div className="field-grid three-fields"><Field label="State" value={form.state} onChange={v => set('state', v)} placeholder="e.g. Karnataka" /><Field label="District" value={form.district} onChange={v => set('district', v)} placeholder="e.g. Mysuru" /><Field label="Village or town" value={form.village} onChange={v => set('village', v)} placeholder="e.g. Hunsur" /></div>
      <div className="field-grid three-fields"><label className="field"><span>Preferred language</span><select value={form.preferredLanguage} onChange={e => set('preferredLanguage', e.target.value)}>{languageOptions.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}</select></label><Field label="Farm size (acres)" type="number" min="0" step="0.1" value={form.farmSize} onChange={v => set('farmSize', v)} placeholder="Optional" /><Field label="Soil type" value={form.soilType} onChange={v => set('soilType', v)} placeholder="e.g. Red loam" /></div>
      <p className="field-hint">{languageDefinition.interfaceSupport === 'english-fallback'
        ? `The ${languageDefinition.nativeName} interface is not translated yet; English is shown for untranslated screens.`
        : 'Some interface sections are translated; untranslated text falls back to English.'} AI replies are requested in {languageDefinition.englishName}, but quality has not been verified for every language. Voice input and spoken output depend on browser and device support.</p>
      <div className="profile-divider" /><div className="profile-section-title"><span className="profile-section-icon"><Sprout size={18} /></span><div><h2>Soil and crop details</h2><p>Soil test values are optional. Leave them blank if you don’t know them.</p></div></div>
      <div className="field-grid four-fields"><Field label="Nitrogen (N)" type="number" min="0" value={form.nitrogen} onChange={v => set('nitrogen', v)} placeholder="Not measured" /><Field label="Phosphorus (P)" type="number" min="0" value={form.phosphorus} onChange={v => set('phosphorus', v)} placeholder="Not measured" /><Field label="Potassium (K)" type="number" min="0" value={form.potassium} onChange={v => set('potassium', v)} placeholder="Not measured" /><Field label="Soil pH" type="number" min="0" max="14" step="0.1" value={form.ph} onChange={v => set('ph', v)} placeholder="Not measured" /></div>
      <div className="field-grid"><Field label="Current crops" value={form.currentCrops} onChange={v => set('currentCrops', v)} placeholder="Separate crops with commas" /><Field label="Irrigation facilities" value={form.irrigationFacilities} onChange={v => set('irrigationFacilities', v)} placeholder="e.g. Borewell, drip (comma separated)" /></div>
      <div className="field-grid three-fields"><Field label="Planner crop" value={form.planCrop} onChange={v => set('planCrop', v)} placeholder="Crop for irrigation planning" /><Field label="Sowing date" type="date" value={form.sowingDate} onChange={v => set('sowingDate', v)} /><label className="field"><span>Growth stage</span><select value={form.growthStage} onChange={e => set('growthStage', e.target.value)}><option value="">Not provided</option><option>Recently sown</option><option>Vegetative growth</option><option>Flowering</option><option>Fruit or grain formation</option><option>Near harvest</option></select></label></div>
      <div className="field-grid three-fields"><Field label="Irrigation method" value={form.irrigationMethod} onChange={v => set('irrigationMethod', v)} placeholder="e.g. Drip, furrow, sprinkler" /><Field label="Measured soil moisture (%)" type="number" min="0" max="100" step="any" value={form.moisturePct} onChange={v => set('moisturePct', v)} placeholder="Optional; enter only if measured" /><Field label="Measurement date" type="date" value={form.moistureMeasuredAt} onChange={v => set('moistureMeasuredAt', v)} /></div>
      <p className="field-hint">Soil moisture must be a farmer-entered measurement with its date; it is never treated as live sensor data. The planner ignores readings older than the configured validity period.</p>
      {saved && <div className="alert alert-success"><Check size={17} />Your farm profile has been saved.</div>}{error && <ErrorNotice>{error}</ErrorNotice>}
      <div className="form-footer"><span><ShieldCheck size={15} />Only you can view and update your farm profile.</span><button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{words[farmer?.preferredLanguage]?.save || 'Save changes'}</button></div>
    </form></Card>
    <FarmHistoryPanel />
  </>;
}
