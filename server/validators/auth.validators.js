import { z } from 'zod';

import { CARD_THEMES } from '../config/constants.js';

const username = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be 30 characters or fewer')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Use letters, numbers, underscores or hyphens only');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be 128 characters or fewer')
  .regex(/[a-zA-Z]/, 'Include at least one letter')
  .regex(/[0-9]/, 'Include at least one number');

export const registerSchema = z.object({
  username,
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  password,
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email or username'),
  password: z.string().min(1, 'Enter your password'),
});

/**
 * `currentPassword` is optional here because a Google-created account has no
 * password to confirm. The service still demands it whenever one exists, so
 * this cannot be used to skip the check on a password account.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').optional(),
    newPassword: password,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'Choose a password different from your current one',
    path: ['newPassword'],
  });

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().max(60, 'Keep it under 60 characters').optional(),
    bio: z.string().trim().max(240, 'Keep your bio under 240 characters').optional(),
    avatarUrl: z.union([z.string().url('Enter a valid URL'), z.literal('')]).optional(),
    preferences: z
      .object({
        theme: z.enum(['dark', 'light', 'system']).optional(),
        reducedMotion: z.boolean().optional(),
        emailReminders: z.boolean().optional(),
      })
      .optional(),
    publicProfile: z
      .object({
        enabled: z.boolean().optional(),
        cardTheme: z.enum(CARD_THEMES).optional(),
        showEmail: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

export default { registerSchema, loginSchema, changePasswordSchema, updateProfileSchema };
