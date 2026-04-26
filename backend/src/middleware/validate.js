/**
 * Zod validation middleware. Usage:
 *
 *   router.post('/', validate({ body: farmerCreateSchema }), controller.create);
 */

function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (err) {
      const details = (err.errors || []).map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      const httpError = new Error('Validation failed');
      httpError.statusCode = 400;
      httpError.details = details;
      next(httpError);
    }
  };
}

module.exports = { validate };
