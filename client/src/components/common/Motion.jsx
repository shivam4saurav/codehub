import { motion } from 'framer-motion';

import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference.js';

/**
 * Motion helpers.
 *
 * Kept deliberately quiet: one short fade when the route changes, and nothing
 * that slides cards in as you scroll. Content should simply be there.
 * Reveal / StaggerGroup / StaggerItem are plain wrappers so pages can keep
 * their structure without every block animating.
 */

export const PageTransition = ({ children, className }) => {
  const reduced = useReducedMotionPreference();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.12, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const Plain = ({ children, className, as: Tag = 'div' }) => <Tag className={className}>{children}</Tag>;

export const Reveal = Plain;
export const StaggerGroup = Plain;
export const StaggerItem = Plain;

export default PageTransition;
