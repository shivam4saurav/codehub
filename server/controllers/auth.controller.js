import {
  changePassword,
  loginUser,
  logoutUser,
  registerUser,
  rotateRefreshToken,
} from '../services/auth.service.js';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from '../services/token.service.js';
import asyncHandler from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req, res) => {
  const { user, tokens } = await registerUser({
    ...req.validated.body,
    userAgent: req.headers['user-agent'] ?? '',
  });

  setAuthCookies(res, tokens);
  res.status(201).json({ user: user.toSafeJSON() });
});

export const login = asyncHandler(async (req, res) => {
  const { user, tokens } = await loginUser({
    ...req.validated.body,
    userAgent: req.headers['user-agent'] ?? '',
  });

  setAuthCookies(res, tokens);
  res.json({ user: user.toSafeJSON() });
});

export const refresh = asyncHandler(async (req, res) => {
  const { user, tokens } = await rotateRefreshToken({
    refreshToken: req.cookies?.[REFRESH_COOKIE],
    userAgent: req.headers['user-agent'] ?? '',
  });

  setAuthCookies(res, tokens);
  res.json({ user: user.toSafeJSON() });
});

export const logout = asyncHandler(async (req, res) => {
  await logoutUser({ refreshToken: req.cookies?.[REFRESH_COOKIE] });
  clearAuthCookies(res);
  res.json({ success: true });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

export const updatePassword = asyncHandler(async (req, res) => {
  await changePassword({ user: req.user, ...req.validated.body });

  // Every session was revoked, so the caller must sign in again.
  clearAuthCookies(res);
  res.json({ success: true, message: 'Password updated. Please sign in again.' });
});

export default { register, login, refresh, logout, me, updatePassword };
