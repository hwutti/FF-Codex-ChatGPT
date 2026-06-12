import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: (() => {
    const s = process.env.JWT_SECRET;
    if (!s || s === 'change-me-in-production') {
      if (process.env.NODE_ENV === 'production') {
        console.error('FATAL: JWT_SECRET ist nicht gesetzt oder ist der Standard-Wert. App wird beendet.');
        process.exit(1);
      }
      return 'change-me-in-production';
    }
    return s;
  })(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  MAX_UPLOAD_SIZE: process.env.MAX_UPLOAD_SIZE || '25MB',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '',
};
