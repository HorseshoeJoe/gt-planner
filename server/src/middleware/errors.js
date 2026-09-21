export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body was not valid JSON.' });
  }

  console.error('[error]', err);
  return res.status(err.status || 500).json({ message: err.message || 'Unexpected server error.' });
}
