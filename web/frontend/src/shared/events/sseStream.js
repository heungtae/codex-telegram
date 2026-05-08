const SSE_ENDPOINT = "/api/events/stream";

export function createSseStream() {
  return new EventSource(SSE_ENDPOINT, { withCredentials: true });
}

export function closeSseStream(stream) {
  if (!stream) {
    return;
  }
  stream.close();
}
