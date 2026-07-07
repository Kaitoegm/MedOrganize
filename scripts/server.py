import http.server
import socketserver
import webbrowser
import threading

PORT = 8000

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

def start_server():
    global PORT
    handler = NoCacheHTTPRequestHandler
    for port in range(8000, 8080):
        try:
            with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
                PORT = port
                print(f"\n[MedNotes Server] Servidor local iniciado com sucesso!")
                print(f"→ Acesse: http://localhost:{port}/src/main/index.html\n")
                print("Pressione Ctrl+C para encerrar o servidor.")
                httpd.serve_forever()
                break
        except OSError:
            continue

def open_browser():
    webbrowser.open(f"http://localhost:{PORT}/src/main/index.html")

if __name__ == "__main__":
    threading.Timer(0.8, open_browser).start()
    start_server()
