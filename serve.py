#!/usr/bin/env python3
"""
로컬 개발 서버 (사유의 방).
- 실행할 때마다 새 '서버 세션 토큰'을 server_session.txt 에 기록한다.
- 프론트(main.js)는 이 토큰이 바뀌면(=서버 재시작) 완주/진행도를 초기화한다.
  → 서버를 다시 띄울 때마다 완주 기능을 처음부터 테스트할 수 있다.
  (단순 새로고침은 토큰이 그대로라 진행도가 유지된다.)
- IPv4(0.0.0.0)로 바인딩한다: Python 기본이 IPv6만 잡으면 브라우저가 못 붙는 문제 회피.
사용: python serve.py   (기본 포트 8000)
"""
import http.server
import socketserver
import os
import sys
import time
import random

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

# 새 서버 세션 토큰 기록 (재시작마다 값이 바뀐다)
token = str(int(time.time() * 1000)) + "-" + str(random.randint(1000, 9999))
with open(os.path.join(ROOT, "server_session.txt"), "w", encoding="utf-8") as f:
    f.write(token)

Handler = http.server.SimpleHTTPRequestHandler


class Server(socketserver.TCPServer):
    allow_reuse_address = True


with Server(("0.0.0.0", PORT), Handler) as httpd:
    print("사유의 방 · 개발 서버")
    print("  http://localhost:%d  (세션 %s)" % (PORT, token))
    print("  Ctrl+C 로 종료")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n종료")
