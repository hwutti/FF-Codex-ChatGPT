import { useRef } from 'react';
import toast from 'react-hot-toast';

export function useInvKiGenerate({
  introText, setIntroText,
  eventName, eventDate, eventTime, eventLocation,
  eventProgram, rsvpDeadline, directions, design,
  setInvKiRunning, setInvKiStreamText,
}: {
  introText: string; setIntroText: (v: string) => void;
  eventName: string; eventDate: string; eventTime: string;
  eventLocation: string; eventProgram: string; rsvpDeadline: string;
  directions: string; design: any;
  setInvKiRunning: (v: boolean) => void;
  setInvKiStreamText: (v: string) => void;
}) {
  const invKiAbortRef = useRef<AbortController | null>(null);

  const generateInvWithKi = async (instruction?: string) => {
    const invKiPromptVal = instruction || '';
    if (!invKiPromptVal.trim() && !instruction) return;
    setInvKiRunning(true);
    setInvKiStreamText('');
    invKiAbortRef.current?.abort();
    const controller = new AbortController();
    invKiAbortRef.current = controller;
    const token = localStorage.getItem('token');
    const viteApiUrl = import.meta.env.VITE_API_URL || '';
    const apiSuffix = 'api';
    const baseUrl = viteApiUrl.endsWith(apiSuffix) ? viteApiUrl.slice(0, -(apiSuffix.length + 1)) : viteApiUrl;
    const isPartial = !!(introText && instruction);
    const contextParts: string[] = [];
    if (eventName) contextParts.push('Veranstaltung: ' + eventName);
    if (eventDate) contextParts.push('Datum: ' + eventDate);
    if (eventTime) contextParts.push('Uhrzeit: ' + eventTime);
    if (eventLocation) contextParts.push('Ort: ' + eventLocation);
    if (eventProgram) { const prog = 'Programm' + '/Tagesordnung'; contextParts.push(prog + ': ' + eventProgram); }
    if (rsvpDeadline) contextParts.push('Anmeldefrist: ' + rsvpDeadline);
    if (directions) contextParts.push('Anreise: ' + directions);
    const contextHint = contextParts.length > 0 ? 'Kontext der Einladung: ' + contextParts.join(', ') + '.' : '';
    try {
      const res = await fetch(baseUrl + '/api/letter/generate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify({
          prompt: contextHint ? contextHint + ' ' + invKiPromptVal : invKiPromptVal,
          currentText: isPartial ? introText : '',
          instruction: isPartial ? instruction : '',
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) { toast.error('KI nicht erreichbar'); setInvKiRunning(false); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = ''; let event = ''; let streamedText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n'); buffer = parts.pop() || '';
        for (const line of parts) {
          if (line.startsWith('event: ')) { event = line.slice(7).trim(); }
          else if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            try {
              const parsed = JSON.parse(jsonStr);
              if (event === 'token') { streamedText += parsed.text || ''; setInvKiStreamText(streamedText); }
              if (event === 'result') {
                const start = (parsed.body || streamedText).indexOf('{');
                const end = (parsed.body || streamedText).lastIndexOf('}');
                let text = parsed.body || '';
                if (!text && start !== -1 && end > start) {
                  try { text = JSON.parse((parsed.body || streamedText).slice(start, end + 1)).body || streamedText; } catch { text = streamedText; }
                }
                if (text) setIntroText(text);
                setInvKiStreamText('');
              }
              if (event === 'error') toast.error(parsed.message || 'KI-Fehler');
            } catch {}
            event = '';
          }
        }
      }
      reader.releaseLock();
    } catch (e: any) { if (e?.name !== 'AbortError') toast.error('Verbindungsfehler'); }
    setInvKiRunning(false); setInvKiStreamText('');
  };

  return { generateInvWithKi };
}
