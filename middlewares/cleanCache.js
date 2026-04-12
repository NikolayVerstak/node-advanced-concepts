const { clearHash } = require('../services/cache');

module.exports = async (req, res, next) => {
  // So what this does is it makes sure that we call the next function,
  // which is in this case the route handler, and we let the route handler do everything
  // that it needs to do.
  // And then after the route handler is complete, execution is going to come back
  // over to this middleware right here.
  await next();

  clearHash(req.user.id);
};
