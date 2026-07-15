


export function openSse(res) {
  res.setHeader("Content-Type","text/event-stream;charset=utf-8");
  res.setHeader("Cache-Control","no-Cache, no-transform");
  res.setHeader("Connection","keep-alive");
  res.flushHeaders?.();
}


export function sendSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function endSse(res) {
  sendSse(res, "done" ,{ ok: true });
  res.end();
}