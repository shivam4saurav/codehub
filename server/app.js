import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { z } from 'zod';

import env from './config/env.js';
import { shareHtml } from './controllers/publicProfile.controller.js';
import errorHandler from './middleware/errorHandler.js';
import notFound from './middleware/notFound.js';
import { globalLimiter, shareCardLimiter } from './middleware/rateLimiters.js';
import validate from './middleware/validate.js';
import routes from './routes/index.js';
import ApiError from './utils/ApiError.js';
import logger from './utils/logger.js';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(serverDir, '../client/dist');

/**
 * When the client has been built into ../client/dist (single-service deploy on
 * Render or a plain VPS), serve it from here too. On a split deployment
 * (Vercel + Render) the directory simply does not exist and this is a no-op.
 */
const attachClientBuild = (app) => {
  const indexPath = path.join(CLIENT_DIST, 'index.html');
  if (!fs.existsSync(indexPath)) return false;

  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api')) return next();
    if (!req.accepts('html')) return next();

    // Public profiles need real meta tags; hand those to the share renderer.
    const publicProfileMatch = /^\/u\/([a-zA-Z0-9_-]{3,30})\/?$/.exec(req.path);
    if (publicProfileMatch && isCrawler(req.headers['user-agent'])) {
      return res.redirect(302, `/share/${publicProfileMatch[1]}`);
    }

    return res.sendFile(indexPath);
  });

  logger.info('Serving built client from /client/dist');
  return true;
};

/** Conservative crawler sniffing - only used to pick the meta-tagged variant. */
const isCrawler = (userAgent = '') =>
  /bot|crawler|spider|facebookexternalhit|twitterbot|linkedinbot|slackbot|whatsapp|telegrambot|discordbot|embedly|preview/i.test(
    userAgent,
  );

/** Unsafe methods must come from a known origin: cookies are the auth carrier. */
const enforceKnownOrigin = (req, _res, next) => {
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
  if (safeMethods.has(req.method)) return next();

  const origin = req.headers.origin;
  // Non-browser clients (curl, Postman, server-to-server) send no Origin.
  if (!origin) return next();

  const allowed = env.clientOrigins.includes(origin.replace(/\/$/, ''));
  if (allowed) return next();

  return next(ApiError.forbidden('Request origin is not allowed', { code: 'BAD_ORIGIN' }));
};

export const createApp = () => {
  const app = express();

  // Render/Railway/Vercel put the app behind a proxy; needed for correct IPs.
  if (env.isProduction) app.set('trust proxy', 1);

  app.disable('x-powered-by');

  app.use(
    helmet({
      // Share-card PNGs and OG images are embedded by other origins.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.clientOrigins.includes(origin.replace(/\/$/, ''))) {
          return callback(null, true);
        }
        return callback(
          new ApiError(403, `Origin ${origin} is not allowed`, { code: 'BAD_ORIGIN' }),
        );
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(cookieParser());

  if (!env.isTest) {
    app.use(
      morgan(env.isProduction ? 'combined' : 'dev', {
        stream: { write: (message) => logger.info(message.trim()) },
        skip: (req) => req.path === '/api/health',
      }),
    );
  }

  app.use(globalLimiter);
  app.use(enforceKnownOrigin);

  app.get('/', (_req, res) => {
    res.json({
      name: 'CodeHub API',
      status: 'ok',
      docs: `${env.SERVER_URL}/api/health`,
    });
  });

  app.use('/api', routes);

  /**
   * Crawler-friendly share route.
   *
   * Social crawlers do not execute JavaScript, so a React SPA can never give
   * them per-user og:* tags. This endpoint returns a small HTML document with
   * the right meta tags and an image URL, then redirects humans to the SPA.
   */
  app.get(
    '/share/:username',
    shareCardLimiter,
    validate({
      params: z.object({
        username: z
          .string()
          .trim()
          .min(3)
          .max(30)
          .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid username'),
      }),
    }),
    shareHtml,
  );

  // Optional single-service deployment: serve the built SPA if it is present.
  attachClientBuild(app);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

export default createApp;
