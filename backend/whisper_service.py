#!/usr/bin/env python3
"""
Feuerwehr Whisper Service
Lädt das Modell einmalig beim Start und hält es dauerhaft im RAM.
Lauscht auf HTTP-Anfragen für Transkription.
"""
import sys
import os
import json
import tempfile
from http.server import HTTPServer, BaseHTTPRequestHandler
from faster_whisper import WhisperModel

# Konfiguration aus Argumenten
MODEL_NAME = sys.argv[1] if len(sys.argv) > 1 else 'medium'
LANGUAGE   = sys.argv[2] if len(sys.argv) > 2 else 'de'
PORT       = int(sys.argv[3]) if len(sys.argv) > 3 else 8765

print(f"[Whisper] Lade Modell '{MODEL_NAME}'...", flush=True)
model = WhisperModel(MODEL_NAME, device='cpu', compute_type='int8')
print(f"[Whisper] Modell '{MODEL_NAME}' geladen — bereit auf Port {PORT}", flush=True)

# Status-Datei schreiben damit Backend weiß dass Service bereit ist
status_file = '/tmp/whisper-service-status.json'
with open(status_file, 'w') as f:
    json.dump({ 'ready': True, 'model': MODEL_NAME, 'language': LANGUAGE, 'port': PORT }, f)
os.chmod(status_file, 0o666)

class WhisperHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Kein HTTP-Logging

    def do_POST(self):
        if self.path == '/transcribe':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)

            # Audio-Datei aus Request Body speichern
            tmp = tempfile.NamedTemporaryFile(suffix='.webm', delete=False)
            tmp.write(body)
            tmp.close()

            try:
                segments, info = model.transcribe(
                    tmp.path if hasattr(tmp, 'path') else tmp.name,
                    language=LANGUAGE if LANGUAGE else None,
                    task='transcribe'
                )
                text = ' '.join([seg.text.strip() for seg in segments])
                response = json.dumps({ 'text': text, 'language': info.language }).encode()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(response)))
                self.end_headers()
                self.wfile.write(response)
            except Exception as e:
                error = json.dumps({ 'error': str(e) }).encode()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(error)))
                self.end_headers()
                self.wfile.write(error)
            finally:
                try:
                    os.unlink(tmp.name)
                except:
                    pass
        elif self.path == '/health':
            response = json.dumps({ 'ready': True, 'model': MODEL_NAME }).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        if self.path == '/health':
            response = json.dumps({ 'ready': True, 'model': MODEL_NAME }).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        else:
            self.send_response(404)
            self.end_headers()

server = HTTPServer(('127.0.0.1', PORT), WhisperHandler)
print(f"[Whisper] Service läuft auf 127.0.0.1:{PORT}", flush=True)
server.serve_forever()
