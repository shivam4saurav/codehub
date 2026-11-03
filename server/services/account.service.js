import BookmarkNote from '../models/BookmarkNote.js';
import PlatformHandle from '../models/PlatformHandle.js';
import RecommendationHistory from '../models/RecommendationHistory.js';
import Reminder from '../models/Reminder.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
/** Every collection that stores rows keyed by `userId`. */
const USER_OWNED_MODELS = [BookmarkNote, PlatformHandle, RecommendationHistory, Reminder];
/**
 * Permanently delete an account and everything keyed to it.
 *
 * Re-authentication happens here, not in the route: the typed username must
 * match, and an account with a password must also present it, so a stolen
 * session cookie alone cannot wipe an account.
 *
 * No transaction (free-tier Atlas may not offer one). Instead the order is the
 * safeguard: children first, the user last. Every step is an idempotent
 * deleteMany, so if the process dies midway the user document still exists,
 * the account still works, and the request can simply be repeated.
 */
export const deleteAccount = async ({ user, confirmUsername, currentPassword }) => {
  const fresh = await User.findById(user._id).select('+passwordHash');
  if (!fresh) throw ApiError.unauthorized('Please sign in to continue');
  if (String(confirmUsername).trim().toLowerCase() !== fresh.usernameLower) {
    throw ApiError.badRequest('The username you typed does not match this account');
  }
  if (fresh.canUsePassword()) {
    if (!currentPassword) throw ApiError.badRequest('Enter your current password');
    const matches = await fresh.verifyPassword(currentPassword);
    if (!matches) throw ApiError.badRequest('Your current password is incorrect');
  }
  await Promise.all(USER_OWNED_MODELS.map((Model) => Model.deleteMany({ userId: fresh._id })));
  // Removing the document also drops its refresh sessions and googleId.
  await User.deleteOne({ _id: fresh._id });
};
export default { deleteAccount };
