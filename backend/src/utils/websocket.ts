import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import fs from 'fs';

let wss: WebSocketServer | null = null;
const ANNOUNCE_STATUS = '/tmp/feuerwehr-announce-status.json';

export function initWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('error', () => {});
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 30000);
    ws.on('close', () => clearInterval(interval));

    // Sende aktuellen Announce-Status an neu verbundene Clients
    try {
      if (fs.existsSync(ANNOUNCE_STATUS)) {
        const status = JSON.parse(fs.readFileSync(ANNOUNCE_STATUS, 'utf8'));
        if (status.announced) {
          const elapsed = Math.floor((Date.now() - new Date(status.startedAt).getTime()) / 1000);
          const remaining = (status.countdown || 300) - elapsed;
          if (remaining > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'UPDATE_ANNOUNCED',
              countdown: remaining,
              message: 'Ein System-Update wird eingespielt. Bitte alle offenen Punkte speichern!',
              startedAt: status.startedAt,
            }));
          }
        }
      }
    } catch {}
  });

  console.log('🔌 WebSocket Server bereit');
}

export function broadcast(message: object) {
  if (!wss) return;
  const data = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}
