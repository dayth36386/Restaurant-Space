"""Generate the checked-in OpenAPI contract. Run from repository root."""
import json
from pathlib import Path

BE_ROOT = Path(__file__).resolve().parents[1]


def ref(name): return {'$ref': '#/components/schemas/' + name}
def obj(props, required=(), strict=False):
    out = {'type': 'object', 'properties': props}
    if required: out['required'] = list(required)
    if strict: out['additionalProperties'] = False
    return out

def text(n=None, nullable=False, **kwargs):
    d = {'type': ['string', 'null'] if nullable else 'string'}
    if n: d['maxLength'] = n
    return dict(d, **kwargs)

def array(schema): return {'type': 'array', 'items': schema}
ID = text(format='uuid')
NID = text(nullable=True, format='uuid')
DATE = text(format='date-time')
PRICE = {'type': ['number', 'null'], 'minimum': 0, 'maximum': 9999999999.99, 'multipleOf': 0.01}
POSITION = {'type': 'integer', 'minimum': 0, 'maximum': 10000}
SCHEMAS = {}
SCHEMAS['Error'] = obj({'error': obj({'code': text(), 'message': text()}, ['code', 'message'])}, ['error'])
SCHEMAS['Status'] = obj({'status': text()}, ['status'])
SCHEMAS['Message'] = obj({'message': text()}, ['message'])
SCHEMAS['User'] = obj({'id': ID, 'email': text(format='email'), 'username': text(50), 'display_name': text(100), 'bio': text(nullable=True), 'role': {'enum': ['USER', 'ADMIN']}, 'status': {'enum': ['ACTIVE', 'SUSPENDED']}, 'preferences': {'type': ['object', 'null']}, 'created_at': DATE, 'updated_at': DATE}, ['id', 'email', 'username', 'display_name', 'role', 'status'])
SCHEMAS['Tokens'] = obj({'access_token': text(), 'token_type': {'const': 'Bearer'}, 'expires_in': {'const': 900}, 'user': ref('User')}, ['access_token', 'token_type', 'expires_in', 'user'])
SCHEMAS['Register'] = obj({'email': text(254, format='email'), 'password': text(72, minLength=10), 'username': text(50, pattern='^[a-z0-9_]{3,50}$'), 'display_name': text(100, minLength=1)}, ['email', 'password', 'username', 'display_name'], True)
SCHEMAS['Login'] = obj({'email': text(format='email'), 'password': text()}, ['email', 'password'], True)
SCHEMAS['ForgotPassword'] = obj({'email': text(format='email')}, ['email'], True)
SCHEMAS['ResetPassword'] = obj({'token': text(43, minLength=43), 'password': text(72, minLength=10)}, ['token', 'password'], True)
SCHEMAS['ProfileImages'] = obj({'avatar_url': text(nullable=True), 'cover_url': text(nullable=True)})
SCHEMAS['MyProfile'] = obj({'user': ref('User'), 'images': ref('ProfileImages')}, ['user', 'images'])
SCHEMAS['PublicProfile'] = obj({'id': ID, 'username': text(), 'display_name': text(), 'bio': text(nullable=True), 'images': ref('ProfileImages'), 'public_restaurant_count': {'type': 'integer'}}, ['id', 'username', 'display_name', 'public_restaurant_count'])
SCHEMAS['ProfilePatch'] = obj({'username': text(50, pattern='^[a-z0-9_]{3,50}$'), 'display_name': text(100, minLength=1), 'bio': text(2000, nullable=True), 'preferences': {'type': ['object', 'null']}, 'avatar_media_id': NID, 'cover_media_id': NID}, strict=True)
restaurant = {'name': text(200, minLength=1), 'description': text(10000, nullable=True), 'address': text(2000, nullable=True), 'phone': text(32, nullable=True), 'website_url': text(2048, nullable=True), 'latitude': {'type': ['number', 'null'], 'minimum': -90, 'maximum': 90}, 'longitude': {'type': ['number', 'null'], 'minimum': -180, 'maximum': 180}, 'map_url': text(2048, nullable=True), 'map_embed_url': text(2048, nullable=True, description='HTTPS Google Maps embed URL only'), 'price_min': PRICE, 'price_max': PRICE, 'currency': {'const': 'THB', 'default': 'THB'}, 'visit_status': {'enum': ['WANT_TO_GO', 'VISITED'], 'default': 'WANT_TO_GO'}, 'visibility': {'enum': ['PUBLIC', 'PRIVATE'], 'default': 'PRIVATE'}}
input_restaurant = dict(restaurant, category_ids=dict(array(ID), maxItems=20, uniqueItems=True), tag_ids=dict(array(ID), maxItems=20, uniqueItems=True))
SCHEMAS['RestaurantCreate'] = obj(input_restaurant, ['name'], True)
SCHEMAS['RestaurantPatch'] = obj(input_restaurant, strict=True)
SCHEMAS['Restaurant'] = obj(dict(restaurant, id=ID, user_id=ID, created_at=DATE, updated_at=DATE), ['id', 'user_id', 'name', 'visibility', 'visit_status', 'created_at', 'updated_at'])
SCHEMAS['Taxonomy'] = obj({'id': ID, 'name': text(), 'slug': text()}, ['id', 'name', 'slug'])
SCHEMAS['TaxonomyList'] = obj({'items': array(ref('Taxonomy'))}, ['items'])
SCHEMAS['RestaurantCard'] = obj({'restaurant': ref('Restaurant'), 'author': dict(ref('UserSummary'), description='User who posted the recommendation'), 'cover_url': text(nullable=True), 'like_count': {'type': 'integer'}, 'comment_count': {'type': 'integer'}}, ['restaurant', 'author', 'cover_url', 'like_count', 'comment_count'])
SCHEMAS['RestaurantList'] = obj({'items': array(ref('RestaurantCard')), 'next_cursor': text(description='Empty string when no more results')}, ['items', 'next_cursor'])
SCHEMAS['Media'] = obj({'id': ID, 'owner_id': ID, 'mime_type': {'const': 'image/jpeg'}, 'size_bytes': {'type': 'integer'}, 'width': {'type': 'integer'}, 'height': {'type': 'integer'}, 'status': {'enum': ['PENDING', 'READY', 'DELETING']}, 'created_at': DATE, 'updated_at': DATE}, ['id', 'owner_id', 'mime_type', 'size_bytes', 'width', 'height', 'status'])
SCHEMAS['UploadResult'] = obj({'media': ref('Media'), 'url': text(), 'expires_in': {'const': 300}}, ['media', 'url', 'expires_in'])
image_input = {'media_id': ID, 'alt_text': text(255, nullable=True), 'sort_order': POSITION, 'is_cover': {'type': 'boolean'}}
SCHEMAS['ImageAttach'] = obj(image_input, ['media_id'], True)
SCHEMAS['ImagePatch'] = obj({k: v for k, v in image_input.items() if k != 'media_id'}, strict=True)
SCHEMAS['RestaurantImage'] = obj(dict(image_input, id=ID, restaurant_id=ID, created_at=DATE), ['id', 'restaurant_id', 'media_id', 'sort_order', 'is_cover'])
SCHEMAS['ImageWithURL'] = obj({'image': ref('RestaurantImage'), 'url': text()}, ['image', 'url'])
menu_input = {'name': text(200, minLength=1), 'description': text(10000, nullable=True), 'price': PRICE, 'image_media_id': NID, 'sort_order': POSITION}
SCHEMAS['MenuCreate'] = obj(menu_input, ['name'], True)
SCHEMAS['MenuPatch'] = obj(menu_input, strict=True)
SCHEMAS['Menu'] = obj(dict(menu_input, id=ID, restaurant_id=ID, created_at=DATE, updated_at=DATE), ['id', 'restaurant_id', 'name', 'sort_order'])
SCHEMAS['MenuWithURL'] = obj({'menu': ref('Menu'), 'image_url': text(description='Empty when no photo')}, ['menu', 'image_url'])
SCHEMAS['RestaurantDetail'] = {'allOf': [ref('RestaurantCard'), obj({'images': array(ref('ImageWithURL')), 'menus': array(ref('MenuWithURL')), 'categories': array(ref('Taxonomy')), 'tags': array(ref('Taxonomy')), 'liked': {'type': 'boolean', 'description': 'Whether the caller likes it; false for guests'}}, ['images', 'menus', 'categories', 'tags', 'liked'])]}
SCHEMAS['UserSummary'] = obj({'id': ID, 'username': text(), 'display_name': text(), 'avatar_url': text(nullable=True), 'online': {'type': 'boolean', 'description': 'Conversation views only: partner has an open realtime connection'}}, ['id', 'username', 'display_name', 'avatar_url'])
comment = {'id': ID, 'restaurant_id': ID, 'parent_id': NID, 'content': text(2000, nullable=True, description='null when deleted'), 'deleted': {'type': 'boolean'}, 'edited': {'type': 'boolean'}, 'author': {'anyOf': [ref('UserSummary'), {'type': 'null'}], 'description': 'null when deleted'}, 'created_at': DATE, 'updated_at': DATE}
SCHEMAS['Reply'] = obj(comment, ['id', 'restaurant_id', 'parent_id', 'content', 'deleted', 'edited', 'author', 'created_at', 'updated_at'])
SCHEMAS['Comment'] = obj(dict(comment, replies=dict(array(ref('Reply')), description='Present on top-level comments; oldest first')), ['id', 'restaurant_id', 'parent_id', 'content', 'deleted', 'edited', 'author', 'created_at', 'updated_at'])
SCHEMAS['CommentList'] = obj({'items': array(ref('Comment')), 'next_cursor': text(description='Empty string when no more results')}, ['items', 'next_cursor'])
SCHEMAS['CommentCreate'] = obj({'content': text(2000, minLength=1), 'parent_id': dict(NID, description='Reply target; replies to replies attach to the top-level comment')}, ['content'], True)
SCHEMAS['CommentPatch'] = obj({'content': text(2000, minLength=1)}, ['content'], True)
SCHEMAS['LikeState'] = obj({'liked': {'type': 'boolean'}, 'like_count': {'type': 'integer'}}, ['liked', 'like_count'])
SCHEMAS['ChatMessage'] = obj({'id': ID, 'conversation_id': ID, 'sender_id': ID, 'client_message_id': ID, 'kind': {'enum': ['TEXT', 'RESTAURANT']}, 'content': text(4000, nullable=True), 'restaurant': {'anyOf': [ref('RestaurantCard'), {'type': 'null'}], 'description': 'Shared restaurant while still visible to the viewer'}, 'created_at': DATE}, ['id', 'conversation_id', 'sender_id', 'client_message_id', 'kind', 'content', 'restaurant', 'created_at'])
SCHEMAS['MessageList'] = obj({'items': dict(array(ref('ChatMessage')), description='Newest first'), 'next_cursor': text(description='Empty string when no more results')}, ['items', 'next_cursor'])
SCHEMAS['MessageSend'] = obj({'client_message_id': dict(ID, description='Client-generated UUID; retries with the same value return the original message'), 'content': text(4000, minLength=1), 'restaurant_id': dict(ID, description='Share a public restaurant instead of text')}, ['client_message_id'], True)
SCHEMAS['ReadCursor'] = obj({'message_id': ID}, ['message_id'], True)
SCHEMAS['Conversation'] = obj({'id': ID, 'other_user': ref('UserSummary'), 'last_message': {'anyOf': [ref('ChatMessage'), {'type': 'null'}]}, 'unread_count': {'type': 'integer'}, 'other_last_read_message_id': NID, 'created_at': DATE, 'updated_at': DATE}, ['id', 'other_user', 'last_message', 'unread_count', 'other_last_read_message_id', 'created_at', 'updated_at'])
SCHEMAS['ConversationList'] = obj({'items': dict(array(ref('Conversation')), description='Most recently active first; up to 100')}, ['items'])
SCHEMAS['ConversationStart'] = obj({'user_id': ID, 'username': text(50)}, strict=True)

spec = {'openapi': '3.1.0', 'info': {'title': 'Restaurant Space API', 'version': '0.1.0', 'description': 'Phases 1-3 backend (restaurants, comments/likes, direct chat). Realtime chat events use the WebSocket at /api/v1/ws; see docs/realtime.md. UTC timestamps; UUID identifiers. Money is THB with at most two decimal places. JWT access token lasts 15 minutes; rotating HttpOnly refresh cookie lasts 30 days. Send cookies with credentials: include. Serialize refresh requests: reuse revokes the entire family. Images use authorized 5-minute S3 URLs. PATCH merges supplied fields; nullable fields can be cleared with null.'}, 'servers': [{'url': '/', 'description': 'Current API server (development)'}, {'url': 'https://{host}', 'description': 'Production (replace host)', 'variables': {'host': {'default': 'api.example.com'}}}], 'tags': [{'name': n} for n in ['Health', 'Auth', 'Users', 'Restaurants', 'Restaurant Images', 'Menus', 'Feed', 'Comments', 'Likes', 'Chats', 'Uploads', 'Taxonomy']], 'paths': {}, 'components': {'securitySchemes': {'BearerAuth': {'type': 'http', 'scheme': 'bearer', 'bearerFormat': 'JWT'}, 'RefreshCookie': {'type': 'apiKey', 'in': 'cookie', 'name': 'refresh_token'}}, 'schemas': SCHEMAS}}

def route(method, path, tag, summary, response=None, body=None, status=200, auth='required', params=None, description=''):
    import re
    parameters = [{'name': name, 'in': 'path', 'required': True, 'schema': ID if name != 'username' else text()} for name in re.findall(r'\{(\w+)\}', path)]
    parameters += params or []
    responses = {str(status): {'description': summary}}
    if response: responses[str(status)]['content'] = {'application/json': {'schema': ref(response)}}
    for code in [400, 401, 403, 404, 409, 429, 500, 503]:
        responses[str(code)] = {'description': {400: 'Invalid request', 401: 'Authentication required or expired', 403: 'Origin rejected', 404: 'Resource absent or invisible', 409: 'Conflict', 429: 'Rate limit', 500: 'Internal error', 503: 'Dependency unavailable'}[code], 'content': {'application/json': {'schema': ref('Error')}}}
    op = {'operationId': method + '_' + re.sub(r'[^a-zA-Z0-9]+', '_', path).strip('_'), 'tags': [tag], 'summary': summary, 'responses': responses, 'security': [{'BearerAuth': []}] if auth == 'required' else ([{}, {'BearerAuth': []}] if auth == 'optional' else ([{'RefreshCookie': []}] if auth == 'cookie' else []))}
    if parameters: op['parameters'] = parameters
    if description: op['description'] = description
    if body: op['requestBody'] = {'required': True, 'content': {'application/json': {'schema': ref(body)}}}
    spec['paths'].setdefault(path, {})[method] = op
    return op

def qp(name, schema): return {'name': name, 'in': 'query', 'schema': schema}
P = '/api/v1'
route('get', '/healthz', 'Health', 'Liveness', 'Status', auth='none')
ready = route('get', '/readyz', 'Health', 'Check database and S3', 'Status', auth='none')
ready['responses']['503'] = {'description': 'Database or storage unavailable', 'content': {'application/json': {'schema': ref('Status')}}}
for path, summary, body, response, status in [('register', 'Register', 'Register', 'Tokens', 201), ('login', 'Log in', 'Login', 'Tokens', 200), ('refresh', 'Rotate refresh token', None, 'Tokens', 200), ('logout', 'Revoke refresh family', None, None, 204), ('forgot-password', 'Send reset email', 'ForgotPassword', 'Message', 202), ('reset-password', 'Reset password and revoke sessions', 'ResetPassword', None, 204)]:
    op = route('post', P+'/auth/'+path, 'Auth', summary, response, body, status, auth='cookie' if path in ('refresh', 'logout') else 'none')
    if path in ('register', 'login', 'refresh', 'logout', 'reset-password'):
        op['responses'][str(status)]['headers'] = {'Set-Cookie': {'description': 'HttpOnly refresh_token cookie; cleared on logout/reset', 'schema': text()}}
route('get', P+'/auth/google', 'Auth', 'Start Google OIDC with PKCE', status=302, auth='none', description='Sets oauth_state cookie and redirects to Google. Use browser navigation, not the Try It fetch button.')
route('get', P+'/auth/google/callback', 'Auth', 'Verify Google login', 'Tokens', auth='none', params=[qp('state', text()), qp('code', text())], description='Requires the oauth_state cookie. Verifies issuer, signature, audience, expiry, nonce and PKCE. Existing accounts with the same email are not auto-linked (409).')
route('get', P+'/users/me', 'Users', 'Get own profile', 'MyProfile')
route('patch', P+'/users/me', 'Users', 'Update own profile', 'MyProfile', 'ProfilePatch')
route('get', P+'/users/{username}', 'Users', 'Get public profile', 'PublicProfile', auth='optional')
filters = [qp('limit', {'type': 'integer', 'minimum': 1, 'maximum': 100, 'default': 20}), qp('cursor', text()), qp('q', text(100)), qp('mine', {'type': 'boolean'}), qp('user_id', ID), qp('visit_status', {'enum': ['WANT_TO_GO', 'VISITED']}), qp('category_id', ID)]
route('get', P+'/feed', 'Feed', 'Public restaurant feed', 'RestaurantList', auth='optional', params=filters)
route('get', P+'/restaurants', 'Restaurants', 'Search visible restaurants', 'RestaurantList', auth='optional', params=filters)
route('post', P+'/restaurants', 'Restaurants', 'Create own restaurant', 'Restaurant', 'RestaurantCreate', 201)
route('get', P+'/restaurants/{id}', 'Restaurants', 'Get visible restaurant detail', 'RestaurantDetail', auth='optional')
route('patch', P+'/restaurants/{id}', 'Restaurants', 'Update own restaurant', 'Restaurant', 'RestaurantPatch')
route('delete', P+'/restaurants/{id}', 'Restaurants', 'Soft-delete own restaurant', status=204)
route('post', P+'/restaurants/{id}/images', 'Restaurant Images', 'Attach owned READY image (maximum 20)', 'RestaurantImage', 'ImageAttach', 201)
route('patch', P+'/restaurants/{id}/images/{imageId}', 'Restaurant Images', 'Set cover, order or alt text', 'RestaurantImage', 'ImagePatch')
route('delete', P+'/restaurants/{id}/images/{imageId}', 'Restaurant Images', 'Detach restaurant image', status=204)
route('post', P+'/restaurants/{id}/menus', 'Menus', 'Create menu (maximum 200)', 'Menu', 'MenuCreate', 201)
route('patch', P+'/restaurants/{id}/menus/{menuId}', 'Menus', 'Update menu', 'Menu', 'MenuPatch')
route('delete', P+'/restaurants/{id}/menus/{menuId}', 'Menus', 'Delete menu', status=204)
for name in ('categories', 'tags'): route('get', P+'/'+name, 'Taxonomy', 'List '+name, 'TaxonomyList', auth='optional')
route('get', P+'/uploads/images/{id}', 'Uploads', 'Get own upload and fresh URL', 'UploadResult')
op = route('post', P+'/uploads/images', 'Uploads', 'Upload and normalize image', 'UploadResult', status=201, description='Multipart file field; up to 8 MiB and 20 megapixels. JPEG/PNG/WebP decoded, resized to max 2048 px and re-encoded JPEG without metadata. SVG rejected. Attach returned media.id to an entity.')
page = [qp('limit', {'type': 'integer', 'minimum': 1, 'maximum': 100, 'default': 20}), qp('cursor', text())]
route('get', P+'/restaurants/{id}/comments', 'Comments', 'List comments on a visible restaurant', 'CommentList', auth='optional', params=page, description='Top-level comments newest first, each with its replies. Deleted comments that still have replies are returned with content and author null.')
route('post', P+'/restaurants/{id}/comments', 'Comments', 'Comment on a public restaurant', 'Comment', 'CommentCreate', 201)
route('patch', P+'/comments/{id}', 'Comments', 'Edit own comment', 'Reply', 'CommentPatch')
route('delete', P+'/comments/{id}', 'Comments', 'Soft-delete own comment', status=204)
route('post', P+'/restaurants/{id}/likes', 'Likes', 'Like a visible restaurant (idempotent)', 'LikeState')
route('delete', P+'/restaurants/{id}/likes', 'Likes', 'Remove like (idempotent)', 'LikeState')
route('get', P+'/conversations', 'Chats', 'List own conversations', 'ConversationList')
start = route('post', P+'/conversations', 'Chats', 'Start or reuse a direct conversation', 'Conversation', 'ConversationStart', 201, description='Send user_id or username. Returns 201 when created and 200 with the existing conversation for the same pair.')
start['responses']['200'] = {'description': 'Existing conversation', 'content': {'application/json': {'schema': ref('Conversation')}}}
route('get', P+'/conversations/{id}', 'Chats', 'Get a conversation you belong to', 'Conversation')
route('get', P+'/conversations/{id}/messages', 'Chats', 'Message history (newest first)', 'MessageList', params=page)
send = route('post', P+'/conversations/{id}/messages', 'Chats', 'Send a message (HTTP fallback for message:send)', 'ChatMessage', 'MessageSend', 201, description='Provide exactly one of content or restaurant_id. A retry with the same client_message_id returns the original message with 200. Members receive message:new over the WebSocket.')
send['responses']['200'] = {'description': 'Duplicate client_message_id; original message', 'content': {'application/json': {'schema': ref('ChatMessage')}}}
route('post', P+'/conversations/{id}/read', 'Chats', 'Advance own read cursor', None, 'ReadCursor', 204, description='Never moves the cursor backwards. Members receive message:read_update.')
ws = route('get', P+'/ws', 'Chats', 'Realtime WebSocket', status=101, auth='none', description='Upgrade to WebSocket, then send {"type":"auth","data":{"token":"<access token>"}} within 10 seconds. Re-send auth after each token refresh; the server closes with 4001 once 15 minutes pass without it. Event contract: docs/realtime.md.')
ws['responses']['101'] = {'description': 'Switching protocols'}
op['requestBody'] = {'required': True, 'content': {'multipart/form-data': {'schema': obj({'file': {'type': 'string', 'format': 'binary'}}, ['file'])}}}
(BE_ROOT / 'docs/openapi.json').write_text(json.dumps(spec, ensure_ascii=False, indent=2)+'\n')
print(f'Generated {sum(len(p) for p in spec["paths"].values())} operations')
