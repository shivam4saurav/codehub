import ApiError from '../utils/ApiError.js';

/**
 * Zod validation middleware.
 *
 * Express 5 exposes `req.query` as a getter, so validated values are attached
 * to `req.validated` instead of mutating the request. Controllers read
 * `req.validated.body / .query / .params`.
 *
 * @param {{ body?: import('zod').ZodTypeAny, query?: import('zod').ZodTypeAny, params?: import('zod').ZodTypeAny }} schemas
 */
export const validate = (schemas = {}) => (req, _res, next) => {
  const validated = {};
  const issues = [];

  for (const part of ['params', 'query', 'body']) {
    const schema = schemas[part];
    if (!schema) continue;

    const result = schema.safeParse(req[part]);

    if (result.success) {
      validated[part] = result.data;
    } else {
      for (const issue of result.error.issues) {
        issues.push({
          field: [part, ...issue.path].join('.'),
          message: issue.message,
        });
      }
    }
  }

  if (issues.length > 0) {
    return next(
      ApiError.badRequest('Validation failed', { code: 'VALIDATION_ERROR', details: issues }),
    );
  }

  req.validated = { ...req.validated, ...validated };
  return next();
};

export default validate;
