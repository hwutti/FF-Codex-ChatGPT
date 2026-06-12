import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { reportApi, memberApi, honorApi, birthdayApi, settingsApi, eventApi, incidentApi, vehicleApi, equipmentApi } from '../api';
import { Download, FileText, Users, Calendar, Cake, Award, File, Shield, Car, Wrench, BookOpen, Pencil, RefreshCw, Check, X, Loader } from 'lucide-react';
import { useAuth } from '../utils/AuthContext';
import toast from 'react-hot-toast';
import { useBranding } from '../utils/BrandingContext';

type Format = 'csv' | 'pdf';

interface ReportDef {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  hasFilter?: boolean;
  category: 'personal' | 'fahrtenbuch' | 'geraete' | 'jahresbericht';
}

const reports: ReportDef[] = [
  // Bestehende
  { id: 'members',           title: 'Kamerad:innenliste',         description: 'Alle Mitglieder mit Stammdaten',                    icon: <Users className="h-5 w-5 text-blue-600" />,   category: 'personal' },
  { id: 'attendance',        title: 'Anwesenheitsliste Ereignisse', description: 'Anwesenheiten aller Ereignisse',                  icon: <Calendar className="h-5 w-5 text-green-600" />, category: 'personal', hasFilter: true },
  { id: 'attendance_member', title: 'Anwesenheit pro Kamerad:in', description: 'Pro Kamerad:in alle Ereignisse mit Quote',          icon: <Users className="h-5 w-5 text-blue-600" />,   category: 'personal', hasFilter: true },
  { id: 'birthdays',         title: 'Geburtstagsliste',           description: 'Alle Geburtstage der aktiven Mitglieder',           icon: <Cake className="h-5 w-5 text-amber-600" />,   category: 'personal' },
  { id: 'honors',            title: 'Ehrungsliste',               description: 'Alle Ehrungen und Auszeichnungen',                  icon: <Award className="h-5 w-5 text-purple-600" />, category: 'personal' },
  // Fahrtenbuch
  { id: 'vehicles',          title: 'Fahrtenbuch',                description: 'Alle Fahrten pro Fahrzeug, km, Kraftstoff, Kosten', icon: <Car className="h-5 w-5 text-fire-700" />,     category: 'fahrtenbuch', hasFilter: true },
  // Gerätebuch
  { id: 'equipment',         title: 'Gerätebuch',                 description: 'Alle Geräte mit Prüfstatus, offene Defekte',        icon: <Wrench className="h-5 w-5 text-purple-600" />, category: 'geraete' },
  // Jahresbericht
  { id: 'annual',            title: 'Jahresbericht',              description: 'Einsätze, Übungen, km, Anwesenheit in einem Dok',   icon: <BookOpen className="h-5 w-5 text-emerald-600" />, category: 'jahresbericht', hasFilter: true },
];

// Load image as base64 - resize to max 200px but full quality
async function loadImageAsBase64(url: string, maxSize = 200): Promise<string | null> {
  try {
    // URL immer relativ zum aktuellen Ursprung machen (verhindert IP/Domain-Probleme)
    if (url && url.startsWith('http')) {
      try {
        const parsed = new URL(url);
        url = parsed.pathname + parsed.search; // nur den Pfad behalten
      } catch {}
    }
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png')); // PNG = verlustfrei
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(blob);
    });
  } catch { return null; }
}

export async function generatePDFReport(reportId: string, brandingName: string, brandingLogoUrl: string | null, dateFrom?: string, dateTo?: string, preloadedAiSections?: Record<string,string>, userName?: string) {
  const { jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Roboto einbinden für Unicode-Support (ä, ö, ü, →, etc.)
  try {
    const fontResponse = await fetch('/Roboto-Regular.ttf');
    const fontBuffer = await fontResponse.arrayBuffer();
    const fontBase64 = btoa(String.fromCharCode(...new Uint8Array(fontBuffer)));
    doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.setFont('Roboto');
  } catch {
    // Fallback zu Helvetica wenn Font nicht ladbar
    doc.setFont('helvetica');
  }
  const reportTitle = reports.find(r => r.id === reportId)?.title || reportId;
  const dateStr = new Date().toLocaleDateString('de-AT');
  const now = new Date();
  const timeStr = now.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  const timestamp = `Erstellt am ${dateStr} um ${timeStr} Uhr${userName ? ' von ' + userName : ''}`;
  const fileTimestamp = `${dateStr.replace(/\./g, '-')}_${timeStr.replace(':', '-')}`;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Primary color (Feuerwehr-Rot als Default)
  const primaryR = 168, primaryG = 40, primaryB = 40;

  const LOGO_SIZE = 28;
  const LOGO_MARGIN = 10;
  const LOGO_X = pageWidth - LOGO_MARGIN - LOGO_SIZE;
  const LOGO_Y = 8;

  // ── Logo (right side, proportional) ────────────────────────────────────────
  let logoImgData: string | null = null;
  if (brandingLogoUrl) {
    logoImgData = await loadImageAsBase64(brandingLogoUrl, 400);
    if (logoImgData) {
      try {
        // Get actual image dimensions for proportional rendering
        const img = new Image();
        await new Promise<void>(resolve => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = logoImgData!;
        });
        const ratio = img.width > 0 && img.height > 0 ? img.width / img.height : 1;
        const logoW = ratio >= 1 ? LOGO_SIZE : LOGO_SIZE * ratio;
        const logoH = ratio >= 1 ? LOGO_SIZE / ratio : LOGO_SIZE;
        const logoXAdjusted = LOGO_X + (LOGO_SIZE - logoW) / 2;
        const logoYAdjusted = LOGO_Y + (LOGO_SIZE - logoH) / 2;
        try {
          doc.addImage(logoImgData, 'JPEG', logoXAdjusted, logoYAdjusted, logoW, logoH);
        } catch {
          try { doc.addImage(logoImgData, 'PNG', logoXAdjusted, logoYAdjusted, logoW, logoH); } catch {}
        }
      } catch {}
    }
  }

  // ── Title (left side, dynamic height) ─────────────────────────────────────
  const titleMaxWidth = LOGO_X - 18;
  const titleFontSize = 15;
  doc.setFontSize(titleFontSize);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);

  const titleText = `${brandingName} – ${reportTitle}`;
  const titleLines = doc.splitTextToSize(titleText, titleMaxWidth);
  const lineHeight = titleFontSize * 0.4; // approx mm per line
  const titleStartY = 16;
  doc.text(titleLines, 14, titleStartY);

  const titleEndY = titleStartY + (titleLines.length - 1) * lineHeight + 2;
  const dateY = titleEndY + 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(timestamp, 14, dateY);

  // Line below the taller of: logo bottom or date text
  const HEADER_BOTTOM = Math.max(LOGO_Y + LOGO_SIZE + 4, dateY + 5);

  // ── Divider ────────────────────────────────────────────────────────────────
  doc.setDrawColor(168, 40, 40);
  doc.setLineWidth(0.5);
  doc.line(14, HEADER_BOTTOM, pageWidth - 14, HEADER_BOTTOM);

  let startY = HEADER_BOTTOM + 6;

  if (reportId === 'members') {
    const res = await memberApi.list({ limit: '500', status: '' });
    const members = res.members || [];

    // Load all member avatars
    const avatarImages: Record<string, string | null> = {};
    await Promise.all(members.map(async (m: any) => {
      if (m.user?.avatarUrl) {
        avatarImages[m.id] = await loadImageAsBase64(m.user.avatarUrl, 400);
      }
    }));

    const STATUS_LABEL: Record<string, string> = {
      ACTIVE: 'Aktiv', RESERVE: 'Reservist', YOUTH: 'Jugend', HONORARY: 'Ehrenmitglied', EXITED: 'Ausgetreten',
    };

    // Use autoTable with didDrawCell to add images
    autoTable(doc, {
      head: [['', 'Nr.', 'Name', 'Dienstgrad', 'Status', 'Funktion', 'Gruppe', 'Eintritt']],
      body: members.map((m: any) => [
        '', // placeholder for image
        m.memberNumber || '',
        `${m.firstName} ${m.lastName}`,
        m.rank || '',
        STATUS_LABEL[m.status] || m.status,
        m.functionTitle || '',
        m.groupName || '',
        m.entryDate ? new Date(m.entryDate).toLocaleDateString('de-AT') : '',
      ]),
      startY,
      rowHeight: 14,
      styles: { fontSize: 8, cellPadding: { top: 2, bottom: 2, left: 2, right: 2 }, valign: 'middle' },
      headStyles: { fillColor: [168, 40, 40], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 247, 245] },
      columnStyles: {
        0: { cellWidth: 12 }, // image column
        1: { cellWidth: 12 },
        2: { cellWidth: 30 },
        3: { cellWidth: 32 },
        4: { cellWidth: 20 },
        5: { cellWidth: 28 },
        6: { cellWidth: 22 },
        7: { cellWidth: 18 },
      },
      didDrawCell: (data: any) => {
        if (data.column.index === 0 && data.section === 'body') {
          const member = members[data.row.index];
          if (!member) return;
          const imgData = avatarImages[member.id];
          if (!imgData) return;
          try {
            const padding = 1;
            const cellH = data.cell.height - padding * 2;
            const cellW = data.cell.width - padding * 2;
            const maxSize = Math.min(cellH, cellW);
            // Get image dimensions for aspect ratio
            const tempImg = document.createElement('img');
            tempImg.src = imgData;
            const ratio = tempImg.naturalWidth > 0 && tempImg.naturalHeight > 0
              ? tempImg.naturalWidth / tempImg.naturalHeight : 1;
            // Fit proportionally in square cell
            let drawW = maxSize;
            let drawH = maxSize;
            if (ratio > 1) { drawH = maxSize / ratio; }
            else if (ratio < 1) { drawW = maxSize * ratio; }
            const offsetX = (cellW - drawW) / 2;
            const offsetY = (cellH - drawH) / 2;
            doc.addImage(
              imgData, 'JPEG',
              data.cell.x + padding + offsetX,
              data.cell.y + padding + offsetY,
              drawW, drawH
            );
          } catch {}
        }
      },
    });

  } else if (reportId === 'attendance') {
    const res = await eventApi.list({ limit: '500' });
    const events = Array.isArray(res) ? res : (res.events || []);

    // Ereignisse
    for (const ev of events) {
      try {
        const attData = await eventApi.getAttendance(ev.id);
        const attendances = attData?.attendances || attData || [];
        if (!attendances.length) continue;

        const present = attendances.filter((a: any) => a.status === 'PRESENT');
        const excused = attendances.filter((a: any) => a.status === 'EXCUSED');
        const absent  = attendances.filter((a: any) => a.status === 'ABSENT');

        const evDate = ev.date ? new Date(ev.date).toLocaleDateString('de-AT') : '';
        const prevY = (doc as any).lastAutoTable?.finalY;
        const headerY = prevY ? prevY + 10 : startY;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text(`${evDate} – ${ev.title}`, 14, headerY);

        autoTable(doc, {
          head: [['Name', 'Dienstgrad', 'Status']],
          body: attendances.map((a: any) => [
            a.member ? `${a.member.firstName} ${a.member.lastName}` : '',
            a.member?.rank || '',
            a.status === 'PRESENT' ? 'Anwesend' : a.status === 'EXCUSED' ? 'Entschuldigt' : 'Abwesend',
          ]),
          startY: headerY + 5,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [168, 40, 40], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [250, 247, 245] },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 2) {
              const val = data.cell.raw;
              if (val === 'Anwesend') data.cell.styles.textColor = [22, 101, 52];
              else if (val === 'Entschuldigt') data.cell.styles.textColor = [133, 77, 14];
              else data.cell.styles.textColor = [153, 27, 27];
            }
          },
          foot: [[`Anwesend: ${present.length}`, `Entschuldigt: ${excused.length}`, `Abwesend: ${absent.length}`]],
          footStyles: { fillColor: [240, 240, 240], textColor: [80, 80, 80], fontStyle: 'bold', fontSize: 8 },
        });
      } catch {}
    }

    // Einsätze mit Mitgliedern in einem Call
    const incidents = await incidentApi.withMembers();

    for (const inc of incidents) {
      const members = inc.members || [];
      if (!members.length) continue;

      const incDate = inc.alarmTime ? new Date(inc.alarmTime).toLocaleDateString('de-AT') : '';
      const prevY2 = (doc as any).lastAutoTable?.finalY;
      const headerY2 = prevY2 ? prevY2 + 10 : startY;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(168, 40, 40);
      const incTypeLabels: Record<string, string> = {
        FIRE: 'Brandeinsatz', TECHNICAL: 'Techn. Einsatz',
        TRAFFIC_ACCIDENT: 'Verkehrsunfall', STORM: 'Sturm/Unwetter',
        SEARCH: 'Sucheinsatz', OTHER: 'Sonstiger Einsatz',
      };
      const incTypeLabel = incTypeLabels[inc.type] || inc.type || '';
      doc.text(`Einsatz ${incDate} – #${inc.incidentNumber}${incTypeLabel ? ' (' + incTypeLabel + ')' : ''}`, 14, headerY2);
      if (inc.location) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(inc.location, 14, headerY2 + 5);
      }

      autoTable(doc, {
        head: [['Name', 'Dienstgrad']],
        body: members.map((m: any) => [
          m.member ? `${m.member.firstName} ${m.member.lastName}` : '',
          m.member?.rank || '',
        ]),
        startY: headerY2 + (inc.location ? 8 : 5),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [168, 40, 40], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 248, 248] },
        foot: [[`Einsatzkräfte: ${members.length}`, '']],
        footStyles: { fillColor: [240, 240, 240], textColor: [80, 80, 80], fontStyle: 'bold', fontSize: 8 },
      });
    }

  } else if (reportId === 'attendance_member') {
    // Alle Ereignisse laden
    const res = await eventApi.list({ limit: '500' });
    const events = Array.isArray(res) ? res : (res.events || []);

    // Alle Mitglieder laden
    const mRes = await memberApi.list({ limit: '500', status: '' });
    const members = mRes.members || [];

    // Alle Anwesenheiten pro Ereignis laden
    const allAttendances: Record<string, any[]> = {};
    for (const ev of events) {
      try {
        const attData = await eventApi.getAttendance(ev.id);
        allAttendances[ev.id] = attData?.attendances || attData || [];
      } catch {}
    }

    // Pro Mitglied eine Tabelle
    for (const member of members) {
      const memberName = `${member.firstName} ${member.lastName}`;
      const evTypeLabels: Record<string, string> = {
        MEETING: 'Versammlung', EXERCISE: 'Übung', INCIDENT: 'Einsatz',
        FIRE_INCIDENT: 'Brandeinsatz', TECHNICAL_INCIDENT: 'Techn. Einsatz',
        FUNERAL: 'Begräbnis', EVENT: 'Veranstaltung', TRAINING: 'Ausbildung', OTHER: 'Sonstiges',
      };
      const memberEvents = events.map(ev => {
        const att = (allAttendances[ev.id] || []).find((a: any) => a.memberId === member.id);
        return {
          date: ev.date ? new Date(ev.date).toLocaleDateString('de-AT') : '',
          title: ev.title,
          type: evTypeLabels[ev.type] || ev.type || '',
          status: att ? (att.status === 'PRESENT' ? 'Anwesend' : att.status === 'EXCUSED' ? 'Entschuldigt' : 'Abwesend') : '-',
          raw: att?.status || '',
        };
      }).filter(e => e.status !== '—');

      if (!memberEvents.length) continue;

      const present = memberEvents.filter(e => e.raw === 'PRESENT').length;
      const total = memberEvents.length;
      const quote = total > 0 ? Math.round((present / total) * 100) : 0;

      const prevY = (doc as any).lastAutoTable?.finalY;
      const tableY = prevY ? prevY + 12 : startY;

      // Check if enough space for header + at least 2 rows
      const pageH = doc.internal.pageSize.getHeight();
      if (tableY > pageH - 40) doc.addPage();

      const headerY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 12 : startY;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text(`${memberName}  ·  ${member.rank || '—'}`, 14, headerY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Anwesenheitsquote: ${quote}%  (${present} von ${total} Ereignissen)`, 14, headerY + 5);

      autoTable(doc, {
        head: [['Datum', 'Ereignis', 'Status']],
        body: memberEvents.map(e => [e.date, e.title, e.status]),
        startY: headerY + 8,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [168, 40, 40], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [250, 247, 245] },
        columnStyles: { 0: { cellWidth: 22 }, 2: { cellWidth: 25 } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 2) {
            const val = data.cell.raw;
            if (val === 'Anwesend') data.cell.styles.textColor = [22, 101, 52];
            else if (val === 'Entschuldigt') data.cell.styles.textColor = [133, 77, 14];
            else if (val === 'Abwesend') data.cell.styles.textColor = [153, 27, 27];
          }
        },
      });
    }

  } else if (reportId === 'birthdays') {
    const data = await birthdayApi.list();
    const members = Array.isArray(data) ? data : [];
    autoTable(doc, {
      head: [['Name', 'Dienstgrad', 'Geburtsdatum', 'Alter', 'Dienstjahre']],
      body: members.map((m: any) => [
        `${m.firstName} ${m.lastName}`,
        m.rank || '',
        m.birthDate ? new Date(m.birthDate).toLocaleDateString('de-AT') : '',
        m.age || '',
        m.yearsOfService || '',
      ]),
      startY,
      styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
      headStyles: { fillColor: [168, 40, 40], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 247, 245] },
    });

  } else if (reportId === 'honors') {
    const data = await honorApi.list();
    const honors = Array.isArray(data) ? data : (data.honors || []);
    autoTable(doc, {
      head: [['Kamerad:in', 'Ehrung', 'Datum', 'Verliehen durch', 'Anlass']],
      body: honors.map((h: any) => [
        h.member ? `${h.member.firstName} ${h.member.lastName}` : '',
        h.title || '',
        h.honorDate ? new Date(h.honorDate).toLocaleDateString('de-AT') : '',
        h.awardedBy || '',
        h.reason || '',
      ]),
      startY,
      styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
      headStyles: { fillColor: [168, 40, 40], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 247, 245] },
    });

  // ── Fahrtenbuch ───────────────────────────────────────────────────────────────
  } else if (reportId === 'vehicles') {
    const [vehicles, tripsData] = await Promise.all([
      vehicleApi.listVehicles(),
      vehicleApi.listTrips({ limit: '9999', ...(dateFrom ? { from: dateFrom } : {}), ...(dateTo ? { to: dateTo } : {}) }),
    ]);
    const trips = tripsData.trips || [];
    // Fuel separat pro Fahrzeug laden
    const fuelAll = await vehicleApi.listFuel();
    const fuelData = Array.isArray(fuelAll) ? fuelAll : [];

    let currentY = startY;
    for (const vehicle of vehicles) {
      const vTrips = trips.filter((t: any) => t.vehicleId === vehicle.id);
      const vFuel = fuelData.filter((f: any) => f.vehicleId === vehicle.id);
      const totalKm = vTrips.reduce((s: number, t: any) => s + (t.endKm - t.startKm), 0);
      const totalLiters = vFuel.reduce((s: number, f: any) => s + (f.liters || 0), 0);
      const totalCost = vFuel.reduce((s: number, f: any) => s + (f.costTotal || 0), 0);

      // Neue Seite wenn nötig
      if (currentY > 250) { doc.addPage(); currentY = 20; }

      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryR, primaryG, primaryB);
      doc.text(`${vehicle.name}${vehicle.licensePlate ? ` (${vehicle.licensePlate})` : ''}`, 14, currentY + 6);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100,100,100);
      doc.text(`${vTrips.length} Fahrten · ${totalKm.toLocaleString('de-AT')} km · ${totalLiters.toFixed(0)} L · € ${totalCost.toFixed(2)}`, 14, currentY + 12);

      if (vTrips.length > 0) {
        // Unterschriften für alle Fahrten laden
        const signaturesMap: Record<string, any[]> = {};
        await Promise.all(vTrips.map(async (t: any) => {
          try {
            const res = await fetch(`/api/trips/${t.id}/signatures`, { credentials: 'include' });
            signaturesMap[t.id] = await res.json();
          } catch { signaturesMap[t.id] = []; }
        }));

        // Tabelle ohne Unterschriften zuerst rendern
        autoTable(doc, {
          startY: currentY + 16,
          head: [['Datum','Fahrer','Von\nNach','km','Fahrzweck','Getankt','Unterschriften']],
          body: vTrips.map((t: any) => {
            const sigs = signaturesMap[t.id] || [];
            const vonNach = t.startLocation && t.endLocation
              ? `${t.startLocation}\n${t.endLocation}`
              : t.startLocation || t.endLocation || '-';
            return [
              new Date(t.date).toLocaleDateString('de-AT'),
              t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : '-',
              vonNach,
              `${t.endKm - t.startKm} km`,
              t.notes || t.purpose || '—',
              t.fuelEntries?.length > 0 ? `${t.fuelEntries[0].liters} L` : '-',
              sigs.length > 0 ? `${sigs.length} Unterschrift${sigs.length > 1 ? 'en' : ''}` : '-',
            ];
          }),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [primaryR,primaryG,primaryB], textColor: [255,255,255] },
          alternateRowStyles: { fillColor: [248,248,248] },
          columnStyles: {
            0: { cellWidth: 18 }, // Datum
            1: { cellWidth: 32 }, // Fahrer
            2: { cellWidth: 25 }, // Von/Nach
            3: { cellWidth: 14 }, // km
            4: { cellWidth: 28 }, // Zweck
            5: { cellWidth: 16 }, // Getankt
            6: { cellWidth: 45 }, // Unterschriften
          },
          margin: { left: 14, right: 14 },
          // Zeilenhöhe für Unterschriften anpassen
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 6) {
              const t = vTrips[data.row.index];
              const sigs = signaturesMap[t?.id] || [];
              if (sigs.length > 0) {
                // 20mm Bild + 4mm Text + 4mm Abstand = 28mm pro Unterschrift
                data.cell.styles.minCellHeight = sigs.length * 22 + 4;
              }
            }
          },
          didDrawCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 6) {
              const t = vTrips[data.row.index];
              const sigs = signaturesMap[t?.id] || [];
              if (sigs.length > 0) {
                let sigY = data.cell.y + 4;
                for (const sig of sigs) {
                  try {
                    const imgData = sig.signatureData;
                    if (!imgData || !imgData.includes(',')) continue;
                    const base64 = imgData.split(',')[1];
                    const format = imgData.includes('image/png') ? 'PNG' : 'JPEG';
                    const sigW = data.cell.width - 4;
                    const sigH = 15;
                    doc.addImage(base64, format, data.cell.x + 2, sigY, sigW, sigH);
                    const dateText = `${new Date(sig.createdAt).toLocaleDateString('de-AT')} ${new Date(sig.createdAt).toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'})} Uhr`;
                    doc.setFontSize(5.5);
                    doc.setTextColor(100, 100, 100);
                    doc.text(dateText, data.cell.x + 2, sigY + sigH + 3);
                    sigY += 22; // 15mm Bild + 4mm Text + 3mm Abstand
                  } catch (e: any) {
                    // Fehler still ignorieren
                  }
                }
                doc.setTextColor(0, 0, 0);
              }
            }
          },
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
      } else {
        doc.setFontSize(8); doc.setTextColor(150,150,150);
        doc.text('Keine Fahrten im gewählten Zeitraum', 14, currentY + 18);
        currentY += 25;
      }
      doc.setTextColor(0,0,0);
    }

  // ── Gerätebuch ────────────────────────────────────────────────────────────────
  } else if (reportId === 'equipment') {
    const [equipmentList, allChecks, allDefects] = await Promise.all([
      equipmentApi.list(),
      equipmentApi.listChecks(),
      equipmentApi.listDefects(),
    ]);
    const eqList = Array.isArray(equipmentList) ? equipmentList : [];
    const chkList = Array.isArray(allChecks) ? allChecks : [];
    const defList = Array.isArray(allDefects) ? allDefects : [];
    autoTable(doc, {
      startY,
      head: [['Gerät','Kategorie','Standort','S/N','Nächste Prüfung','Letzte Prüfung','Defekte']],
      body: eqList.map((e: any) => {
        const eChecks = chkList.filter((c: any) => c.equipmentId === e.id).sort((a: any,b: any) => new Date(b.date).getTime()-new Date(a.date).getTime());
        const openDefects = defList.filter((d: any) => d.equipmentId === e.id && d.status !== 'Behoben');
        const daysUntil = e.nextCheckDate ? Math.ceil((new Date(e.nextCheckDate).getTime() - Date.now()) / 86400000) : null;
        return [
          e.name, e.customCategory || e.category || '—', e.location || '—', e.serialNumber || '—',
          daysUntil !== null ? `${new Date(e.nextCheckDate).toLocaleDateString('de-AT')} (${daysUntil <= 0 ? 'ÜBERFÄLLIG' : `${daysUntil}d`})` : '-',
          eChecks[0] ? `${new Date(eChecks[0].date).toLocaleDateString('de-AT')} · ${eChecks[0].result}` : '-',
          openDefects.length > 0 ? `${openDefects.length} offen` : '-',
        ];
      }),
      styles: { fontSize: 8, cellPadding: 2, font: 'Roboto' },
      headStyles: { fillColor: [primaryR,primaryG,primaryB], textColor: [255,255,255], font: 'Roboto' },
      alternateRowStyles: { fillColor: [248,248,248] },
      margin: { left: 14, right: 14 },
      didParseCell: (data: any) => {
        if (data.section === 'body') {
          if (data.column.index === 6 && data.cell.raw !== '—') { data.cell.styles.textColor = [192,57,43]; data.cell.styles.fontStyle = 'bold'; }
          if (data.column.index === 4 && String(data.cell.raw).includes('ÜBERFÄLLIG')) { data.cell.styles.textColor = [192,57,43]; data.cell.styles.fontStyle = 'bold'; }
        }
      },
    });

  // ── Jahresbericht ─────────────────────────────────────────────────────────────
  } else if (reportId === 'annual') {
    const year = dateFrom ? new Date(dateFrom).getFullYear() : new Date().getFullYear();
    const from = `${year}-01-01`; const to = `${year}-12-31`;
    const MONTHS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    let aiSections: Record<string,string> = {};
    const GRAY = [100,100,100] as [number,number,number];
    const LIGHT_GRAY = [200,200,200] as [number,number,number];
    const DARK = [30,30,30] as [number,number,number];
    const PH = doc.internal.pageSize.getHeight();
    const M = 14;
    const PW = pageWidth - 2 * M;
    const FOOTER_H = 10; // reserved for footer
    const BOTTOM = PH - FOOTER_H - 4;

    // ── Alle Daten laden ──────────────────────────────────────────────────────
    const [events, incidents, tripsData, equipData, membersAllData, membersActiveData, membersYouthData,
           membersReserveData, membersHonorData, honorsData, vehiclesData, fuelData] = await Promise.all([
      eventApi.list({ from, to, limit: '9999' }),
      incidentApi.list({ from, to, limit: '9999' }),
      vehicleApi.listTrips({ from, to, limit: '9999' }),
      equipmentApi.list(),
      memberApi.list({ limit: '9999' }),
      memberApi.list({ status: 'ACTIVE', limit: '9999' }),
      memberApi.list({ status: 'YOUTH', limit: '9999' }),
      memberApi.list({ status: 'RESERVE', limit: '9999' }),
      memberApi.list({ status: 'HONORARY', limit: '9999' }),
      honorApi.list(),
      vehicleApi.listVehicles(),
      vehicleApi.listFuel({ from, to, limit: '9999' }),
    ]);

    const trips = tripsData.trips || [];
    const allEvents = events.events || events || [];
    const einsaetze = incidents.incidents || incidents || [];
    const activeMembers = membersActiveData.members || membersActiveData || [];
    const youthMembers = membersYouthData.members || membersYouthData || [];
    const reserveMembers = membersReserveData.members || membersReserveData || [];
    const honorMembers = membersHonorData.members || membersHonorData || [];
    const allMembersList = membersAllData.members || membersAllData || [];
    const honors = (honorsData.honors || honorsData || []).filter((h: any) => {
      const d = h.date || h.awardedDate; return d && new Date(d).getFullYear() === year;
    });
    const vehicles = vehiclesData || [];
    const fuelList = fuelData?.fuel || fuelData || [];
    const equipList = equipData?.equipment || equipData || [];
    const trainings = allEvents.filter((e: any) => ['TRAINING','EXERCISE','GENERAL'].includes(e.type));
    const totalKm = trips.reduce((s: number, t: any) => s + (t.endKm - t.startKm), 0);
    const totalFuelCost = fuelList.reduce((s: number, f: any) => s + (f.costTotal || 0), 0);
    const totalFuelLiters = fuelList.reduce((s: number, f: any) => s + (f.liters || 0), 0);

    // KI-Texte
    if (preloadedAiSections) {
      aiSections = preloadedAiSections;
    } else try {
      const aiRes = await api.post('/ai/jahresbericht', {
        year,
        stats: {
          activeMembers: activeMembers.length, youthMembers: youthMembers.length,
          reserveMembers: reserveMembers.length, honorMembers: honorMembers.length,
          newMembers: activeMembers.filter((m: any) => m.joinDate && new Date(m.joinDate).getFullYear() === year).length,
          totalIncidents: einsaetze.length,
          fireIncidents: einsaetze.filter((i: any) => i.type === 'FIRE').length,
          technicalIncidents: einsaetze.filter((i: any) => i.type === 'TECHNICAL').length,
          waterIncidents: einsaetze.filter((i: any) => i.type === 'WATER').length,
          otherIncidents: einsaetze.filter((i: any) => i.type === 'OTHER').length,
          totalEvents: allEvents.length,
          avgAttendance: allEvents.length > 0
            ? Math.round(allEvents.reduce((s: number, e: any) => s + (e._count?.attendances || 0), 0) / allEvents.length) : 0,
          totalTrips: trips.length, totalKm: totalKm.toLocaleString('de-AT'),
          fuelCost: totalFuelCost > 0 ? `€ ${totalFuelCost.toFixed(2)}` : 'keine Daten',
          activeEquipment: equipList.filter((e: any) => e.isActive !== false).length,
          checksPerformed: 0, openDefects: 0, totalHonors: honors.length,
          honorDetails: honors.map((h: any) => h.type || h.title).join(', '),
        }
      });
      aiSections = aiRes.data.sections || {};
    } catch { /* ohne KI-Text */ }

    // ── Hilfsfunktionen ───────────────────────────────────────────────────────
    // Prüfe ob genug Platz, sonst neue Seite
    const checkPage = (y: number, needed: number): number => {
      if (y + needed > BOTTOM) { doc.addPage(); return 20; }
      return y;
    };

    // Kapitelüberschrift — kein addPage(), nur checkPage
    const chapterHeader = (num: string, title: string, y: number): number => {
      y = checkPage(y, 18);
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...LIGHT_GRAY);
      doc.text(`KAPITEL ${num}`, M, y);
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GRAY);
      doc.text(title, M, y + 5);
      doc.setDrawColor(...LIGHT_GRAY); doc.setLineWidth(0.2);
      doc.line(M, y + 8, M + PW, y + 8);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK);
      return y + 12;
    };

    // KI-Text
    const addAiText = (text: string, yPos: number): number => {
      if (!text) return yPos;
      doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(80, 80, 80);
      const lines = doc.splitTextToSize(text, PW);
      yPos = checkPage(yPos, Math.min(lines.length, 4) * 4.5);
      doc.text(lines, M, yPos);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK);
      return yPos + lines.length * 4.5 + 3;
    };

    // Sub-Label
    const subLabel = (title: string, y: number): number => {
      y = checkPage(y, 8);
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...LIGHT_GRAY);
      doc.text(title.toUpperCase(), M, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK);
      return y + 4;
    };

    const tStyle = {
      styles: { fontSize: 7.5, cellPadding: 1.8, font: 'Roboto', lineColor: [235,235,235] as [number,number,number], lineWidth: 0.1 },
      headStyles: { fillColor: [245,245,245] as [number,number,number], textColor: GRAY, font: 'Roboto', fontSize: 7.5, fontStyle: 'bold' as 'bold' },
      alternateRowStyles: { fillColor: [252,252,252] as [number,number,number] },
      margin: { left: M, right: M },
    };

    // ── DECKBLATT (Seite 1) ───────────────────────────────────────────────────
    doc.addPage(); doc.deletePage(1);
    doc.setFillColor(primaryR, primaryG, primaryB);
    doc.rect(0, 0, pageWidth, 6, 'F');

    if (logoImgData) {
      try { doc.addImage(logoImgData, 'PNG', pageWidth/2 - 22, 18, 44, 44); } catch {}
    }
    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK);
    doc.text(brandingName, pageWidth/2, 76, { align: 'center' });
    doc.setDrawColor(...LIGHT_GRAY); doc.setLineWidth(0.4);
    doc.line(pageWidth/2 - 35, 80, pageWidth/2 + 35, 80);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY);
    doc.text('JAHRESBERICHT', pageWidth/2, 87, { align: 'center' });
    doc.setFontSize(32); doc.setFont('helvetica', 'bold'); doc.setTextColor(primaryR, primaryG, primaryB);
    doc.text(String(year), pageWidth/2, 101, { align: 'center' });

    if (aiSections.vorwort) {
      doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(120, 120, 120);
      const vl = doc.splitTextToSize(aiSections.vorwort, pageWidth - 50);
      doc.text(vl.slice(0, 7), pageWidth/2, 112, { align: 'center' });
    }

    // Kennzahlen-Kästen — weiter oben damit Footer Platz hat
    const boxes = [
      { label: 'Mitglieder', value: String(activeMembers.length) },
      { label: 'Einsätze', value: String(einsaetze.length) },
      { label: 'Übungen', value: String(trainings.length) },
      { label: 'km gefahren', value: totalKm.toLocaleString('de-AT') },
    ];
    const bw = (pageWidth - 28 - 9) / 4;
    const by = PH - 38; // weiter oben = mehr Abstand zum Footer
    boxes.forEach((b, i) => {
      const bx = M + i * (bw + 3);
      doc.setFillColor(248, 248, 248); doc.setDrawColor(...LIGHT_GRAY); doc.setLineWidth(0.2);
      doc.roundedRect(bx, by, bw, 20, 1.5, 1.5, 'FD');
      doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(primaryR, primaryG, primaryB);
      doc.text(b.value, bx + bw/2, by + 9, { align: 'center' });
      doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...LIGHT_GRAY);
      doc.text(b.label.toUpperCase(), bx + bw/2, by + 16, { align: 'center' });
    });
    doc.setFillColor(primaryR, primaryG, primaryB);
    doc.rect(0, PH - 6, pageWidth, 6, 'F');
    // Timestamp im roten Balken unten auf Deckblatt
    doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(255, 255, 255);
    doc.text(timestamp, pageWidth/2, PH - 2, { align: 'center' });

    // ── INHALT (ab Seite 2) ───────────────────────────────────────────────────
    doc.addPage(); let y = 20;

    // KAPITEL 1: MITGLIEDER
    y = chapterHeader('1', 'Mitgliederstand', y);
    y = addAiText(aiSections.mitglieder, y);
    y = subLabel('Übersicht', y);
    autoTable(doc, { startY: y,
      head: [['Kategorie','Anzahl']],
      body: [
        ['Aktive Mitglieder', activeMembers.length],
        ['Jugendfeuerwehr', youthMembers.length],
        ['Reservisten', reserveMembers.length],
        ['Ehrenmitglieder', honorMembers.length],
        ['Gesamt', allMembersList.length],
      ], ...tStyle, tableWidth: 80, columnStyles: { 1: { halign: 'center' as 'center', fontStyle: 'bold' as 'bold' } },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    // Rang-Verteilung neben Übersicht falls Platz
    const rankCount: Record<string,number> = {};
    activeMembers.forEach((m: any) => { if (m.rank) rankCount[m.rank] = (rankCount[m.rank]||0)+1; });
    if (Object.keys(rankCount).length > 0) {
      y = subLabel('Rangverteilung', y);
      autoTable(doc, { startY: y,
        head: [['Rang','Anzahl']],
        body: Object.entries(rankCount).sort((a,b)=>b[1]-a[1]).map(([r,c])=>[r,c]),
        ...tStyle, tableWidth: 80, columnStyles: { 1: { halign: 'center' as 'center' } },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    // Mitgliederliste
    y = subLabel('Mitgliederliste (aktiv)', y);
    autoTable(doc, { startY: y,
      head: [['Nr.','Name','Rang','Funktion','Seit']],
      body: activeMembers.map((m: any, i: number) => [
        m.memberNumber || String(i+1), `${m.lastName} ${m.firstName}`,
        m.rank || '—', m.position || '—',
        m.joinDate ? new Date(m.joinDate).getFullYear() : '—',
      ]), ...tStyle,
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // KAPITEL 2: EINSÄTZE
    y += 12;
    y = chapterHeader('2', 'Einsatzgeschehen', y);
    y = addAiText(aiSections.einsaetze, y);
    const incByMonth = Array(12).fill(0);
    einsaetze.forEach((i: any) => { const d = i.date||i.startDate||i.alarmTime; if(d) incByMonth[new Date(d).getMonth()]++; });
    const typeMap: Record<string,string> = { FIRE:'Brand', TECHNICAL:'Technisch', WATER:'Wasser', OTHER:'Sonstiges' };
    const incByType: Record<string,number> = {};
    einsaetze.forEach((i: any) => { const t = typeMap[i.type||''] || 'Sonstiges'; incByType[t]=(incByType[t]||0)+1; });

    y = subLabel('Monatsverteilung', y);
    autoTable(doc, { startY: y,
      head: [['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']],
      body: [incByMonth.map(v => v > 0 ? String(v) : '—')],
      ...tStyle, tableWidth: PW,
      columnStyles: Object.fromEntries(Array.from({length:12},(_,i)=>([i,{halign:'center' as 'center'}]))),
    });
    y = (doc as any).lastAutoTable.finalY + 3;

    if (einsaetze.length > 0) {
      y = subLabel('Einsatzliste', y);
      autoTable(doc, { startY: y,
        head: [['Datum','Bezeichnung','Art','Ort']],
        body: einsaetze.map((i: any) => {
          const d = i.date||i.startDate||i.alarmTime||i.incidentDate;
          return [d ? new Date(d).toLocaleDateString('de-AT') : '—', i.title||i.name||i.description||'—', typeMap[i.type||'']||'—', i.location||'—'];
        }), ...tStyle,
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    } else { y += 4; }

    // KAPITEL 3: ÜBUNGEN
    y += 12;
    y = chapterHeader('3', 'Übungen & Ausbildung', y);
    y = addAiText(aiSections.uebungen, y);
    const trainByMonth = Array(12).fill(0);
    trainings.forEach((e: any) => { const d = e.date||e.startDate; if(d) trainByMonth[new Date(d).getMonth()]++; });
    y = subLabel('Monatsverteilung', y);
    autoTable(doc, { startY: y,
      head: [['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']],
      body: [trainByMonth.map(v => v > 0 ? String(v) : '—')],
      ...tStyle, tableWidth: PW,
      columnStyles: Object.fromEntries(Array.from({length:12},(_,i)=>([i,{halign:'center' as 'center'}]))),
    });
    y = (doc as any).lastAutoTable.finalY + 3;
    if (allEvents.length > 0) {
      y = subLabel('Ereignisliste', y);
      autoTable(doc, { startY: y,
        head: [['Datum','Bezeichnung','Art','Ort','TN']],
        body: allEvents.map((e: any) => {
          const tl: Record<string,string> = { EXERCISE:'Übung', TRAINING:'Ausbildung', GENERAL:'Allgemein', COMMAND:'Kommando', COMPETITION:'Wettbewerb' };
          return [new Date(e.date||e.startDate).toLocaleDateString('de-AT'), e.title||'—', tl[e.type]||e.type||'—', e.location||'—', e._count?.attendances||'—'];
        }), ...tStyle,
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    } else { y += 4; }

    // KAPITEL 4: FAHRZEUGE
    y += 12;
    y = chapterHeader('4', 'Fahrzeuge & Fahrtenbuch', y);
    y = addAiText(aiSections.fahrzeuge, y);
    y = subLabel('Jahresübersicht', y);
    autoTable(doc, { startY: y,
      head: [['Kennzahl','Wert']],
      body: [
        ['Fahrten gesamt', trips.length],
        ['Gefahrene km', `${totalKm.toLocaleString('de-AT')} km`],
        ['Kraftstoff gesamt', `${totalFuelLiters.toFixed(0)} L`],
        ['Kraftstoffkosten', totalFuelCost > 0 ? `€ ${totalFuelCost.toFixed(2)}` : '—'],
      ], ...tStyle, tableWidth: 100, columnStyles: { 1: { halign: 'right' as 'right', fontStyle: 'bold' as 'bold' } },
    });
    y = (doc as any).lastAutoTable.finalY + 3;
    if (trips.length > 0) {
      y = subLabel('Fahrtendetails', y);
      autoTable(doc, { startY: y,
        head: [['Datum','Fahrzeug','Fahrer','Typ','Von','Nach','km']],
        body: trips.map((t: any) => [
          new Date(t.date).toLocaleDateString('de-AT'), t.vehicle?.name||'—',
          t.driver?`${t.driver.firstName} ${t.driver.lastName}`:'—',
          t.purpose||'—', t.startLocation||'—', t.endLocation||'—',
          `${(t.endKm-t.startKm).toLocaleString('de-AT')} km`,
        ]), ...tStyle, columnStyles: { 6: { halign: 'right' as 'right' } },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    } else { y += 4; }

    // KAPITEL 5: GERÄTEBUCH
    y += 12;
    y = chapterHeader('5', 'Gerätebuch', y);
    y = subLabel('Geräteliste', y);
    autoTable(doc, { startY: y,
      head: [['Gerät','Kategorie','Standort','Nächste Prüfung','Status']],
      body: equipList.map((e: any) => {
        const d = e.nextCheckDate ? Math.ceil((new Date(e.nextCheckDate).getTime()-Date.now())/86400000) : null;
        const status = d===null ? '—' : d<=0 ? 'ÜBERFÄLLIG' : d<=30 ? 'Bald fällig' : '✓ OK';
        return [e.name, e.customCategory||e.category||'—', e.location||'—', e.nextCheckDate?new Date(e.nextCheckDate).toLocaleDateString('de-AT'):'—', status];
      }),
      ...tStyle,
      didParseCell: (data: any) => {
        if (data.section==='body' && data.column.index===4) {
          if (String(data.cell.raw).includes('ÜBERFÄLLIG')) { data.cell.styles.textColor=[192,57,43]; data.cell.styles.fontStyle='bold'; }
          else if (String(data.cell.raw).includes('Bald')) { data.cell.styles.textColor=[180,100,0]; }
          else if (String(data.cell.raw).includes('OK')) { data.cell.styles.textColor=[39,174,96]; }
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // KAPITEL 6: EHRUNGEN (falls vorhanden)
    if (honors.length > 0) {
      y += 12;
      y = chapterHeader('6', `Ehrungen ${year}`, y);
      autoTable(doc, { startY: y,
        head: [['Datum','Name','Ehrung','Bemerkung']],
        body: honors.map((h: any) => [
          h.date||h.awardedDate ? new Date(h.date||h.awardedDate).toLocaleDateString('de-AT') : '—',
          h.member ? `${h.member.lastName} ${h.member.firstName}` : (h.memberName||'—'),
          h.type||h.title||'—', h.description||h.notes||'—',
        ]), ...tStyle,
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // SCHLUSSWORT
    if (aiSections.schlusswort) {
      y += 12;
      const chNum = honors.length > 0 ? '7' : '6';
      y = chapterHeader(chNum, 'Schlusswort', y);
      y = addAiText(aiSections.schlusswort, y);
      y += 16;
      y = checkPage(y, 20);
      const sigW = (PW - 10) / 2;
      doc.setDrawColor(...LIGHT_GRAY); doc.setLineWidth(0.3);
      doc.line(M, y, M + sigW, y);
      doc.line(M + sigW + 10, y, M + PW, y);
      doc.setFontSize(7); doc.setTextColor(...LIGHT_GRAY);
      doc.text('Kommandant/in', M + sigW/2, y + 4, { align: 'center' });
      doc.text('Schriftführer/in', M + sigW + 10 + sigW/2, y + 4, { align: 'center' });
    }
  }
  // ── Footer on each page ──────────────────────────────────────────────────────
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    // Roter Balken am unteren Rand
    doc.setFillColor(primaryR, primaryG, primaryB);
    doc.rect(0, pageHeight - 8, pageWidth, 8, 'F');
    // Text in weiss im roten Balken
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.text(`${brandingName}  ·  ${reportTitle}`, 14, pageHeight - 3);
    doc.text(`${i} / ${pageCount}`, pageWidth - 14, pageHeight - 3, { align: 'right' });
  }

  const sanitize = (s: string) => s
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss').replace(/[^a-zA-Z0-9._-]/g, '-');

  const fileNames: Record<string, string> = {
    members: 'Kamerad:innenliste',
    attendance: 'Anwesenheitsliste-Ereignisse',
    attendance_member: 'Anwesenheit-pro-Mitglied',
    birthdays: 'Geburtstagsliste',
    honors: 'Ehrungsliste',
    vehicles: 'Fahrtenbuch',
    equipment: 'Geraetebuch',
    annual: 'Jahresbericht',
  };
  const fileName = `${sanitize(brandingName)}-${fileNames[reportId] || reportId}-${fileTimestamp}.pdf`;

  return { blob: doc.output('blob'), fileName };
}

import { hasAdvancedAccess } from '../utils/rankAccess';

const ReportsPage: React.FC = () => {
  const { branding } = useBranding();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [generating, setGenerating] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; fileName: string; title: string } | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const currentYear = new Date().getFullYear();

  if (!hasAdvancedAccess(user)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
        <Shield className="w-12 h-12 opacity-20" />
        <p className="font-medium">Kein Zugriff — nicht verfügbar für diesen Dienstgrad</p>
      </div>
    );
  }

  const handleGenerate = async (report: ReportDef) => {
    if (report.id === 'annual') {
      navigate('/jahresbericht');
      return;
    }
    const params = new URLSearchParams({
      id: report.id,
      title: report.title,
      ...(dateFrom ? { from: dateFrom } : {}),
      ...(dateTo ? { to: dateTo } : {}),
    });
    navigate(`/reports/speichern?${params.toString()}`);
  };



  const handleDownloadCSV = async (report: ReportDef) => {
    const key = `${report.id}-csv`;
    setGenerating(key);
    try {
      let csvContent = '';
      const bom = '\uFEFF';

      if (report.id === 'vehicles') {
        const [tripsData, fuelData] = await Promise.all([
          vehicleApi.listTrips({ limit: '9999', ...(dateFrom ? { from: dateFrom } : {}), ...(dateTo ? { to: dateTo } : {}) }),
          vehicleApi.listFuel(),
        ]);
        const trips = tripsData.trips || [];
        csvContent = bom + 'Datum;Fahrzeug;Kennzeichen;Fahrer;Von;Nach;km Start;km Ende;km gefahren;Zweck;Getankt L;Kosten EUR\n';
        csvContent += trips.map((t: any) => {
          const fuel = t.fuelEntries?.[0];
          return [
            new Date(t.date).toLocaleDateString('de-AT'),
            t.vehicle?.name || '', t.vehicle?.licensePlate || '',
            t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : '',
            t.startLocation || '', t.endLocation || '',
            t.startKm, t.endKm, t.endKm - t.startKm,
            t.purpose || '',
            fuel ? fuel.liters : '', fuel?.costTotal || '',
          ].join(';');
        }).join('\n');

      } else if (report.id === 'equipment') {
        const equipmentList = await equipmentApi.list();
        csvContent = bom + 'Name;Kategorie;Standort;Seriennummer;Nächste Prüfung;Letzte Prüfung;Ergebnis;Offene Defekte;Aktiv\n';
        csvContent += equipmentList.map((e: any) => {
          const openDefects = e.defects?.filter((d: any) => d.status !== 'Behoben') || [];
          return [
            e.name, e.customCategory || e.category || '', e.location || '',
            e.serialNumber || '',
            e.nextCheckDate ? new Date(e.nextCheckDate).toLocaleDateString('de-AT') : '',
            e.checks?.[0] ? new Date(e.checks[0].date).toLocaleDateString('de-AT') : '',
            e.checks?.[0]?.result || '',
            openDefects.length,
            e.isActive ? 'Ja' : 'Nein',
          ].join(';');
        }).join('\n');

      } else {
        const response = await reportApi.download(report.id);
        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `${report.id}.csv`;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link); URL.revokeObjectURL(url);
        toast.success(`${report.title} als CSV heruntergeladen`);
        setGenerating(null); return;
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report.id}-${new Date().toLocaleDateString('de-AT').replace(/\./g, '-')}.csv`;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link); URL.revokeObjectURL(url);
      toast.success(`${report.title} als CSV heruntergeladen`);
    } catch {
      toast.error('Fehler beim Herunterladen');
    } finally {
      setGenerating(null);
    }
  };

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const downloadPreview = () => {
    if (!preview) return;
    const a = document.createElement('a');
    a.href = preview.url;
    a.download = preview.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-headings)' }}>Berichte & Auswertungen</h1>
        <p className="text-ink-muted mt-1 text-sm">Exportieren Sie Daten als PDF oder CSV</p>
      </div>

      {/* Zeitraumfilter */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-ink flex items-center gap-2">
          <Calendar className="w-4 h-4 text-ink-muted" /> Zeitraumfilter (optional)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Von</label>
            <input className="input-field" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Bis</label>
            <input className="input-field" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[currentYear, currentYear-1, currentYear-2].map(y => (
            <button key={y} onClick={() => { setDateFrom(`${y}-01-01`); setDateTo(`${y}-12-31`); }}
              className="text-xs px-3 py-1.5 bg-surface-100 hover:bg-surface-200 rounded-xl text-ink-muted font-medium transition-colors">
              {y}
            </button>
          ))}
          <button onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="text-xs px-3 py-1.5 bg-surface-100 hover:bg-surface-200 rounded-xl text-ink-muted font-medium transition-colors">
            Zurücksetzen
          </button>
        </div>
      </div>

      {/* Berichte nach Kategorien */}
      {[
        { key: 'personal', label: 'Personal & Mitglieder', color: 'text-blue-700', bg: 'bg-blue-50' },
        { key: 'fahrtenbuch', label: 'Fahrtenbuch', color: 'text-fire-700', bg: 'bg-fire-50' },
        { key: 'geraete', label: 'Gerätebuch', color: 'text-purple-700', bg: 'bg-purple-50' },
        { key: 'jahresbericht', label: 'Jahresbericht', color: 'text-emerald-700', bg: 'bg-emerald-50' },
      ].map(cat => {
        const catReports = reports.filter(r => r.category === cat.key);
        return (
          <div key={cat.key} className="space-y-3">
            <h2 className={`text-sm font-bold uppercase tracking-wider ${cat.color}`}>{cat.label}</h2>
            <div className="grid grid-cols-1 gap-3">
              {catReports.map(report => (
                <div key={report.id} className="card">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`flex-shrink-0 w-10 h-10 ${cat.bg} rounded-xl flex items-center justify-center`}>
                      {report.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-ink">{report.title}</h3>
                      <p className="text-xs text-ink-muted">{report.description}</p>
                    </div>
                    {report.hasFilter && (dateFrom || dateTo) && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full flex-shrink-0">
                        Gefiltert
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleGenerate(report)} disabled={!!generating}
                      className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
                      {generating === report.id
                        ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        : <File className="h-4 w-4" />}
                      PDF
                    </button>
                    <button onClick={() => handleDownloadCSV(report)} disabled={!!generating}
                      className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm">
                      {generating === `${report.id}-csv`
                        ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" />
                        : <Download className="h-4 w-4" />}
                      CSV
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="card bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">Hinweis</p>
            <p className="text-sm text-blue-700 mt-1">
              PDFs werden mit dem aktuellen Branding-Logo erstellt. Der Zeitraumfilter wirkt auf alle Berichte die mit "Gefiltert" markiert sind.
            </p>
          </div>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
            <div>
              <h3 className="font-bold text-gray-900" style={{ fontFamily: 'var(--font-headings)' }}>{preview.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{preview.fileName}</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={downloadPreview} className="btn-primary flex items-center gap-2">
                <Download className="w-4 h-4" /> Herunterladen
              </button>
              <button onClick={closePreview} className="btn-secondary flex items-center gap-2">
                <span>✕</span> Schließen
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <iframe src={preview.url} className="w-full h-full" title={preview.title} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
