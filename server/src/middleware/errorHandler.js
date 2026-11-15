export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error)
  }

  const status = error.statusCode ?? error.status
  const statusCode =
    Number.isInteger(status) && status >= 400 && status < 500 ? status : 500
  const message =
    statusCode >= 500 ? 'Internal server error' : error.message || 'Request failed'

  if (statusCode >= 500) {
    console.error(error)
  }

  res.status(statusCode).json({ error: message })
}
