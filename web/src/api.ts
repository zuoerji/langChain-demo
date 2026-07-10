export type ApiResult<T = unknown> = {
  ok: boolean;
  output?: string;
  data?: T;
  error?: string;
  message?: string;
  details?: unknown;
};

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  console.log(response,'====response===');
  const payload = (await response.json()) as ApiResult<T>;
  console.log(payload, '====payload==');
  if (!response.ok || !payload.ok) {
    throw new Error(payload.message ?? payload.error ?? `Request failed: ${response.status}`);
  }

  return payload.data as T;
}

export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.message ?? payload.error ?? `Request failed: ${response.status}`);
  }

  return payload.data.output as T;
}

export async function streamPost(
  url: string,
  body: unknown,
  onEvent: (event: string, data: unknown) => void,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Stream request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      const lines = rawEvent.split("\n");
      const event = lines.find((line) => line.startsWith("event: "))?.slice(7) ?? "message";
      const dataText = lines
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6))
        .join("\n");

      if (dataText) {
        onEvent(event, JSON.parse(dataText));
      }
    }
  }
}

export function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}
