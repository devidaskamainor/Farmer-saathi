import { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Upload, Plus, FileWarning } from 'lucide-react';
import PageTitle from '../components/common/PageTitle.jsx';
import Card from '../components/common/Card.jsx';
import { AdviceForm } from '../components/dashboard/AdviceComponents.jsx';

export default function DiseasePage() {
  const [fileName, setFileName] = useState('');
  const [image, setImage] = useState(null);
  const [imageError, setImageError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!image) { setPreviewUrl(''); return undefined; }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  function chooseImage(event) {
    const selected = event.target.files?.[0] || null;
    if (selected && !['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
      event.target.value = '';
      setImage(null);
      setFileName('');
      setImageError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (selected && selected.size > 5 * 1024 * 1024) {
      event.target.value = '';
      setImage(null);
      setFileName('');
      setImageError('Image must be 5 MB or smaller.');
      return;
    }
    setImage(selected);
    setFileName(selected?.name || '');
    setImageError('');
  }

  return <><PageTitle eyebrow="CROP HEALTH" title="Describe what you see" description="Share symptoms for possible causes and safe next steps. This is not a confirmed diagnosis." />
    <div className="two-column-layout"><div className="side-context"><Card className="disease-info"><span className="disease-mark"><Activity size={20} /></span><h3>Help Saathi understand</h3><div className="symptom-examples"><span>Which crop is affected?</span><span>When did the symptoms begin?</span><span>Are there spots, insects or wilting?</span><span>Has the weather changed recently?</span></div><p>For serious damage or fast spread, contact a local agriculture expert or Krishi Vigyan Kendra.</p></Card><div className="safety-note"><ShieldCheck size={18} /><div><b>Be careful with treatments</b><p>No pesticide mixtures or unsupported dosages will be suggested.</p></div></div></div>
      <AdviceForm endpoint="/disease/analyze" requireFile title="Possible causes" submitLabel="Review symptoms" buildBody={form => { const body = new FormData(); body.append('symptoms', form.elements.symptoms.value); if (form.elements.image.files[0]) body.append('image', form.elements.image.files[0]); return body; }}>
        <label className="field"><span>What are you noticing?</span><textarea name="symptoms" rows="6" placeholder="Describe the crop, affected parts, when it started, and any visible changes…" /></label>
        <label className="upload-box"><input name="image" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage} /><span className="upload-icon"><Upload size={18} /></span><span><b>{fileName || 'Add a crop photo (optional)'}</b><small>JPG, PNG or WebP · up to 5 MB</small></span><Plus size={18} /></label>
        {imageError && <div className="alert alert-error" role="alert"><FileWarning size={17} />{imageError}</div>}
        {previewUrl && <figure className="disease-image-preview"><img src={previewUrl} alt="Preview of the selected crop photo" /><figcaption>Preview only. This image is sent for analysis only when you submit and is not saved by this page.</figcaption></figure>}
        <p className="field-hint">A photo can help, but image analysis may miss important details. Avoid including people or personal information.</p>
      </AdviceForm>
    </div></>;
}
