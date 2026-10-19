import mongoose from 'mongoose';
import { ZodError } from 'zod';

import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

const duplicateKeyMessage = (error) => {
  const field = Object.keys(error.keyPattern ?? error.keyValue ?? {})[0];

  const friendly = {
    usernameLower: 'That username is already taken',
    username: 'That username is already taken',
    email: 'An account with that email already exists',
    normalizedHandle: 'That handle is already linked to another CodeHub account',
  };

  return friendly[field] ?? 'That record already exists';
};

/** Translate known error types into a consistent JSON error envelope. */
const normalise = (error) => {
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
      code: error.code,
      details: error.details,
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return {
      statusCode: 400,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: Object.values(error.errors).map((item) => ({
        field: item.path,
        message: item.message,
      })),
    };
  }

  if (error instanceof mongoose.Error.CastError) {
    return { statusCode: 400, message: `Invalid value for "${error.path}"`, code: 'CAST_ERROR' };
  }

  if (error?.code === 11000) {
    return { statusCode: 409, message: duplicateKeyMessage(error), code: 'DUPLICATE_KEY' };
  }

  if (error?.name === 'TokenExpiredError') {
    return { statusCode: 401, message: 'Session expired, please sign in again', code: 'TOKEN_EXPIRED' };
  }

  if (error?.name === 'JsonWebTokenError') {
    return { statusCode: 401, message: 'Invalid authentication token', code: 'TOKEN_INVALID' };
  }

  if (error?.type === 'entity.too.large') {
    return { statusCode: 413, message: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' };
  }

  return { statusCode: 500, message: 'Something went wrong on our side', code: 'INTERNAL_ERROR' };
};

// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature
export const errorHandler = (error, req, res, next) => {
  const { statusCode, message, code, details } = normalise(error);

  const logMeta = {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    code,
  };

  if (statusCode >= 500) {
    logger.error(error?.message ?? 'Unhandled error', { ...logMeta, stack: error?.stack });
  } else {
    logger.warn(message, logMeta);
  }

  res.status(statusCode).json({
    error: {
      message,
      code,
      ...(details ? { details } : {}),
      ...(env.isProduction || statusCode < 500 ? {} : { stack: error?.stack }),
    },
  });
};

export default errorHandler;
