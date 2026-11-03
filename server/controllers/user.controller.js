import { deleteAccount } from '../services/account.service.js';
import { clearAuthCookies } from '../services/token.service.js';
import asyncHandler from '../utils/asyncHandler.js';

/** PATCH /api/users/me - profile, preferences and public-sharing settings. */
export const updateMe = asyncHandler(async (req, res) => {
  const { displayName, bio, avatarUrl, preferences, publicProfile } = req.validated.body;
  const user = req.user;

  if (displayName !== undefined) user.displayName = displayName;
  if (bio !== undefined) user.bio = bio;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

  if (preferences) {
    user.preferences = { ...user.preferences.toObject?.() ?? user.preferences, ...preferences };
  }

  if (publicProfile) {
    user.publicProfile = {
      ...(user.publicProfile.toObject?.() ?? user.publicProfile),
      ...publicProfile,
    };
  }

  await user.save();

  res.json({ user: user.toSafeJSON() });
});

/** DELETE /api/users/me - permanently remove the account and its data. */
export const deleteMe = asyncHandler(async (req, res) => {
  await deleteAccount({ user: req.user, ...req.validated.body });
  // The user document (and with it every session) is gone.
  clearAuthCookies(res);
  res.json({ success: true, message: 'Your account and its data have been deleted.' });
});

export default { updateMe, deleteMe };
