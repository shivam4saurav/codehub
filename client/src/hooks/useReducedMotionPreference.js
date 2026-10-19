import { useReducedMotion } from 'framer-motion';

import { useTheme } from '../context/ThemeContext.jsx';

/**
 * True when motion should be suppressed: either the OS setting or the in-app
 * accessibility preference in Settings.
 */
export const useReducedMotionPreference = () => {
  const systemPrefersReduced = useReducedMotion();
  const { reducedMotion } = useTheme();

  return Boolean(systemPrefersReduced || reducedMotion);
};

export default useReducedMotionPreference;
