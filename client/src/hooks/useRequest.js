import { useState, useEffect } from 'react';
import { api, errorMessage } from '../services/api.js';

export function useRequest(path, dependencies = []) {
  const [state, setState] = useState({ data: null, error: '', loading: true });

  const load = async () => {
    setState(previous => ({ ...previous, loading: true, error: '' }));
    try {
      const { data } = await api.get(path);
      setState({ data, error: '', loading: false });
    } catch (error) {
      setState({ data: null, error: errorMessage(error), loading: false });
    }
  };

  useEffect(() => {
    load();
  }, dependencies);

  return { ...state, load };
}

export default useRequest;

