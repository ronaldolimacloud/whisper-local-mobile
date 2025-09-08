AppSync Events (generic WebSockets pub/sub)

Use for non‑GraphQL channels (presence, typing, device telemetry, AI token streams).

Channels support paths (e.g., /default/rooms/{roomId}) and wildcards (/default/*).

Publish supports batching (send ≤ 5 events per call). Each event is a string (typically JSON.stringify).

Auth options mirror GraphQL: API Key, IAM, Cognito, OIDC, Lambda. Configure per Events API.

Minimal browser publisher

const socket = new WebSocket(`wss://${REALTIME_DOMAIN}/event/realtime`, ['aws-appsync-event-ws', base64UrlHeaderProtocol()])
socket.onopen = () => socket.send(JSON.stringify({
id: crypto.randomUUID(),
type: 'publish',
channel: `/default/rooms/${roomId}`,
events: [JSON.stringify({ t: Date.now(), type: 'TYPING', userId })],
authorization: { 'x-api-key': API_KEY },
}))

Channel taxonomy

/default/system
/default/rooms/{roomId}
/default/users/{userId}
/default/* # dashboards/moderators
