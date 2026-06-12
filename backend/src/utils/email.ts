import * as nodemailer from 'nodemailer';
import { prisma } from '../config/database';
import { decryptSecret } from './crypto';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'singleton' },
      select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true, smtpSecure: true } as any,
    }) as any;

    if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPass) return null;

    return {
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: settings.smtpSecure || false,
      user: settings.smtpUser,
      pass: decryptSecret(settings.smtpPass),
      from: settings.smtpFrom || settings.smtpUser,
    };
  } catch {
    return null;
  }
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const config = await getSmtpConfig();
  if (!config) {
    console.error('[Email] Kein SMTP konfiguriert');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    await transporter.sendMail({
      from: config.from,
      to,
      subject,
      html,
    });

    return true;
  } catch (e) {
    console.error('[Email] Sendefehler:', e);
    return false;
  }
}

export async function testSmtpConnection(config: SmtpConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: 10000,  // 10 Sekunden
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
    await transporter.verify();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
