import { LoaderCircle } from 'lucide-react';

export function LoadingBox({ label = 'Getting the latest information…' }) {
  return (
    <div className="loading-box">
      <LoaderCircle className="spin" size={21} />
      <span>{label}</span>
    </div>
  );
}

export default LoadingBox;

