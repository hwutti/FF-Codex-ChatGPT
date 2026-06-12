#!/usr/bin/env python3
"""
Feuerwehr Whisper.cpp Service
Wrapper um das whisper.cpp Binary — lädt Modell einmalig, lauscht auf HTTP-Anfragen.
Unterstützt CPU/GPU/auto Modus.
"""
import sys
import os
import json
import tempfile
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler

MODEL_PATH = sys.argv[1] if len(sys.argv) > 1 else "/opt/whisper-cpp/models/ggml-medium.bin"
LANGUAGE   = sys.argv[2] if len(sys.argv) > 2 else "de"
PORT       = int(sys.argv[3]) if len(sys.argv) > 3 else 8766
GPU_MODE   = sys.argv[4] if len(sys.argv) > 4 else "auto"  # auto | gpu | cpu
BINARY     = "/opt/whisper-cpp/build/bin/whisper-cli"

def detect_gpu() -> bool:
    """Erkennt ob eine NVIDIA GPU verfügbar ist."""
    try:
        result = subprocess.run(["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
                                capture_output=True, timeout=5)
        return result.returncode == 0 and len(result.stdout.strip()) > 0
    except Exception:
        return False

# GPU-Modus bestimmen
if GPU_MODE == "auto":
    USE_GPU = detect_gpu()
    print(f"[Whisper.cpp] GPU-Modus: auto → {'GPU erkannt' if USE_GPU else 'kein GPU, verwende CPU'}", flush=True)
elif GPU_MODE == "gpu":
    USE_GPU = True
    print(f"[Whisper.cpp] GPU-Modus: erzwungen (GPU)", flush=True)
else:  # cpu
    USE_GPU = False
    print(f"[Whisper.cpp] GPU-Modus: CPU (kein GPU)", flush=True)

NO_GPU_FLAG = [] if USE_GPU else ["--no-gpu"]

print(f"[Whisper.cpp] Binary: {BINARY}", flush=True)
print(f"[Whisper.cpp] Modell: {MODEL_PATH}", flush=True)
print(f"[Whisper.cpp] Sprache: {LANGUAGE}", flush=True)
print(f"[Whisper.cpp] GPU aktiv: {USE_GPU}", flush=True)

if not os.path.exists(BINARY):
    print(f"[Whisper.cpp] FEHLER: Binary nicht gefunden: {BINARY}", flush=True)
    sys.exit(1)
if not os.path.exists(MODEL_PATH):
    print(f"[Whisper.cpp] FEHLER: Modell nicht gefunden: {MODEL_PATH}", flush=True)
    sys.exit(1)

status_file = "/tmp/whisper-cpp-service-status.json"
with open(status_file, "w") as f:
    json.dump({"ready": True, "model": MODEL_PATH, "language": LANGUAGE,
               "port": PORT, "engine": "whisper-cpp", "gpu": USE_GPU, "gpuMode": GPU_MODE}, f)
os.chmod(status_file, 0o666)

print(f"[Whisper.cpp] Bereit auf Port {PORT}", flush=True)

class WhisperCppHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_POST(self):
        if self.path == "/transcribe":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)

            tmp_webm = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
            tmp_webm.write(body)
            tmp_webm.close()

            tmp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            tmp_wav.close()

            try:
                conv = subprocess.run([
                    "ffmpeg", "-y", "-i", tmp_webm.name,
                    "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
                    tmp_wav.name
                ], capture_output=True, timeout=30)

                if conv.returncode != 0:
                    raise Exception(f"ffmpeg Fehler: {conv.stderr.decode()}")

                lang_args = ["-l", LANGUAGE] if LANGUAGE else []
                result = subprocess.run([
                    BINARY,
                    "-m", MODEL_PATH,
                    "-f", tmp_wav.name,
                    "--output-txt",
                    "--no-prints",
                    *NO_GPU_FLAG,
                    *lang_args,
                ], capture_output=True, timeout=120)

                if result.returncode != 0:
                    raise Exception(f"whisper.cpp Fehler: {result.stderr.decode()}")

                text = result.stdout.decode("utf-8", errors="replace").strip()
                import re
                text = re.sub(r"\[\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\]\s*", "", text)
                text = text.strip()

                response = json.dumps({"text": text, "language": LANGUAGE, "gpu": USE_GPU}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(response)))
                self.end_headers()
                self.wfile.write(response)

            except Exception as e:
                error = json.dumps({"error": str(e)}).encode()
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(error)))
                self.end_headers()
                self.wfile.write(error)
            finally:
                try: os.unlink(tmp_webm.name)
                except: pass
                try: os.unlink(tmp_wav.name)
                except: pass

        elif self.path == "/health":
            response = json.dumps({"ready": True, "engine": "whisper-cpp", "gpu": USE_GPU, "gpuMode": GPU_MODE}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            response = json.dumps({"ready": True, "engine": "whisper-cpp", "gpu": USE_GPU, "gpuMode": GPU_MODE}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        else:
            self.send_response(404)
            self.end_headers()

server = HTTPServer(("127.0.0.1", PORT), WhisperCppHandler)
print(f"[Whisper.cpp] Service läuft auf 127.0.0.1:{PORT}", flush=True)
server.serve_forever()
