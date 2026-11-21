import { Link } from 'react-router-dom';
import { Sprout, ArrowRight, ShieldCheck } from 'lucide-react';
import useFarm from '../hooks/useFarm.js';
import PageTitle from '../components/common/PageTitle.jsx';
import Card from '../components/common/Card.jsx';
import { AdviceForm } from '../components/dashboard/AdviceComponents.jsx';

export function ContextRow({ label, value }) {
  return (
    <div className="context-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export default function CropsPage() {
  const { farmer } = useFarm();
  return <><PageTitle eyebrow="CROP ADVISOR" title="Explore what may grow well" description="Suggestions use only the farm details you’ve supplied. Missing soil or weather information is not filled in." />
    <div className="two-column-layout"><div className="side-context"><Card className="profile-context"><div className="context-top"><span className="feature-icon"><Sprout size={19} /></span><span className="eyebrow">YOUR FARM DETAILS</span></div><h3>{farmer?.village || farmer?.district || 'Location not set'}</h3><p>{[farmer?.district, farmer?.state].filter(Boolean).join(', ') || 'Add your location to personalize crop guidance.'}</p><div className="context-list"><ContextRow label="Soil" value={farmer?.soil?.type || 'Not provided'} /><ContextRow label="Farm size" value={farmer?.farmSize ? `${farmer.farmSize} acres` : 'Not provided'} /><ContextRow label="Current crops" value={farmer?.currentCrops?.join(', ') || 'Not provided'} /><ContextRow label="Water" value={farmer?.irrigationFacilities?.join(', ') || 'Not provided'} /></div><Link className="text-link" to="/profile">Update farm details <ArrowRight size={15} /></Link></Card><div className="safety-note"><ShieldCheck size={18} /><div><b>Information may be incomplete</b><p>AI advice is a starting point. Confirm planting choices with local agricultural guidance and current conditions.</p></div></div></div>
      <AdviceForm endpoint="/ai/crop-recommendations" title="Crop suggestions" submitLabel="Get crop ideas" buildBody={form => ({ details: form.elements.details.value })}><label className="field"><span>What are you planning for?</span><textarea name="details" rows="5" placeholder="For example: planning a crop for the coming monsoon, limited irrigation, harvested groundnut last season…" /></label><p className="field-hint">Optional: add season, planting plans or field observations. Soil measurements are read from your profile only if you entered them.</p></AdviceForm>
    </div></>;
}
