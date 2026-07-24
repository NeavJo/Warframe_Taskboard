"""
Dev Server with Proxy — 带代理功能的开发服务器
- 静态文件服务（同 http.server）
- /proxy/* 路径转发到外部站点（解决 CORS 问题）
"""

import http.server
import socketserver
import urllib.request
import urllib.parse
import os
import sys
import socket

PORT = int(os.environ.get('PORT', 8080))
PROXY_PREFIX = '/proxy/'


class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    # HTTP/1.0 默认短连接，避免 keep-alive 导致客户端挂起
    protocol_version = 'HTTP/1.0'
    # 单个 socket 请求超时（秒），防止客户端挂起占用连接
    timeout = 10

    def do_GET(self):
        if self.path.startswith(PROXY_PREFIX):
            self._handle_proxy()
            return
        super().do_GET()

    def _handle_proxy(self):
        target_url = self.path[len(PROXY_PREFIX):]
        if not target_url.startswith('http'):
            target_url = 'https://' + target_url

        try:
            req = urllib.request.Request(target_url)
            req.add_header('User-Agent', 'Mozilla/5.0 (Warframe Taskboard Dev)')

            with urllib.request.urlopen(req, timeout=15) as resp:
                content_type = resp.headers.get('Content-Type', 'application/octet-stream')
                data = resp.read()

                self.send_response(resp.status)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', len(data))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Connection', 'close')
                self.end_headers()
                self.wfile.write(data)
                self.wfile.flush()

        except Exception as e:
            error_msg = f'Proxy error: {str(e)}'.encode('utf-8')
            self.send_response(502)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Content-Length', len(error_msg))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Connection', 'close')
            self.end_headers()
            self.wfile.write(error_msg)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Connection', 'close')
        super().end_headers()

    def log_message(self, format, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), format % args))

    def handle(self):
        try:
            super().handle()
        except (ConnectionAbortedError, TimeoutError, BrokenPipeError):
            # 客户端主动断开或超时属于正常现象，不打印堆栈
            pass


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return '127.0.0.1'


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    ip = get_local_ip()
    print('=' * 55)
    print('  Warframe Taskboard Dev Server (with Proxy)')
    print('=' * 55)
    print(f'  Localhost:  http://127.0.0.1:{PORT}/')
    print(f'  LAN Access: http://{ip}:{PORT}/')
    print('=' * 55)
    print('  Press Ctrl+C to stop')
    print()

    # 允许地址复用，避免重启时"Address already in use"错误
    socketserver.TCPServer.allow_reuse_address = True
    # 增大请求队列，提升并发能力
    socketserver.TCPServer.request_queue_size = 128

    with socketserver.TCPServer(('0.0.0.0', PORT), ProxyHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nServer stopped.')
            httpd.shutdown()


if __name__ == '__main__':
    main()
