import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names, letting later Tailwind classes win. */
export const cn = (...inputs) => twMerge(clsx(inputs));

export default cn;
