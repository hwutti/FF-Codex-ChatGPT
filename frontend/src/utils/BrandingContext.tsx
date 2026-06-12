import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

export interface Branding {
  name: string;
  subtitle: string;
  foundedYear: string;
  primaryColor: string;
  logoUrl: string | null;
  pwaIcon: string | null;
  dashboardBgColor: string | null;
  dashboardBgImage: string | null;
  dashboardTextColor: string;
  radarLat: number;
  radarLng: number;
  radarZoom: number;
  radarLayer: string;
  radarOpacity: number;
  radarSpeed: number;
  radarHeight: number;
  radarLabels: boolean;
  radarDarkMap: boolean;
  radarTitle: string;
  loginTitle: string;
  loginSubtitle: string;
  loginColor: string;
  loginBadge: string;
  loginWelcomeTitle: string;
  loginWelcomeSubtitle: string;
  loginBgColor: string;
  loginBgImage: string | null;
  fontGeneral: string;
  fontHeadings: string;
  fontLogin: string;
  fontSidebar: string;
  fontDashboard: string;
  fontPrivacy: string;
}

const DEFAULT: Branding = {
  name: 'Feuerwehr Görtschach',
  subtitle: 'Verwaltung',
  foundedYear: '1888',
  primaryColor: '#a82828',
  logoUrl: null,
  pwaIcon: null,
  dashboardBgColor: '#2d2724',
  dashboardBgImage: null,
  dashboardTextColor: '#ffffff',
  radarLat: 46.62,
  radarLng: 13.22,
  radarZoom: 9,
  radarLayer: 'radar',
  radarOpacity: 83,
  radarSpeed: 4,
  radarHeight: 220,
  radarLabels: false,
  radarDarkMap: false,
  radarTitle: 'Regenradar — Görtschach',
  loginTitle: 'Mitglieder & Einsatzverwaltung',
  loginSubtitle: 'Professionelle Verwaltung für die Freiwillige Feuerwehr',
  loginColor: '#a82828',
  loginBadge: 'VERWALTUNGSSYSTEM',
  loginWelcomeTitle: 'Willkommen zurück',
  loginWelcomeSubtitle: 'Bitte melde dich an um fortzufahren.',
  loginBgColor: '#1a0a05',
  loginBgImage: null,
  fontGeneral: 'DM Sans',
  fontHeadings: 'Outfit',
  fontLogin: 'Outfit',
  fontSidebar: 'DM Sans',
  fontDashboard: 'Outfit',
  fontPrivacy: 'DM Sans',
};

const BrandingContext = createContext<{
  branding: Branding;
  reload: () => void;
}>({ branding: DEFAULT, reload: () => {} });

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<Branding>(DEFAULT);

  const load = () => {
    api.get('/settings').then(r => {
      const s = r.data;
      const fonts = {
        fontGeneral: s.fontGeneral || DEFAULT.fontGeneral,
        fontHeadings: s.fontHeadings || DEFAULT.fontHeadings,
        fontLogin: s.fontLogin || DEFAULT.fontLogin,
        fontSidebar: s.fontSidebar || DEFAULT.fontSidebar,
        fontDashboard: s.fontDashboard || DEFAULT.fontDashboard,
        fontPrivacy: s.fontPrivacy || DEFAULT.fontPrivacy,
      };
      setBranding({
        name: s.name || DEFAULT.name,
        subtitle: s.subtitle || DEFAULT.subtitle,
        foundedYear: s.foundedYear || DEFAULT.foundedYear,
        primaryColor: s.primaryColor || DEFAULT.primaryColor,
        logoUrl: s.logoUrl ? (s.logoUrl.startsWith('http') ? new URL(s.logoUrl).pathname : s.logoUrl) : null,
        pwaIcon: s.pwaIcon ? (s.pwaIcon.startsWith('http') ? new URL(s.pwaIcon).pathname : s.pwaIcon) : null,
        dashboardBgColor: s.dashboardBgColor || '#2d2724',
        dashboardBgImage: s.dashboardBgImage ? (s.dashboardBgImage.startsWith('http') ? new URL(s.dashboardBgImage).pathname : s.dashboardBgImage) : null,
        dashboardTextColor: s.dashboardTextColor || '#ffffff',
        radarLat: s.radarLat ?? 46.62,
        radarLng: s.radarLng ?? 13.22,
        radarZoom: s.radarZoom ?? 9,
        radarLayer: s.radarLayer || 'radar',
        radarOpacity: s.radarOpacity ?? 83,
        radarSpeed: s.radarSpeed ?? 4,
        radarHeight: s.radarHeight ?? 220,
        radarLabels: s.radarLabels ?? false,
        radarDarkMap: s.radarDarkMap ?? false,
        radarTitle: s.radarTitle || 'Regenradar — Görtschach',
        loginTitle: s.loginTitle || DEFAULT.loginTitle,
        loginSubtitle: s.loginSubtitle || DEFAULT.loginSubtitle,
        loginColor: s.loginColor || DEFAULT.loginColor,
        loginBadge: s.loginBadge || DEFAULT.loginBadge,
        loginWelcomeTitle: s.loginWelcomeTitle || DEFAULT.loginWelcomeTitle,
        loginWelcomeSubtitle: s.loginWelcomeSubtitle || DEFAULT.loginWelcomeSubtitle,
        loginBgColor: s.loginBgColor || DEFAULT.loginBgColor,
        loginBgImage: s.loginBgImage ? (s.loginBgImage.startsWith('http') ? new URL(s.loginBgImage).pathname : s.loginBgImage) : null,
        ...fonts,
      });

      // CSS-Variablen setzen
      const primary = s.primaryColor || DEFAULT.primaryColor;
      document.documentElement.style.setProperty('--color-primary', primary);
      document.documentElement.style.setProperty('--btn-primary-bg', primary);
      // Schriftarten als CSS-Variablen
      document.documentElement.style.setProperty('--font-general', `'${fonts.fontGeneral}', system-ui, sans-serif`);
      document.documentElement.style.setProperty('--font-headings', `'${fonts.fontHeadings}', system-ui, sans-serif`);
      document.documentElement.style.setProperty('--font-login', `'${fonts.fontLogin}', system-ui, sans-serif`);
      document.documentElement.style.setProperty('--font-sidebar', `'${fonts.fontSidebar}', system-ui, sans-serif`);
      document.documentElement.style.setProperty('--font-dashboard', `'${fonts.fontDashboard}', system-ui, sans-serif`);
      document.documentElement.style.setProperty('--font-privacy', `'${fonts.fontPrivacy}', system-ui, sans-serif`);

      // Page title + Favicon
      document.title = `${s.name || DEFAULT.name} – Verwaltung`;
      if (s.logoUrl) {
        const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (favicon) favicon.href = s.logoUrl;
        const favicon2 = document.querySelector('link[rel="icon"][sizes="32x32"]') as HTMLLinkElement;
        if (favicon2) favicon2.href = s.logoUrl;
        const appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
        if (appleTouchIcon) appleTouchIcon.href = s.logoUrl;
        let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
        if (!link) { link = document.createElement('link') as HTMLLinkElement; document.head.appendChild(link); }
        link.type = 'image/png'; link.rel = 'shortcut icon';
        link.href = s.logoUrl + '?t=' + Date.now();
      }
    }).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  return (
    <BrandingContext.Provider value={{ branding, reload: load }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => useContext(BrandingContext);
