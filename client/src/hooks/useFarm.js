import { useOutletContext } from 'react-router-dom';

export function useFarm() {
  return useOutletContext();
}

export default useFarm;

