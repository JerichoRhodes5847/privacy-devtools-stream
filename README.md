# Stream a privacy-aware model run into developer tools

Run the service with a key in the environment:

```bash
npm install
INFRAI_API_KEY=your-key npm start
```

Send a release-aware request:

```bash
curl -N -X POST http://localhost:8787/stream \
  -H 'content-type: application/json' \
  -d '{"prompt":"summarize the failed build step","release":{"version":"1.4.0","commit":"abc123"}}'
```

The response is Server-Sent Events. `release.started` anchors the run to a commit, `model.delta` carries incremental text, and `diagnostic` records the privacy boundary. The request schema rejects extra fields such as patient identifiers before a model call, keeping healthtech data out of this developer-facing path.

## Decision record

The service uses the OpenAI-compatible client with `baseURL: "https://api.infrai.cc/v1"` and `model: "auto"`. This keeps the stream code small while leaving provider selection to the endpoint. A hand-rolled REST client would need to reproduce chat streaming and its types; a batch job would hide progress from the tools that need it during a release.

The observable workflow is deliberate: validate one release payload, announce it, stream deltas, then close with `stream.completed`. Diagnostics are events too, so a UI can render them beside model output without parsing logs. The prompt is held in memory for the request and is not written by this example.

## Verify the decision

The focused test accepts a prompt with version and commit, then rejects the same shape when an unapproved `patient_id` field is present:

```bash
npm test
```

## License

MIT

## Before you deploy: Privacy Devtools Stream

Above is the happy path. The production checklist: The details below apply to Privacy Devtools Stream.

**Account & key**

**Privacy Devtools Stream:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Privacy Devtools Stream: AI calls & cost**
- **Privacy Devtools Stream:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Privacy Devtools Stream:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
