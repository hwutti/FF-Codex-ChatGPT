import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '@prisma/client';
import { prisma } from '../config/database';

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
  memberId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

// Bereinigt abgelaufene Blacklist-Einträge alle 60 Minuten
setInterval(async () => {
  try {
    await prisma.blacklistedToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch {}
}, 60 * 60 * 1000);

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Token aus Cookie oder Bearer Header
  const token = req.cookies?.authToken || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'Nicht authentifiziert' });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    req.user = payload;

    // Blacklist prüfen
    try {
      const blacklisted = await prisma.blacklistedToken.findUnique({ where: { token } });
      if (blacklisted) {
        res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
        return;
      }
    } catch {
      // Blacklist-Tabelle noch nicht vorhanden — ignorieren
    }

    next();
  } catch (err) {
    res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Nicht authentifiziert' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Keine Berechtigung' });
      return;
    }
    next();
  };
}

export const isAdmin = authorize(UserRole.ADMIN);
export const isAdminOrCommander = authorize(UserRole.ADMIN, UserRole.COMMANDER, UserRole.DEPUTY_COMMANDER);
export const canManageContent = authorize(
  UserRole.ADMIN, UserRole.COMMANDER, UserRole.DEPUTY_COMMANDER, UserRole.SECRETARY
);
