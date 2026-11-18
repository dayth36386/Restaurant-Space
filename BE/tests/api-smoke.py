"""End-to-end API checks against a disposable dev stack (stdlib only)."""
import base64
import http.cookiejar
import json
import os
import time
import urllib.error
import urllib.request
import uuid

BASE = os.environ.get('API_URL', 'http://localhost:8080')

class Client:
    def __init__(self):
        self.cookies = http.cookiejar.CookieJar()
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
        self.token = None

    def call(self, method, path, body=None, status=200, raw=None, content_type=None, headers=None):
        h = headers.copy() if headers else {}
        if self.token: h['Authorization'] = 'Bearer ' + self.token
        data = raw
        if body is not None:
            data = json.dumps(body).encode()
            h['Content-Type'] = 'application/json'
        if content_type: h['Content-Type'] = content_type
        req = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
        try:
            response = self.http.open(req, timeout=30)
        except urllib.error.HTTPError as e:
            response = e
        payload = response.read()
        assert response.code == status, f'{method} {path}: expected {status}, got {response.code}: {payload.decode()}'
        return json.loads(payload) if payload else None

    def upload(self, data, status=201):
        boundary = 'boundary' + uuid.uuid4().hex
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + data + f'\r\n--{boundary}--\r\n'.encode())
        return self.call('POST', '/api/v1/uploads/images', status=status, raw=body, content_type='multipart/form-data; boundary='+boundary)

guest, owner, other, stranger = Client(), Client(), Client(), Client()
for attempt in range(60):
    try:
        guest.call('GET', '/readyz')
        break
    except (AssertionError, urllib.error.URLError):
        if attempt == 59: raise
        time.sleep(1)

prefix = uuid.uuid4().hex[:12]
for i, client in enumerate((owner, other, stranger)):
    result = client.call('POST', '/api/v1/auth/register', {'email':f'{prefix}{i}@example.invalid', 'username': f'test_{prefix}{i}', 'display_name':'ทดสอบ API', 'password':'test-password-123'}, status=201)
    client.token = result['access_token']
    client.user_id = result['user']['id']

r = owner.call('POST', '/api/v1/restaurants', {'name':'ร้านทดสอบ '+prefix}, status=201)
rid = r['id']
path = '/api/v1/restaurants/'+rid
assert r['visibility'] == 'PRIVATE'
guest.call('GET', path, status=404)
other.call('GET', path, status=404)
other.call('PATCH', path, {'name':'stolen'}, status=404)
other.call('DELETE', path, status=404)
owner.call('PATCH', path, {'price_min':100, 'price_max':50}, status=400)
owner.call('PATCH', path, {'visibility':'PUBLIC', 'price_min':50, 'price_max':100})
detail = guest.call('GET', path)
assert detail['restaurant']['id'] == rid
assert detail['author']['username'] == 'test_'+prefix+'0' and 'email' not in detail['author'], 'post author missing or leaks email'
feed = guest.call('GET', '/api/v1/feed?q='+prefix)
assert any(x['restaurant']['id']==rid for x in feed['items'])
owner.call('POST', '/api/v1/restaurants', {'name':'second '+prefix, 'visibility':'PUBLIC'}, status=201)
page = guest.call('GET', '/api/v1/feed?q='+prefix+'&limit=1')
assert page['next_cursor']
second = guest.call('GET', '/api/v1/feed?q='+prefix+'&limit=1&cursor='+page['next_cursor'])
assert page['items'][0]['restaurant']['id'] != second['items'][0]['restaurant']['id']

# Comments: one-level replies, author-only edits, soft delete keeps the thread.
c1 = other.call('POST', path+'/comments', {'content':'อร่อยมาก'}, status=201)
r1 = owner.call('POST', path+'/comments', {'content':'ขอบคุณ', 'parent_id':c1['id']}, status=201)
r2 = other.call('POST', path+'/comments', {'content':'ตอบต่อ', 'parent_id':r1['id']}, status=201)
assert r2['parent_id'] == c1['id'], 'reply to reply should attach to the top-level comment'
listing = guest.call('GET', path+'/comments')
assert listing['items'][0]['id'] == c1['id'] and [x['id'] for x in listing['items'][0]['replies']] == [r1['id'], r2['id']]
assert 'email' not in listing['items'][0]['author']
guest.call('POST', path+'/comments', {'content':'x'}, status=401)
owner.call('PATCH', '/api/v1/comments/'+c1['id'], {'content':'hijack'}, status=404)
owner.call('DELETE', '/api/v1/comments/'+c1['id'], status=404)
assert other.call('PATCH', '/api/v1/comments/'+c1['id'], {'content':'อร่อยมาก!'})['content'] == 'อร่อยมาก!'
other.call('DELETE', '/api/v1/comments/'+c1['id'], status=204)
thread = guest.call('GET', path+'/comments')['items'][0]
assert thread['deleted'] and thread['content'] is None and thread['author'] is None and len(thread['replies']) == 2
assert guest.call('GET', path)['comment_count'] == 2

# Likes are idempotent and reported per viewer.
assert other.call('POST', path+'/likes') == {'liked': True, 'like_count': 1}
assert other.call('POST', path+'/likes')['like_count'] == 1
assert other.call('GET', path)['liked'] is True and guest.call('GET', path)['liked'] is False
assert other.call('DELETE', path+'/likes')['like_count'] == 0
guest.call('POST', path+'/likes', status=401)

# Direct chat over HTTP; realtime events are covered by the browser e2e.
convo = owner.call('POST', '/api/v1/conversations', {'username':'test_'+prefix+'1'}, status=201)
assert other.call('POST', '/api/v1/conversations', {'user_id':owner.user_id})['id'] == convo['id']
owner.call('POST', '/api/v1/conversations', {'user_id':owner.user_id}, status=400)
cpath = '/api/v1/conversations/'+convo['id']
client_id = str(uuid.uuid4())
m1 = owner.call('POST', cpath+'/messages', {'client_message_id':client_id, 'content':'สวัสดี'}, status=201)
assert owner.call('POST', cpath+'/messages', {'client_message_id':client_id, 'content':'สวัสดี'})['id'] == m1['id'], 'retry duplicated a message'
share = owner.call('POST', cpath+'/messages', {'client_message_id':str(uuid.uuid4()), 'restaurant_id':rid}, status=201)
assert share['kind'] == 'RESTAURANT' and share['restaurant']['restaurant']['id'] == rid
secret = owner.call('POST', '/api/v1/restaurants', {'name':'secret '+prefix}, status=201)
owner.call('POST', cpath+'/messages', {'client_message_id':str(uuid.uuid4()), 'restaurant_id':secret['id']}, status=400)
stranger.call('GET', cpath, status=404)
stranger.call('GET', cpath+'/messages', status=404)
stranger.call('POST', cpath+'/messages', {'client_message_id':str(uuid.uuid4()), 'content':'hi'}, status=404)
inbox = other.call('GET', '/api/v1/conversations')['items']
assert inbox[0]['id'] == convo['id'] and inbox[0]['unread_count'] == 2 and inbox[0]['last_message']['id'] == share['id']
history = other.call('GET', cpath+'/messages?limit=1')
assert history['items'][0]['id'] == share['id'] and history['next_cursor']
assert other.call('GET', cpath+'/messages?limit=1&cursor='+history['next_cursor'])['items'][0]['id'] == m1['id']
other.call('POST', cpath+'/read', {'message_id':share['id']}, status=204)
other.call('POST', cpath+'/read', {'message_id':m1['id']}, status=204)
assert other.call('GET', cpath)['unread_count'] == 0
assert owner.call('GET', cpath)['other_last_read_message_id'] == share['id'], 'read cursor moved backwards'

# PNG made with stdlib to avoid relying on opaque fixtures.
import struct
import zlib
def chunk(kind, data):
    return struct.pack('!I', len(data))+kind+data+struct.pack('!I', zlib.crc32(kind+data)&0xffffffff)
png = b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR', struct.pack('!2I5B',1,1,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b'\0\xff\0\0'))+chunk(b'IEND',b'')
owner.upload(b'<svg/>', status=400)
media = owner.upload(png)
assert media['media']['mime_type']=='image/jpeg'
mid = media['media']['id']
# Preserve the exact signed Host/path/query while connecting through Docker DNS.
import http.client
import urllib.parse
signed = urllib.parse.urlsplit(media['url'])
s3_host = os.environ.get('S3_TEST_HOST', signed.netloc)
connection = http.client.HTTPConnection(s3_host, timeout=10)
connection.request('GET', signed.path+'?'+signed.query, headers={'Host': signed.netloc})
response = connection.getresponse()
assert response.status == 200 and response.read().startswith(b'\xff\xd8'), 'Signed JPEG URL failed'
connection.close()
connection = http.client.HTTPConnection(s3_host, timeout=10)
connection.request('GET', signed.path, headers={'Host': signed.netloc})
response = connection.getresponse()
assert response.status == 403, 'Private bucket allowed anonymous read'
response.read()
connection.close()
other.call('GET', '/api/v1/uploads/images/'+mid, status=404)
other_rest = other.call('POST', '/api/v1/restaurants', {'name':'other'}, status=201)
other.call('POST', '/api/v1/restaurants/'+other_rest['id']+'/images', {'media_id':mid}, status=404)
im = owner.call('POST', path+'/images', {'media_id':mid,'is_cover':True}, status=201)
owner.call('POST', path+'/images', {'media_id':mid}, status=409)
menu = owner.call('POST', path+'/menus', {'name':'ผัดไทย', 'price':60, 'image_media_id':mid}, status=201)
other.call('PATCH', path+'/menus/'+menu['id'], {'price':1}, status=404)
owner.call('PATCH', path+'/menus/'+menu['id'], {'price':65})
owner.call('PATCH', '/api/v1/users/me', {'avatar_media_id':mid,'bio':'hello'})
profile = guest.call('GET', '/api/v1/users/test_'+prefix+'0')
assert 'email' not in profile and profile['images']['avatar_url']
assert guest.call('GET', path)['images'][0]['url']
owner.call('PATCH', path, {'visibility':'PRIVATE'})
guest.call('GET', path, status=404)
assert not any(x['restaurant']['id']==rid for x in guest.call('GET','/api/v1/feed?q='+prefix)['items'])

# Rotation, replay detection, family-wide access-token revocation.
old_refresh = next(c.value for c in owner.cookies if c.name=='refresh_token')
rotated = owner.call('POST','/api/v1/auth/refresh')
owner.token = rotated['access_token']
owner.call('GET','/api/v1/users/me')
replay = Client()
replay.call('POST','/api/v1/auth/refresh',status=401,headers={'Cookie':'refresh_token='+old_refresh})
owner.call('GET','/api/v1/users/me',status=401)
owner.token = None
login = owner.call('POST','/api/v1/auth/login',{'email':prefix+'0@example.invalid','password':'test-password-123'})
owner.token = login['access_token']
owner.call('DELETE',path+'/images/'+im['id'],status=204)
owner.call('DELETE',path+'/menus/'+menu['id'],status=204)
owner.call('DELETE',path,status=204)
owner.call('GET',path,status=404)
owner.call('POST','/api/v1/auth/logout',status=204)
owner.call('GET','/api/v1/users/me',status=401)
print('PASS: auth, rotation/replay, ownership/privacy, pagination, comments, likes, chat, upload, menu and profile flows')
