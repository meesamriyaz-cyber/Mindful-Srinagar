export function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
}

export function errorHandler(error, req, res, _next) {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = error.message || "Server error";

  if (error.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(error.errors).map((issue) => issue.message).join(". ");
  }

  if (error.code === 11000) {
    statusCode = 409;
    const field = Object.keys(error.keyPattern || {})[0] || "record";
    message = `A ${field} with this value already exists`;
  }

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack
  });
}
