import { useState } from 'react';
import { Leaf, ShieldCheck, LoaderCircle, ArrowRight } from 'lucide-react';
import { api, errorMessage } from '../../services/api.js';
import Card from '../common/Card.jsx';
import ErrorNotice from '../common/ErrorNotice.jsx';
import MetaLine from '../common/MetaLine.jsx';

export function AdviceResult({ result, title = 'Saathi’s guidance' }) {
  return result ? (
    <Card className="result-card">
      <div className="result-head">
        <span className="result-icon"><Leaf size={18} /></span>
        <div>
          <span className="eyebrow">AI-GENERATED GUIDANCE</span>
          <h3>{title}</h3>
        </div>
        <span className="ai-pill">{result.source}</span>
      </div>
      <div className="answer-text">{result.answer}</div>
      <div className="result-disclaimer">
        <ShieldCheck size={15} />
        General guidance can be incomplete. Check local conditions and consult an agriculture expert for important decisions.
      </div>
      <MetaLine source={result.source} time={result.generatedAt} />
    </Card>
  ) : null;
}

export function AdviceForm({ endpoint, submitLabel, title, children, buildBody, requireFile = false }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post(
        endpoint,
        buildBody(event.currentTarget),
        requireFile ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
      );
      setResult(data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card className="form-card">
        <form onSubmit={submit} className="form-stack">
          {children}
          {error && <ErrorNotice>{error}</ErrorNotice>}
          <button disabled={loading} className="primary-button form-submit">
            {loading ? <LoaderCircle className="spin" size={17} /> : null}
            {submitLabel}
            <ArrowRight size={17} />
          </button>
        </form>
      </Card>
      {result && <AdviceResult result={result} title={title} />}
    </>
  );
}
