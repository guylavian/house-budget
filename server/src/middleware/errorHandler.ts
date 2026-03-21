import { Request, Response, NextFunction } from 'express';
import type { ApiError } from '../interfaces/error';
import log from '../lib/logger';

const errLog = log.get('error-handler');

export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  errLog.error(err.stack ?? err.message ?? String(err));

  if (err.name === 'ZodError' && err.errors) {
    res.status(400).json({
      error: 'Validation error',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  if (err.code === 'P2002') {
    res.status(409).json({ error: 'Resource already exists' });
    return;
  }

  if (err.code === 'P2025') {
    res.status(404).json({ error: 'Record not found' });
    return;
  }

  const status = err.status ?? err.statusCode ?? 500;
  const message = err.message ?? 'Internal server error';

  res.status(status).json({ error: message });
}
