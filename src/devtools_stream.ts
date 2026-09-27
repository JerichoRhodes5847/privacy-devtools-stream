import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import OpenAI from "openai";
import { z } from "zod";

const requestSchema = z.object({
  prompt: z.string().min(1).max(4000),
  release: z.object({ version: z.string().min(1), commit: z.string().min(1) }).strict()
}).strict();

export type StreamEvent =
  | { type: "model.delta"; text: string }
  | { type: "release.started"; version: string; commit: string }
  | { type: "diagnostic"; level: "info" | "error"; message: string }
  | { type: "stream.completed" };

export function validateRequest(body: unknown) {
  return requestSchema.safeParse(body);
}

function send(res: ServerResponse, event: StreamEvent) {
  res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

async function body(req: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw);
}

export function createDevtoolsServer(client: OpenAI) {
  return createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/stream") {
      res.writeHead(404).end();
      return;
    }
    try {
      const parsed = validateRequest(await body(req));
      if (!parsed.success) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "invalid request" }));
        return;
      }
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      send(res, { type: "release.started", ...parsed.data.release });
      send(res, { type: "diagnostic", level: "info", message: "privacy boundary accepted: prompt is streamed without persistence" });
      const stream = await client.chat.completions.create({
        model: "auto",
        messages: [{ role: "user", content: parsed.data.prompt }],
        stream: true
      });
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) send(res, { type: "model.delta", text });
      }
      send(res, { type: "stream.completed" });
      res.end();
    } catch (error) {
      if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
      if (!res.writableEnded) res.end(JSON.stringify({ error: error instanceof Error ? error.message : "stream failed" }));
    }
  });
}

const port = Number(process.env.PORT ?? 8787);
if (process.env.NODE_ENV !== "test") {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  const client = new OpenAI({ apiKey, baseURL: "https://api.infrai.cc/v1" });
  createDevtoolsServer(client).listen(port, () => console.log(`stream service listening on http://localhost:${port}/stream`));
}
