"""
Dev Server with Proxy — 带代理功能的开发服务器
- 静态文件服务（同 http.server）
- /proxy/* 路径转发到外部站点（解决 CORS 问题）
- 连接池复用，减少 SSL 握手开销
"""

import http.server
import socketserver
import urllib.parse
import os
import sys
import socket
import http.client
import ssl

PORT = int(os.environ.get('PORT', 8080))
PROXY_PREFIX = '/proxy/'

# ===== SSL 上下文（全局复用） =====
_ssl_ctx = ssl.create_default_context()

# ===== 连接池：host -> http.client.HTTPSConnection =====
_conn_pool = {}

def _get_connection(host):
    """获取或创建到指定 host 的 HTTPS 连接（连接池复用）"""
    conn = _conn_pool.get(host)
    if conn is None or conn.sock is None:
        conn = http.client.HTTPSConnection(host, timeout=15, context=_ssl_ctx)
        _conn_pool[host] = conn
    return conn


class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    # HTTP/1.1 保持连接复用，但设置 Connection: close 让客户端短连接
    protocol_version = 'HTTP/1.0'
    timeout = 15

    def do_GET(self):
        if self.path.startswith(PROXY_PREFIX):
            self._handle_proxy()
            return
        super().do_GET()

    def do_HEAD(self):
        if self.path.startswith(PROXY_PREFIX):
            self._handle_proxy(head_only=True)
            return
        super().do_HEAD()

    def _handle_proxy(self, head_only=False):
        target_url = self.path[len(PROXY_PREFIX):]
        if not target_url.startswith('http'):
            target_url = 'https://' + target_url

        parsed = urllib.parse.urlparse(target_url)
        host = parsed.netloc
        path = parsed.path
        if parsed.query:
            path += '?' + parsed.query

        forwarded_keys = {'language', 'platform', 'crossplay', 'accept'}

        # 构建请求头
        headers = {
            'User-Agent': 'Mozilla/5.0 (Warframe Taskboard Dev)',
            'Accept-Encoding': 'identity',  # 禁用压缩，避免代理读取耗时
        }
        for key, value in self.headers.items():
            if key.lower() in forwarded_keys:
                headers[key] = value

        # 重试：只重试 1 次，减少等待时间
        last_error = None
        for attempt in range(2):
            try:
                conn = _get_connection(host)
                method = 'HEAD' if head_only else 'GET'
                conn.request(method, path, headers=headers)
                resp = conn.getresponse()

                content_type = resp.headers.get('Content-Type', 'application/octet-stream')
                data = b'' if head_only else resp.read()

                self.send_response(resp.status)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', len(data) if not head_only else resp.headers.get('Content-Length', '0'))
                self.end_headers()
                if not head_only:
                    self.wfile.write(data)
                    self.wfile.flush()
                sys.stderr.write(f'  [Proxy] {resp.status} {target_url[:80]}\n')
                return  # 成功

            except http.client.HTTPException as e:
                # HTTP 协议错误或连接断开：清除连接池条目，下次重建
                _conn_pool.pop(host, None)
                last_error = e
                sys.stderr.write(f'  [Proxy] Attempt {attempt+1} failed: {e}\n')
                if attempt == 0:
                    import time
                    time.sleep(0.2)
                    continue
                break

            except (OSError, socket.timeout) as e:
                _conn_pool.pop(host, None)
                last_error = e
                sys.stderr.write(f'  [Proxy] Attempt {attempt+1} failed: {e}\n')
                if attempt == 0:
                    import time
                    time.sleep(0.2)
                    continue
                break

            except Exception as e:
                _conn_pool.pop(host, None)
                last_error = e
                sys.stderr.write(f'  [Proxy] Attempt {attempt+1} failed: {e}\n')
                if attempt == 0:
                    import time
                    time.sleep(0.2)
                    continue
                break

        error_msg = f'Proxy error: {str(last_error)}'.encode('utf-8')
        try:
            self.send_response(502)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Content-Length', len(error_msg))
            self.end_headers()
            self.wfile.write(error_msg)
        except (ConnectionAbortedError, BrokenPipeError):
            pass

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
    print(f'  Proxy pool: {len(_conn_pool)} connections')
    print('=' * 55)
    print('  Press Ctrl+C to stop')
    print()

    socketserver.ThreadingTCPServer.allow_reuse_address = True
    socketserver.ThreadingTCPServer.request_queue_size = 128
    socketserver.ThreadingTCPServer.daemon_threads = True

    with socketserver.ThreadingTCPServer(('0.0.0.0', PORT), ProxyHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nServer stopped.')
            # 清理连接池
            for host, conn in _conn_pool.items():
                try:
                    conn.close()
                except:
                    pass
            _conn_pool.clear()
            httpd.shutdown()


if __name__ == '__main__':
    main()
