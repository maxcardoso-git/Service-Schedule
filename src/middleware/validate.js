import { ValidationError } from '../lib/errors.js';

/**
 * Zod validation middleware factory.
 * @param {Object} schema - Object with optional keys: body, query, params (each a Zod schema)
 * @returns Express middleware that validates and replaces req.body/query/params with parsed values
 */
export function validate(schema) {
  return (req, res, next) => {
    const errors = {};

    if (schema.body) {
      const result = schema.body.safeParse(req.body);
      if (!result.success) {
        Object.assign(errors, result.error.flatten().fieldErrors);
      } else {
        req.body = result.data;
      }
    }

    if (schema.query) {
      const result = schema.query.safeParse(req.query);
      if (!result.success) {
        Object.assign(errors, result.error.flatten().fieldErrors);
      } else {
        req.query = result.data;
      }
    }

    if (schema.params) {
      const result = schema.params.safeParse(req.params);
      if (!result.success) {
        Object.assign(errors, result.error.flatten().fieldErrors);
      } else {
        req.params = result.data;
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Validation failed', errors);
    }

    next();
  };
}
