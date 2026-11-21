import { Droplets, Check } from 'lucide-react';
import PageTitle from '../components/common/PageTitle.jsx';
import Card from '../components/common/Card.jsx';
import Field from '../components/common/Field.jsx';
import PlannerPanel from '../components/dashboard/PlannerPanel.jsx';
import { AdviceForm } from '../components/dashboard/AdviceComponents.jsx';

export default function IrrigationPage() {
  return <><PageTitle eyebrow="WATER PLANNING" title="Think through irrigation" description="Get a cautious checklist based on your crop, stage and any rainfall information you share." />
    <PlannerPanel />
    <div className="two-column-layout"><div className="side-context"><Card className="irrigation-info"><span className="feature-icon"><Droplets size={20} /></span><h3>Before you water</h3><div className="check-list"><div><Check size={15} /><span>Check soil moisture at the root zone.</span></div><div><Check size={15} /><span>Account for recent and expected rain.</span></div><div><Check size={15} /><span>Use the crop’s growth stage as a guide.</span></div><div><Check size={15} /><span>Follow local agriculture advice for exact timing.</span></div></div><p>Saathi won’t estimate a soil moisture reading or give a precise schedule from missing data.</p></Card></div>
      <AdviceForm endpoint="/ai/irrigation" title="Irrigation guidance" submitLabel="Get irrigation guidance" buildBody={form => ({ crop: form.elements.crop.value, growthStage: form.elements.stage.value, rainfall: form.elements.rainfall.value })}>
        <Field label="Crop" name="crop" placeholder="e.g. Cotton" value={undefined} onChange={() => {}} />
        <label className="field"><span>Growth stage</span><select name="stage" defaultValue=""><option value="">Select if known</option><option>Recently sown</option><option>Vegetative growth</option><option>Flowering</option><option>Fruit or grain formation</option><option>Near harvest</option></select></label>
        <Field label="Expected or recent rainfall" placeholder="e.g. Moderate rain yesterday" value={undefined} onChange={() => {}} name="rainfall" />
        <p className="field-hint">Farm profile information, including soil type and water access, is also shared with the AI when available.</p>
      </AdviceForm>
    </div></>;
}
