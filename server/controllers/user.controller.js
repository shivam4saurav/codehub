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

export default { updateMe };
