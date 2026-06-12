import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from './permissions.routes';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import nodemailer from 'nodemailer';
import puppeteer from 'puppeteer';
import crypto from 'crypto';
import { syncOrgEventToCalendar } from '../utils/calendarSync';
import sharp from 'sharp';
import { decryptSecret } from '../utils/crypto';

// Unterschrift für Email verkleinern (max 120px hoch)
async function resizeSignatureForEmail(base64DataUrl: string): Promise<string> {
  try {
    const match = base64DataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) return base64DataUrl;
    const imageBuffer = Buffer.from(match[2], 'base64');
    const resized = await sharp(imageBuffer)
      .resize({ height: 120, withoutEnlargement: true })
      .png()
      .toBuffer();
    return `data:image/png;base64,${resized.toString('base64')}`;
  } catch {
    return base64DataUrl;
  }
}

const router = Router();
router.use(authenticate);
const prisma = new PrismaClient();

// ── System-Design-Vorlagen (schreibgeschützt) ────────────────────────────────

export const SYSTEM_DESIGNS: Record<string, any> = {

  // ══════════════════════════════════════════════════════
  // KATEGORIE: klassisch  (zeitlos, elegant, metallisch)
  // ══════════════════════════════════════════════════════

  'klassisch-gold': {
    name: 'Klassisch Gold',
    isSystem: true,
    category: 'klassisch',
    headerBgColor: '#1C1C1C',
    headerTitleColor: '#D4AF37',
    headerTitleSize: 22,
    headerLogoPosition: 'both',
    accentColor: '#D4AF37',
    footerBgColor: '#1C1C1C',
    fontFamily: 'Cormorant Garamond',
    fontSize: 13,
    bodyBgColor: '#FDFCF7',
    bodyBgImageOpacity: 0.04,
    template: 'classic',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: 'im Dienst der Gemeinschaft',
  },

  'silber-prestige': {
    name: 'Silber Prestige',
    isSystem: true,
    category: 'klassisch',
    headerBgColor: '#2C2C2C',
    headerTitleColor: '#C0C0C0',
    headerTitleSize: 20,
    headerLogoPosition: 'both',
    accentColor: '#A8A8A8',
    footerBgColor: '#2C2C2C',
    fontFamily: 'Playfair Display',
    fontSize: 12,
    bodyBgColor: '#F8F8F8',
    bodyBgImageOpacity: 0.03,
    template: 'minimal',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },

  'messing-klassik': {
    name: 'Messing Klassik',
    isSystem: true,
    category: 'klassisch',
    headerBgColor: '#2B1E0E',
    headerTitleColor: '#C8922A',
    headerTitleSize: 21,
    headerLogoPosition: 'both',
    accentColor: '#C8922A',
    footerBgColor: '#2B1E0E',
    fontFamily: 'Cormorant Garamond',
    fontSize: 13,
    bodyBgColor: '#FFFDF5',
    bodyBgImageOpacity: 0.04,
    template: 'frame',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },

  'royal-navy': {
    name: 'Royal Navy',
    isSystem: true,
    category: 'klassisch',
    headerBgColor: '#0D1B3E',
    headerTitleColor: '#BFA96E',
    headerTitleSize: 22,
    headerLogoPosition: 'both',
    accentColor: '#BFA96E',
    footerBgColor: '#0D1B3E',
    fontFamily: 'Playfair Display',
    fontSize: 13,
    bodyBgColor: '#FAFBFF',
    bodyBgImageOpacity: 0.03,
    template: 'split',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: 'Freiwillige Feuerwehr',
  },

  'elfenbein-gold': {
    name: 'Elfenbein & Gold',
    isSystem: true,
    category: 'klassisch',
    headerBgColor: '#4A3728',
    headerTitleColor: '#F0E6C8',
    headerTitleSize: 20,
    headerLogoPosition: 'both',
    accentColor: '#C9A84C',
    footerBgColor: '#4A3728',
    fontFamily: 'Cormorant Garamond',
    fontSize: 13,
    bodyBgColor: '#FFFEF9',
    bodyBgImageOpacity: 0.05,
    template: 'rounded',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },

  // ══════════════════════════════════════════════════════
  // KATEGORIE: feuerwehr  (feuerwehrtypisch, markant)
  // ══════════════════════════════════════════════════════

  'flammen-rot': {
    name: 'Flammen Rot',
    isSystem: true,
    category: 'feuerwehr',
    headerBgColor: '#8B0000',
    headerTitleColor: '#FFE4B5',
    headerTitleSize: 21,
    headerLogoPosition: 'both',
    accentColor: '#CC2200',
    footerBgColor: '#6B0000',
    fontFamily: 'Playfair Display',
    fontSize: 12,
    bodyBgColor: '#FFFFFF',
    bodyBgImageOpacity: 0.04,
    template: 'diagonal',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: 'Bereit wenn es drauf ankommt',
  },

  'stahl-blau': {
    name: 'Stahl Blau',
    isSystem: true,
    category: 'feuerwehr',
    headerBgColor: '#1B3A5C',
    headerTitleColor: '#E8F4FD',
    headerTitleSize: 20,
    headerLogoPosition: 'both',
    accentColor: '#2E86C1',
    footerBgColor: '#152D47',
    fontFamily: 'Georgia',
    fontSize: 12,
    bodyBgColor: '#F7FAFD',
    bodyBgImageOpacity: 0.04,
    template: 'stripe',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },

  'feuer-dunkel': {
    name: 'Feuer & Dunkel',
    isSystem: true,
    category: 'feuerwehr',
    headerBgColor: '#1A0A00',
    headerTitleColor: '#FF6B2B',
    headerTitleSize: 22,
    headerLogoPosition: 'both',
    accentColor: '#E85D04',
    footerBgColor: '#1A0A00',
    fontFamily: 'Cormorant Garamond',
    fontSize: 13,
    bodyBgColor: '#FFFAF7',
    bodyBgImageOpacity: 0.04,
    template: 'corner',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },

  'bergrettung-gruen': {
    name: 'Bergrettung Grün',
    isSystem: true,
    category: 'feuerwehr',
    headerBgColor: '#1B4332',
    headerTitleColor: '#D8F3DC',
    headerTitleSize: 19,
    headerLogoPosition: 'both',
    accentColor: '#40916C',
    footerBgColor: '#1B4332',
    fontFamily: 'Georgia',
    fontSize: 12,
    bodyBgColor: '#F7FFF9',
    bodyBgImageOpacity: 0.04,
    template: 'sidebar',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: 'Gemeinsam. Sicher. Stark.',
  },

  'karmesin-silber': {
    name: 'Karmesin & Silber',
    isSystem: true,
    category: 'feuerwehr',
    headerBgColor: '#6B0F1A',
    headerTitleColor: '#E8E8E8',
    headerTitleSize: 20,
    headerLogoPosition: 'both',
    accentColor: '#B0B0B0',
    footerBgColor: '#4A0A12',
    fontFamily: 'Playfair Display',
    fontSize: 12,
    bodyBgColor: '#FFFFFF',
    bodyBgImageOpacity: 0.03,
    template: 'ribbon',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },

  // ══════════════════════════════════════════════════════
  // KATEGORIE: premium  (hochwertig, designorientiert)
  // ══════════════════════════════════════════════════════

  'platin-eleganz': {
    name: 'Platin Eleganz',
    isSystem: true,
    category: 'premium',
    headerBgColor: '#1A1A1A',
    headerTitleColor: '#E5E4E2',
    headerTitleSize: 22,
    headerLogoPosition: 'both',
    accentColor: '#E5E4E2',
    footerBgColor: '#111111',
    fontFamily: 'Cormorant Garamond',
    fontSize: 13,
    bodyBgColor: '#FAFAFA',
    bodyBgImageOpacity: 0.03,
    template: 'bold-type',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },

  'bronze-antik': {
    name: 'Bronze Antik',
    isSystem: true,
    category: 'premium',
    headerBgColor: '#3D2B1F',
    headerTitleColor: '#CD7F32',
    headerTitleSize: 21,
    headerLogoPosition: 'both',
    accentColor: '#CD7F32',
    footerBgColor: '#2D1F16',
    fontFamily: 'Cormorant Garamond',
    fontSize: 13,
    bodyBgColor: '#FEFCF8',
    bodyBgImageOpacity: 0.05,
    template: 'geometric',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },

  'mitternacht-kupfer': {
    name: 'Mitternacht & Kupfer',
    isSystem: true,
    category: 'premium',
    headerBgColor: '#0D0D0D',
    headerTitleColor: '#B87333',
    headerTitleSize: 21,
    headerLogoPosition: 'both',
    accentColor: '#B87333',
    footerBgColor: '#0D0D0D',
    fontFamily: 'Playfair Display',
    fontSize: 12,
    bodyBgColor: '#FDFCFB',
    bodyBgImageOpacity: 0.03,
    template: 'wave',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },

  'tiefblau-gold': {
    name: 'Tiefblau & Gold',
    isSystem: true,
    category: 'premium',
    headerBgColor: '#050A30',
    headerTitleColor: '#CFB53B',
    headerTitleSize: 22,
    headerLogoPosition: 'both',
    accentColor: '#CFB53B',
    footerBgColor: '#050A30',
    fontFamily: 'Cormorant Garamond',
    fontSize: 13,
    bodyBgColor: '#FAFBFF',
    bodyBgImageOpacity: 0.03,
    template: 'overlap',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: 'im Dienst für Sicherheit',
  },

  'smaragd-gold': {
    name: 'Smaragd & Gold',
    isSystem: true,
    category: 'premium',
    headerBgColor: '#0D3B2E',
    headerTitleColor: '#CFB53B',
    headerTitleSize: 20,
    headerLogoPosition: 'both',
    accentColor: '#CFB53B',
    footerBgColor: '#082518',
    fontFamily: 'Cormorant Garamond',
    fontSize: 13,
    bodyBgColor: '#F7FFF9',
    bodyBgImageOpacity: 0.04,
    template: 'arch',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },

  // ══════════════════════════════════════════════════════
  // KATEGORIE: modern  (clean, zeitgemäß, professionell)
  // ══════════════════════════════════════════════════════

  'schnee-akzent': {
    name: 'Schnee & Akzent',
    isSystem: true,
    category: 'modern',
    headerBgColor: '#F0F0F0',
    headerTitleColor: '#1A1A1A',
    headerTitleSize: 20,
    headerLogoPosition: 'both',
    accentColor: '#CC2200',
    footerBgColor: '#E0E0E0',
    fontFamily: 'Lora',
    fontSize: 12,
    bodyBgColor: '#FFFFFF',
    bodyBgImageOpacity: 0.02,
    template: 'badge',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },

  'graphit-rot': {
    name: 'Graphit & Rot',
    isSystem: true,
    category: 'modern',
    headerBgColor: '#2D2D2D',
    headerTitleColor: '#FFFFFF',
    headerTitleSize: 19,
    headerLogoPosition: 'left',
    accentColor: '#CC2200',
    footerBgColor: '#1A1A1A',
    fontFamily: 'Lora',
    fontSize: 12,
    bodyBgColor: '#FFFFFF',
    bodyBgImageOpacity: 0.02,
    template: 'duo',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },

  'indigo-weiss': {
    name: 'Indigo & Weiß',
    isSystem: true,
    category: 'modern',
    headerBgColor: '#1C1F6E',
    headerTitleColor: '#FFFFFF',
    headerTitleSize: 20,
    headerLogoPosition: 'both',
    accentColor: '#3D42E0',
    footerBgColor: '#131647',
    fontFamily: 'Lora',
    fontSize: 12,
    bodyBgColor: '#FAFAFF',
    bodyBgImageOpacity: 0.02,
    template: 'sidebar-right',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },

  'sahara-dunkel': {
    name: 'Sahara & Dunkel',
    isSystem: true,
    category: 'modern',
    headerBgColor: '#2C1810',
    headerTitleColor: '#F5DEB3',
    headerTitleSize: 20,
    headerLogoPosition: 'both',
    accentColor: '#D2691E',
    footerBgColor: '#1C0E08',
    fontFamily: 'Playfair Display',
    fontSize: 12,
    bodyBgColor: '#FFFDF7',
    bodyBgImageOpacity: 0.04,
    template: 'footer-heavy',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },

  // ── Bewährte Vorlagen (klassische Kollektion) ────────────────────────────

  // Feuerwehr-Kategorie
  'klassisch-rot': {
    name: 'Klassisch Rot',
    isSystem: true,
    category: 'feuerwehr',
    headerBgColor: '#c0392b',
    headerTitleColor: '#ffffff',
    headerTitleSize: 18,
    headerLogoPosition: 'both',
    accentColor: '#e74c3c',
    fontFamily: 'Georgia',
    fontSize: 12,
    bodyBgColor: '#ffffff',
    bodyBgImageOpacity: 0.05,
    template: 'classic',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },
  'nacht-flamme': {
    name: 'Nacht & Flamme',
    isSystem: true,
    category: 'feuerwehr',
    headerBgColor: '#1a1a2e',
    headerTitleColor: '#f39c12',
    headerTitleSize: 20,
    headerLogoPosition: 'both',
    accentColor: '#e67e22',
    fontFamily: 'Playfair Display',
    fontSize: 12,
    bodyBgColor: '#fafafa',
    bodyBgImageOpacity: 0.05,
    template: 'classic',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },
  'alpengruen': {
    name: 'Alpengrün',
    isSystem: true,
    category: 'feuerwehr',
    headerBgColor: '#1a3a2a',
    headerTitleColor: '#e8f5e9',
    headerTitleSize: 18,
    headerLogoPosition: 'both',
    accentColor: '#7cb342',
    fontFamily: 'Georgia',
    fontSize: 12,
    bodyBgColor: '#ffffff',
    bodyBgImageOpacity: 0.05,
    template: 'classic',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },
  'ehrenamt': {
    name: 'Ehrenamt',
    isSystem: true,
    category: 'feuerwehr',
    headerBgColor: '#6d1a36',
    headerTitleColor: '#f5e6c8',
    headerTitleSize: 20,
    headerLogoPosition: 'both',
    accentColor: '#d4a853',
    fontFamily: 'Cormorant Garamond',
    fontSize: 13,
    bodyBgColor: '#fffdf8',
    bodyBgImageOpacity: 0.05,
    template: 'classic',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },
  'einsatzbereit': {
    name: 'Einsatzbereit',
    isSystem: true,
    category: 'feuerwehr',
    headerBgColor: '#2d2d2d',
    headerTitleColor: '#f1c40f',
    headerTitleSize: 18,
    headerLogoPosition: 'left',
    accentColor: '#f39c12',
    fontFamily: 'Arial',
    fontSize: 12,
    bodyBgColor: '#ffffff',
    bodyBgImageOpacity: 0.05,
    template: 'classic',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },

  // Modern-Kategorie
  'schwarz-gold': {
    name: 'Schwarz-Gold',
    isSystem: true,
    category: 'modern',
    headerBgColor: '#0a0a0a',
    headerTitleColor: '#d4a853',
    headerTitleSize: 20,
    headerLogoPosition: 'both',
    accentColor: '#c8a96e',
    fontFamily: 'Cormorant Garamond',
    fontSize: 13,
    bodyBgColor: '#ffffff',
    bodyBgImageOpacity: 0.03,
    template: 'classic',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },
  'navy-mint': {
    name: 'Navy-Mint',
    isSystem: true,
    category: 'modern',
    headerBgColor: '#0d2137',
    headerTitleColor: '#a8eddb',
    headerTitleSize: 18,
    headerLogoPosition: 'both',
    accentColor: '#26a69a',
    fontFamily: 'Lora',
    fontSize: 12,
    bodyBgColor: '#f8fffe',
    bodyBgImageOpacity: 0.03,
    template: 'classic',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },
  'anthrazit-silber': {
    name: 'Anthrazit-Silber',
    isSystem: true,
    category: 'modern',
    headerBgColor: '#2c3e50',
    headerTitleColor: '#ecf0f1',
    headerTitleSize: 18,
    headerLogoPosition: 'center',
    accentColor: '#95a5a6',
    fontFamily: 'Arial',
    fontSize: 12,
    bodyBgColor: '#ffffff',
    bodyBgImageOpacity: 0.03,
    template: 'classic',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },
  'slate-copper': {
    name: 'Slate-Copper',
    isSystem: true,
    category: 'modern',
    headerBgColor: '#334155',
    headerTitleColor: '#fde8d8',
    headerTitleSize: 19,
    headerLogoPosition: 'both',
    accentColor: '#b87333',
    fontFamily: 'Lora',
    fontSize: 12,
    bodyBgColor: '#fffcfa',
    bodyBgImageOpacity: 0.03,
    template: 'classic',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },
  'midnight-rose': {
    name: 'Midnight-Rose',
    isSystem: true,
    category: 'modern',
    headerBgColor: '#1a1035',
    headerTitleColor: '#f8d7e3',
    headerTitleSize: 20,
    headerLogoPosition: 'both',
    accentColor: '#c9788a',
    fontFamily: 'Cormorant Garamond',
    fontSize: 13,
    bodyBgColor: '#fffbfc',
    bodyBgImageOpacity: 0.03,
    template: 'classic',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },

  // Klassisch-Kategorie (Standard)
  'standard': {
    name: 'Standard',
    isSystem: true,
    category: 'klassisch',
    headerBgColor: '#1a2744',
    headerTitleColor: '#f5e6d0',
    headerTitleSize: 20,
    headerLogoPosition: 'both',
    accentColor: '#c8a96e',
    fontFamily: 'Playfair Display',
    fontSize: 12,
    bodyBgColor: '#ffffff',
    bodyBgImageOpacity: 0.08,
    template: 'classic',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: 'im Einsatz für die Gemeinschaft',
  },

  'eis-silber': {
    name: 'Eis & Silber',
    isSystem: true,
    category: 'modern',
    headerBgColor: '#E8EEF4',
    headerTitleColor: '#1A2744',
    headerTitleSize: 19,
    headerLogoPosition: 'center',
    accentColor: '#4A6FA5',
    footerBgColor: '#D0DCE8',
    fontFamily: 'Lora',
    fontSize: 12,
    bodyBgColor: '#FFFFFF',
    bodyBgImageOpacity: 0.02,
    template: 'watermark',
    signerPosition: 'right',
    headerTitle: '',
    headerSubtitle: '',
  },

};


// ── Encryption für Unterschrift ───────────────────────────────────────────────
const SIGNATURE_KEY = (env.ENCRYPTION_KEY || '').substring(0, 32).padEnd(32, '0');

function encryptSignature(data: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(SIGNATURE_KEY), iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptSignature(data: string): string {
  const [ivHex, encHex] = data.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(SIGNATURE_KEY), iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

// ── Bilder als Base64 inline einbetten (für Puppeteer PDF) ───────────────────
// Ersetzt alle src="..." und url('...') die auf lokale Upload-Pfade zeigen
// durch data:image/...;base64,... damit Puppeteer keine HTTP-Requests braucht.
async function inlineImages(html: string): Promise<string> {
  // Matches: src="/uploads/..." oder src="uploads/..."
  const srcRegex = /src="(\/uploads\/[^"]+)"/g;
  // Matches: url('/uploads/...') oder url("/uploads/...") in CSS
  const urlRegex = /url\(['"]?(\/uploads\/[^'")]+)['"]?\)/g;

  const toDataUrl = (uploadPath: string): string => {
    const filePath = path.join(env.UPLOAD_DIR, uploadPath.replace(/^\/uploads\//, ''));
    if (!fs.existsSync(filePath)) return uploadPath;
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const mime = ext === 'svg' ? 'image/svg+xml'
               : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
               : ext === 'webp' ? 'image/webp'
               : 'image/png';
    const data = fs.readFileSync(filePath).toString('base64');
    return `data:${mime};base64,${data}`;
  };

  // src="..." ersetzen
  html = html.replace(srcRegex, (_, p) => `src="${toDataUrl(p)}"`);
  // url('...') in CSS ersetzen
  html = html.replace(urlRegex, (_, p) => `url('${toDataUrl(p)}')`);

  return html;
}

// ── Bilder als CID-Attachments für HTML-Emails ───────────────────────────────
// Gibt das HTML mit cid:... src-Attributen zurück + die Attachments für nodemailer.
function buildCidHtml(html: string): { html: string; attachments: any[] } {
  const attachments: any[] = [];
  const seen = new Map<string, string>(); // uploadPath oder dataUrl-hash → cid

  const replaceUpload = (uploadPath: string): string => {
    if (seen.has(uploadPath)) return `cid:${seen.get(uploadPath)}`;
    const filePath = path.join(env.UPLOAD_DIR, uploadPath.replace(/^\/uploads\//, ''));
    if (!fs.existsSync(filePath)) return uploadPath;
    const cid = `img_${seen.size}_${path.basename(filePath).replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const contentType = ext === 'svg' ? 'image/svg+xml'
                      : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
                      : ext === 'webp' ? 'image/webp'
                      : 'image/png';
    attachments.push({ filename: path.basename(filePath), path: filePath, cid, contentType });
    seen.set(uploadPath, cid);
    return `cid:${cid}`;
  };

  const replaceDataUrl = (dataUrl: string): string => {
    if (seen.has(dataUrl)) return `cid:${seen.get(dataUrl)}`;
    const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) return dataUrl;
    const contentType = match[1];
    const ext = contentType.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
    const cid = `sig_${seen.size}.${ext}`;
    const content = Buffer.from(match[2], 'base64');
    attachments.push({ filename: cid, content, cid, contentType });
    seen.set(dataUrl, cid);
    return `cid:${cid}`;
  };

  // src="/uploads/..." ersetzen
  html = html.replace(/src="(\/uploads\/[^"]+)"/g, (_, p) => `src="${replaceUpload(p)}"`);
  // url('/uploads/...') in CSS ersetzen
  html = html.replace(/url\(['"]?(\/uploads\/[^'")]+)['"]?\)/g, (_, p) => `url('${replaceUpload(p)}')`);
  // src="data:image/...;base64,..." ersetzen (Unterschriften)
  html = html.replace(/src="(data:image\/[^"]+)"/g, (_, p) => `src="${replaceDataUrl(p)}"`);

  return { html, attachments };
}


const letterUploadDir = path.join(env.UPLOAD_DIR, 'letter');
if (!fs.existsSync(letterUploadDir)) fs.mkdirSync(letterUploadDir, { recursive: true });

const letterStorage = multer.diskStorage({
  destination: letterUploadDir,
  filename: (_, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')),
});
const letterUpload = multer({ storage: letterStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// Für Versand-Anhänge: memory storage (max 25MB gesamt, max 10 Dateien)
const sendAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
}).array('attachments', 10);

// ── Hilfsfunktion: SMTP-Transporter ──────────────────────────────────────────
async function getTransporter() {
  const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
  if (!settings?.smtpHost) throw new Error('SMTP nicht konfiguriert');
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort || 587,
    secure: settings.smtpPort === 465,
    auth: { user: settings.smtpUser, pass: decryptSecret(settings.smtpPass) },
  });
}

// ── HTML-Brief generieren ─────────────────────────────────────────────────────
function generateLetterHtml(params: {
  design: any;
  subject: string;
  salutation: string;
  body: string;
  closing: string;
  recipientName: string;
  recipientAddress: string;
  date: string;
  signers: { name: string; function: string; signatureBase64?: string }[];
}): string {
  const { design, subject, salutation, body, closing, recipientName, recipientAddress, date, signers } = params;

  // Pfad unverändert lassen — wird später per inlineImages() als Base64 eingebettet
  const absUrl = (url: string | null | undefined) => url || '';

  const accentColor   = design.accentColor   || design.headerBgColor || '#1a2744';
  const footerBgColor = design.footerBgColor || design.headerBgColor || accentColor;
  const fontFamily    = design.fontFamily    || 'Georgia';
  const fontSize      = design.fontSize      || 12;
  const signerPos     = design.signerPosition || 'right';
  const tpl           = design.template      || 'classic';

  // ── Gemeinsame Hilfsfunktionen ──────────────────────────────────────────────

  const logoImg = (src: string, size = 52) =>
    `<img src="${absUrl(src)}" style="width:${size}px;height:${size}px;object-fit:contain;" alt="">`;

  const logoCircle = (src: string, size = 64, bg = 'rgba(255,255,255,0.15)') =>
    `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
      <img src="${absUrl(src)}" style="width:${size - 8}px;height:${size - 8}px;object-fit:contain;" alt="">
    </div>`;

  const getLogo = (pos: 'left' | 'right' | 'center') => {
    const src = pos === 'left' ? design.headerLogoLeft
              : pos === 'right' ? design.headerLogoRight
              : design.headerLogoCenter;
    return src || null;
  };

  const signersHtml = signers.length > 0 ? `
    <div style="margin-top:40px;display:flex;justify-content:${signerPos === 'left' ? 'flex-start' : 'flex-end'};gap:48px;">
      ${signers.map(s => `
        <div style="text-align:center;min-width:130px;">
          ${s.signatureBase64
            ? `<img src="${s.signatureBase64}" style="height:54px;max-width:180px;object-fit:contain;display:block;margin:0 auto 4px;mix-blend-mode:multiply;" alt="Unterschrift">`
            : '<div style="height:54px;"></div>'}
          <div style="border-top:1.5px solid ${accentColor};padding-top:6px;font-family:${fontFamily};font-size:11px;">
            <div style="font-weight:600;color:#1a1a1a;">${s.name}</div>
            <div style="color:#888;font-size:10px;margin-top:2px;">${s.function}</div>
          </div>
        </div>
      `).join('')}
    </div>` : '';

  const recipientHtml = recipientName
    ? `<div class="recipient"><div class="sender-ref">${design.senderLineText || design.senderName || ''}</div>
       <strong>${recipientName.split('\n').join('<br>')}</strong>
       ${recipientAddress ? '<br>' + recipientAddress.split('\n').join('<br>') : ''}</div>`
    : '';

  const footerItems = [design.senderName, design.senderAddress, design.senderPhone, design.senderEmail, design.senderWebsite]
    .filter(Boolean)
    .map((item, i) => i === 0 ? `<span>${item}</span>` : `<span class="footer-dot">·</span><span>${item}</span>`)
    .join('');

  const bodyContent = `
    <div class="meta-row">
      <div class="sender-small">${design.senderLineText || [design.senderName, design.senderAddress].filter(Boolean).join(' · ')}</div>
      <div class="date">${design.senderCity ? design.senderCity + ', ' : ''}${date}</div>
    </div>
    ${recipientHtml}
    ${subject ? `<div class="subject">Betreff: ${subject}</div>` : ''}
    ${salutation ? `<div class="salutation">${salutation}</div>` : ''}
    <div class="letter-body">${body || ''}</div>
    <div class="closing-block">
      <div style="text-align:${signerPos === 'right' ? 'right' : 'left'};">${closing || ''}</div>
      ${signersHtml}
    </div>`;

  const baseStyles = `
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'${fontFamily}',Georgia,serif; background:#f0f0f0; }
    .page { max-width:700px; margin:0 auto; background:#fff; box-shadow:0 2px 20px rgba(0,0,0,0.12); }
    .meta-row { display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:24px;padding-bottom:8px;border-bottom:0.5px solid #efefef; }
    .sender-small { font-size:9px;color:#bbb;letter-spacing:0.05em; }
    .date { font-size:11px;color:#666;font-style:italic; }
    .recipient { margin-bottom:28px;padding-left:12px;border-left:3px solid ${accentColor};font-size:12px;line-height:1.7;color:#333; }
    .sender-ref { font-size:8px;color:#ccc;margin-bottom:2px; }
    .subject { font-family:'${fontFamily}',Georgia,serif;font-size:${fontSize + 1}px;font-weight:700;color:#1a1a1a;margin-bottom:20px;padding-bottom:8px;border-bottom:0.5px solid #e8e8e8; }
    .salutation { font-size:${fontSize}px;margin-bottom:12px;color:#222; }
    .letter-body { font-size:${fontSize}px;line-height:1.9;color:#333;white-space:pre-wrap; }
    .closing-block { margin-top:32px;padding-top:20px;border-top:0.5px solid #ececec;font-size:${fontSize}px;color:#444; }
    .footer { padding:12px 28px;display:flex;justify-content:center;align-items:center;gap:16px; }
    .footer span { font-size:9.5px;color:rgba(255,255,255,0.85);letter-spacing:0.04em; }
    .footer-dot { color:rgba(255,255,255,0.4);font-size:8px; }
  `;

  // ── Template-spezifisches HTML ──────────────────────────────────────────────

  // 1. CLASSIC — voller Header, Akzentlinie
  if (tpl === 'classic') {
    const logoL = getLogo('left'); const logoR = getLogo('right'); const logoC = getLogo('center');
    const showL = design.headerLogoPosition === 'left' || design.headerLogoPosition === 'both';
    const showR = design.headerLogoPosition === 'right' || design.headerLogoPosition === 'both';
    const showC = design.headerLogoPosition === 'center';
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .header { background:${design.headerBgColor};padding:20px 28px;position:relative;overflow:hidden; }
    .header-inner { position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:16px; }
    .header-title h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||20}px;color:${design.headerTitleColor||'#fff'};font-weight:700;letter-spacing:0.03em;line-height:1.2;text-align:center; }
    .header-title p { color:rgba(255,255,255,0.7);font-size:11px;margin-top:4px;letter-spacing:0.08em;font-style:italic;text-align:center; }
    .accent-line { height:4px;background:${accentColor}; }
    .body-content { padding:32px 40px; }
    .footer { background:${footerBgColor}; }
    </style></head><body><div class="page">
    <div class="header">
      <div class="header-inner">
        <div>${showL && logoL ? logoImg(logoL) : showL ? '<div style="width:52px"></div>' : ''}</div>
        ${showC && logoC ? logoImg(logoC, 56) : ''}
        <div class="header-title" style="flex:1;text-align:center;">
          <h1>${design.headerTitle || ''}</h1>
          ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
        </div>
        <div>${showR && logoR ? logoImg(logoR) : showR ? '<div style="width:52px"></div>' : ''}</div>
      </div>
    </div>
    <div class="accent-line"></div>
    <div class="body-content">${bodyContent}</div>
    <div class="footer">${footerItems}</div>
    </div></body></html>`;
  }

  // 2. MINIMAL — dünne Linie oben, viel Weißraum
  if (tpl === 'minimal') {
    const logoL = getLogo('left') || getLogo('center') || getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .header { padding:32px 48px 20px;border-top:4px solid ${accentColor};display:flex;align-items:center;justify-content:space-between; }
    .header-title h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||18}px;color:${design.headerBgColor};font-weight:700;letter-spacing:0.04em; }
    .header-title p { font-size:10px;color:#999;letter-spacing:0.08em;margin-top:3px; }
    .divider { height:0.5px;background:#e0e0e0;margin:0 48px; }
    .body-content { padding:28px 48px 40px; }
    .footer { background:${footerBgColor};margin-top:32px; }
    </style></head><body><div class="page">
    <div class="header">
      <div class="header-title">
        <h1>${design.headerTitle || ''}</h1>
        ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
      </div>
      ${logoL ? logoImg(logoL, 48) : ''}
    </div>
    <div class="divider"></div>
    <div class="body-content">${bodyContent}</div>
    <div class="footer">${footerItems}</div>
    </div></body></html>`;
  }

  // 3. SIDEBAR — farbige Leiste links
  if (tpl === 'sidebar') {
    const logoL = getLogo('left') || getLogo('center') || getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .page { display:flex;min-height:297mm; }
    .sidebar { width:72px;background:${design.headerBgColor};display:flex;flex-direction:column;align-items:center;padding:28px 0;gap:16px;flex-shrink:0; }
    .sidebar-title { writing-mode:vertical-rl;transform:rotate(180deg);font-family:'${fontFamily}',serif;font-size:11px;color:${design.headerTitleColor||'#fff'};letter-spacing:0.12em;font-weight:600;margin-top:16px; }
    .sidebar-accent { width:3px;height:40px;background:${accentColor};border-radius:2px;margin-top:8px; }
    .main { flex:1;display:flex;flex-direction:column; }
    .main-header { padding:24px 32px 16px;border-bottom:0.5px solid #efefef;display:flex;justify-content:space-between;align-items:flex-end; }
    .main-title h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||18}px;color:${design.headerBgColor};font-weight:700; }
    .main-title p { font-size:10px;color:#999;margin-top:2px; }
    .body-content { padding:28px 32px;flex:1; }
    .footer { background:${footerBgColor}; }
    </style></head><body><div class="page">
    <div class="sidebar">
      ${logoL ? logoCircle(logoL, 48) : ''}
      <div class="sidebar-accent"></div>
      <div class="sidebar-title">${design.headerTitle || ''}</div>
    </div>
    <div class="main">
      <div class="main-header">
        <div class="main-title">
          <h1>${design.headerTitle || ''}</h1>
          ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
        </div>
        <div style="font-size:10px;color:#999;">${design.senderCity || ''}</div>
      </div>
      <div class="body-content">${bodyContent}</div>
      <div class="footer">${footerItems}</div>
    </div>
    </div></body></html>`;
  }

  // 4. DIAGONAL — schräger Schnitt im Header
  if (tpl === 'diagonal') {
    const logoL = getLogo('left'); const logoR = getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .header-wrap { position:relative;height:120px;overflow:hidden; }
    .header-bg { position:absolute;inset:0;background:${design.headerBgColor};clip-path:polygon(0 0,100% 0,100% 70%,0 100%); }
    .header-inner { position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;padding:20px 32px; }
    .header-title h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||20}px;color:${design.headerTitleColor||'#fff'};font-weight:700;letter-spacing:0.03em; }
    .header-title p { color:rgba(255,255,255,0.75);font-size:11px;margin-top:3px;font-style:italic; }
    .accent-bar { height:3px;background:${accentColor};margin:0 32px; }
    .body-content { padding:24px 40px 40px; }
    .footer { background:${footerBgColor};margin-top:16px; }
    </style></head><body><div class="page">
    <div class="header-wrap">
      <div class="header-bg"></div>
      <div class="header-inner">
        ${logoL ? logoImg(logoL, 52) : ''}
        <div class="header-title" style="flex:1;text-align:center;">
          <h1>${design.headerTitle || ''}</h1>
          ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
        </div>
        ${logoR ? logoImg(logoR, 52) : ''}
      </div>
    </div>
    <div class="accent-bar"></div>
    <div class="body-content">${bodyContent}</div>
    <div class="footer">${footerItems}</div>
    </div></body></html>`;
  }

  // 5. ROUNDED — Header mit abgerundeten Ecken unten
  if (tpl === 'rounded') {
    const logoL = getLogo('left'); const logoR = getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .page { background:#f5f5f5; }
    .header { background:${design.headerBgColor};padding:28px 32px 36px;border-radius:0 0 32px 32px;margin:0 16px; }
    .header-inner { display:flex;align-items:center;justify-content:space-between;gap:16px; }
    .header-title h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||20}px;color:${design.headerTitleColor||'#fff'};font-weight:700;letter-spacing:0.03em;text-align:center; }
    .header-title p { color:rgba(255,255,255,0.7);font-size:11px;margin-top:4px;font-style:italic;text-align:center; }
    .accent-dot { width:8px;height:8px;border-radius:50%;background:${accentColor};margin:12px auto; }
    .body-content { padding:24px 40px 40px;background:#fff;margin:16px;border-radius:16px; }
    .footer { background:${footerBgColor};border-radius:16px;margin:0 16px 16px; }
    </style></head><body><div class="page">
    <div class="header">
      <div class="header-inner">
        ${logoL ? logoImg(logoL, 52) : ''}
        <div class="header-title" style="flex:1;">
          <h1>${design.headerTitle || ''}</h1>
          ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
        </div>
        ${logoR ? logoImg(logoR, 52) : ''}
      </div>
    </div>
    <div class="accent-dot"></div>
    <div class="body-content">${bodyContent}</div>
    <div class="footer">${footerItems}</div>
    </div></body></html>`;
  }

  // 6. SPLIT — Logo links groß, Titel rechts
  if (tpl === 'split') {
    const logoL = getLogo('left') || getLogo('center') || getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .header { display:flex;overflow:hidden; }
    .header-logo-block { background:${accentColor};width:100px;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:20px; }
    .header-title-block { background:${design.headerBgColor};flex:1;padding:20px 28px;display:flex;flex-direction:column;justify-content:center; }
    .header-title-block h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||20}px;color:${design.headerTitleColor||'#fff'};font-weight:700;letter-spacing:0.03em; }
    .header-title-block p { color:rgba(255,255,255,0.65);font-size:11px;margin-top:5px;font-style:italic; }
    .accent-line { height:3px;background:${accentColor}; }
    .body-content { padding:32px 40px; }
    .footer { background:${footerBgColor}; }
    </style></head><body><div class="page">
    <div class="header">
      <div class="header-logo-block">${logoL ? logoImg(logoL, 60) : ''}</div>
      <div class="header-title-block">
        <h1>${design.headerTitle || ''}</h1>
        ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
      </div>
    </div>
    <div class="accent-line"></div>
    <div class="body-content">${bodyContent}</div>
    <div class="footer">${footerItems}</div>
    </div></body></html>`;
  }

  // 7. BADGE — Logo in rundem Kreis mittig überlappt Header/Body
  if (tpl === 'badge') {
    const logoL = getLogo('left') || getLogo('center') || getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .header { background:${design.headerBgColor};padding:24px 32px 48px;text-align:center;position:relative; }
    .header h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||20}px;color:${design.headerTitleColor||'#fff'};font-weight:700;letter-spacing:0.04em; }
    .header p { color:rgba(255,255,255,0.7);font-size:11px;margin-top:4px;font-style:italic; }
    .badge-wrap { display:flex;justify-content:center;margin-top:-36px;margin-bottom:16px;position:relative;z-index:2; }
    .badge-circle { width:72px;height:72px;border-radius:50%;background:#fff;border:4px solid ${accentColor};display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.15); }
    .body-content { padding:8px 40px 40px; }
    .footer { background:${footerBgColor}; }
    </style></head><body><div class="page">
    <div class="header">
      <h1>${design.headerTitle || ''}</h1>
      ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
    </div>
    <div class="badge-wrap">
      <div class="badge-circle">${logoL ? `<img src="${absUrl(logoL)}" style="width:56px;height:56px;object-fit:contain;" alt="">` : ''}</div>
    </div>
    <div style="height:3px;background:${accentColor};margin:0 40px 24px;border-radius:2px;"></div>
    <div class="body-content">${bodyContent}</div>
    <div class="footer">${footerItems}</div>
    </div></body></html>`;
  }

  // 8. FRAME — Rahmen rund um die ganze Seite
  if (tpl === 'frame') {
    const logoL = getLogo('left'); const logoR = getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .page { background:#fff; }
    .frame-outer { margin:12px;border:2px solid ${design.headerBgColor};border-radius:8px;overflow:hidden; }
    .header { background:${design.headerBgColor};padding:20px 28px;display:flex;align-items:center;justify-content:space-between;gap:16px; }
    .header-title h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||19}px;color:${design.headerTitleColor||'#fff'};font-weight:700;text-align:center; }
    .header-title p { color:rgba(255,255,255,0.7);font-size:10px;margin-top:3px;font-style:italic;text-align:center; }
    .accent-line { height:3px;background:${accentColor}; }
    .body-content { padding:28px 36px; }
    .footer { background:${footerBgColor}; }
    </style></head><body><div class="page">
    <div class="frame-outer">
      <div class="header">
        ${logoL ? logoImg(logoL, 48) : ''}
        <div class="header-title" style="flex:1;">
          <h1>${design.headerTitle || ''}</h1>
          ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
        </div>
        ${logoR ? logoImg(logoR, 48) : ''}
      </div>
      <div class="accent-line"></div>
      <div class="body-content">${bodyContent}</div>
      <div class="footer">${footerItems}</div>
    </div>
    </div></body></html>`;
  }

  // 9. CORNER — Farbblock oben-links, Titel rechts
  if (tpl === 'corner') {
    const logoL = getLogo('left') || getLogo('center') || getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .header { position:relative;height:110px;overflow:hidden; }
    .corner-block { position:absolute;top:0;left:0;width:200px;height:110px;background:${design.headerBgColor};clip-path:polygon(0 0,100% 0,70% 100%,0 100%); }
    .corner-logo { position:absolute;top:50%;left:60px;transform:translateY(-50%);z-index:1; }
    .corner-title { position:absolute;right:28px;top:50%;transform:translateY(-50%);text-align:right; }
    .corner-title h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||19}px;color:${design.headerBgColor};font-weight:700; }
    .corner-title p { font-size:10px;color:#888;margin-top:3px;font-style:italic; }
    .accent-line { height:3px;background:${accentColor}; }
    .body-content { padding:28px 40px; }
    .footer { background:${footerBgColor}; }
    </style></head><body><div class="page">
    <div class="header">
      <div class="corner-block"></div>
      <div class="corner-logo">${logoL ? logoImg(logoL, 52) : ''}</div>
      <div class="corner-title">
        <h1>${design.headerTitle || ''}</h1>
        ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
      </div>
    </div>
    <div class="accent-line"></div>
    <div class="body-content">${bodyContent}</div>
    <div class="footer">${footerItems}</div>
    </div></body></html>`;
  }

  // 10. STRIPE — drei horizontale Farbstreifen
  if (tpl === 'stripe') {
    const logoL = getLogo('left') || getLogo('center') || getLogo('right');
    const darken = design.headerBgColor;
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .stripe1 { height:8px;background:${accentColor}; }
    .stripe2 { height:8px;background:${design.headerBgColor};opacity:0.6; }
    .header { background:${design.headerBgColor};padding:20px 32px;display:flex;align-items:center;gap:20px; }
    .header-title h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||20}px;color:${design.headerTitleColor||'#fff'};font-weight:700; }
    .header-title p { color:rgba(255,255,255,0.7);font-size:10px;margin-top:3px;font-style:italic; }
    .stripe3 { height:4px;background:${accentColor}; }
    .body-content { padding:28px 40px; }
    .footer { background:${darken}; }
    </style></head><body><div class="page">
    <div class="stripe1"></div>
    <div class="stripe2"></div>
    <div class="header">
      ${logoL ? logoImg(logoL, 52) : ''}
      <div class="header-title" style="flex:1;">
        <h1>${design.headerTitle || ''}</h1>
        ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
      </div>
    </div>
    <div class="stripe3"></div>
    <div class="body-content">${bodyContent}</div>
    <div class="footer">${footerItems}</div>
    </div></body></html>`;
  }

  // 11. WATERMARK — minimaler Header, Logo als Wasserzeichen
  if (tpl === 'watermark') {
    const logoL = getLogo('left') || getLogo('center') || getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .header { padding:28px 48px 16px;border-top:3px solid ${accentColor};display:flex;align-items:center;justify-content:space-between; }
    .header h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||18}px;color:${design.headerBgColor};font-weight:700; }
    .header p { font-size:10px;color:#aaa;margin-top:2px; }
    .body-wrap { position:relative;padding:24px 48px 40px; }
    .watermark { position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);opacity:0.07;pointer-events:none; }
    .body-content { position:relative;z-index:1; }
    .footer { background:${footerBgColor}; }
    </style></head><body><div class="page">
    <div class="header">
      <div>
        <h1>${design.headerTitle || ''}</h1>
        ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
      </div>
      ${logoL ? logoImg(logoL, 44) : ''}
    </div>
    <div style="height:0.5px;background:#e0e0e0;margin:0 48px;"></div>
    <div class="body-wrap">
      ${logoL ? `<div class="watermark"><img src="${absUrl(logoL)}" style="width:260px;height:260px;object-fit:contain;" alt=""></div>` : ''}
      <div class="body-content">${bodyContent}</div>
    </div>
    <div class="footer">${footerItems}</div>
    </div></body></html>`;
  }

  // 12. BOLD-TYPE — großer fetter Titel, kaum Grafik
  if (tpl === 'bold-type') {
    const logoL = getLogo('left') || getLogo('center') || getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .header { padding:32px 48px 24px;display:flex;align-items:flex-start;gap:20px;border-bottom:4px solid ${design.headerBgColor}; }
    .big-title { font-family:'${fontFamily}',serif;font-size:28px;font-weight:700;color:${design.headerBgColor};line-height:1.1;letter-spacing:-0.02em; }
    .sub-title { font-size:11px;color:${accentColor};margin-top:6px;letter-spacing:0.1em;font-style:italic; }
    .body-content { padding:28px 48px; }
    .footer { background:${footerBgColor}; }
    </style></head><body><div class="page">
    <div class="header">
      ${logoL ? logoImg(logoL, 56) : ''}
      <div>
        <div class="big-title">${design.headerTitle || ''}</div>
        ${design.headerSubtitle ? `<div class="sub-title">${design.headerSubtitle}</div>` : ''}
      </div>
    </div>
    <div style="height:2px;background:${accentColor};margin:0 48px;"></div>
    <div class="body-content">${bodyContent}</div>
    <div class="footer">${footerItems}</div>
    </div></body></html>`;
  }

  // 13. WAVE — geschwungene Linie zwischen Header und Body
  if (tpl === 'wave') {
    const logoL = getLogo('left'); const logoR = getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .header { background:${design.headerBgColor};padding:24px 32px 0;display:flex;align-items:center;justify-content:space-between;gap:16px; }
    .header-title h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||20}px;color:${design.headerTitleColor||'#fff'};font-weight:700;text-align:center; }
    .header-title p { color:rgba(255,255,255,0.7);font-size:11px;margin-top:3px;font-style:italic;text-align:center; }
    .wave-svg { display:block;width:100%;margin-top:-1px; }
    .body-content { padding:16px 40px 40px; }
    .footer { background:${footerBgColor}; }
    </style></head><body><div class="page">
    <div class="header">
      ${logoL ? logoImg(logoL, 52) : ''}
      <div class="header-title" style="flex:1;">
        <h1>${design.headerTitle || ''}</h1>
        ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
      </div>
      ${logoR ? logoImg(logoR, 52) : ''}
    </div>
    <svg class="wave-svg" viewBox="0 0 700 40" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <path d="M0,0 L700,0 L700,15 Q525,40 350,20 Q175,0 0,25 Z" fill="${design.headerBgColor}"/>
      <path d="M0,28 Q175,8 350,28 Q525,48 700,22 L700,32 Q525,52 350,32 Q175,12 0,38 Z" fill="${accentColor}" opacity="0.6"/>
    </svg>
    <div class="body-content">${bodyContent}</div>
    <div class="footer">${footerItems}</div>
    </div></body></html>`;
  }

  // 14. OVERLAP — Logo-Kreis überlappt Header und Body
  if (tpl === 'overlap') {
    const logoL = getLogo('left') || getLogo('center') || getLogo('right');
    const logoR = getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .header { background:${design.headerBgColor};padding:24px 32px 48px;display:flex;align-items:center;justify-content:space-between;gap:16px; }
    .header-title h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||20}px;color:${design.headerTitleColor||'#fff'};font-weight:700;text-align:center; }
    .header-title p { color:rgba(255,255,255,0.7);font-size:11px;margin-top:4px;font-style:italic;text-align:center; }
    .overlap-row { display:flex;justify-content:center;margin-top:-40px;margin-bottom:12px;gap:16px;position:relative;z-index:2; }
    .overlap-circle { width:80px;height:80px;border-radius:50%;background:#fff;border:4px solid ${accentColor};box-shadow:0 4px 20px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;overflow:hidden; }
    .body-content { padding:8px 40px 40px; }
    .footer { background:${footerBgColor}; }
    </style></head><body><div class="page">
    <div class="header">
      <div style="width:52px;"></div>
      <div class="header-title" style="flex:1;">
        <h1>${design.headerTitle || ''}</h1>
        ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
      </div>
      ${logoR ? logoImg(logoR, 52) : '<div style="width:52px;"></div>'}
    </div>
    <div class="overlap-row">
      <div class="overlap-circle">${logoL ? `<img src="${absUrl(logoL)}" style="width:64px;height:64px;object-fit:contain;" alt="">` : ''}</div>
    </div>
    <div style="height:2px;background:${accentColor};margin:0 40px 20px;"></div>
    <div class="body-content">${bodyContent}</div>
    <div class="footer">${footerItems}</div>
    </div></body></html>`;
  }

  // 15. DUO — zwei Farbblöcke nebeneinander im Header
  if (tpl === 'duo') {
    const logoL = getLogo('left'); const logoR = getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .header { display:flex;height:90px; }
    .duo-left { background:${design.headerBgColor};flex:1;display:flex;align-items:center;justify-content:center;padding:16px; }
    .duo-right { background:${accentColor};width:120px;display:flex;align-items:center;justify-content:center;padding:16px; }
    .header-title h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||18}px;color:${design.headerTitleColor||'#fff'};font-weight:700;text-align:left; }
    .header-title p { color:rgba(255,255,255,0.7);font-size:10px;margin-top:3px;font-style:italic; }
    .body-content { padding:28px 40px; }
    .footer { background:${footerBgColor}; }
    </style></head><body><div class="page">
    <div class="header">
      <div class="duo-left">
        <div style="display:flex;align-items:center;gap:16px;width:100%;">
          ${logoL ? logoImg(logoL, 52) : ''}
          <div class="header-title">
            <h1>${design.headerTitle || ''}</h1>
            ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
          </div>
        </div>
      </div>
      <div class="duo-right">${logoR ? logoImg(logoR, 56) : ''}</div>
    </div>
    <div style="height:3px;background:${design.headerBgColor};"></div>
    <div class="body-content">${bodyContent}</div>
    <div class="footer">${footerItems}</div>
    </div></body></html>`;
  }

  // 16. ARCH — Header mit Bogen-Ausschnitt unten
  if (tpl === 'arch') {
    const logoL = getLogo('left'); const logoR = getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .header-wrap { position:relative;margin-bottom:8px; }
    .header-bg { background:${design.headerBgColor};padding:24px 32px 56px;display:flex;align-items:center;justify-content:space-between;gap:16px; }
    .header-title h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||20}px;color:${design.headerTitleColor||'#fff'};font-weight:700;text-align:center; }
    .header-title p { color:rgba(255,255,255,0.7);font-size:11px;margin-top:4px;font-style:italic;text-align:center; }
    .arch-svg { display:block;width:100%;margin-top:-1px; }
    .body-content { padding:16px 40px 40px; }
    .footer { background:${footerBgColor}; }
    </style></head><body><div class="page">
    <div class="header-wrap">
      <div class="header-bg">
        ${logoL ? logoImg(logoL, 52) : ''}
        <div class="header-title" style="flex:1;">
          <h1>${design.headerTitle || ''}</h1>
          ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
        </div>
        ${logoR ? logoImg(logoR, 52) : ''}
      </div>
      <svg class="arch-svg" viewBox="0 0 700 40" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <path d="M0,0 L700,0 Q350,80 0,0 Z" fill="${design.headerBgColor}"/>
        <path d="M0,0 Q350,60 700,0" fill="none" stroke="${accentColor}" stroke-width="3"/>
      </svg>
    </div>
    <div class="body-content">${bodyContent}</div>
    <div class="footer">${footerItems}</div>
    </div></body></html>`;
  }

  // 17. SIDEBAR-RIGHT — schmale Leiste rechts
  if (tpl === 'sidebar-right') {
    const logoR = getLogo('right') || getLogo('center') || getLogo('left');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .page { display:flex;min-height:297mm; }
    .main { flex:1;display:flex;flex-direction:column; }
    .main-header { padding:24px 32px 16px;border-bottom:0.5px solid #efefef;border-top:4px solid ${accentColor};display:flex;justify-content:space-between;align-items:flex-end; }
    .main-title h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||18}px;color:${design.headerBgColor};font-weight:700; }
    .main-title p { font-size:10px;color:#999;margin-top:2px; }
    .body-content { padding:28px 32px;flex:1; }
    .sidebar-r { width:72px;background:${design.headerBgColor};display:flex;flex-direction:column;align-items:center;padding:28px 0;gap:16px;flex-shrink:0; }
    .sidebar-r-title { writing-mode:vertical-rl;font-family:'${fontFamily}',serif;font-size:11px;color:${design.headerTitleColor||'#fff'};letter-spacing:0.1em;font-weight:600; }
    .sidebar-r-accent { width:3px;height:40px;background:${accentColor};border-radius:2px;margin-top:8px; }
    .footer { background:${footerBgColor}; }
    </style></head><body><div class="page">
    <div class="main">
      <div class="main-header">
        <div class="main-title">
          <h1>${design.headerTitle || ''}</h1>
          ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
        </div>
        <div style="font-size:10px;color:#999;">${date}</div>
      </div>
      <div class="body-content">${bodyContent}</div>
      <div class="footer">${footerItems}</div>
    </div>
    <div class="sidebar-r">
      ${logoR ? logoCircle(logoR, 48) : ''}
      <div class="sidebar-r-accent"></div>
      <div class="sidebar-r-title">${design.senderCity || ''}</div>
    </div>
    </div></body></html>`;
  }

  // 18. FOOTER-HEAVY — minimaler Header, reicher Footer
  if (tpl === 'footer-heavy') {
    const logoL = getLogo('left') || getLogo('center') || getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .header { padding:24px 48px;display:flex;align-items:center;gap:16px;border-bottom:2px solid ${design.headerBgColor}; }
    .header h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||17}px;color:${design.headerBgColor};font-weight:700; }
    .header p { font-size:10px;color:#888;margin-top:2px; }
    .accent-dot-row { display:flex;gap:6px;padding:0 48px;margin-bottom:16px;margin-top:8px; }
    .adot { width:8px;height:8px;border-radius:50%;background:${accentColor}; }
    .adot2 { width:8px;height:8px;border-radius:50%;background:${accentColor};opacity:0.4; }
    .body-content { padding:8px 48px 32px; }
    .rich-footer { background:${design.headerBgColor};padding:24px 48px; }
    .rich-footer h3 { font-family:'${fontFamily}',serif;font-size:14px;color:${design.headerTitleColor||'#fff'};font-weight:600;margin-bottom:12px; }
    .rich-footer-grid { display:flex;gap:32px;flex-wrap:wrap; }
    .rich-footer-item { font-size:10px;color:rgba(255,255,255,0.75);line-height:1.8; }
    .rich-footer-item span { display:block;color:rgba(255,255,255,0.45);font-size:9px;letter-spacing:0.05em;margin-bottom:2px; }
    </style></head><body><div class="page">
    <div class="header">
      ${logoL ? logoImg(logoL, 44) : ''}
      <div>
        <h1>${design.headerTitle || ''}</h1>
        ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
      </div>
    </div>
    <div class="accent-dot-row"><div class="adot"></div><div class="adot2"></div><div class="adot2" style="opacity:0.2;"></div></div>
    <div class="body-content">${bodyContent}</div>
    <div class="rich-footer">
      <h3>${design.senderName || ''}</h3>
      <div class="rich-footer-grid">
        ${design.senderAddress ? `<div class="rich-footer-item"><span>Adresse</span>${design.senderAddress}</div>` : ''}
        ${design.senderPhone ? `<div class="rich-footer-item"><span>Telefon</span>${design.senderPhone}</div>` : ''}
        ${design.senderEmail ? `<div class="rich-footer-item"><span>Email</span>${design.senderEmail}</div>` : ''}
        ${design.senderWebsite ? `<div class="rich-footer-item"><span>Web</span>${design.senderWebsite}</div>` : ''}
      </div>
    </div>
    </div></body></html>`;
  }

  // 19. GEOMETRIC — geometrische Formen im Hintergrund
  if (tpl === 'geometric') {
    const logoL = getLogo('left'); const logoR = getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .header { background:${design.headerBgColor};padding:24px 32px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;gap:16px; }
    .geo-circle1 { position:absolute;top:-30px;right:80px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,0.06);pointer-events:none; }
    .geo-circle2 { position:absolute;bottom:-40px;right:20px;width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,0.04);pointer-events:none; }
    .geo-rect { position:absolute;top:10px;left:180px;width:60px;height:60px;background:rgba(255,255,255,0.05);transform:rotate(30deg);pointer-events:none; }
    .header-title h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||20}px;color:${design.headerTitleColor||'#fff'};font-weight:700;text-align:center;position:relative;z-index:1; }
    .header-title p { color:rgba(255,255,255,0.7);font-size:11px;margin-top:4px;font-style:italic;text-align:center;position:relative;z-index:1; }
    .accent-line { height:4px;background:${accentColor}; }
    .body-content { padding:28px 40px;position:relative; }
    .body-geo { position:absolute;bottom:20px;right:20px;width:80px;height:80px;border-radius:50%;background:${accentColor};opacity:0.04;pointer-events:none; }
    .footer { background:${footerBgColor}; }
    </style></head><body><div class="page">
    <div class="header">
      <div class="geo-circle1"></div>
      <div class="geo-circle2"></div>
      <div class="geo-rect"></div>
      ${logoL ? `<div style="position:relative;z-index:1;">${logoImg(logoL, 52)}</div>` : ''}
      <div class="header-title" style="flex:1;">
        <h1>${design.headerTitle || ''}</h1>
        ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
      </div>
      ${logoR ? `<div style="position:relative;z-index:1;">${logoImg(logoR, 52)}</div>` : ''}
    </div>
    <div class="accent-line"></div>
    <div class="body-content">
      <div class="body-geo"></div>
      ${bodyContent}
    </div>
    <div class="footer">${footerItems}</div>
    </div></body></html>`;
  }

  // 20. RIBBON — schmales Farbband diagonal über die Ecke
  if (tpl === 'ribbon') {
    const logoL = getLogo('left'); const logoR = getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .header { background:${design.headerBgColor};padding:24px 32px;display:flex;align-items:center;justify-content:space-between;gap:16px;position:relative;overflow:hidden; }
    .ribbon-stripe { position:absolute;top:0;left:0;right:0;height:6px;background:${accentColor}; }
    .ribbon-stripe2 { position:absolute;top:6px;left:0;right:0;height:2px;background:${accentColor};opacity:0.4; }
    .header-title h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||20}px;color:${design.headerTitleColor||'#fff'};font-weight:700;text-align:center;position:relative;z-index:1; }
    .header-title p { color:rgba(255,255,255,0.7);font-size:11px;margin-top:4px;font-style:italic;text-align:center;position:relative;z-index:1; }
    .body-content { padding:28px 40px; }
    .footer { background:${footerBgColor};position:relative;overflow:hidden; }
    .footer-ribbon { position:absolute;bottom:0;left:0;right:0;height:4px;background:${accentColor}; }
    </style></head><body><div class="page">
    <div class="header">
      <div class="ribbon-stripe"></div>
      <div class="ribbon-stripe2"></div>
      ${logoL ? `<div style="position:relative;z-index:1;">${logoImg(logoL, 52)}</div>` : ''}
      <div class="header-title" style="flex:1;">
        <h1>${design.headerTitle || ''}</h1>
        ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
      </div>
      ${logoR ? `<div style="position:relative;z-index:1;">${logoImg(logoR, 52)}</div>` : ''}
    </div>
    <div style="height:3px;background:${accentColor};opacity:0.3;"></div>
    <div class="body-content">${bodyContent}</div>
    <div class="footer">
      ${footerItems}
      <div class="footer-ribbon"></div>
    </div>
    </div></body></html>`;
  }

  // Fallback → classic
  return generateLetterHtml({ ...params, design: { ...design, template: 'classic' } });
}



// ── Design ────────────────────────────────────────────────────────────────────

// Alle Designs laden (System + Eigene getrennt)
router.get('/designs', requirePermission('schriftverkehr','VIEW'), async (req, res) => {
  try {
    const designType = req.query.type as string | undefined;
    // Eigene Designs aus DB
    const whereClause = designType ? { designType } : {};
    const userDesigns = await (prisma as any).letterDesign.findMany({ where: whereClause, orderBy: { name: 'asc' } });

    // System-Designs als virtuelle Objekte
    const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
    const appName = settings?.appName || 'Freiwillige Feuerwehr';

    const systemDesigns = Object.entries(SYSTEM_DESIGNS).map(([key, d]) => ({
      ...d,
      id: `system:${key}`,
      headerTitle: d.headerTitle || appName,
      senderName: appName,
      isSystem: true,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }));

    res.json({ systemDesigns, userDesigns });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Einzelnes Design laden (für Abwärtskompatibilität)
router.get('/design', requirePermission('schriftverkehr','VIEW'), async (_req, res) => {
  try {
    let design = await (prisma as any).letterDesign.findFirst({ orderBy: { name: 'asc' } });
    if (!design) {
      const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
      design = await (prisma as any).letterDesign.create({ data: {
        name: 'Standard',
        headerTitle: settings?.appName || 'Freiwillige Feuerwehr',
        headerBgColor: '#1a2744',
        headerTitleColor: '#f5e6d0',
        accentColor: '#c8a96e',
        fontFamily: 'Playfair Display',
        fontSize: 12,
        signerPosition: 'right',
        senderName: settings?.appName || '',
      }});
    }
    res.json(design);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/design/:id', requirePermission('schriftverkehr', 'EDIT'), async (req, res) => {
  try {
    const { id: _, createdAt, updatedAt, ...data } = req.body;
    const design = await (prisma as any).letterDesign.update({ where: { id: req.params.id }, data });
    res.json(design);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Neues Design erstellen
router.post('/designs', requirePermission('schriftverkehr', 'EDIT'), async (req, res) => {
  try {
    const design = await (prisma as any).letterDesign.create({ data: req.body });
    res.json(design);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Design löschen
router.delete('/designs/:id', requirePermission('schriftverkehr', 'EDIT'), async (req, res) => {
  try {
    const count = await (prisma as any).letterDesign.count();
    if (count <= 1) { res.status(400).json({ error: 'Mindestens ein Design muss vorhanden bleiben' }); return; }
    await (prisma as any).letterDesign.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Upload: Header-Hintergrundbild
router.post('/design/header-bg', requirePermission('schriftverkehr', 'EDIT'), letterUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Kein Bild' }); return; }
    const url = `/uploads/letter/${req.file.filename}`;
    let design = await (prisma as any).letterDesign.findFirst();
    if (design) await (prisma as any).letterDesign.update({ where: { id: design.id }, data: { headerBgImage: url } });
    else await (prisma as any).letterDesign.create({ data: { headerBgImage: url } });
    res.json({ url });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Upload: Body-Hintergrundbild
router.post('/design/body-bg', requirePermission('schriftverkehr', 'EDIT'), letterUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Kein Bild' }); return; }
    const url = `/uploads/letter/${req.file.filename}`;
    let design = await (prisma as any).letterDesign.findFirst();
    if (design) await (prisma as any).letterDesign.update({ where: { id: design.id }, data: { bodyBgImage: url } });
    else await (prisma as any).letterDesign.create({ data: { bodyBgImage: url } });
    res.json({ url });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Upload: Logos
router.post('/designs/:id/upload-image', requirePermission('schriftverkehr', 'EDIT'), letterUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Kein Bild' }); return; }
    const { field } = req.body;
    const url = `/uploads/letter/${req.file.filename}`;
    await (prisma as any).letterDesign.update({ where: { id: req.params.id }, data: { [field]: url } });
    res.json({ url });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/design/logo/:position', requirePermission('schriftverkehr', 'EDIT'), letterUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Kein Bild' }); return; }
    const pos = req.params.position; // left, right, center
    const field = pos === 'left' ? 'headerLogoLeft' : pos === 'right' ? 'headerLogoRight' : 'headerLogoCenter';
    const url = `/uploads/letter/${req.file.filename}`;
    let design = await (prisma as any).letterDesign.findFirst();
    if (design) await (prisma as any).letterDesign.update({ where: { id: design.id }, data: { [field]: url } });
    else await (prisma as any).letterDesign.create({ data: { [field]: url } });
    res.json({ url });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Vorlagen ──────────────────────────────────────────────────────────────────

router.get('/templates', requirePermission('schriftverkehr', 'VIEW'), async (_req, res) => {
  try {
    const templates = await (prisma as any).letterTemplate.findMany({ orderBy: { updatedAt: 'desc' } });
    res.json(templates);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/templates', requirePermission('schriftverkehr', 'CREATE'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const template = await (prisma as any).letterTemplate.create({ data: { ...req.body, createdBy: userId } });
    res.json(template);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/templates/:id', requirePermission('schriftverkehr', 'CREATE'), async (req, res) => {
  try {
    const { id } = req.params;
    const { createdBy, createdAt, updatedAt, id: _, ...data } = req.body;
    const template = await (prisma as any).letterTemplate.update({ where: { id }, data });
    res.json(template);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/templates/:id', requirePermission('schriftverkehr', 'CREATE'), async (req, res) => {
  try {
    await (prisma as any).letterTemplate.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Ansprechpartner ───────────────────────────────────────────────────────────

router.get('/contacts', requirePermission('schriftverkehr', 'VIEW'), async (_req, res) => {
  try {
    const contacts = await (prisma as any).letterContact.findMany({ orderBy: { name: 'asc' } });
    res.json(contacts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/contacts', requirePermission('schriftverkehr', 'CREATE'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const contact = await (prisma as any).letterContact.create({ data: { ...req.body, createdBy: userId } });
    res.json(contact);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/contacts/:id', requirePermission('schriftverkehr', 'CREATE'), async (req, res) => {
  try {
    const { id: _, createdBy, createdAt, updatedAt, ...data } = req.body;
    const contact = await (prisma as any).letterContact.update({ where: { id: req.params.id }, data });
    res.json(contact);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/contacts/:id', requirePermission('schriftverkehr', 'CREATE'), async (req, res) => {
  try {
    await (prisma as any).letterContact.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Unterschrift ──────────────────────────────────────────────────────────────

// Eigene Unterschrift hochladen
router.post('/signature', requirePermission('schriftverkehr', 'CREATE'), letterUpload.single('signature'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!req.file) { res.status(400).json({ error: 'Keine Datei' }); return; }
    const base64 = fs.readFileSync(req.file.path).toString('base64');
    const mimeType = req.file.mimetype || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64}`;
    const encrypted = encryptSignature(dataUrl);
    // Temporäre Datei löschen
    fs.unlinkSync(req.file.path);
    await prisma.user.update({ where: { id: userId }, data: { signatureImage: encrypted, signatureEnabled: true } as any });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Eigene Unterschrift abrufen
router.get('/signature/me', requirePermission('schriftverkehr', 'CREATE'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } }) as any;
    if (!user?.signatureImage) { res.json({ hasSignature: false }); return; }
    const decrypted = decryptSignature(user.signatureImage);
    res.json({ hasSignature: true, dataUrl: decrypted });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Eigene Unterschrift löschen
router.delete('/signature/me', requirePermission('schriftverkehr', 'CREATE'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    await prisma.user.update({ where: { id: userId }, data: { signatureImage: null, signatureEnabled: false } as any });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Alle Unterzeichner mit Berechtigung und Unterschrift abrufen
router.get('/signers', requirePermission('schriftverkehr', 'CREATE'), async (_req, res) => {
  try {
    // Alle User mit schriftverkehr.SEND Berechtigung und Unterschrift
    const users = await prisma.user.findMany({
      where: { isActive: true, signatureEnabled: true } as any,
      include: { member: { select: { firstName: true, lastName: true, rank: true } } },
    }) as any[];
    // Nur User mit Berechtigung zurückgeben (ohne Unterschrift-Daten)
    const signers = users
      .filter((u: any) => u.signatureEnabled && u.signatureImage)
      .map((u: any) => ({
        userId: u.id,
        name: u.member ? `${u.member.firstName} ${u.member.lastName}` : u.email,
        function: u.member?.rank || '',
        hasSignature: true,
      }));
    res.json(signers);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Mitglieder-Empfängerliste ─────────────────────────────────────────────────

router.get('/recipients/members', requirePermission('schriftverkehr', 'VIEW'), async (_req, res) => {
  try {
    const members = await (prisma as any).member.findMany({
      select: {
        id: true, firstName: true, lastName: true,
        email: true, status: true, rank: true,
        user: { select: { id: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    // userId hinzufügen damit Verteiler-Zuordnung funktioniert
    res.json(members.map((m: any) => ({ ...m, userId: m.user?.id || null })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── KI-Brief-Generierung (SSE Streaming) ─────────────────────────────────────

router.post('/generate/stream', requirePermission('schriftverkehr', 'CREATE'), async (req: Request, res: Response) => {
  const { prompt, recipientName, subject, currentText, instruction } = req.body;

  // KI-Provider laden (gleiche Funktion wie im Jahresbericht)
  let provider = 'ollama', apiKey = '', ollamaUrl = 'http://localhost:11434', ollamaModel = 'gemma2:2b';
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma2 = new PrismaClient();
    const settings = await prisma2.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
    await prisma2.$disconnect();
    provider = settings?.activeAiProvider || 'gemini';
    apiKey = provider === 'gemini' ? (decryptSecret(settings?.geminiApiKey) || env.GEMINI_API_KEY || '')
           : provider === 'groq'   ? (decryptSecret(settings?.groqApiKey)   || env.GROQ_API_KEY   || '')
           : provider === 'openai' ? (decryptSecret(settings?.openaiApiKey) || '')
           : (settings?.ollamaUrl || 'http://localhost:11434');
    ollamaUrl  = settings?.ollamaUrl   || 'http://localhost:11434';
    ollamaModel = settings?.ollamaModel || 'gemma2:2b';
  } catch {}

  if (provider !== 'ollama' && !apiKey) {
    res.status(503).json({ error: 'Kein KI-Anbieter konfiguriert' }); return;
  }

  // SSE Setup
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sseSend = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    (res as any).flush?.();
  };

  let aborted = false;
  req.on('close', () => { aborted = true; });

  const isPartial = !!(currentText && instruction);

  const systemPrompt = 'Du bist ein erfahrener österreichischer Feuerwehr-Schriftführer. ' +
    'Schreibe professionelle, elegante Briefe für Freiwillige Feuerwehren in Österreich. ' +
    'Korrekte deutsche Umlaute (ä, ö, ü, ß). KEINE Markdown-Formatierung, KEINE Sternchen, nur reinen Fließtext.';

  let userPrompt: string;
  if (isPartial) {
    userPrompt = `Überarbeite diesen Brieftext: ANWEISUNG: ${instruction}. AKTUELLER TEXT: ${currentText}. ` +
      'Antworte NUR mit dem überarbeiteten Text, ohne Überschrift.';
  } else {
    const recipientHint = recipientName ? `Der Empfänger ist: ${recipientName}.` : '';
    const subjectHint = subject ? `Betreff: ${subject}.` : '';
    userPrompt = `Schreibe einen professionellen Feuerwehr-Brief. ${recipientHint} ${subjectHint} ` +
      `Inhalt: ${prompt}. ` +
      'Antworte mit JSON in diesem Format (kein Markdown, kein ```json): ' +
      '{"subject":"...","salutation":"...","body":"..."}. ' +
      'subject: präziser Betreff. salutation: passende Anrede. body: vollständiger Brieftext als reiner Fließtext.';
  }

  let fullText = '';

  try {
    if (provider === 'ollama') {
      const http = require('http');
      const ollamaPayload = JSON.stringify({
        model: ollamaModel,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        stream: true,
        options: { num_predict: 800, temperature: 0.7 },
      });

      await new Promise<void>((resolve) => {
        const url = new URL(ollamaUrl.replace(/\/$/, '') + '/api/chat');
        const ollamaReq = require('http').request({
          hostname: url.hostname, port: url.port || 11434,
          path: url.pathname, method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(ollamaPayload) },
        }, (ollamaResp: any) => {
          let lineBuf = '';
          ollamaResp.on('data', (chunk: Buffer) => {
            if (aborted) return;
            lineBuf += chunk.toString('utf8');
            const lines = lineBuf.split('\n');
            lineBuf = lines.pop() || '';
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const parsed = JSON.parse(line);
                const token = parsed.message?.content || '';
                if (token) { fullText += token; sseSend('token', { text: token }); }
              } catch {}
            }
          });
          ollamaResp.on('end', resolve);
          ollamaResp.on('error', resolve);
        });
        ollamaReq.on('error', resolve);
        ollamaReq.setTimeout(5 * 60 * 1000, () => { ollamaReq.destroy(); resolve(); });
        ollamaReq.write(ollamaPayload);
        ollamaReq.end();
      });

    } else if (provider === 'gemini') {
      const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:streamGenerateContent?alt=sse&key=' + apiKey;
      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }], generationConfig: { maxOutputTokens: 800, temperature: 0.7 } }),
      });
      if (geminiRes.ok && geminiRes.body) {
        const reader = geminiRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          if (aborted) break;
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n'); buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const token = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (token) { fullText += token; sseSend('token', { text: token }); }
            } catch {}
          }
        }
        reader.releaseLock();
      }
    } else {
      // Groq / OpenAI
      const url = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
      const model = provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';
      const apiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], max_tokens: 800, temperature: 0.7, stream: true, stream_options: { include_usage: true } }),
      });
      if (apiRes.ok && apiRes.body) {
        const reader = apiRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          if (aborted) break;
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n'); buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const token = parsed.choices?.[0]?.delta?.content || '';
              if (token) { fullText += token; sseSend('token', { text: token }); }
            } catch {}
          }
        }
        reader.releaseLock();
      }
    }
  } catch (e: any) {
    sseSend('error', { message: e?.message || 'Fehler' });
  }

  // Finales Ergebnis senden
  if (isPartial) {
    sseSend('result', { body: fullText.trim() });
  } else {
    // JSON parsen
    try {
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      if (parsed?.body) {
        sseSend('result', { subject: parsed.subject || '', salutation: parsed.salutation || '', body: parsed.body || '' });
      } else {
        sseSend('result', { body: fullText.trim() });
      }
    } catch {
      sseSend('result', { body: fullText.trim() });
    }
  }

  res.write('event: done\ndata: {}\n\n');
  (res as any).flush?.();
  res.end();
});

// ── Versenden ─────────────────────────────────────────────────────────────────

router.post('/send', requirePermission('schriftverkehr', 'CREATE'), (req: Request, res: any, next: any) => {
  sendAttachmentUpload(req, res, (err: any) => { if (err) return res.status(400).json({ error: err.message }); next(); });
}, async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { member: { select: { firstName: true, lastName: true } } },
    }) as any;
    const sentByName = user?.member
      ? `${user.member.firstName} ${user.member.lastName}`
      : user?.email || 'Unbekannt';

    const {
      subject, salutation, body, closing,
      recipients, // [{name, email, address}]
      signerUserIds, // [userId, ...]
      sendMode, // pdf | html | html_pdf
      templateId,
      recipientName, recipientAddress,
      companionText,
      date,
    } = req.body;

    // Design laden (designId optional, sonst erstes Design)
    const { designId } = req.body;
    const designSnapshot = req.body.designSnapshot ? (typeof req.body.designSnapshot === 'string' && req.body.designSnapshot !== '' ? (() => { try { return JSON.parse(req.body.designSnapshot); } catch { return null; } })() : req.body.designSnapshot) : null;
    let design = designSnapshot || (designId
      ? await (prisma as any).letterDesign.findUnique({ where: { id: designId } })
      : await (prisma as any).letterDesign.findFirst({ orderBy: { name: 'asc' } }));
    if (!design) design = { headerBgColor: '#1a2744', headerTitle: '', headerTitleColor: '#f5e6d0', fontFamily: 'Playfair Display', fontSize: 12, accentColor: '#c8a96e', signerPosition: 'right' };

    // Unterzeichner mit Unterschriften laden
    const parsedSignerIds: string[] = typeof signerUserIds === 'string' ? (() => { try { return JSON.parse(signerUserIds); } catch { return []; } })() : (signerUserIds || []);
    const signers: { name: string; function: string; signatureBase64?: string }[] = [];
    if (parsedSignerIds?.length) {
      for (const sid of parsedSignerIds) {
        const signer = await prisma.user.findUnique({
          where: { id: sid },
          include: { member: { select: { firstName: true, lastName: true, rank: true } } },
        }) as any;
        if (!signer) continue;
        let signatureBase64: string | undefined;
        if (signer.signatureImage) {
          try { signatureBase64 = decryptSignature(signer.signatureImage); } catch {}
        }
        signers.push({
          name: signer.member ? `${signer.member.firstName} ${signer.member.lastName}` : signer.email,
          function: signer.member?.rank || '',
          signatureBase64,
        });
      }
    }

    // HTML generieren
    const htmlContent = generateLetterHtml({
      design,
      subject, salutation, body, closing,
      recipientName: recipientName || (recipients?.[0]?.name || ''),
      recipientAddress: recipientAddress || '',
      date: date || new Date().toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' }),
      signers,
    });

    // PDF generieren wenn nötig
    let pdfBuffer: Buffer | null = null;
    if (sendMode === 'pdf' || sendMode === 'html_pdf') {
      const htmlForPdf = await inlineImages(htmlContent);
      const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(htmlForPdf, { waitUntil: 'domcontentloaded' });
      pdfBuffer = Buffer.from(await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '10mm', left: '0' } }));
      await browser.close();
    }

    // SMTP-Transporter
    const transporter = await getTransporter();
    const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
    const fromEmail = settings?.smtpFrom || settings?.smtpUser || 'noreply@feuerwehr.at';
    const fromName  = design.senderName || settings?.appName || 'Feuerwehr';

    // HTML-Email mit CID-Attachments vorbereiten (Bilder korrekt eingebettet)
    const { html: htmlWithCidRaw, attachments: cidAttachments } = buildCidHtml(htmlContent);
    const htmlWithCid = htmlWithCidRaw.replace(/mix-blend-mode:\s*multiply;?/g, '');

    const recipientList: { name: string; email: string }[] = typeof recipients === 'string' ? JSON.parse(recipients) : (recipients || []);
    let failedCount = 0;
    const errors: string[] = [];

    for (const rec of recipientList) {
      if (!rec.email) continue;
      try {
        const mailOptions: any = {
          from: `"${fromName}" <${fromEmail}>`,
          to: `"${rec.name}" <${rec.email}>`,
          subject,
          text: body,
        };

        if (sendMode === 'html' || sendMode === 'html_pdf') {
          const htmlWithCompanion = companionText
            ? `<div style="font-family:Arial,sans-serif;font-size:13px;color:#333;padding:16px 24px;border-bottom:2px solid #e5e7eb;margin-bottom:0;background:#f9fafb;">${companionText.replace(/\n/g, '<br>')}</div>${htmlWithCid}`
            : htmlWithCid;
          mailOptions.html = htmlWithCompanion;
          mailOptions.attachments = [...cidAttachments];
        }
        if (pdfBuffer) {
          const pdfAttachment = {
            filename: `${subject.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          };
          mailOptions.attachments = [...(mailOptions.attachments || []), pdfAttachment];
        }
        if (companionText) {
          mailOptions.text = companionText + '\n\n' + body;
        }

        // Extra-Anhänge (hochgeladene Dateien)
        const uploadedFiles = (req as any).files as Express.Multer.File[] || [];
        if (uploadedFiles.length > 0) {
          const extraAttachments = uploadedFiles.map((f: Express.Multer.File) => ({
            filename: f.originalname,
            content: f.buffer,
            contentType: f.mimetype,
          }));
          mailOptions.attachments = [...(mailOptions.attachments || []), ...extraAttachments];
        }

        await transporter.sendMail(mailOptions);
      } catch (mailErr: any) {
        failedCount++;
        errors.push(`${rec.email}: ${mailErr?.message || 'Unbekannter Fehler'}`);
      }
    }

    // Versandhistorie speichern
    await (prisma as any).letterSent.create({ data: {
      sentBy: userId,
      sentByName,
      recipients: JSON.stringify(recipientList),
      subject, salutation, body, closing,
      signers: JSON.stringify(signers.map(s => ({ name: s.name, function: s.function, signatureBase64: s.signatureBase64 }))),
      sendMode,
      templateId: templateId || null,
      status: failedCount === recipientList.length ? 'failed' : failedCount > 0 ? 'partial' : 'sent',
      designSnapshot: JSON.stringify(design),
    }});

    res.json({
      ok: failedCount < recipientList.length,
      sent: recipientList.length - failedCount,
      failed: failedCount,
      errors: errors.length ? errors : undefined,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── HTML Vorschau (für Live-Vorschau im Browser) ─────────────────────────────

router.post('/preview-html', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const { subject, salutation, body, closing, recipientName, recipientAddress, signerUserIds, date, designSnapshot } = req.body;

    // Design aus Snapshot (für Live-Vorschau mit aktuellen Einstellungen) oder aus DB
    let design = designSnapshot ? designSnapshot : null;
    if (!design) {
      const { designId } = req.body;
      design = designId
        ? await (prisma as any).letterDesign.findUnique({ where: { id: designId } })
        : await (prisma as any).letterDesign.findFirst({ orderBy: { name: 'asc' } });
    }
    if (!design) design = { headerBgColor: '#1a2744', headerTitle: '', headerTitleColor: '#f5e6d0', fontFamily: 'Arial', fontSize: 12, accentColor: '#c8a96e', signerPosition: 'right', template: 'classic' };

    const signers: { name: string; function: string; signatureBase64?: string }[] = [];
    if (signerUserIds?.length) {
      for (const sid of signerUserIds) {
        const signer = await prisma.user.findUnique({
          where: { id: sid },
          include: { member: { select: { firstName: true, lastName: true, rank: true } } },
        }) as any;
        if (!signer) continue;
        let signatureBase64: string | undefined;
        if (signer.signatureImage) {
          try { signatureBase64 = decryptSignature(signer.signatureImage); } catch {}
        }
        signers.push({
          name: signer.member ? `${signer.member.firstName} ${signer.member.lastName}` : signer.email,
          function: signer.member?.rank || '',
          signatureBase64,
        });
      }
    }

    const htmlContent = generateLetterHtml({
      design,
      subject: subject || '',
      salutation: salutation || '',
      body: body || '',
      closing: closing || '',
      recipientName: recipientName || '',
      recipientAddress: recipientAddress || '',
      date: date || new Date().toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' }),
      signers,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlContent);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── PDF Vorschau ──────────────────────────────────────────────────────────────

router.post('/preview-pdf', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { subject, salutation, body, closing, recipientName, recipientAddress, signerUserIds, date } = req.body;

    let design = await (prisma as any).letterDesign.findFirst();
    if (!design) design = { headerBgColor: '#8B1A1A', headerTitle: '', headerTitleColor: '#ffffff', fontFamily: 'Arial', fontSize: 12 };

    const signers: { name: string; function: string; signatureBase64?: string }[] = [];
    if (signerUserIds?.length) {
      for (const sid of signerUserIds) {
        const signer = await prisma.user.findUnique({
          where: { id: sid },
          include: { member: { select: { firstName: true, lastName: true, rank: true } } },
        }) as any;
        if (!signer) continue;
        let signatureBase64: string | undefined;
        if (signer.signatureImage) {
          try { signatureBase64 = decryptSignature(signer.signatureImage); } catch {}
        }
        signers.push({
          name: signer.member ? `${signer.member.firstName} ${signer.member.lastName}` : signer.email,
          function: signer.member?.rank || '',
          signatureBase64,
        });
      }
    }

    const htmlContent = generateLetterHtml({
      design, subject, salutation, body, closing,
      recipientName: recipientName || '',
      recipientAddress: recipientAddress || '',
      date: date || new Date().toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' }),
      signers,
    });

    const htmlForPdf = await inlineImages(htmlContent);
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlForPdf, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '10mm', left: '0' } });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="vorschau.pdf"');
    res.send(Buffer.from(pdf));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Versandhistorie ───────────────────────────────────────────────────────────

router.get('/history', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const isAdmin = (req as any).user?.role === 'ADMIN';
    // Briefe + Übungspläne + Schulungspläne aus letterSent
    const letterHistory = await (prisma as any).letterSent.findMany({
      where: isAdmin ? {} : { sentBy: userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { template: { select: { name: true } } },
    });
    // Einladungen aus invitationSent
    const invHistory = await (prisma as any).invitationSent.findMany({
      where: isAdmin ? {} : { sentBy: userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    // Einladungen auf letterSent-Format mappen
    const mappedInv = invHistory.map((h: any) => ({
      ...h,
      type: 'invitation',
      subject: h.eventName || 'Einladung',
      body: '',
      salutation: '',
      template: null,
      templateId: null,
    }));
    // Zusammenführen + nach Datum sortieren
    const combined = [...letterHistory, ...mappedInv]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 200);
    res.json(combined);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/history/:id', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const entry = await (prisma as any).letterSent.findUnique({
      where: { id: req.params.id },
      include: { template: { select: { name: true } } },
    });
    if (!entry) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    if (!isAdmin && entry.sentBy !== userId) { res.status(403).json({ error: 'Kein Zugriff' }); return; }
    res.json(entry);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Vorschau eines historischen Briefes ──────────────────────────────────────

router.get('/history/:id/preview', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const entry = await (prisma as any).letterSent.findUnique({ where: { id: req.params.id } });
    if (!entry) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    if (!isAdmin && entry.sentBy !== userId) { res.status(403).json({ error: 'Kein Zugriff' }); return; }

    // Design aus Snapshot laden (Fallback: erstes vorhandenes Design)
    let design = entry.designSnapshot ? JSON.parse(entry.designSnapshot) : null;
    if (!design) design = await (prisma as any).letterDesign.findFirst();
    if (!design) design = { headerBgColor: '#1a2744', headerTitle: '', headerTitleColor: '#f5e6d0', fontFamily: 'Arial', fontSize: 12, accentColor: '#c8a96e', signerPosition: 'right' };

    const signers = JSON.parse(entry.signers || '[]');
    const recipients = JSON.parse(entry.recipients || '[]');

    const htmlContent = generateLetterHtml({
      design,
      subject: entry.subject,
      salutation: entry.salutation,
      body: entry.body,
      closing: entry.closing,
      recipientName: recipients[0]?.name || '',
      recipientAddress: recipients[0]?.address || '',
      date: new Date(entry.createdAt).toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' }),
      signers: signers.map((s: any) => ({ name: s.name, function: s.function, signatureBase64: s.signatureBase64 })),
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlContent);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Historie löschen ─────────────────────────────────────────────────────────

router.delete('/history/:id', requirePermission('schriftverkehr', 'CREATE'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const entry = await (prisma as any).letterSent.findUnique({ where: { id: req.params.id } });
    if (!entry) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    if (!isAdmin && entry.sentBy !== userId) { res.status(403).json({ error: 'Kein Zugriff' }); return; }
    await (prisma as any).letterSent.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


// ════════════════════════════════════════════════════════════════════════════
// EINLADUNGEN — HTML-Generator + Routes
// ════════════════════════════════════════════════════════════════════════════

function generateInvitationHtml(params: {
  design: any;
  eventName: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  eventProgram: string;
  rsvpDeadline: string;
  directions: string;
  introText: string;
  closing: string;
  recipientName: string;
  recipientAddress: string;
  date: string;
  signers: { name: string; function: string; signatureBase64?: string }[];
}): string {
  const { design, eventName, eventDate, eventTime, eventLocation, eventProgram,
          rsvpDeadline, directions, introText, closing,
          recipientName, recipientAddress, date, signers } = params;

  const accentColor   = design.accentColor   || design.headerBgColor || '#1a2744';
  const footerBgColor = design.footerBgColor || design.headerBgColor || accentColor;
  const fontFamily    = design.fontFamily    || 'Georgia';
  const fontSize      = design.fontSize      || 12;
  const signerPos     = design.signerPosition || 'right';
  const tpl           = design.template      || 'classic';
  const absUrl        = (url: string | null | undefined) => url || '';

  const logoImg = (src: string, size = 52) =>
    `<img src="${absUrl(src)}" style="width:${size}px;height:${size}px;object-fit:contain;" alt="">`;

  const logoCircle = (src: string, size = 64) =>
    `<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
      <img src="${absUrl(src)}" style="width:${size-8}px;height:${size-8}px;object-fit:contain;" alt="">
    </div>`;

  const getLogo = (pos: 'left' | 'right' | 'center') => {
    const src = pos === 'left' ? design.headerLogoLeft
              : pos === 'right' ? design.headerLogoRight
              : design.headerLogoCenter;
    return src || null;
  };

  const signersHtml = signers.length > 0 ? `
    <div style="margin-top:40px;display:flex;justify-content:${signerPos === 'left' ? 'flex-start' : 'flex-end'};gap:48px;">
      ${signers.map(s => `
        <div style="text-align:center;min-width:130px;">
          ${s.signatureBase64
            ? `<img src="${s.signatureBase64}" style="height:54px;max-width:180px;object-fit:contain;display:block;margin:0 auto 4px;mix-blend-mode:multiply;" alt="">`
            : '<div style="height:54px;"></div>'}
          <div style="border-top:1.5px solid ${accentColor};padding-top:6px;font-family:${fontFamily};font-size:11px;">
            <div style="font-weight:600;color:#1a1a1a;">${s.name}</div>
            <div style="color:#888;font-size:10px;margin-top:2px;">${s.function}</div>
          </div>
        </div>`).join('')}
    </div>` : '';

  const recipientBlock = recipientName ? `
    <div style="margin-bottom:24px;padding-left:12px;border-left:3px solid ${accentColor};font-size:12px;line-height:1.7;color:#333;">
      <div style="font-size:8px;color:#ccc;margin-bottom:2px;">${design.senderLineText || design.senderName || ''}</div>
      <strong>${recipientName.split('\n').join('<br>')}</strong>
      ${recipientAddress ? '<br>' + recipientAddress.split('\n').join('<br>') : ''}
    </div>` : '';

  const footerItems = [design.senderName, design.senderAddress, design.senderPhone, design.senderEmail, design.senderWebsite]
    .filter(Boolean)
    .map((item, i) => i === 0 ? `<span>${item}</span>` : `<span style="color:rgba(255,255,255,0.4);margin:0 6px;">·</span><span>${item}</span>`)
    .join('');

  // ── Einladungs-Infoblock ──────────────────────────────────────────────────
  const infoBlock = `
    <div style="background:${design.headerBgColor};border-radius:12px;padding:20px 24px;margin-bottom:24px;color:#fff;">
      <div style="font-family:${fontFamily};font-size:18px;font-weight:700;color:${design.headerTitleColor||'#fff'};margin-bottom:14px;letter-spacing:0.02em;">
        📋 ${eventName}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;">
        ${eventDate ? `<div style="display:flex;align-items:center;gap:6px;font-size:12px;">
          <span style="opacity:0.6;font-size:14px;">📅</span>
          <span><span style="opacity:0.65;font-size:10px;display:block;letter-spacing:0.05em;">DATUM</span>${eventDate}</span>
        </div>` : ''}
        ${eventTime ? `<div style="display:flex;align-items:center;gap:6px;font-size:12px;">
          <span style="opacity:0.6;font-size:14px;">🕐</span>
          <span><span style="opacity:0.65;font-size:10px;display:block;letter-spacing:0.05em;">UHRZEIT</span>${eventTime}</span>
        </div>` : ''}
        ${eventLocation ? `<div style="display:flex;align-items:center;gap:6px;font-size:12px;">
          <span style="opacity:0.6;font-size:14px;">📍</span>
          <span><span style="opacity:0.65;font-size:10px;display:block;letter-spacing:0.05em;">ORT</span>${eventLocation}</span>
        </div>` : ''}
        ${rsvpDeadline ? `<div style="display:flex;align-items:center;gap:6px;font-size:12px;">
          <span style="opacity:0.6;font-size:14px;">✉️</span>
          <span><span style="opacity:0.65;font-size:10px;display:block;letter-spacing:0.05em;">ANMELDUNG BIS</span>${rsvpDeadline}</span>
        </div>` : ''}
      </div>
      ${eventProgram ? `<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.15);">
        <div style="font-size:10px;opacity:0.65;letter-spacing:0.05em;margin-bottom:6px;">PROGRAMM</div>
        <div style="font-size:12px;line-height:1.7;white-space:pre-wrap;">${eventProgram}</div>
      </div>` : ''}
    </div>`;

  const bodyContent = `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;padding-bottom:8px;border-bottom:0.5px solid #efefef;">
      <div style="font-size:9px;color:#bbb;letter-spacing:0.05em;">${design.senderLineText || [design.senderName, design.senderAddress].filter(Boolean).join(' · ')}</div>
      <div style="font-size:11px;color:#666;font-style:italic;">${design.senderCity ? design.senderCity + ', ' : ''}${date}</div>
    </div>
    ${recipientBlock}
    ${infoBlock}
    ${introText ? `<div style="font-size:${fontSize}px;line-height:1.9;color:#333;margin-bottom:20px;white-space:pre-wrap;">${introText}</div>` : ''}
    ${directions ? `<div style="background:#f8f8f8;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:11px;color:#555;line-height:1.6;">
      <div style="font-size:9px;color:#999;letter-spacing:0.05em;margin-bottom:4px;">ANREISE</div>
      <div style="white-space:pre-wrap;">${directions}</div>
    </div>` : ''}
    <div style="margin-top:24px;padding-top:16px;border-top:0.5px solid #ececec;font-size:${fontSize}px;color:#444;">
      <div style="text-align:${signerPos === 'right' ? 'right' : 'left'};">${closing || 'Mit freundlichen Grüßen,'}</div>
      ${signersHtml}
    </div>`;

  // Header-HTML je nach Template (wiederverwendet aus generateLetterHtml)
  const logoL = getLogo('left'); const logoR = getLogo('right'); const logoC = getLogo('center');
  const showL = design.headerLogoPosition === 'left' || design.headerLogoPosition === 'both';
  const showR = design.headerLogoPosition === 'right' || design.headerLogoPosition === 'both';

  const baseStyles = `
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'${fontFamily}',Georgia,serif; background:#f0f0f0; }
    .page { max-width:700px; margin:0 auto; background:#fff; box-shadow:0 2px 20px rgba(0,0,0,0.12); }
    .footer { padding:12px 28px;display:flex;justify-content:center;align-items:center;gap:0;flex-wrap:wrap; }
    .footer span { font-size:9.5px;color:rgba(255,255,255,0.85);letter-spacing:0.04em; }
  `;

  // Für alle Templates: gleicher Header-HTML wie in generateLetterHtml
  // Rufe generateLetterHtml mit dummy-Werten auf um den Header zu holen — 
  // stattdessen bauen wir den Header inline:

  const headerHtml = (bodyPadding = '28px 40px') => {
    if (tpl === 'sidebar') return `
      <div style="display:flex;min-height:297mm;">
        <div style="width:72px;background:${design.headerBgColor};display:flex;flex-direction:column;align-items:center;padding:28px 0;gap:16px;flex-shrink:0;">
          ${logoL ? logoCircle(logoL, 48) : ''}
          <div style="width:3px;height:40px;background:${accentColor};border-radius:2px;margin-top:8px;"></div>
          <div style="writing-mode:vertical-rl;transform:rotate(180deg);font-family:'${fontFamily}',serif;font-size:11px;color:${design.headerTitleColor||'#fff'};letter-spacing:0.12em;font-weight:600;margin-top:16px;">${design.headerTitle||''}</div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;">
          <div style="padding:24px 32px 16px;border-bottom:0.5px solid #efefef;display:flex;justify-content:space-between;align-items:flex-end;">
            <div><div style="font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||18}px;color:${design.headerBgColor};font-weight:700;">${design.headerTitle||''}</div>${design.headerSubtitle?`<div style="font-size:10px;color:#999;margin-top:2px;">${design.headerSubtitle}</div>`:''}</div>
            <div style="font-size:10px;color:#999;">${design.senderCity||''}</div>
          </div>
          <div style="padding:${bodyPadding};flex:1;">${bodyContent}</div>
          <div style="background:${footerBgColor};padding:12px 28px;display:flex;justify-content:center;align-items:center;gap:0;flex-wrap:wrap;">${footerItems}</div>
        </div>
      </div>`;

    if (tpl === 'minimal') return `
      <div>
        <div style="padding:32px 48px 20px;border-top:4px solid ${accentColor};display:flex;align-items:center;justify-content:space-between;">
          <div><div style="font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||18}px;color:${design.headerBgColor};font-weight:700;">${design.headerTitle||''}</div>${design.headerSubtitle?`<div style="font-size:10px;color:#999;margin-top:3px;">${design.headerSubtitle}</div>`:''}</div>
          ${logoL ? logoImg(logoL, 48) : ''}
        </div>
        <div style="height:0.5px;background:#e0e0e0;margin:0 48px;"></div>
        <div style="padding:28px 48px 40px;">${bodyContent}</div>
        <div style="background:${footerBgColor};padding:12px 28px;display:flex;justify-content:center;align-items:center;gap:0;flex-wrap:wrap;">${footerItems}</div>
      </div>`;

    if (tpl === 'rounded') return `
      <div style="background:#f5f5f5;">
        <div style="background:${design.headerBgColor};padding:28px 32px 36px;border-radius:0 0 32px 32px;margin:0 16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
            ${showL && logoL ? logoImg(logoL, 52) : showL ? '<div style="width:52px"></div>' : ''}
            <div style="text-align:center;flex:1;"><div style="font-family:\'${fontFamily}\',serif;font-size:${design.headerTitleSize||20}px;color:${design.headerTitleColor||'#fff'};font-weight:700;">${design.headerTitle||''}</div>${design.headerSubtitle?`<div style="color:rgba(255,255,255,0.7);font-size:11px;margin-top:4px;font-style:italic;">${design.headerSubtitle}</div>`:''}</div>
            ${showR && logoR ? logoImg(logoR, 52) : showR ? '<div style="width:52px"></div>' : ''}
          </div>
        </div>
        <div style="width:8px;height:8px;border-radius:50%;background:${accentColor};margin:12px auto;"></div>
        <div style="padding:16px 40px 40px;background:#fff;margin:0 16px;border-radius:16px;">${bodyContent}</div>
        <div style="background:${footerBgColor};border-radius:16px;margin:8px 16px 16px;padding:12px 28px;display:flex;justify-content:center;align-items:center;gap:0;flex-wrap:wrap;">${footerItems}</div>
      </div>`;

    // overlap — Logo-Kreis überlappt Briefkopf
    if (tpl === 'overlap') {
      const logoO = getLogo('left') || getLogo('center') || getLogo('right');
      return `<div>
        <div style="background:${design.headerBgColor};padding:28px 32px 48px;text-align:center;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
            ${showL && logoL ? logoImg(logoL,48) : '<div style="width:48px"></div>'}
            <div style="flex:1;text-align:center;">
              <div style="font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||20}px;color:${design.headerTitleColor||'#fff'};font-weight:700;letter-spacing:0.03em;">${design.headerTitle||''}</div>
              ${design.headerSubtitle?`<div style="color:rgba(255,255,255,0.7);font-size:11px;margin-top:4px;font-style:italic;">${design.headerSubtitle}</div>`:''}
            </div>
            ${showR && logoR ? logoImg(logoR,48) : '<div style="width:48px"></div>'}
          </div>
        </div>
        <div style="display:flex;justify-content:center;margin-top:-44px;position:relative;z-index:2;">
          <div style="width:88px;height:88px;border-radius:50%;background:#fff;border:4px solid ${accentColor};box-shadow:0 6px 24px rgba(0,0,0,0.18);display:flex;align-items:center;justify-content:center;overflow:hidden;">
            ${logoO?`<img src="${absUrl(logoO)}" style="width:70px;height:70px;object-fit:contain;" alt="">`:''}
          </div>
        </div>
        <div style="height:2px;background:${accentColor};margin:14px 40px 20px;"></div>
        <div style="padding:0 40px 40px;">${bodyContent}</div>
        <div style="background:${footerBgColor};padding:12px 28px;display:flex;justify-content:center;align-items:center;flex-wrap:wrap;">${footerItems}</div>
      </div>`;
    }

    // diagonal — Schräger Header-Schnitt
    if (tpl === 'diagonal') {
      return `<div>
        <div style="background:${design.headerBgColor};padding:28px 36px 60px;clip-path:polygon(0 0,100% 0,100% 70%,0 100%);margin-bottom:-20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
            ${showL && logoL ? logoImg(logoL,52) : ''}
            <div style="flex:1;text-align:center;">
              <div style="font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||20}px;color:${design.headerTitleColor||'#fff'};font-weight:700;">${design.headerTitle||''}</div>
              ${design.headerSubtitle?`<div style="color:rgba(255,255,255,0.75);font-size:11px;margin-top:5px;font-style:italic;">${design.headerSubtitle}</div>`:''}
            </div>
            ${showR && logoR ? logoImg(logoR,52) : ''}
          </div>
        </div>
        <div style="height:3px;background:${accentColor};margin:0 0 28px;"></div>
        <div style="padding:0 40px 40px;">${bodyContent}</div>
        <div style="background:${footerBgColor};padding:12px 28px;display:flex;justify-content:center;align-items:center;flex-wrap:wrap;">${footerItems}</div>
      </div>`;
    }

    // split — Zweifarbiger geteilter Header
    if (tpl === 'split') {
      const logoS = getLogo('left') || getLogo('center') || getLogo('right');
      return `<div>
        <div style="display:flex;height:110px;">
          <div style="background:${design.headerBgColor};flex:2;display:flex;flex-direction:column;justify-content:center;padding:0 28px;">
            <div style="font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||18}px;color:${design.headerTitleColor||'#fff'};font-weight:700;line-height:1.2;">${design.headerTitle||''}</div>
            ${design.headerSubtitle?`<div style="color:rgba(255,255,255,0.7);font-size:10px;margin-top:5px;font-style:italic;">${design.headerSubtitle}</div>`:''}
          </div>
          <div style="background:${accentColor};width:110px;display:flex;align-items:center;justify-content:center;padding:16px;">
            ${logoS?`<img src="${absUrl(logoS)}" style="width:60px;height:60px;object-fit:contain;filter:brightness(0) invert(1);" alt="">`:''}
          </div>
        </div>
        <div style="height:4px;background:${design.headerBgColor};"></div>
        <div style="padding:28px 40px 40px;">${bodyContent}</div>
        <div style="background:${footerBgColor};padding:12px 28px;display:flex;justify-content:center;align-items:center;flex-wrap:wrap;">${footerItems}</div>
      </div>`;
    }

    // bold-type — Große Typografie, minimalistisch
    if (tpl === 'bold-type') {
      const logoB = getLogo('left') || getLogo('right') || getLogo('center');
      return `<div>
        <div style="padding:32px 40px 20px;border-top:6px solid ${design.headerBgColor};display:flex;align-items:flex-start;justify-content:space-between;gap:20px;">
          <div style="flex:1;">
            <div style="font-family:'${fontFamily}',serif;font-size:${(design.headerTitleSize||20)+8}px;color:${design.headerBgColor};font-weight:900;line-height:1.1;letter-spacing:-0.02em;">${design.headerTitle||''}</div>
            ${design.headerSubtitle?`<div style="font-size:11px;color:${accentColor};margin-top:6px;letter-spacing:0.1em;text-transform:uppercase;">${design.headerSubtitle}</div>`:''}
          </div>
          ${logoB?`<div style="width:60px;height:60px;border-radius:50%;background:${design.headerBgColor};display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;"><img src="${absUrl(logoB)}" style="width:48px;height:48px;object-fit:contain;" alt=""></div>`:''}
        </div>
        <div style="height:2px;background:${accentColor};margin:0 40px 28px;"></div>
        <div style="padding:0 40px 40px;">${bodyContent}</div>
        <div style="background:${footerBgColor};padding:12px 28px;display:flex;justify-content:center;align-items:center;flex-wrap:wrap;">${footerItems}</div>
      </div>`;
    }

    // ribbon — Breites Ribbon-Banner
    if (tpl === 'ribbon') {
      const logoRb = getLogo('left') || getLogo('center') || getLogo('right');
      return `<div>
        <div style="background:${design.headerBgColor};padding:0;position:relative;overflow:hidden;">
          <div style="position:absolute;top:0;right:0;width:120px;height:100%;background:${accentColor};opacity:0.3;clip-path:polygon(40% 0,100% 0,100% 100%,0 100%);"></div>
          <div style="position:relative;z-index:1;display:flex;align-items:center;padding:20px 32px;gap:20px;">
            ${logoRb?`<div style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;"><img src="${absUrl(logoRb)}" style="width:52px;height:52px;object-fit:contain;" alt=""></div>`:''}
            <div style="flex:1;">
              <div style="font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||20}px;color:${design.headerTitleColor||'#fff'};font-weight:700;letter-spacing:0.03em;">${design.headerTitle||''}</div>
              ${design.headerSubtitle?`<div style="color:rgba(255,255,255,0.75);font-size:11px;margin-top:4px;font-style:italic;">${design.headerSubtitle}</div>`:''}
            </div>
            <div style="width:8px;height:100%;background:${accentColor};border-radius:4px;align-self:stretch;min-height:40px;"></div>
          </div>
        </div>
        <div style="height:3px;background:${accentColor};"></div>
        <div style="padding:28px 40px 40px;">${bodyContent}</div>
        <div style="background:${footerBgColor};padding:12px 28px;display:flex;justify-content:center;align-items:center;flex-wrap:wrap;">${footerItems}</div>
      </div>`;
    }

    // Default: classic
    return `
      <div>
        <div style="background:${design.headerBgColor};padding:20px 28px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
            ${showL && logoL ? logoImg(logoL, 52) : showL ? '<div style="width:52px"></div>' : ''}
            <div style="text-align:center;flex:1;"><div style="font-family:\'${fontFamily}\',serif;font-size:${design.headerTitleSize||20}px;color:${design.headerTitleColor||'#fff'};font-weight:700;letter-spacing:0.03em;">${design.headerTitle||''}</div>${design.headerSubtitle?`<div style="color:rgba(255,255,255,0.7);font-size:11px;margin-top:4px;font-style:italic;">${design.headerSubtitle}</div>`:''}</div>
            ${showR && logoR ? logoImg(logoR, 52) : showR ? '<div style="width:52px"></div>' : ''}
          </div>
        </div>
        <div style="height:4px;background:${accentColor};"></div>
        <div style="padding:${bodyPadding};">${bodyContent}</div>
        <div style="background:${footerBgColor};padding:12px 28px;display:flex;justify-content:center;align-items:center;gap:0;flex-wrap:wrap;">${footerItems}</div>
      </div>`;
  };

  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>${baseStyles}</style></head><body><div class="page">${headerHtml()}</div></body></html>`;
}

// ── Einladungs-Endpunkte ──────────────────────────────────────────────────────

// HTML-Vorschau
router.post('/invitation/preview-html', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const { eventName, eventDate, eventTime, eventLocation, eventProgram,
            rsvpDeadline, directions, introText, closing,
            recipientName, recipientAddress, signerUserIds, date, designSnapshot } = req.body;

    let design = designSnapshot || null;
    if (!design) {
      const { designId } = req.body;
      design = designId
        ? await (prisma as any).letterDesign.findUnique({ where: { id: designId } })
        : await (prisma as any).letterDesign.findFirst({ orderBy: { name: 'asc' } });
    }
    if (!design) design = { headerBgColor: '#1a2744', headerTitle: '', headerTitleColor: '#f5e6d0', fontFamily: 'Arial', fontSize: 12, accentColor: '#c8a96e', signerPosition: 'right', template: 'classic' };

    const signers: { name: string; function: string; signatureBase64?: string }[] = [];
    if (signerUserIds?.length) {
      for (const sid of signerUserIds) {
        const signer = await prisma.user.findUnique({ where: { id: sid }, include: { member: { select: { firstName: true, lastName: true, rank: true } } } }) as any;
        if (!signer) continue;
        let signatureBase64: string | undefined;
        if (signer.signatureImage) { try { signatureBase64 = decryptSignature(signer.signatureImage); } catch {} }
        signers.push({ name: signer.member ? `${signer.member.firstName} ${signer.member.lastName}` : signer.email, function: signer.member?.rank || '', signatureBase64 });
      }
    }

    const html = generateInvitationHtml({ design, eventName: eventName||'', eventDate: eventDate||'', eventTime: eventTime||'', eventLocation: eventLocation||'', eventProgram: eventProgram||'', rsvpDeadline: rsvpDeadline||'', directions: directions||'', introText: introText||'', closing: closing||'', recipientName: recipientName||'', recipientAddress: recipientAddress||'', date: date || new Date().toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' }), signers });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PDF-Vorschau
router.post('/invitation/preview-pdf', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const { eventName, eventDate, eventTime, eventLocation, eventProgram, rsvpDeadline, directions, introText, closing, recipientName, recipientAddress, signerUserIds, date, designSnapshot } = req.body;
    let design = designSnapshot || null;
    if (!design) { const { designId } = req.body; design = designId ? await (prisma as any).letterDesign.findUnique({ where: { id: designId } }) : await (prisma as any).letterDesign.findFirst(); }
    if (!design) design = { headerBgColor: '#1a2744', headerTitle: '', headerTitleColor: '#f5e6d0', fontFamily: 'Arial', fontSize: 12, accentColor: '#c8a96e', signerPosition: 'right', template: 'classic' };
    const signers: { name: string; function: string; signatureBase64?: string }[] = [];
    if (signerUserIds?.length) {
      for (const sid of signerUserIds) {
        const signer = await prisma.user.findUnique({ where: { id: sid }, include: { member: { select: { firstName: true, lastName: true, rank: true } } } }) as any;
        if (!signer) continue;
        let signatureBase64: string | undefined;
        if (signer.signatureImage) { try { signatureBase64 = decryptSignature(signer.signatureImage); } catch {} }
        signers.push({ name: signer.member ? `${signer.member.firstName} ${signer.member.lastName}` : signer.email, function: signer.member?.rank || '', signatureBase64 });
      }
    }
    const htmlContent = generateInvitationHtml({ design, eventName: eventName||'', eventDate: eventDate||'', eventTime: eventTime||'', eventLocation: eventLocation||'', eventProgram: eventProgram||'', rsvpDeadline: rsvpDeadline||'', directions: directions||'', introText: introText||'', closing: closing||'', recipientName: recipientName||'', recipientAddress: recipientAddress||'', date: date || new Date().toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' }), signers });
    const htmlForPdf = await inlineImages(htmlContent);
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlForPdf, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '10mm', left: '0' } });
    await browser.close();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="einladung.pdf"`);
    res.send(Buffer.from(pdf));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Versenden
router.post('/invitation/send', requirePermission('schriftverkehr', 'CREATE'), (req: Request, res: any, next: any) => {
  sendAttachmentUpload(req, res, (err: any) => { if (err) return res.status(400).json({ error: err.message }); next(); });
}, async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { eventName, eventDate, eventTime, eventLocation, eventProgram, rsvpDeadline, directions, introText, closing, recipients, signerUserIds, sendMode, date, designSnapshot, designId, companionText } = req.body;
    const settings = await prisma.appSettings.findFirst() as any;
    const sentByName = (req as any).user?.name || 'Unbekannt';
    const fromName = settings?.smtpFrom || settings?.smtpUser || 'Feuerwehr';
    const fromEmail = settings?.smtpUser || 'noreply@feuerwehr.at';

    let design = (designSnapshot && designSnapshot !== '') ? (() => { try { return typeof designSnapshot === 'string' ? JSON.parse(designSnapshot) : designSnapshot; } catch { return null; } })() : null;
    if (!design && designId) design = await (prisma as any).letterDesign.findUnique({ where: { id: designId } });
    if (!design) design = await (prisma as any).letterDesign.findFirst();
    if (!design) design = { headerBgColor: '#1a2744', headerTitle: '', headerTitleColor: '#f5e6d0', fontFamily: 'Arial', fontSize: 12, accentColor: '#c8a96e', signerPosition: 'right', template: 'classic' };

    const parsedInvSignerIds: string[] = typeof signerUserIds === 'string' ? (() => { try { return JSON.parse(signerUserIds); } catch { return []; } })() : (signerUserIds || []);
    const signers: { name: string; function: string; signatureBase64?: string }[] = [];
    if (parsedInvSignerIds?.length) {
      for (const sid of parsedInvSignerIds) {
        const signer = await prisma.user.findUnique({ where: { id: sid }, include: { member: { select: { firstName: true, lastName: true, rank: true } } } }) as any;
        if (!signer) continue;
        let signatureBase64: string | undefined;
        if (signer.signatureImage) { try { signatureBase64 = decryptSignature(signer.signatureImage); } catch {} }
        signers.push({ name: signer.member ? `${signer.member.firstName} ${signer.member.lastName}` : signer.email, function: signer.member?.rank || '', signatureBase64 });
      }
    }

    const htmlContent = generateInvitationHtml({ design, eventName: eventName||'', eventDate: eventDate||'', eventTime: eventTime||'', eventLocation: eventLocation||'', eventProgram: eventProgram||'', rsvpDeadline: rsvpDeadline||'', directions: directions||'', introText: introText||'', closing: closing||'', recipientName: '', recipientAddress: '', date: date || new Date().toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' }), signers });

    let pdfBuffer: Buffer | null = null;
    if (sendMode === 'pdf' || sendMode === 'html_pdf') {
      const htmlForPdf = await inlineImages(htmlContent);
      const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(htmlForPdf, { waitUntil: 'domcontentloaded' });
      pdfBuffer = Buffer.from(await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '10mm', left: '0' } }));
      await browser.close();
    }

    const { html: htmlWithCidRaw2, attachments: cidAttachments } = buildCidHtml(htmlContent);
    const htmlWithCid = htmlWithCidRaw2.replace(/mix-blend-mode:\s*multiply;?/g, '');
    const recipientList: { name: string; email: string }[] = typeof recipients === 'string' ? JSON.parse(recipients) : (recipients || []);
    let failedCount = 0;
    const errors: string[] = [];
    const transporter = await getTransporter();

    for (const rec of recipientList) {
      if (!rec.email) continue;
      try {
        const mailOptions: any = {
          from: `"${fromName}" <${fromEmail}>`,
          to: `"${rec.name}" <${rec.email}>`,
          subject: `Einladung: ${eventName}`,
          text: introText || '',
        };
        if (sendMode === 'html' || sendMode === 'html_pdf') {
          const htmlWithCompanion = companionText
            ? `<div style="font-family:Arial,sans-serif;font-size:13px;color:#333;padding:16px 24px;border-bottom:2px solid #e5e7eb;margin-bottom:0;background:#f9fafb;">${companionText.replace(/\n/g, '<br>')}</div>${htmlWithCid}`
            : htmlWithCid;
          mailOptions.html = htmlWithCompanion;
          mailOptions.attachments = [...cidAttachments];
        }
        if (pdfBuffer) {
          mailOptions.attachments = [...(mailOptions.attachments || []), { filename: `Einladung_${eventName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }];
        }
        if (companionText) {
          mailOptions.text = companionText + '\n\n' + (introText || '');
        }
        // Extra-Anhänge
        const uploadedFiles = (req as any).files as Express.Multer.File[] || [];
        if (uploadedFiles.length > 0) {
          const extraAttachments = uploadedFiles.map((f: Express.Multer.File) => ({
            filename: f.originalname,
            content: f.buffer,
            contentType: f.mimetype,
          }));
          mailOptions.attachments = [...(mailOptions.attachments || []), ...extraAttachments];
        }
        await transporter.sendMail(mailOptions);
      } catch (mailErr: any) {
        failedCount++;
        errors.push(`${rec.email}: ${mailErr?.message || 'Unbekannter Fehler'}`);
      }
    }

    await (prisma as any).invitationSent.create({ data: {
      sentBy: userId, sentByName,
      recipients: JSON.stringify(recipientList),
      eventName: eventName||'', eventDate: eventDate||'', eventTime: eventTime||'',
      eventLocation: eventLocation||'', eventProgram: eventProgram||'',
      rsvpDeadline: rsvpDeadline||'', directions: directions||'',
      introText: introText||'', closing: closing||'',
      signers: JSON.stringify(signers.map(s => ({ name: s.name, function: s.function, signatureBase64: s.signatureBase64 }))),
      sendMode, designSnapshot: JSON.stringify(design),
      status: failedCount === recipientList.length ? 'failed' : failedCount > 0 ? 'partial' : 'sent',
    }});

    // Auch in einheitliche Versandhistorie (LetterSent) speichern
    await (prisma as any).letterSent.create({ data: {
      sentBy: userId, sentByName,
      recipients: JSON.stringify(recipientList),
      subject: eventName || 'Einladung',
      salutation: '', body: introText || '', closing: closing || '',
      signers: JSON.stringify(signers.map(s => ({ name: s.name, function: s.function }))),
      sendMode, designSnapshot: JSON.stringify(design),
      status: failedCount === recipientList.length ? 'failed' : failedCount > 0 ? 'partial' : 'sent',
      type: 'invitation',
      extraData: JSON.stringify({ eventName, eventDate, eventTime, eventLocation }),
    }}).catch(() => {});

    res.json({ ok: failedCount < recipientList.length, sent: recipientList.length - failedCount, failed: failedCount, errors: errors.length ? errors : undefined });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Historie
router.get('/invitation/history', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const history = await (prisma as any).invitationSent.findMany({
      where: isAdmin ? {} : { sentBy: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(history);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Historie Vorschau
router.get('/invitation/history/:id/preview', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const entry = await (prisma as any).invitationSent.findUnique({ where: { id: req.params.id } });
    if (!entry) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    if (!isAdmin && entry.sentBy !== userId) { res.status(403).json({ error: 'Kein Zugriff' }); return; }
    let design = entry.designSnapshot ? JSON.parse(entry.designSnapshot) : null;
    if (!design) design = await (prisma as any).letterDesign.findFirst();
    if (!design) design = { headerBgColor: '#1a2744', headerTitle: '', headerTitleColor: '#f5e6d0', fontFamily: 'Arial', fontSize: 12, accentColor: '#c8a96e', signerPosition: 'right', template: 'classic' };
    const signers = JSON.parse(entry.signers || '[]');
    const recipients = JSON.parse(entry.recipients || '[]');
    const html = generateInvitationHtml({ design, eventName: entry.eventName, eventDate: entry.eventDate, eventTime: entry.eventTime, eventLocation: entry.eventLocation, eventProgram: entry.eventProgram, rsvpDeadline: entry.rsvpDeadline, directions: entry.directions, introText: entry.introText, closing: entry.closing, recipientName: recipients[0]?.name || '', recipientAddress: recipients[0]?.address || '', date: new Date(entry.createdAt).toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' }), signers });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Löschen
router.delete('/invitation/history/:id', requirePermission('schriftverkehr', 'CREATE'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const entry = await (prisma as any).invitationSent.findUnique({ where: { id: req.params.id } });
    if (!entry) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    if (!isAdmin && entry.sentBy !== userId) { res.status(403).json({ error: 'Kein Zugriff' }); return; }
    await (prisma as any).invitationSent.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});



// ════════════════════════════════════════════════════════════════════════════
// ENTWÜRFE — CRUD
// ════════════════════════════════════════════════════════════════════════════

// Liste aller Entwürfe
router.get('/drafts', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const isAdmin = (req as any).user?.role === 'ADMIN';
    // Debug: alle Drafts zählen
    const drafts = await (prisma as any).draft.findMany({
      where: isAdmin ? {} : { createdBy: userId },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(drafts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Einzelnen Entwurf laden
router.get('/drafts/:id', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const draft = await (prisma as any).draft.findUnique({ where: { id: req.params.id } });
    if (!draft) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    if (!isAdmin && draft.createdBy !== userId) { res.status(403).json({ error: 'Kein Zugriff' }); return; }
    res.json(draft);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Entwurf erstellen
router.post('/drafts', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const createdByName = (req as any).user?.name || 'Unbekannt';
    const { type, title, subject, salutation, body, closing, recipientName, recipientAddress,
            date, signerUserIds, designId, designSnapshot,
            eventName, eventDate, eventTime, eventLocation, eventProgram,
            rsvpDeadline, directions, introText } = req.body;

    const draft = await (prisma as any).draft.create({ data: {
      type: type || 'letter',
      title: title || subject || eventName || 'Unbenannter Entwurf',
      createdBy: userId,
      createdByName,
      subject: subject || '',
      salutation: salutation || '',
      body: body || '',
      closing: closing || '',
      recipientName: recipientName || '',
      recipientAddress: recipientAddress || '',
      date: date || '',
      signerUserIds: JSON.stringify(signerUserIds || []),
      designId: designId || null,
      designSnapshot: designSnapshot ? JSON.stringify(designSnapshot) : null,
      eventName: eventName || '',
      eventDate: eventDate || '',
      eventTime: eventTime || '',
      eventLocation: eventLocation || '',
      eventProgram: eventProgram || '',
      rsvpDeadline: rsvpDeadline || '',
      directions: directions || '',
      introText: introText || '',
    }});
    res.json(draft);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Entwurf aktualisieren
router.put('/drafts/:id', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const existing = await (prisma as any).draft.findUnique({ where: { id: req.params.id } });
    if (!existing) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    if (!isAdmin && existing.createdBy !== userId) { res.status(403).json({ error: 'Kein Zugriff' }); return; }

    const { title, subject, salutation, body, closing, recipientName, recipientAddress,
            date, signerUserIds, designId, designSnapshot,
            eventName, eventDate, eventTime, eventLocation, eventProgram,
            rsvpDeadline, directions, introText } = req.body;

    const draft = await (prisma as any).draft.update({
      where: { id: req.params.id },
      data: {
        title: title || subject || eventName || existing.title,
        subject: subject ?? existing.subject,
        salutation: salutation ?? existing.salutation,
        body: body ?? existing.body,
        closing: closing ?? existing.closing,
        recipientName: recipientName ?? existing.recipientName,
        recipientAddress: recipientAddress ?? existing.recipientAddress,
        date: date ?? existing.date,
        signerUserIds: signerUserIds ? JSON.stringify(signerUserIds) : existing.signerUserIds,
        designId: designId !== undefined ? designId : existing.designId,
        designSnapshot: designSnapshot ? JSON.stringify(designSnapshot) : existing.designSnapshot,
        eventName: eventName ?? existing.eventName,
        eventDate: eventDate ?? existing.eventDate,
        eventTime: eventTime ?? existing.eventTime,
        eventLocation: eventLocation ?? existing.eventLocation,
        eventProgram: eventProgram ?? existing.eventProgram,
        rsvpDeadline: rsvpDeadline ?? existing.rsvpDeadline,
        directions: directions ?? existing.directions,
        introText: introText ?? existing.introText,
        updatedAt: new Date(),
      }
    });
    res.json(draft);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Entwurf löschen
router.delete('/drafts/:id', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const existing = await (prisma as any).draft.findUnique({ where: { id: req.params.id } });
    if (!existing) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    if (!isAdmin && existing.createdBy !== userId) { res.status(403).json({ error: 'Kein Zugriff' }); return; }
    await (prisma as any).draft.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Entwurf als versendet markieren (sendCount++)
router.post('/drafts/:id/mark-sent', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const draft = await (prisma as any).draft.update({
      where: { id: req.params.id },
      data: { sendCount: { increment: 1 }, lastSentAt: new Date() }
    });
    res.json(draft);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});



// ════════════════════════════════════════════════════════════════════════════
// VERTEILER — CRUD
// ════════════════════════════════════════════════════════════════════════════

router.get('/distributors', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const distributors = await (prisma as any).distributor.findMany({ orderBy: { name: 'asc' } });
    res.json(distributors.map((d: any) => ({
      ...d,
      memberIds: JSON.parse(d.memberIds || '[]'),
      contactIds: JSON.parse(d.contactIds || '[]'),
    })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/distributors', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const { name, memberIds, contactIds } = req.body;
    const dist = await (prisma as any).distributor.create({ data: {
      name,
      memberIds: JSON.stringify(Array.isArray(memberIds) ? memberIds : JSON.parse(memberIds || '[]')),
      contactIds: JSON.stringify(Array.isArray(contactIds) ? contactIds : JSON.parse(contactIds || '[]')),
    }});
    res.json({ ...dist, memberIds: JSON.parse(dist.memberIds), contactIds: JSON.parse(dist.contactIds) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/distributors/:id', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const { name, memberIds, contactIds } = req.body;
    const dist = await (prisma as any).distributor.update({
      where: { id: req.params.id },
      data: {
        name,
        memberIds: JSON.stringify(Array.isArray(memberIds) ? memberIds : JSON.parse(memberIds || '[]')),
        contactIds: JSON.stringify(Array.isArray(contactIds) ? contactIds : JSON.parse(contactIds || '[]')),
      }
    });
    res.json({ ...dist, memberIds: JSON.parse(dist.memberIds), contactIds: JSON.parse(dist.contactIds) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/distributors/:id', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    await (prisma as any).distributor.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


// ── Übungsplan ────────────────────────────────────────────────────────────────

function generateTrainingPlanHtml(params: {
  design: any;
  year: number;
  entries: { date: string; time?: string | null; type: string; title: string; location?: string | null; leaderName?: string | null }[];
  closing: string;
  signers: { name: string; function: string; signatureBase64?: string }[];
  forEmail?: boolean;
  leaderLabel?: string;
  showLeaderBullet?: boolean;
}): string {
  const { design, year, entries, closing, signers, forEmail = false, leaderLabel = 'Übungsleiter', showLeaderBullet = true } = params;

  // Dieselben Hilfsfunktionen wie generateLetterHtml
  const absUrl = (url: string | null | undefined) => url || '';
  const accentColor   = design.accentColor   || design.headerBgColor || '#8B1A1A';
  const footerBgColor = design.footerBgColor || design.headerBgColor || accentColor;
  const fontFamily    = design.fontFamily    || 'Arial';
  const fontSize      = design.fontSize      || 12;
  const signerPos     = design.signerPosition || 'right';
  const tpl           = design.template      || 'classic';

  const logoImg = (src: string, size = 52) =>
    `<img src="${absUrl(src)}" style="width:${size}px;height:${size}px;object-fit:contain;" alt="">`;

  const logoCircle = (src: string, size = 64, bg = 'rgba(255,255,255,0.15)') =>
    `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
      <img src="${absUrl(src)}" style="width:${size - 8}px;height:${size - 8}px;object-fit:contain;" alt="">
    </div>`;

  const getLogo = (pos: 'left' | 'right' | 'center') => {
    const src = pos === 'left' ? design.headerLogoLeft
              : pos === 'right' ? design.headerLogoRight
              : design.headerLogoCenter;
    return src || null;
  };

  const signersHtml = signers.length > 0 ? `
    <div style="margin-top:16px;display:flex;justify-content:${signerPos === 'left' ? 'flex-start' : signerPos === 'center' ? 'center' : 'flex-end'};gap:48px;">
      ${signers.map(s => `
        <div style="text-align:center;min-width:130px;">
          ${s.signatureBase64
            ? `<img src="${s.signatureBase64}" style="width:140px;height:auto;display:inline-block;" alt="">`
            : '<div style="height:40px;"></div>'}
          <div style="border-top:1.5px solid ${accentColor};padding-top:4px;font-family:${fontFamily};font-size:11px;">
            <div style="font-weight:600;color:#1a1a1a;">${s.name}</div>
            <div style="color:#888;font-size:10px;margin-top:1px;">${s.function}</div>
          </div>
        </div>
      `).join('')}
    </div>` : '';

  const footerItems = [design.senderName, design.senderAddress, design.senderPhone, design.senderEmail, design.senderWebsite]
    .filter(Boolean)
    .map((item, i) => i === 0 ? `<span>${item}</span>` : `<span class="footer-dot">·</span><span>${item}</span>`)
    .join('');

  // Tabelleninhalt
  const typeLabel: Record<string, string> = {
    EINSATZ: 'Einsatzübung', FUNK: 'Funkübung', GEMEINDE: 'Gemeindeübung', ABSCHNITT: 'Abschnittsübung', SONSTIGE: 'Sonstige',
    SCHULUNG: 'Schulung', SEMINAR: 'Seminar', KURS: 'Kurs', WEBINAR: 'Webinar', CUSTOM: 'Sonstige',
  };

  const hasLocation = entries.some(e => e.location);

  const rowsHtml = entries.map((e, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#fafafa';
    const typeStr = typeLabel[e.type] || e.type;
    const titleStr = e.title || '';
    let time = e.time || '—';
    if (time !== '—') {
      time = time.replace(/\s*Uhr\s*/i, '').trim();
      if (/^\d{3,4}$/.test(time)) {
        time = time.length === 3 ? `${time[0]}:${time.slice(1)}` : `${time.slice(0,2)}:${time.slice(2)}`;
      }
    }
    const pad = forEmail ? '4px 5px' : '5px 8px';
    const fs  = forEmail ? '10px' : `${fontSize}px`;
    return `<tr style="background:${bg};">
      <td style="padding:${pad};font-size:${fs};border-bottom:0.5px solid #ececec;white-space:nowrap;vertical-align:top;color:#666;">${e.date}</td>
      <td style="padding:${pad};font-size:${fs};border-bottom:0.5px solid #ececec;vertical-align:top;color:#555;white-space:nowrap;">${typeStr}</td>
      <td style="padding:${pad};font-size:${fs};border-bottom:0.5px solid #ececec;vertical-align:top;font-weight:500;color:#1a1a1a;">${titleStr}</td>
      ${hasLocation ? `<td style="padding:${pad};font-size:${fs};border-bottom:0.5px solid #ececec;vertical-align:top;white-space:nowrap;color:#444;">${e.location || '—'}</td>` : ''}
      <td style="padding:${pad};font-size:${fs};border-bottom:0.5px solid #ececec;vertical-align:top;white-space:nowrap;color:#444;">${e.leaderName || '—'}</td>
      <td style="padding:${pad};font-size:${fs};border-bottom:0.5px solid #ececec;vertical-align:top;white-space:nowrap;color:#444;">${time}</td>
    </tr>`;
  }).join('');

  const tablePadding = forEmail ? '0' : '16px';
  const thPad = forEmail ? '6px 5px' : '9px 8px';
  const thFont = forEmail ? '10px' : '11px';
  const tableContent = `<div style="padding:0 ${tablePadding}">
    <h2 style="font-family:'${fontFamily}',serif;font-size:16px;font-weight:700;color:#1a1a1a;text-align:center;margin-bottom:12px;margin-top:12px;">Übungsplan ${year}</h2>
    <table style="width:100%;max-width:100%;border-collapse:collapse;font-size:${fontSize}px;table-layout:auto;">
      <thead>
        <tr>
          <th style="background:${accentColor};color:#fff;padding:${thPad};font-size:${thFont};font-weight:600;text-align:left;white-space:nowrap;">Datum</th>
          <th style="background:${accentColor};color:#fff;padding:${thPad};font-size:${thFont};font-weight:600;text-align:left;white-space:nowrap;">Art</th>
          <th style="background:${accentColor};color:#fff;padding:${thPad};font-size:${thFont};font-weight:600;text-align:left;width:99%;">Bezeichnung</th>
          ${hasLocation ? `<th style="background:${accentColor};color:#fff;padding:${thPad};font-size:${thFont};font-weight:600;text-align:left;white-space:nowrap;">Ort</th>` : ''}
          <th style="background:${accentColor};color:#fff;padding:${thPad};font-size:${thFont};font-weight:600;text-align:left;white-space:nowrap;">${leaderLabel}</th>
          <th style="background:${accentColor};color:#fff;padding:${thPad};font-size:${thFont};font-weight:600;text-align:left;white-space:nowrap;">Zeit</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div style="margin-top:12px;font-size:${fontSize}px;color:#444;line-height:1.5;">
      <div>&#9679; Um pünktliches und vollzähliges Erscheinen wird ersucht!</div>
      <div>&#9679; Schäden an Gerät oder Fahrzeug sind unverzüglich dem Kommandanten zu melden!</div>
      ${showLeaderBullet ? `<div>&#9679; Verantwortlich für die Durchführung ist der jeweilige ${leaderLabel}!</div>` : ''}
    </div>
    <div style="margin-top:16px;padding-top:12px;border-top:0.5px solid #ececec;font-size:${fontSize}px;color:#444;">
      <div style="text-align:${signerPos === 'right' ? 'right' : signerPos === 'center' ? 'center' : 'left'};">${closing}</div>
      ${signersHtml}
    </div>
  </div>`;

  const baseStyles = `
    @page { size: A4; margin: 0; }
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:210mm; }
    body { font-family:'${fontFamily}',Georgia,serif; background:#fff; }
    .page { width:210mm; background:#fff; }
    .body-content { padding:0; }
    .letter-body { white-space:normal; }
    .meta-row { display:none; }
    .sender-small { display:none; }
    .sender-ref { display:none; }
    .date { display:none; }
    .recipient { display:none; }
    .subject { display:none; }
    .salutation { display:none; }
    .closing-block { display:none; }
    .footer { padding:8px 16px;display:flex;justify-content:center;align-items:center;gap:16px; }
    .footer span { font-size:9px;color:rgba(255,255,255,0.85);letter-spacing:0.04em; }
    .footer-dot { color:rgba(255,255,255,0.4);font-size:8px; }
  `;

  // Classic Template
  if (tpl === 'classic') {
    const logoL = getLogo('left'); const logoR = getLogo('right'); const logoC = getLogo('center');
    const showL = design.headerLogoPosition === 'left' || design.headerLogoPosition === 'both';
    const showR = design.headerLogoPosition === 'right' || design.headerLogoPosition === 'both';
    const showC = design.headerLogoPosition === 'center';
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .header { background:${design.headerBgColor};padding:20px 28px;position:relative;overflow:hidden; }
    .header-inner { position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:16px; }
    .header-title h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||20}px;color:${design.headerTitleColor||'#fff'};font-weight:700;letter-spacing:0.03em;line-height:1.2;text-align:center; }
    .header-title p { color:rgba(255,255,255,0.7);font-size:11px;margin-top:4px;letter-spacing:0.08em;font-style:italic;text-align:center; }
    .accent-line { height:4px;background:${accentColor}; }
    .body-content { padding:0 }
    .footer { background:${footerBgColor}; }
    </style></head><body><div class="page">
    <div class="header">
      <div class="header-inner">
        <div>${showL && logoL ? logoImg(logoL) : showL ? '<div style="width:52px"></div>' : ''}</div>
        ${showC && logoC ? logoImg(logoC, 56) : ''}
        <div class="header-title" style="flex:1;text-align:center;">
          <h1>${design.headerTitle || ''}</h1>
          ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
        </div>
        <div>${showR && logoR ? logoImg(logoR) : showR ? '<div style="width:52px"></div>' : ''}</div>
      </div>
    </div>
    <div class="accent-line"></div>
    <div class="body-content">${tableContent}</div>
    <div class="footer">${footerItems}</div>
    </div></body></html>`;
  }

  // Minimal Template
  if (tpl === 'minimal') {
    const logoL = getLogo('left') || getLogo('center') || getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .header { padding:32px 48px 20px;border-top:4px solid ${accentColor};display:flex;align-items:center;justify-content:space-between; }
    .header-title h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||18}px;color:${design.headerBgColor};font-weight:700;letter-spacing:0.04em; }
    .header-title p { font-size:10px;color:#999;letter-spacing:0.08em;margin-top:3px; }
    .divider { height:0.5px;background:#e0e0e0;margin:0 48px; }
    .body-content { padding:0 }
    .footer { background:${footerBgColor};margin-top:32px; }
    </style></head><body><div class="page">
    <div class="header">
      <div class="header-title">
        <h1>${design.headerTitle || ''}</h1>
        ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
      </div>
      ${logoL ? logoImg(logoL, 48) : ''}
    </div>
    <div class="divider"></div>
    <div class="body-content">${tableContent}</div>
    <div class="footer">${footerItems}</div>
    </div></body></html>`;
  }

  // Sidebar Template
  if (tpl === 'sidebar') {
    const logoL = getLogo('left') || getLogo('center') || getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .page { display:flex;min-height:297mm; }
    .sidebar { width:72px;background:${design.headerBgColor};display:flex;flex-direction:column;align-items:center;padding:28px 0;gap:16px;flex-shrink:0; }
    .sidebar-title { writing-mode:vertical-rl;transform:rotate(180deg);font-family:'${fontFamily}',serif;font-size:11px;color:${design.headerTitleColor||'#fff'};letter-spacing:0.12em;font-weight:600;margin-top:16px; }
    .sidebar-accent { width:3px;height:40px;background:${accentColor};border-radius:2px;margin-top:8px; }
    .main { flex:1;display:flex;flex-direction:column; }
    .main-header { padding:24px 32px 16px;border-bottom:0.5px solid #efefef;display:flex;justify-content:space-between;align-items:flex-end; }
    .main-title h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||18}px;color:${design.headerBgColor};font-weight:700; }
    .main-title p { font-size:10px;color:#999;margin-top:2px; }
    .body-content { padding:0;flex:1; }
    .footer { background:${footerBgColor}; }
    </style></head><body><div class="page">
    <div class="sidebar">
      ${logoL ? logoCircle(logoL, 48) : ''}
      <div class="sidebar-accent"></div>
      <div class="sidebar-title">${design.headerTitle || ''}</div>
    </div>
    <div class="main">
      <div class="main-header">
        <div class="main-title">
          <h1>${design.headerTitle || ''}</h1>
          ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
        </div>
      </div>
      <div class="body-content">${tableContent}</div>
      <div class="footer">${footerItems}</div>
    </div>
    </div></body></html>`;
  }

  // Badge Template (Kreis-Logo)
  if (tpl === 'badge') {
    const logoL = getLogo('left') || getLogo('center') || getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .header { background:${design.headerBgColor};padding:24px 32px 48px;text-align:center;position:relative; }
    .header h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||20}px;color:${design.headerTitleColor||'#fff'};font-weight:700;letter-spacing:0.04em; }
    .header p { color:rgba(255,255,255,0.7);font-size:11px;margin-top:4px;font-style:italic; }
    .badge-wrap { display:flex;justify-content:center;margin-top:-36px;margin-bottom:16px;position:relative;z-index:2; }
    .badge-circle { width:72px;height:72px;border-radius:50%;background:#fff;border:4px solid ${accentColor};display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.15); }
    .body-content { padding:0 }
    .sender-small { display:none; }
    .date { display:none; }
    .footer { background:${footerBgColor}; }
    </style></head><body><div class="page">
    <div class="header">
      <h1>${design.headerTitle || ''}</h1>
      ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
    </div>
    <div class="badge-wrap">
      <div class="badge-circle">${logoL ? `<img src="${absUrl(logoL)}" style="width:56px;height:56px;object-fit:contain;" alt="">` : ''}</div>
    </div>
    <div style="height:3px;background:${accentColor};margin:0 0 16px;border-radius:0;"></div>
    <div class="body-content">${tableContent}</div>
    <div class="footer">${footerItems}</div>
    </div></body></html>`;
  }

  // Overlap Template (Überlappend)
  if (tpl === 'overlap') {
    const logoO = getLogo('left') || getLogo('center') || getLogo('right');
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
    ${baseStyles}
    .header { background:${design.headerBgColor};padding:24px 32px 48px;text-align:center; }
    .header h1 { font-family:'${fontFamily}',serif;font-size:${design.headerTitleSize||20}px;color:${design.headerTitleColor||'#fff'};font-weight:700;letter-spacing:0.04em; }
    .header p { color:rgba(255,255,255,0.7);font-size:11px;margin-top:4px;font-style:italic; }
    .overlap-wrap { display:flex;justify-content:center;margin-top:-44px;margin-bottom:0;position:relative;z-index:2; }
    .overlap-circle { width:88px;height:88px;border-radius:50%;background:#fff;border:4px solid ${accentColor};box-shadow:0 6px 24px rgba(0,0,0,0.18);display:flex;align-items:center;justify-content:center;overflow:hidden; }
    .accent-line { height:2px;background:${accentColor};margin:14px 0 0; }
    .body-content { padding:0 }
    .footer { background:${footerBgColor}; }
    </style></head><body><div class="page">
    <div class="header">
      <h1>${design.headerTitle || ''}</h1>
      ${design.headerSubtitle ? `<p>${design.headerSubtitle}</p>` : ''}
    </div>
    <div class="overlap-wrap">
      <div class="overlap-circle">${logoO ? `<img src="${absUrl(logoO)}" style="width:70px;height:70px;object-fit:contain;" alt="">` : ''}</div>
    </div>
    <div class="accent-line"></div>
    <div class="body-content">${tableContent}</div>
    <div class="footer">${footerItems}</div>
    </div></body></html>`;
  }

  // Alle anderen Templates — nutze generateLetterHtml mit tableContent
  const fullHtml = generateLetterHtml({
    design, subject: '', salutation: '', body: '', closing: '', recipientName: '', recipientAddress: '', date: '', signers: [],
  });
  // Brief-spezifische Elemente entfernen und tableContent einsetzen
  return fullHtml
    .replace(/<div class="letter-body"><\/div>/, `<div class="letter-body" style="white-space:normal;">${tableContent}</div>`)
    .replace(/<div class="closing-block">[\s\S]*?<\/div>\s*(<\/div>)/, '$1')
    .replace(/<div class="sender-small">[\s\S]*?<\/div>/, '')
    .replace(/<div class="meta-row">[\s\S]*?<\/div>/, '')
    .replace(/<div class="sender-ref">[\s\S]*?<\/div>/, '')
    .replace(/<div class="date">[\s\S]*?<\/div>/, '')
    .replace(/<div class="recipient">[\s\S]*?<\/div>/, '')
    .replace(/<div class="subject">[\s\S]*?<\/div>/, '')
    .replace(/<div class="salutation">[\s\S]*?<\/div>/, '');
}


// Helper: Signers laden (identisch zu Brief/Einladung)
async function loadSigners(signerUserIds: string[], prismaClient: any): Promise<{ name: string; function: string; signatureBase64?: string }[]> {
  const ids: string[] = typeof signerUserIds === 'string'
    ? (() => { try { return JSON.parse(signerUserIds); } catch { return []; } })()
    : (signerUserIds || []);
  const signers: { name: string; function: string; signatureBase64?: string }[] = [];
  for (const sid of ids) {
    const signer = await prismaClient.user.findUnique({
      where: { id: sid },
      include: { member: { select: { firstName: true, lastName: true, rank: true } } },
    }) as any;
    if (!signer) continue;
    let signatureBase64: string | undefined;
    if (signer.signatureImage) { try { signatureBase64 = decryptSignature(signer.signatureImage); } catch {} }
    signers.push({
      name: signer.member ? `${signer.member.firstName} ${signer.member.lastName}` : signer.email,
      function: signer.member?.rank || '',
      signatureBase64,
    });
  }
  return signers;
}

// Gleiche Funktion aber mit verkleinerter Unterschrift für Email-Versand
async function loadSignersForEmail(signerUserIds: string[], prismaClient: any): Promise<{ name: string; function: string; signatureBase64?: string }[]> {
  const signers = await loadSigners(signerUserIds, prismaClient);
  return Promise.all(signers.map(async s => ({
    ...s,
    signatureBase64: s.signatureBase64 ? await resizeSignatureForEmail(s.signatureBase64) : undefined,
  })));
}

// GET alle Übungspläne
router.get('/training-plans', requirePermission('schriftverkehr', 'VIEW'), async (_req, res) => {
  try {
    const plans = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM training_plans ORDER BY year DESC`);
    const entries = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM training_plan_entries ORDER BY "planId", "sortOrder" ASC`);
    const result = plans.map(p => ({
      ...p,
      year: Number(p.year),
      sendCount: Number(p.sendCount),
      entries: entries.filter(e => e.planId === p.id).map(e => ({ ...e, sortOrder: Number(e.sortOrder) })),
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: 'Fehler beim Laden' }); }
});

// GET einzelner Plan
router.get('/training-plans/:id', requirePermission('schriftverkehr', 'VIEW'), async (req, res) => {
  try {
    const plans = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM training_plans WHERE id = $1 LIMIT 1`, req.params.id);
    if (!plans.length) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    const entries = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM training_plan_entries WHERE "planId" = $1 ORDER BY "sortOrder" ASC`, req.params.id);
    const p = plans[0];
    res.json({ ...p, year: Number(p.year), sendCount: Number(p.sendCount), entries: entries.map(e => ({ ...e, sortOrder: Number(e.sortOrder) })) });
  } catch (e) { res.status(500).json({ error: 'Fehler' }); }
});

// POST neuen Plan erstellen oder vorhandenen für Jahr laden/überschreiben
router.post('/training-plans', requirePermission('schriftverkehr', 'CREATE'), async (req: Request, res) => {
  const userId = (req as any).user?.userId || '';
  const userName = (req as any).user?.name || (req as any).user?.email || 'Unbekannt';
  try {
    const { year, title, designId, designSnapshot, signerUserIds, closing, entries } = req.body;
    if (!year) { res.status(400).json({ error: 'Jahr fehlt' }); return; }

    const yearNum = Number(year);
    const designSnapshotStr = designSnapshot ? JSON.stringify(designSnapshot) : null;
    const signerUserIdsStr = JSON.stringify(signerUserIds || []);
    const closingStr = closing || 'Mit kameradschaftlichen Grüßen';
    const titleStr = title || null;
    const designIdStr = designId || null;

    // Existierenden Plan für dieses Jahr suchen
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM training_plans WHERE year = $1 LIMIT 1`,
      yearNum
    );

    let planId: string;

    if (existing.length > 0) {
      planId = existing[0].id;
      await prisma.$executeRawUnsafe(
        `DELETE FROM training_plan_entries WHERE "planId" = $1`,
        planId
      );
      await prisma.$executeRawUnsafe(
        `UPDATE training_plans SET title=$1, "designId"=$2, "designSnapshot"=$3, "signerUserIds"=$4, closing=$5, status=$6, "updatedAt"=NOW() WHERE id=$7`,
        titleStr, designIdStr, designSnapshotStr, signerUserIdsStr, closingStr, 'draft', planId
      );
    } else {
      planId = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO training_plans (id, year, title, "createdBy", "createdByName", "designId", "designSnapshot", "signerUserIds", closing, status, "sendCount", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())`,
        planId, yearNum, titleStr, userId, userName, designIdStr, designSnapshotStr, signerUserIdsStr, closingStr, 'draft', 0
      );
    }

    // Einträge anlegen
    if (entries?.length) {
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const entryId = crypto.randomUUID();
        await prisma.$executeRawUnsafe(
          `INSERT INTO training_plan_entries (id, "planId", date, time, type, title, location, "leaderId", "leaderName", "calendarId", "sortOrder", "createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
          entryId, planId,
          e.date || '', e.time || null, e.type || 'SONSTIGE', e.title || '',
          e.location || null, e.leaderId || null, e.leaderName || null,
          e.calendarId || null, i
        );
      }
    }

    // Ergebnis zurückgeben — BigInt-safe via JSON stringify/parse
    const plans = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM training_plans WHERE id = $1`, planId);
    const planEntries = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM training_plan_entries WHERE "planId" = $1 ORDER BY "sortOrder" ASC`, planId);
    const result = { ...plans[0], year: Number(plans[0].year), sendCount: Number(plans[0].sendCount), entries: planEntries.map(e => ({ ...e, sortOrder: Number(e.sortOrder) })) };
    res.json(result);
  } catch (e: any) {
    console.error('[training-plans POST] Fehler:', e?.message, e?.code, e?.meta);
    res.status(500).json({ error: 'Fehler beim Speichern', detail: e?.message, code: e?.code });
  }
});

// DELETE Plan
router.delete('/training-plans/:id', requirePermission('schriftverkehr', 'CREATE'), async (req, res) => {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM training_plan_entries WHERE "planId" = $1`, req.params.id);
    await prisma.$executeRawUnsafe(`DELETE FROM training_plans WHERE id = $1`, req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Fehler beim Löschen' }); }
});

// POST Preview-HTML
router.post('/training-plans/preview-html', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const { year, entries, signerUserIds, closing, designSnapshot, designId } = req.body;
    let design = designSnapshot ? (typeof designSnapshot === 'string' ? JSON.parse(designSnapshot) : designSnapshot) : null;
    if (!design && designId) {
      const d = await prisma.letterDesign.findUnique({ where: { id: designId } });
      if (d) design = d;
    }
    if (!design) design = { headerBgColor: '#8B1A1A', headerTitle: '', headerTitleColor: '#ffffff', fontFamily: 'Arial', fontSize: 12, accentColor: '#8B1A1A', signerPosition: 'right' };

    const signers = await loadSigners(signerUserIds || [], prisma);
    const html = generateTrainingPlanHtml({
      design,
      year: Number(year) || new Date().getFullYear(),
      entries: entries || [],
      closing: closing || 'Mit kameradschaftlichen Grüßen',
      signers,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e: any) {
    console.error('[training-plans/preview-html]', e);
    res.status(500).json({ error: 'Fehler', detail: e?.message });
  }
});

// POST PDF generieren
router.post('/training-plans/pdf', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  let browser: any = null;
  try {
    const { year, entries, signerUserIds, closing, designSnapshot, designId } = req.body;
    let design = designSnapshot ? (typeof designSnapshot === 'string' ? JSON.parse(designSnapshot) : designSnapshot) : null;
    if (!design && designId) {
      const d = await prisma.letterDesign.findUnique({ where: { id: designId } });
      if (d) design = d;
    }
    if (!design) design = { headerBgColor: '#8B1A1A', headerTitle: '', headerTitleColor: '#ffffff', fontFamily: 'Arial', fontSize: 12, accentColor: '#8B1A1A', signerPosition: 'right' };

    const signers = await loadSigners(signerUserIds || [], prisma);
    const entryList = entries || [];

    let html = generateTrainingPlanHtml({
      design,
      year: Number(year) || new Date().getFullYear(),
      entries: entryList,
      closing: closing || 'Mit kameradschaftlichen Grüßen',
      signers,
    });
    html = await inlineImages(html);

    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Echte Inhaltshöhe messen (.page hat keine height-Constraint mehr)
    const contentHeight = await page.evaluate('document.querySelector(".page").scrollHeight') as number;
    const a4Height = 1123; // 297mm bei 96dpi

    if (contentHeight > a4Height) {
      // Gesamten Inhalt proportional skalieren — Header, Tabelle, Footer, alles
      const scale = (a4Height / (contentHeight + 20)).toFixed(4); // +20px Safety-Buffer
      await page.evaluate(`(function(){
        var s=${scale};
        var p=document.querySelector('.page');
        if(!p)return;
        var w=document.createElement('div');
        w.style.cssText='width:210mm;height:297mm;overflow:hidden;';
        p.style.transform='scale('+s+')';
        p.style.transformOrigin='top left';
        p.style.width=(100/s)+'%';
        p.style.height='auto';
        p.style.overflow='visible';
        p.parentNode.insertBefore(w,p);
        w.appendChild(p);
      })()`);
    }
    // Puppeteer-Seitenumbruch verhindern: html+body auf exakt A4 fixieren
    await page.addStyleTag({ content: 'html,body{width:210mm;height:297mm;overflow:hidden;}' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
      preferCSSPageSize: true,
    });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Uebungsplan-${year || new Date().getFullYear()}.pdf"`);
    res.send(pdfBuffer);
  } catch (e: any) {
    if (browser) try { await browser.close(); } catch {}
    console.error('[training-plans/pdf]', e);
    res.status(500).json({ error: 'PDF-Fehler', detail: e?.message });
  }
});

// POST Versenden
router.post('/training-plans/send', requirePermission('schriftverkehr', 'CREATE'), async (req: Request, res) => {
  const userId = (req as any).user?.id;
  try {
    const { planId, recipients, signerUserIds, closing, designSnapshot, designId, companionText, sendMode } = req.body;

    let plan: any = null;
    if (planId) {
      const plans = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM training_plans WHERE id = $1 LIMIT 1`, planId);
      if (plans.length) {
        plan = { ...plans[0], year: Number(plans[0].year), sendCount: Number(plans[0].sendCount) };
        const planEntries = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM training_plan_entries WHERE "planId" = $1 ORDER BY "sortOrder" ASC`, planId);
        plan.entries = planEntries;
      }
    }
    if (!plan) { res.status(404).json({ error: 'Plan nicht gefunden' }); return; }

    let design = designSnapshot ? (typeof designSnapshot === 'string' ? JSON.parse(designSnapshot) : designSnapshot) : null;
    if (!design && (plan.designSnapshot || plan.designId)) {
      if (plan.designSnapshot) design = JSON.parse(plan.designSnapshot);
      else if (plan.designId) { const d = await prisma.letterDesign.findUnique({ where: { id: plan.designId } }); if (d) design = d; }
    }
    if (!design) design = { headerBgColor: '#8B1A1A', headerTitle: '', headerTitleColor: '#ffffff', fontFamily: 'Arial', fontSize: 12, accentColor: '#8B1A1A', signerPosition: 'right' };

    const signers = await loadSignersForEmail(signerUserIds || JSON.parse(plan.signerUserIds || '[]'), prisma);
    let html = generateTrainingPlanHtml({
      design,
      year: plan.year,
      entries: plan.entries,
      closing: closing || plan.closing,
      signers,
      forEmail: true,
    });
    html = await (inlineImages as any)(html);
    // mix-blend-mode entfernen für Email-Clients
    const htmlCleaned = html.replace(/mix-blend-mode:\s*multiply;?/g, '');
    // Base64-Unterschrift als CID-Attachment einbetten (wie Brief/Einladung)
    const { html: htmlForEmail, attachments: cidAttachments } = buildCidHtml(htmlCleaned);

    // PDF generieren (mit Scale-to-Fit auf eine A4-Seite)
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const sendContentH = await page.evaluate('document.querySelector(".page") ? document.querySelector(".page").scrollHeight : document.documentElement.scrollHeight') as number;
    if (sendContentH > 1123) {
      const sendScale = (1123 / (sendContentH + 20)).toFixed(4); // +20px Safety-Buffer
      await page.evaluate(`(function(){
        var s=${sendScale};
        var p=document.querySelector('.page');
        if(!p)return;
        var w=document.createElement('div');
        w.style.cssText='width:210mm;height:297mm;overflow:hidden;';
        p.style.transform='scale('+s+')';
        p.style.transformOrigin='top left';
        p.style.width=(100/s)+'%';
        p.style.height='auto';
        p.style.overflow='visible';
        p.parentNode.insertBefore(w,p);
        w.appendChild(p);
      })()`);
    }
    // Puppeteer-Seitenumbruch verhindern: html+body auf exakt A4 fixieren
    await page.addStyleTag({ content: 'html,body{width:210mm;height:297mm;overflow:hidden;}' });

    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' }, preferCSSPageSize: true });
    await browser.close();

    // SMTP senden
    const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
    if (!settings?.smtpHost) { res.status(400).json({ error: 'SMTP nicht konfiguriert' }); return; }

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost, port: settings.smtpPort || 587,
      secure: (settings.smtpPort || 587) === 465,
      auth: { user: settings.smtpUser, pass: decryptSecret(settings.smtpPass) },
    });

    const parsedRecipients: { name: string; email: string }[] =
      typeof recipients === 'string' ? JSON.parse(recipients) : (recipients || []);

    let sent = 0; let failed = 0;
    for (const r of parsedRecipients) {
      try {
        const mailOptions: any = {
          from: `"${settings.smtpFromName || 'Feuerwehr'}" <${settings.smtpFrom || settings.smtpUser}>`,
          to: r.email,
          subject: `Übungsplan ${plan.year}`,
          text: companionText || `Übungsplan ${plan.year}`,
          attachments: [...cidAttachments, { filename: `Uebungsplan-${plan.year}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
        };
        if (sendMode !== 'pdf_only') {
          mailOptions.html = companionText
            ? `<p>${companionText.replace(/\n/g, '<br>')}</p><br>${htmlForEmail}`
            : htmlForEmail;
        }
        await transporter.sendMail(mailOptions);
        sent++;
      } catch { failed++; }
    }

    // sendCount erhöhen
    await prisma.$executeRawUnsafe(`UPDATE training_plans SET "sendCount" = "sendCount" + $1, "lastSentAt" = NOW(), "updatedAt" = NOW() WHERE id = $2`, sent, planId);

    // Versandhistorie speichern
    await (prisma as any).letterSent.create({ data: {
      sentBy: userId || '',
      sentByName: '',
      recipients: JSON.stringify(parsedRecipients),
      subject: `Übungsplan ${plan.year}`,
      salutation: '',
      body: '',
      closing: closing || plan.closing || '',
      signers: JSON.stringify(signers.map((s: any) => ({ name: s.name, function: s.function }))),
      sendMode: sendMode || 'html_pdf',
      status: failed === parsedRecipients.length ? 'failed' : failed > 0 ? 'partial' : 'sent',
      designSnapshot: JSON.stringify(design),
      type: 'training_plan',
      extraData: JSON.stringify({ planId, year: plan.year, title: plan.title || `Übungsplan ${plan.year}` }),
    }}).catch(() => {});

    res.json({ success: true, sent, failed, total: parsedRecipients.length });
  } catch (e: any) {
    console.error('[training-plans/send]', e);
    res.status(500).json({ error: 'Fehler beim Senden', detail: e?.message });
  }
});

// POST "In Kalender übernehmen" → Kalender Allgemein (org_events)
router.post('/training-plans/:id/to-calendar', requirePermission('schriftverkehr', 'CREATE'), async (req: Request, res) => {
  try {
    const plans = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM training_plans WHERE id = $1 LIMIT 1`, req.params.id);
    if (!plans.length) { res.status(404).json({ error: 'Plan nicht gefunden' }); return; }
    const plan = plans[0];
    const entries = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM training_plan_entries WHERE "planId" = $1 ORDER BY "sortOrder" ASC`, plan.id);

    const year = Number(plan.year);
    let created = 0; let updated = 0; let deleted = 0; let skipped = 0;

    const typeMap: Record<string, string> = {
      EINSATZ: 'TRAINING', FUNK: 'TRAINING', GEMEINDE: 'EVENT', ABSCHNITT: 'TRAINING', SONSTIGE: 'OTHER',
    };

    // Alle calendarIds die nach dem Push noch aktiv sind sammeln
    const activeCalendarIds = new Set<string>();

    // Vorher: alle bestehenden calendarIds aus der DB holen (vor dem Push)
    const allOldCalendarIds = entries
      .map(e => e.calendarId)
      .filter(Boolean) as string[];

    for (const entry of entries) {
      const match = entry.date.match(/^(\d{1,2})\.(\d{1,2})\.?/);
      if (!match) { skipped++; continue; }
      const day   = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      let startTime: string | null = null;
      if (entry.time) {
        const tMatch = entry.time.match(/(\d{1,2}):(\d{2})/);
        if (tMatch) startTime = `${tMatch[1].padStart(2, '0')}:${tMatch[2]}`;
      }

      const orgEventType = typeMap[entry.type] || 'OTHER';
      const title = entry.title; // Titel so verwenden wie eingegeben — Ort ist bereits im Titel oder nur im location-Feld
      const description = entry.leaderName ? `Übungsleiter: ${entry.leaderName}` : '';
      const dateTime = new Date(`${dateStr}T${startTime || '00:00'}:00`);

      if (entry.calendarId) {
        const existing = await prisma.orgEvent.findUnique({ where: { id: entry.calendarId } });
        if (existing) {
          const updatedEvent = await prisma.orgEvent.update({
            where: { id: entry.calendarId },
            data: { title, date: dateTime, startTime, location: entry.location || null, description, type: orgEventType as any },
          });
          await syncOrgEventToCalendar(updatedEvent);
          activeCalendarIds.add(entry.calendarId);
          updated++;
        } else {
          const newEvent = await prisma.orgEvent.create({
            data: { title, date: dateTime, startTime, location: entry.location || null, description, type: orgEventType as any },
          });
          await syncOrgEventToCalendar(newEvent);
          await prisma.$executeRawUnsafe(`UPDATE training_plan_entries SET "calendarId" = $1 WHERE id = $2`, newEvent.id, entry.id);
          activeCalendarIds.add(newEvent.id);
          created++;
        }
      } else {
        const newEvent = await prisma.orgEvent.create({
          data: { title, date: dateTime, startTime, location: entry.location || null, description, type: orgEventType as any },
        });
        await syncOrgEventToCalendar(newEvent);
        await prisma.$executeRawUnsafe(`UPDATE training_plan_entries SET "calendarId" = $1 WHERE id = $2`, newEvent.id, entry.id);
        activeCalendarIds.add(newEvent.id);
        created++;
      }
    }

    // Verwaiste org_events löschen (calendarIds die nicht mehr im Plan sind)
    // Nur IDs löschen die aus diesem Plan stammten — nicht fremde Events
    for (const oldId of allOldCalendarIds) {
      if (!activeCalendarIds.has(oldId)) {
        try {
          // Prüfen ob es wirklich ein org_event ist (nicht eine alte exercise-ID)
          const orgEvent = await prisma.orgEvent.findUnique({ where: { id: oldId } });
          if (orgEvent) {
            await prisma.orgEvent.delete({ where: { id: oldId } });
            deleted++;
          }
        } catch {}
      }
    }

    res.json({ success: true, created, updated, deleted, skipped });
  } catch (e: any) {
    console.error('[training-plans/to-calendar]', e);
    res.status(500).json({ error: 'Fehler', detail: e?.message });
  }
});

// ── SCHULUNGSPLAN ROUTES ──────────────────────────────────────────────────────

// generateSchulungsplanHtml — wie generateTrainingPlanHtml, mappt trainerName → leaderName
function generateSchulungsplanHtml(params: Parameters<typeof generateTrainingPlanHtml>[0]): string {
  const mappedEntries = (params.entries || []).map((e: any) => ({
    ...e,
    leaderName: e.trainerName || e.leaderName || null,
    leaderId:   e.trainerId  || e.leaderId  || null,
  }));
  return generateTrainingPlanHtml({ ...params, entries: mappedEntries, leaderLabel: 'Verantwortlicher', showLeaderBullet: false }).replace(/Übungsplan/g, 'Schulungsplan');
}


router.get('/schulungsplaene', requirePermission('schriftverkehr', 'VIEW'), async (_req, res) => {
  try {
    const plans = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM schulungsplaene ORDER BY year DESC`);
    const entries = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM schulungsplan_eintraege ORDER BY "planId", "sortOrder" ASC`);
    const result = plans.map(p => ({
      ...p,
      year: Number(p.year),
      sendCount: Number(p.sendCount),
      entries: entries.filter(e => e.planId === p.id).map(e => ({ ...e, sortOrder: Number(e.sortOrder) })),
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: 'Fehler beim Laden' }); }
});

// GET einzelner Plan
router.get('/schulungsplaene/:id', requirePermission('schriftverkehr', 'VIEW'), async (req, res) => {
  try {
    const plans = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM schulungsplaene WHERE id = $1 LIMIT 1`, req.params.id);
    if (!plans.length) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    const entries = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM schulungsplan_eintraege WHERE "planId" = $1 ORDER BY "sortOrder" ASC`, req.params.id);
    const p = plans[0];
    res.json({ ...p, year: Number(p.year), sendCount: Number(p.sendCount), entries: entries.map(e => ({ ...e, sortOrder: Number(e.sortOrder) })) });
  } catch (e) { res.status(500).json({ error: 'Fehler' }); }
});

// POST neuen Plan erstellen oder vorhandenen für Jahr laden/überschreiben
router.post('/schulungsplaene', requirePermission('schriftverkehr', 'CREATE'), async (req: Request, res) => {
  const userId = (req as any).user?.userId || '';
  const userName = (req as any).user?.name || (req as any).user?.email || 'Unbekannt';
  try {
    const { year, title, designId, designSnapshot, signerUserIds, closing, entries } = req.body;
    if (!year) { res.status(400).json({ error: 'Jahr fehlt' }); return; }

    const yearNum = Number(year);
    const designSnapshotStr = designSnapshot ? JSON.stringify(designSnapshot) : null;
    const signerUserIdsStr = JSON.stringify(signerUserIds || []);
    const closingStr = closing || 'Mit kameradschaftlichen Grüßen';
    const titleStr = title || null;
    const designIdStr = designId || null;

    // Existierenden Plan für dieses Jahr suchen
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM schulungsplaene WHERE year = $1 LIMIT 1`,
      yearNum
    );

    let planId: string;

    if (existing.length > 0) {
      planId = existing[0].id;
      await prisma.$executeRawUnsafe(
        `DELETE FROM schulungsplan_eintraege WHERE "planId" = $1`,
        planId
      );
      await prisma.$executeRawUnsafe(
        `UPDATE schulungsplaene SET title=$1, "designId"=$2, "designSnapshot"=$3, "signerUserIds"=$4, closing=$5, status=$6, "updatedAt"=NOW() WHERE id=$7`,
        titleStr, designIdStr, designSnapshotStr, signerUserIdsStr, closingStr, 'draft', planId
      );
    } else {
      planId = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO schulungsplaene (id, year, title, "createdBy", "createdByName", "designId", "designSnapshot", "signerUserIds", closing, status, "sendCount", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())`,
        planId, yearNum, titleStr, userId, userName, designIdStr, designSnapshotStr, signerUserIdsStr, closingStr, 'draft', 0
      );
    }

    // Einträge anlegen
    if (entries?.length) {
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const entryId = crypto.randomUUID();
        await prisma.$executeRawUnsafe(
          `INSERT INTO schulungsplan_eintraege (id, "planId", date, time, type, title, location, "trainerId", "trainerName", "calendarId", "sortOrder", "createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
          entryId, planId,
          e.date || '', e.time || null, e.type || 'SONSTIGE', e.title || '',
          e.location || null, e.trainerId || null, e.trainerName || null,
          e.calendarId || null, i
        );
      }
    }

    // Ergebnis zurückgeben — BigInt-safe via JSON stringify/parse
    const plans = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM schulungsplaene WHERE id = $1`, planId);
    const planEntries = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM schulungsplan_eintraege WHERE "planId" = $1 ORDER BY "sortOrder" ASC`, planId);
    const result = { ...plans[0], year: Number(plans[0].year), sendCount: Number(plans[0].sendCount), entries: planEntries.map(e => ({ ...e, sortOrder: Number(e.sortOrder) })) };
    res.json(result);
  } catch (e: any) {
    console.error('[schulungsplaene POST] Fehler:', e?.message, e?.code, e?.meta);
    res.status(500).json({ error: 'Fehler beim Speichern', detail: e?.message, code: e?.code });
  }
});

// DELETE Plan
router.delete('/schulungsplaene/:id', requirePermission('schriftverkehr', 'CREATE'), async (req, res) => {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM schulungsplan_eintraege WHERE "planId" = $1`, req.params.id);
    await prisma.$executeRawUnsafe(`DELETE FROM schulungsplaene WHERE id = $1`, req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Fehler beim Löschen' }); }
});

// POST Preview-HTML
router.post('/schulungsplaene/preview-html', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const { year, entries, signerUserIds, closing, designSnapshot, designId } = req.body;
    let design = designSnapshot ? (typeof designSnapshot === 'string' ? JSON.parse(designSnapshot) : designSnapshot) : null;
    if (!design && designId) {
      const d = await prisma.letterDesign.findUnique({ where: { id: designId } });
      if (d) design = d;
    }
    if (!design) design = { headerBgColor: '#8B1A1A', headerTitle: '', headerTitleColor: '#ffffff', fontFamily: 'Arial', fontSize: 12, accentColor: '#8B1A1A', signerPosition: 'right' };

    const signers = await loadSigners(signerUserIds || [], prisma);
    const html = generateSchulungsplanHtml({
      design,
      year: Number(year) || new Date().getFullYear(),
      entries: entries || [],
      closing: closing || 'Mit kameradschaftlichen Grüßen',
      signers,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e: any) {
    console.error('[schulungsplaene/preview-html]', e);
    res.status(500).json({ error: 'Fehler', detail: e?.message });
  }
});

// POST PDF generieren
router.post('/schulungsplaene/pdf', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  let browser: any = null;
  try {
    const { year, entries, signerUserIds, closing, designSnapshot, designId } = req.body;
    let design = designSnapshot ? (typeof designSnapshot === 'string' ? JSON.parse(designSnapshot) : designSnapshot) : null;
    if (!design && designId) {
      const d = await prisma.letterDesign.findUnique({ where: { id: designId } });
      if (d) design = d;
    }
    if (!design) design = { headerBgColor: '#8B1A1A', headerTitle: '', headerTitleColor: '#ffffff', fontFamily: 'Arial', fontSize: 12, accentColor: '#8B1A1A', signerPosition: 'right' };

    const signers = await loadSigners(signerUserIds || [], prisma);
    const entryList = entries || [];

    let html = generateSchulungsplanHtml({
      design,
      year: Number(year) || new Date().getFullYear(),
      entries: entryList,
      closing: closing || 'Mit kameradschaftlichen Grüßen',
      signers,
    });
    html = await inlineImages(html);

    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Echte Inhaltshöhe messen (.page hat keine height-Constraint mehr)
    const contentHeight = await page.evaluate('document.querySelector(".page").scrollHeight') as number;
    const a4Height = 1123; // 297mm bei 96dpi

    if (contentHeight > a4Height) {
      // Gesamten Inhalt proportional skalieren — Header, Tabelle, Footer, alles
      const scale = (a4Height / (contentHeight + 20)).toFixed(4); // +20px Safety-Buffer
      await page.evaluate(`(function(){
        var s=${scale};
        var p=document.querySelector('.page');
        if(!p)return;
        var w=document.createElement('div');
        w.style.cssText='width:210mm;height:297mm;overflow:hidden;';
        p.style.transform='scale('+s+')';
        p.style.transformOrigin='top left';
        p.style.width=(100/s)+'%';
        p.style.height='auto';
        p.style.overflow='visible';
        p.parentNode.insertBefore(w,p);
        w.appendChild(p);
      })()`);
    }
    // Puppeteer-Seitenumbruch verhindern: html+body auf exakt A4 fixieren
    await page.addStyleTag({ content: 'html,body{width:210mm;height:297mm;overflow:hidden;}' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
      preferCSSPageSize: true,
    });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Schulungsplan-${year || new Date().getFullYear()}.pdf"`);
    res.send(pdfBuffer);
  } catch (e: any) {
    if (browser) try { await browser.close(); } catch {}
    console.error('[schulungsplaene/pdf]', e);
    res.status(500).json({ error: 'PDF-Fehler', detail: e?.message });
  }
});

// POST Versenden
router.post('/schulungsplaene/send', requirePermission('schriftverkehr', 'CREATE'), async (req: Request, res) => {
  const userId = (req as any).user?.id;
  try {
    const { planId, recipients, signerUserIds, closing, designSnapshot, designId, companionText, sendMode } = req.body;

    let plan: any = null;
    if (planId) {
      const plans = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM schulungsplaene WHERE id = $1 LIMIT 1`, planId);
      if (plans.length) {
        plan = { ...plans[0], year: Number(plans[0].year), sendCount: Number(plans[0].sendCount) };
        const planEntries = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM schulungsplan_eintraege WHERE "planId" = $1 ORDER BY "sortOrder" ASC`, planId);
        plan.entries = planEntries;
      }
    }
    if (!plan) { res.status(404).json({ error: 'Plan nicht gefunden' }); return; }

    let design = designSnapshot ? (typeof designSnapshot === 'string' ? JSON.parse(designSnapshot) : designSnapshot) : null;
    if (!design && (plan.designSnapshot || plan.designId)) {
      if (plan.designSnapshot) design = JSON.parse(plan.designSnapshot);
      else if (plan.designId) { const d = await prisma.letterDesign.findUnique({ where: { id: plan.designId } }); if (d) design = d; }
    }
    if (!design) design = { headerBgColor: '#8B1A1A', headerTitle: '', headerTitleColor: '#ffffff', fontFamily: 'Arial', fontSize: 12, accentColor: '#8B1A1A', signerPosition: 'right' };

    const signers = await loadSignersForEmail(signerUserIds || JSON.parse(plan.signerUserIds || '[]'), prisma);
    let html = generateSchulungsplanHtml({
      design,
      year: plan.year,
      entries: plan.entries,
      closing: closing || plan.closing,
      signers,
      forEmail: true,
    });
    html = await (inlineImages as any)(html);
    // mix-blend-mode entfernen für Email-Clients
    const htmlCleaned = html.replace(/mix-blend-mode:\s*multiply;?/g, '');
    // Base64-Unterschrift als CID-Attachment einbetten (wie Brief/Einladung)
    const { html: htmlForEmail, attachments: cidAttachments } = buildCidHtml(htmlCleaned);

    // PDF generieren (mit Scale-to-Fit auf eine A4-Seite)
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const sendContentH = await page.evaluate('document.querySelector(".page") ? document.querySelector(".page").scrollHeight : document.documentElement.scrollHeight') as number;
    if (sendContentH > 1123) {
      const sendScale = (1123 / (sendContentH + 20)).toFixed(4); // +20px Safety-Buffer
      await page.evaluate(`(function(){
        var s=${sendScale};
        var p=document.querySelector('.page');
        if(!p)return;
        var w=document.createElement('div');
        w.style.cssText='width:210mm;height:297mm;overflow:hidden;';
        p.style.transform='scale('+s+')';
        p.style.transformOrigin='top left';
        p.style.width=(100/s)+'%';
        p.style.height='auto';
        p.style.overflow='visible';
        p.parentNode.insertBefore(w,p);
        w.appendChild(p);
      })()`);
    }
    // Puppeteer-Seitenumbruch verhindern: html+body auf exakt A4 fixieren
    await page.addStyleTag({ content: 'html,body{width:210mm;height:297mm;overflow:hidden;}' });

    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' }, preferCSSPageSize: true });
    await browser.close();

    // SMTP senden
    const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
    if (!settings?.smtpHost) { res.status(400).json({ error: 'SMTP nicht konfiguriert' }); return; }

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost, port: settings.smtpPort || 587,
      secure: (settings.smtpPort || 587) === 465,
      auth: { user: settings.smtpUser, pass: decryptSecret(settings.smtpPass) },
    });

    const parsedRecipients: { name: string; email: string }[] =
      typeof recipients === 'string' ? JSON.parse(recipients) : (recipients || []);

    let sent = 0; let failed = 0;
    for (const r of parsedRecipients) {
      try {
        const mailOptions: any = {
          from: `"${settings.smtpFromName || 'Feuerwehr'}" <${settings.smtpFrom || settings.smtpUser}>`,
          to: r.email,
          subject: `Schulungsplan ${plan.year}`,
          text: companionText || `Schulungsplan ${plan.year}`,
          attachments: [...cidAttachments, { filename: `Schulungsplan-${plan.year}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
        };
        if (sendMode !== 'pdf_only') {
          mailOptions.html = companionText
            ? `<p>${companionText.replace(/\n/g, '<br>')}</p><br>${htmlForEmail}`
            : htmlForEmail;
        }
        await transporter.sendMail(mailOptions);
        sent++;
      } catch { failed++; }
    }

    // sendCount erhöhen
    await prisma.$executeRawUnsafe(`UPDATE training_plans SET "sendCount" = "sendCount" + $1, "lastSentAt" = NOW(), "updatedAt" = NOW() WHERE id = $2`, sent, planId);

    // Versandhistorie speichern
    await (prisma as any).letterSent.create({ data: {
      sentBy: userId || '',
      sentByName: '',
      recipients: JSON.stringify(parsedRecipients),
      subject: `Schulungsplan ${plan.year}`,
      salutation: '',
      body: '',
      closing: closing || plan.closing || '',
      signers: JSON.stringify(signers.map((s: any) => ({ name: s.name, function: s.function }))),
      sendMode: sendMode || 'html_pdf',
      status: failed === parsedRecipients.length ? 'failed' : failed > 0 ? 'partial' : 'sent',
      designSnapshot: JSON.stringify(design),
      type: 'schulungsplan',
      extraData: JSON.stringify({ planId, year: plan.year, title: plan.title || `Schulungsplan ${plan.year}` }),
    }}).catch(() => {});

    res.json({ success: true, sent, failed, total: parsedRecipients.length });
  } catch (e: any) {
    console.error('[schulungsplaene/send]', e);
    res.status(500).json({ error: 'Fehler beim Senden', detail: e?.message });
  }
});

// POST "In Kalender übernehmen" → Kalender Allgemein (org_events)
router.post('/schulungsplaene/:id/to-calendar', requirePermission('schriftverkehr', 'CREATE'), async (req: Request, res) => {
  try {
    const plans = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM schulungsplaene WHERE id = $1 LIMIT 1`, req.params.id);
    if (!plans.length) { res.status(404).json({ error: 'Plan nicht gefunden' }); return; }
    const plan = plans[0];
    const entries = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM schulungsplan_eintraege WHERE "planId" = $1 ORDER BY "sortOrder" ASC`, plan.id);

    const year = Number(plan.year);
    let created = 0; let updated = 0; let deleted = 0; let skipped = 0;

    const typeMap: Record<string, string> = {
      EINSATZ: 'TRAINING', FUNK: 'TRAINING', GEMEINDE: 'EVENT', ABSCHNITT: 'TRAINING', SONSTIGE: 'OTHER',
    };

    // Alle calendarIds die nach dem Push noch aktiv sind sammeln
    const activeCalendarIds = new Set<string>();

    // Vorher: alle bestehenden calendarIds aus der DB holen (vor dem Push)
    const allOldCalendarIds = entries
      .map(e => e.calendarId)
      .filter(Boolean) as string[];

    for (const entry of entries) {
      const match = entry.date.match(/^(\d{1,2})\.(\d{1,2})\.?/);
      if (!match) { skipped++; continue; }
      const day   = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      let startTime: string | null = null;
      if (entry.time) {
        const tMatch = entry.time.match(/(\d{1,2}):(\d{2})/);
        if (tMatch) startTime = `${tMatch[1].padStart(2, '0')}:${tMatch[2]}`;
      }

      const orgEventType = typeMap[entry.type] || 'OTHER';
      const title = entry.title; // Titel so verwenden wie eingegeben — Ort ist bereits im Titel oder nur im location-Feld
      const description = entry.trainerName ? `Übungsleiter: ${entry.trainerName}` : '';
      const dateTime = new Date(`${dateStr}T${startTime || '00:00'}:00`);

      if (entry.calendarId) {
        const existing = await prisma.orgEvent.findUnique({ where: { id: entry.calendarId } });
        if (existing) {
          const updatedEvent = await prisma.orgEvent.update({
            where: { id: entry.calendarId },
            data: { title, date: dateTime, startTime, location: entry.location || null, description, type: orgEventType as any },
          });
          await syncOrgEventToCalendar(updatedEvent);
          activeCalendarIds.add(entry.calendarId);
          updated++;
        } else {
          const newEvent = await prisma.orgEvent.create({
            data: { title, date: dateTime, startTime, location: entry.location || null, description, type: orgEventType as any },
          });
          await syncOrgEventToCalendar(newEvent);
          await prisma.$executeRawUnsafe(`UPDATE schulungsplan_eintraege SET "calendarId" = $1 WHERE id = $2`, newEvent.id, entry.id);
          activeCalendarIds.add(newEvent.id);
          created++;
        }
      } else {
        const newEvent = await prisma.orgEvent.create({
          data: { title, date: dateTime, startTime, location: entry.location || null, description, type: orgEventType as any },
        });
        await syncOrgEventToCalendar(newEvent);
        await prisma.$executeRawUnsafe(`UPDATE schulungsplan_eintraege SET "calendarId" = $1 WHERE id = $2`, newEvent.id, entry.id);
        activeCalendarIds.add(newEvent.id);
        created++;
      }
    }

    // Verwaiste org_events löschen (calendarIds die nicht mehr im Plan sind)
    // Nur IDs löschen die aus diesem Plan stammten — nicht fremde Events
    for (const oldId of allOldCalendarIds) {
      if (!activeCalendarIds.has(oldId)) {
        try {
          // Prüfen ob es wirklich ein org_event ist (nicht eine alte exercise-ID)
          const orgEvent = await prisma.orgEvent.findUnique({ where: { id: oldId } });
          if (orgEvent) {
            await prisma.orgEvent.delete({ where: { id: oldId } });
            deleted++;
          }
        } catch {}
      }
    }

    res.json({ success: true, created, updated, deleted, skipped });
  } catch (e: any) {
    console.error('[schulungsplaene/to-calendar]', e);
    res.status(500).json({ error: 'Fehler', detail: e?.message });
  }
});


export default router;







// ── Geplanter Versand ──────────────────────────────────────────────────────────

router.post('/schedule', requirePermission('schriftverkehr', 'CREATE'), (req: Request, res: any, next: any) => {
  sendAttachmentUpload(req, res, (err: any) => { if (err) return res.status(400).json({ error: err.message }); next(); });
}, async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { member: { select: { firstName: true, lastName: true } } },
    }) as any;
    const scheduledByName = user?.member
      ? `${user.member.firstName} ${user.member.lastName}`
      : user?.email || 'Unbekannt';

    const { scheduledAt, draftType, draftId, draftTitle, recipients, payload } = req.body;
    if (!scheduledAt) { res.status(400).json({ error: 'scheduledAt erforderlich' }); return; }
    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) { res.status(400).json({ error: 'Ungültiger Zeitpunkt' }); return; }
    if (scheduledDate <= new Date()) { res.status(400).json({ error: 'Zeitpunkt muss in der Zukunft liegen' }); return; }

    const recipientList = typeof recipients === 'string'
      ? (() => { try { return JSON.parse(recipients); } catch { return []; } })()
      : (recipients || []);

    // Hochgeladene Anhänge als Base64 in die Payload encodieren → DB-persistent
    const uploadedFiles = (req as any).files as Express.Multer.File[] || [];
    const parsedPayload = typeof payload === 'string'
      ? (() => { try { return JSON.parse(payload); } catch { return {}; } })()
      : (payload || {});
    if (uploadedFiles.length > 0) {
      parsedPayload.userAttachments = uploadedFiles.map((f: Express.Multer.File) => ({
        filename: f.originalname,
        content: f.buffer.toString('base64'),
        mimetype: f.mimetype,
      }));
    }

    const job = await (prisma as any).scheduledSend.create({
      data: {
        scheduledBy: userId,
        scheduledByName,
        scheduledAt: scheduledDate,
        status: 'pending',
        draftType: draftType || 'letter',
        draftId: draftId || null,
        draftTitle: draftTitle || '',
        recipientCount: recipientList.length,
        payload: JSON.stringify(parsedPayload),
      },
    });
    res.json({ id: job.id, scheduledAt: job.scheduledAt });
  } catch (e: any) { console.error('[schedule]', e); res.status(500).json({ error: e.message }); }
});

router.get('/scheduled', requirePermission('schriftverkehr', 'VIEW'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const jobs = await (prisma as any).scheduledSend.findMany({
      where: { ...(isAdmin ? {} : { scheduledBy: userId }), status: 'pending' },
      orderBy: { scheduledAt: 'asc' },
    });
    res.json(jobs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/scheduled/:id', requirePermission('schriftverkehr', 'CREATE'), async (req: Request, res) => {
  try {
    const userId = (req as any).user?.userId;
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const job = await (prisma as any).scheduledSend.findUnique({ where: { id: req.params.id } });
    if (!job) { res.status(404).json({ error: 'Auftrag nicht gefunden' }); return; }
    if (!isAdmin && job.scheduledBy !== userId) { res.status(403).json({ error: 'Kein Zugriff' }); return; }
    if (job.status !== 'pending') { res.status(400).json({ error: 'Nur ausstehende Aufträge können storniert werden' }); return; }
    await (prisma as any).scheduledSend.update({ where: { id: req.params.id }, data: { status: 'cancelled' } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Scheduled Send Worker ──────────────────────────────────────────────────────

async function executeScheduledJob(job: any): Promise<{ sent: number; failed: number }> {
  const payload = JSON.parse(job.payload);
  const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } }) as any;
  if (!settings?.smtpHost) throw new Error('SMTP nicht konfiguriert');
  const transporter = nodemailer.createTransport({
    host: settings.smtpHost, port: settings.smtpPort || 587,
    secure: (settings.smtpPort || 587) === 465,
    auth: { user: settings.smtpUser, pass: decryptSecret(settings.smtpPass) },
  });
  const parsedRecipients: { name: string; email: string }[] =
    typeof payload.recipients === 'string' ? (() => { try { return JSON.parse(payload.recipients); } catch { return []; } })() : (payload.recipients || []);
  const parsedSignerIds: string[] =
    typeof payload.signerUserIds === 'string' ? (() => { try { return JSON.parse(payload.signerUserIds); } catch { return []; } })() : (payload.signerUserIds || []);
  let sent = 0; let failed = 0;
  const fromStr = `"${settings.smtpFromName || 'Feuerwehr'}" <${settings.smtpFrom || settings.smtpUser}>`;

  if (job.draftType === 'training_plan') {
    const plans = await prisma.$queryRawUnsafe<any[]>('SELECT * FROM training_plans WHERE id = $1 LIMIT 1', payload.planId);
    if (!plans.length) throw new Error('Trainingsplan nicht gefunden');
    const plan: any = { ...plans[0], year: Number(plans[0].year) };
    plan.entries = await prisma.$queryRawUnsafe<any[]>('SELECT * FROM training_plan_entries WHERE "planId" = $1 ORDER BY "sortOrder" ASC', payload.planId);
    let design = payload.designSnapshot ? (typeof payload.designSnapshot === 'string' ? (() => { try { return JSON.parse(payload.designSnapshot); } catch { return null; } })() : payload.designSnapshot) : null;
    if (!design && plan.designSnapshot) design = JSON.parse(plan.designSnapshot);
    if (!design) design = { headerBgColor: '#8B1A1A', headerTitle: '', headerTitleColor: '#ffffff', fontFamily: 'Arial', fontSize: 12, accentColor: '#8B1A1A', signerPosition: 'right' };
    const signers = await loadSignersForEmail(parsedSignerIds.length ? parsedSignerIds : (() => { try { return JSON.parse(plan.signerUserIds || '[]'); } catch { return []; } })(), prisma);
    let html = generateTrainingPlanHtml({ design, year: plan.year, entries: plan.entries, closing: payload.closing || plan.closing, signers, forEmail: true });
    html = await (inlineImages as any)(html);
    const cleaned = html.replace(/mix-blend-mode:\s*multiply;?/g, '');
    const { html: htmlForEmail, attachments: cidAtts } = buildCidHtml(cleaned);
    const puppeteer = require('puppeteer');
    const br = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const pg = await br.newPage();
    await pg.setViewport({ width: 794, height: 1123 });
    await pg.setContent(html, { waitUntil: 'networkidle0' });
    const h = await pg.evaluate('document.querySelector(".page")?document.querySelector(".page").scrollHeight:document.documentElement.scrollHeight') as number;
    if (h > 1123) { const s=(1123/(h+20)).toFixed(4); await pg.evaluate(`(function(){var s=${s};var p=document.querySelector('.page');if(!p)return;var w=document.createElement('div');w.style.cssText='width:210mm;height:297mm;overflow:hidden;';p.style.transform='scale('+s+')';p.style.transformOrigin='top left';p.style.width=(100/s)+'%';p.style.height='auto';p.style.overflow='visible';p.parentNode.insertBefore(w,p);w.appendChild(p);})()`); }
    await pg.addStyleTag({ content: 'html,body{width:210mm;height:297mm;overflow:hidden;}' });
    const pdfBuf = await pg.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' }, preferCSSPageSize: true });
    await br.close();
    for (const r of parsedRecipients) {
      try {
        const mo: any = { from: fromStr, to: r.email, subject: `Übungsplan ${plan.year}`, text: payload.companionText || `Übungsplan ${plan.year}`, attachments: [...cidAtts, { filename: `Uebungsplan-${plan.year}.pdf`, content: pdfBuf, contentType: 'application/pdf' }] };
        if (payload.sendMode !== 'pdf_only') mo.html = payload.companionText ? `<p>${payload.companionText.replace(/\n/g, '<br>')}</p><br>${htmlForEmail}` : htmlForEmail;
        await transporter.sendMail(mo); sent++;
      } catch { failed++; }
    }
    if (sent > 0) await prisma.$executeRawUnsafe('UPDATE training_plans SET "sendCount" = "sendCount" + $1, "lastSentAt" = NOW(), "updatedAt" = NOW() WHERE id = $2', sent, payload.planId);
  } else {
    const design = payload.designSnapshot ? (typeof payload.designSnapshot === 'string' ? (() => { try { return JSON.parse(payload.designSnapshot); } catch { return {}; } })() : payload.designSnapshot) : {};
    const signers = await loadSignersForEmail(parsedSignerIds, prisma);
    const date = payload.date || new Date().toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' });
    const htmlContent = job.draftType === 'invitation'
      ? generateInvitationHtml({ design, eventName: payload.eventName||'', eventDate: payload.eventDate||'', eventTime: payload.eventTime||'', eventLocation: payload.eventLocation||'', eventProgram: payload.eventProgram||'', rsvpDeadline: payload.rsvpDeadline||'', directions: payload.directions||'', introText: payload.introText||'', closing: payload.closing||'', recipientName: '', recipientAddress: '', date, signers })
      : generateLetterHtml({ design, subject: payload.subject||'', salutation: payload.salutation||'', body: payload.body||'', closing: payload.closing||'', recipientName: '', recipientAddress: '', date, signers });
    const inlinedHtml = await (inlineImages as any)(htmlContent);
    const cleaned = inlinedHtml.replace(/mix-blend-mode:\s*multiply;?/g, '');
    const { html: htmlForEmail, attachments: cidAtts } = buildCidHtml(cleaned);
    const sendMode = payload.sendMode || 'html_pdf';
    let pdfBuf: Buffer | null = null;
    if (sendMode === 'pdf' || sendMode === 'html_pdf') {
      const puppeteer = require('puppeteer');
      const br = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const pg = await br.newPage();
      await pg.setViewport({ width: 794, height: 1123 });
      await pg.setContent(inlinedHtml, { waitUntil: 'networkidle0' });
      const h = await pg.evaluate('document.documentElement.scrollHeight') as number;
      if (h > 1123) { const s=(1123/(h+20)).toFixed(4); await pg.evaluate(`(function(){var s=${s};var p=document.querySelector('.page');if(!p)return;var w=document.createElement('div');w.style.cssText='width:210mm;height:297mm;overflow:hidden;';p.style.transform='scale('+s+')';p.style.transformOrigin='top left';p.style.width=(100/s)+'%';p.style.height='auto';p.style.overflow='visible';p.parentNode.insertBefore(w,p);w.appendChild(p);})()`); }
      await pg.addStyleTag({ content: 'html,body{width:210mm;height:297mm;overflow:hidden;}' });
      pdfBuf = await pg.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' }, preferCSSPageSize: true });
      await br.close();
    }
    const subject = payload.subject || (job.draftType === 'invitation' ? payload.eventName || 'Einladung' : 'Kein Betreff');
    for (const r of parsedRecipients) {
      try {
        const atts: any[] = [...cidAtts];
        if (pdfBuf) atts.push({ filename: `${subject}.pdf`, content: pdfBuf, contentType: 'application/pdf' });
        const htmlBody = sendMode === 'pdf' ? `<p style="font-family:Arial,sans-serif;font-size:14px;color:#333;">${payload.companionText||subject}</p>` : htmlForEmail;
        // Benutzer-Anhänge aus Base64 wiederherstellen (DB-persistent)
        if (Array.isArray(payload.userAttachments)) {
          for (const ua of payload.userAttachments) {
            atts.push({ filename: ua.filename, content: Buffer.from(ua.content, 'base64'), contentType: ua.mimetype });
          }
        }
        await transporter.sendMail({ from: fromStr, to: r.email, subject, text: payload.companionText || subject, html: payload.companionText && sendMode !== 'pdf' ? `<p style="font-family:Arial,sans-serif;font-size:14px;color:#333;">${payload.companionText.replace(/\n/g,'<br>')}</p><br>${htmlBody}` : htmlBody, attachments: atts });
        sent++;
      } catch { failed++; }
    }
  }
  return { sent, failed };
}

async function runScheduledSendWorker() {
  try {
    const due = await (prisma as any).scheduledSend.findMany({
      where: { status: 'pending', scheduledAt: { lte: new Date() } }, take: 5,
    });
    for (const job of due) {
      const updated = await (prisma as any).scheduledSend.updateMany({
        where: { id: job.id, status: 'pending' }, data: { status: 'processing' },
      });
      if (updated.count === 0) continue;
      try {
        const { sent, failed } = await executeScheduledJob(job);
        await (prisma as any).scheduledSend.update({
          where: { id: job.id },
          data: { status: failed === 0 ? 'sent' : sent > 0 ? 'partial' : 'failed', sentAt: new Date(), sentCount: sent, failedCount: failed },
        });
        console.log(`[ScheduledSend] Job ${job.id}: ${sent} gesendet, ${failed} fehlgeschlagen`);
      } catch (err: any) {
        console.error(`[ScheduledSend] Job ${job.id} Fehler:`, err?.message);
        await (prisma as any).scheduledSend.update({ where: { id: job.id }, data: { status: 'failed', errorMessage: err?.message } }).catch(() => {});
      }
    }
  } catch (err) { console.error('[ScheduledSend Worker]', err); }
}

setInterval(runScheduledSendWorker, 60 * 1000);
console.log('[ScheduledSend Worker] Aktiv — prüft jede Minute auf fällige Aufträge');
