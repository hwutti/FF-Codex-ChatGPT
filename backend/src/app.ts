import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from './config/env';

// Routes
import authRoutes from './routes/auth.routes';
import memberRoutes from './routes/member.routes';
import eventRoutes from './routes/event.routes';
import exerciseRoutes from './routes/exercise.routes';
import orgEventRoutes from './routes/orgevent.routes';
import kommandoTerminRoutes from './routes/kommandotermin.routes';
import attendanceRoutes from './routes/attendance.routes';
import incidentRoutes from './routes/incident.routes';
import honorRoutes from './routes/honor.routes';
import birthdayRoutes from './routes/birthday.routes';
import dashboardRoutes from './routes/dashboard.routes';
import reportRoutes from './routes/report.routes';
import userRoutes from './routes/user.routes';
import dataRoutes from './routes/data.routes';
import settingsRoutes from './routes/settings.routes';
import protocolRoutes from './routes/protocol.routes';
import signatureRoutes from './routes/signature.routes';
import documentRoutes from './routes/document.routes';
import backupRoutes from './routes/backup.routes';
import calendarRoutes from './routes/calendar.routes';
import calendarCommandRoutes from './routes/calendar-command.routes';
import updateRoutes from './routes/update.routes';
import vehicleRoutes from './routes/vehicle.routes';
import equipmentRoutes from './routes/equipment.routes';
import aiRoutes from './routes/ai.routes';
import permissionsRoutes from './routes/permissions.routes';
import pushRoutes from './routes/push.routes';
import whisperRoutes from './routes/whisper.routes';
import einsatzplaeneRoutes from './routes/einsatzplaene.routes';
import tripSignatureRoutes from './routes/trip-signature.routes';
import privacyRoutes from './routes/privacy.routes';
import passwordResetRoutes from './routes/password-reset.routes';
import letterRoutes from './routes/letter.routes';

const app = express();

// Kein ETag-Caching für API-Responses
app.set('etag', false);
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Security
app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));

// Parsing
// Compression deaktiviert für SSE-Streaming-Routen (/api/ai/ — Jahresbericht, /api/update/ — Live-Log)
app.use(compression({
  filter: (req, res) => {
    // Kein gzip für SSE (text/event-stream) — compression puffert sonst den Stream
    if (req.path.startsWith('/api/ai/') || res.getHeader('Content-Type') === 'text/event-stream') {
      return false;
    }
    return compression.filter(req, res);
  },
}));
app.use(cookieParser());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Static uploads
app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/org-events', orgEventRoutes);
app.use('/api/kommando-termine', kommandoTerminRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/honors', honorRoutes);
app.use('/api/birthdays', birthdayRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/protocols', protocolRoutes);
app.use('/api/protocols', signatureRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/backup', backupRoutes);
// Public iCal feed - no auth required
app.use('/api/calendar/feed.ics', calendarRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/calendar-command', calendarCommandRoutes);
app.use('/api/update', updateRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/trips', tripSignatureRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/whisper', whisperRoutes);
app.use('/api/einsatzplaene', einsatzplaeneRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/auth', passwordResetRoutes);
app.use('/api/letter', letterRoutes);

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Route nicht gefunden' });
});

// Error Handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Interner Serverfehler', message: env.NODE_ENV === 'development' ? err.message : undefined });
});

export default app;

