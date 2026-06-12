import { prisma } from '../config/database';

const DEFAULT_BODY = `Du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt. Klicke auf den Button um ein neues Passwort zu vergeben.

Anleitung:
1. Klicke auf den Button "Passwort zurücksetzen"
2. Du wirst zur App weitergeleitet
3. Gib dein neues Passwort zweimal ein
4. Bestätige — du wirst danach automatisch zur Anmeldung weitergeleitet

Falls du keine Anfrage gestellt hast, kannst du diese E-Mail ignorieren. Dein Passwort bleibt unverändert.`;

export interface EmailBranding {
  name: string;
  logoUrl: string | null;
  headerBg: string;
  headerImage: string | null;
  buttonBg: string;
  footerText: string;
  subject: string;
  headline: string;
  bodyText: string;
  buttonText: string;
  font: string;
  appUrl: string;
}

export async function getEmailBranding(appUrl: string): Promise<EmailBranding> {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'singleton' },
      select: {
        name: true, logoUrl: true, primaryColor: true,
        emailHeaderBg: true, emailButtonBg: true, emailFooterText: true,
        emailSubject: true, emailHeadline: true, emailBodyText: true,
        emailButtonText: true, emailHeaderImage: true, emailFont: true,
      } as any,
    }) as any;

    const primaryColor = settings?.primaryColor || '#a82828';
    const name = settings?.name || 'Feuerwehr Verwaltung';

    return {
      name,
      logoUrl: settings?.logoUrl ? `${appUrl}${settings.logoUrl}` : null,
      headerBg: settings?.emailHeaderBg || primaryColor,
      headerImage: settings?.emailHeaderImage ? `${appUrl}${settings.emailHeaderImage}` : null,
      buttonBg: settings?.emailButtonBg || primaryColor,
      footerText: settings?.emailFooterText || `${name} — Internes Verwaltungssystem`,
      subject: (settings?.emailSubject || 'Passwort zurücksetzen — {{name}}').replace('{{name}}', name),
      headline: settings?.emailHeadline || 'Passwort zurücksetzen',
      bodyText: settings?.emailBodyText || DEFAULT_BODY,
      buttonText: settings?.emailButtonText || 'Passwort zurücksetzen →',
      font: settings?.emailFont || 'Arial',
      appUrl,
    };
  } catch {
    return {
      name: 'Feuerwehr Verwaltung',
      logoUrl: null,
      headerBg: '#a82828',
      headerImage: null,
      buttonBg: '#a82828',
      footerText: 'Feuerwehr Verwaltung — Internes Verwaltungssystem',
      subject: 'Passwort zurücksetzen — Feuerwehr Verwaltung',
      headline: 'Passwort zurücksetzen',
      bodyText: DEFAULT_BODY,
      buttonText: 'Passwort zurücksetzen →',
      font: 'Arial',
      appUrl,
    };
  }
}

export function buildPasswordResetEmail(branding: EmailBranding, resetUrl: string): string {
  const logoHtml = branding.logoUrl
    ? `<img src="${branding.logoUrl}" alt="${branding.name}" style="height:64px;width:auto;object-fit:contain;display:block;margin:0 auto 12px;" />`
    : '';

  const headerStyle = branding.headerImage
    ? `background:${branding.headerBg} url('${branding.headerImage}') center/cover no-repeat;`
    : `background:${branding.headerBg};`;

  // Bodytext: Zeilenumbrüche in HTML umwandeln, Nummerierungen erkennen
  const bodyHtml = branding.bodyText
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '<br/>';
      if (/^\d+\./.test(trimmed)) return `<p style="margin:4px 0;font-size:14px;color:#374151;font-family:'${branding.font}',sans-serif;padding-left:16px;">${trimmed}</p>`;
      return `<p style="margin:6px 0;font-size:15px;color:#374151;line-height:1.6;font-family:'${branding.font}',sans-serif;">${trimmed}</p>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${branding.headline}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="${headerStyle}padding:32px;text-align:center;">
            ${logoHtml}
            <p style="margin:0;color:#ffffff;font-size:13px;font-family:'${branding.font}',sans-serif;opacity:0.85;">${branding.name}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 24px;">
            <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#111827;font-family:'${branding.font}',sans-serif;">
              ${branding.headline}
            </h1>

            <div style="margin:0 0 28px;">
              ${bodyHtml}
            </div>

            <!-- Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="border-radius:10px;background:${branding.buttonBg};">
                  <a href="${resetUrl}"
                     style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;font-family:'${branding.font}',sans-serif;border-radius:10px;">
                    ${branding.buttonText}
                  </a>
                </td>
              </tr>
            </table>

            <!-- Link fallback -->
            <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;font-family:'${branding.font}',sans-serif;">
              Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:
            </p>
            <p style="margin:0 0 24px;font-size:12px;color:#6b7280;word-break:break-all;font-family:monospace;background:#f9fafb;padding:10px 14px;border-radius:8px;border:1px solid #e5e7eb;">
              ${resetUrl}
            </p>

            <!-- Warning -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#fef9ec;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;">
                  <p style="margin:0;font-size:13px;color:#92400e;font-family:'${branding.font}',sans-serif;">
                    ⏱ Dieser Link ist <strong>1 Stunde gültig</strong>.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;font-family:'${branding.font}',sans-serif;">
              ${branding.footerText}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildPasswordResetEmailPreview(branding: EmailBranding): string {
  return buildPasswordResetEmail(branding, '#VORSCHAU-LINK');
}
