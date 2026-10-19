import { linkHandle, listHandles, unlinkHandle } from '../services/handle.service.js';
import asyncHandler from '../utils/asyncHandler.js';

/** GET /api/handles */
export const list = asyncHandler(async (req, res) => {
  const handles = await listHandles(req.user._id);
  res.json({ handles });
});

/** PUT /api/handles/:platform */
export const link = asyncHandler(async (req, res) => {
  const { platform } = req.validated.params;
  const { handle } = req.validated.body;

  const result = await linkHandle({ userId: req.user._id, platform, handle });

  res.json({
    handle: result.handle,
    verified: result.verified,
    // Tell the UI why a handle is saved but unverified.
    message: result.verified
      ? 'Handle verified'
      : result.reason === 'source-unavailable'
        ? 'Saved, but the platform did not respond - it will verify on the next refresh.'
        : 'Saved without verification.',
  });
});

/** DELETE /api/handles/:platform */
export const unlink = asyncHandler(async (req, res) => {
  const { platform } = req.validated.params;
  const result = await unlinkHandle({ userId: req.user._id, platform });

  res.json({ success: true, ...result });
});

export default { list, link, unlink };
