import { FileWarning } from 'lucide-react';

export function ErrorNotice({ children, retry }) {
  return (
    <div className="alert alert-error">
      <FileWarning size={17} />
      <span>{children}</span>
      {retry && <button onClick={retry}>Try again</button>}
    </div>
  );
}

export default ErrorNotice;

