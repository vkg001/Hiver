# Hiver — AI Customer Support Agent

Hiver is a full-stack AI customer-support application built around a local LLM, semantic retrieval, intent classification, and rule-based escalation. The project is designed around SprintCare-style Twitter support conversations and uses historical customer-support interactions as the knowledge base for grounded responses.

The repository contains three main pieces:

- `api/` — Flask backend and the AI agent implementation.
- `ui/` — React/Vite frontend for the chat interface.
- `Solution.ipynb` — the original experimentation pipeline used to prepare the RAG dataset, prototype the agent, and evaluate it.
- `rag_database.npy` — precomputed searchable chunks and embeddings used by the backend.

> **Important:** The notebook is the clearest description of the original solution, but the current backend has evolved from that prototype. Some behavior in the notebook and backend therefore differs; this README documents the current implementation first and the notebook separately.

---

## Architecture

```text
                        ┌─────────────────────────┐
                        │       React UI          │
                        │      Vite + React       │
                        │        Zustand          │
                        └────────────┬────────────┘
                                     │ POST /chat
                                     │ JSON { message }
                                     ▼
                        ┌─────────────────────────┐
                        │       Flask API         │
                        │   CORS + SSE response   │
                        └────────────┬────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │   CustomerCareAgent     │
                        └────────────┬────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
          ┌──────────────────┐              ┌──────────────────┐
          │ Intent Classifier│              │ Churn / Escalation│
          │   Llama 3.1      │              │      Rules        │
          └────────┬─────────┘              └────────┬─────────┘
                   │                                 │
                   └────────────────┬────────────────┘
                                    │
                         not escalated
                                    ▼
                         ┌──────────────────┐
                         │ Tool-enabled LLM │
                         │    Llama 3.1     │
                         └────────┬─────────┘
                                  │ tool call
                                  ▼
                         ┌──────────────────┐
                         │ Semantic RAG Tool │
                         │ all-MiniLM-L6-v2 │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ rag_database.npy │
                         │ 12,975 chunks    │
                         └────────┬─────────┘
                                  │
                                  ▼
                         grounded reply stream
                                  │
                                  ▼
                         ┌──────────────────┐
                         │       SSE        │
                         │ data: {...}      │
                         └──────────────────┘
```

### Request lifecycle

For a normal chat request, the current backend follows this sequence:

1. The Flask `/chat` endpoint reads `message` from the JSON request body.
2. `CustomerCareAgent` creates an LLM-backed `Classifier` and classifies the message into one of:
   - `Network Issue`
   - `Billing`
   - `Device Upgrade`
   - `Cancellation`
   - `General Inquiry`
3. The message is checked against a fixed churn/escalation keyword list: `cancel`, `switch`, `horrible`, `worst`, `lawyer`, `attorney`, and `rip off`.
4. Cancellation intent or a churn keyword causes an immediate `ESCALATE` response without performing retrieval.
5. Otherwise the agent invokes a tool-enabled Llama 3.1 model.
6. The model can call `get_existing_solution`, which performs embedding-based cosine-similarity search over `rag_database.npy`.
7. The two highest-scoring chunks above a `0.70` cosine-similarity threshold are returned to the model.
8. The model generates a short Twitter-style response based on the conversation history and retrieved evidence.
9. The response is streamed to the browser as Server-Sent Events (SSE).

---

## Backend

### Files

```text
api/
├── app.py                  # Flask HTTP API
├── customer_care_agent.py  # Agent orchestration + SSE streaming
├── classifier.py           # LLM-based intent classification
└── tools.py                # Embedding model + RAG retrieval tool
```

### `api/app.py`

The Flask application exposes two endpoints:

#### `GET /health`

Returns:

```text
ok
```

#### `POST /chat`

Request body:

```json
{
  "message": "My phone is not getting any network."
}
```

The endpoint returns `text/event-stream` rather than a conventional JSON response. Each event has the following shape:

```json
{
  "intent": "Network Issue",
  "action": "AUTO_HANDLE",
  "chunk": "..."
}
```

For escalation, `action` becomes `ESCALATE` and the `chunk` contains the handoff message.

CORS is explicitly configured for `http://localhost:3003`, matching the Vite development server configured in `ui/vite.config.js`.

### `api/classifier.py`

The intent classifier is intentionally simple: it uses a zero-shot prompt against local `llama3.1` with temperature `0` and asks for exactly one intent name.

The implementation does **not** use a trained classifier or a fixed ML classification head. Classification quality therefore depends heavily on the local LLM and prompt.

### `api/tools.py`

The RAG layer loads `rag_database.npy` with `allow_pickle=True` and builds an in-memory list of stored embeddings.

The retrieval model is:

```text
sentence-transformers/all-MiniLM-L6-v2
```

For every query:

```text
query
  ↓
query embedding
  ↓
cosine similarity against every stored embedding
  ↓
keep scores >= 0.70
  ↓
sort descending
  ↓
take top 2
```

This is a brute-force, in-memory vector search. It is simple and appropriate for a small prototype, but it is not a scalable vector database architecture.

### `api/customer_care_agent.py`

This class is the main orchestration layer.

It uses:

- `ChatOllama(model="llama3.1", temperature=0)`
- LangChain message primitives
- a tool-enabled LLM binding
- `InMemoryChatMessageHistory`
- a generator that emits SSE events

The system prompt asks the model to behave as a SprintCare support agent and generate short, polite Twitter responses grounded in historical chunks.

---

## Retrieval / RAG Dataset

The committed `rag_database.npy` is produced by the notebook rather than by the Flask application itself.

The stored records have this structure:

```python
{
    "original_index": int,
    "text": str,
    "embedding": np.ndarray
}
```

The notebook reports a database size of **12,975 searchable chunks**.

The current retrieval implementation keeps only the text and embedding data necessary for semantic lookup. `original_index` preserves the relationship between a chunk and its source conversation, although the current backend does not use that metadata when generating its answer.

---

## `Solution.ipynb` — Data & Agent Development Pipeline

`Solution.ipynb` is more than a demo notebook. It documents the original end-to-end approach used to build the system.

### 1. Load the TWCS dataset

The notebook expects:

```text
Datasets/twcs/twcs.csv
```

It loads the dataset with pandas and filters it to the `sprintcare` account.

### 2. Reconstruct conversations

The notebook sorts messages chronologically and groups customer/support messages into conversation strings such as:

```text
Host: ...
User: @sprintcare ...
Host: ...
```

Inbound messages are labelled `User`, while support replies are labelled `Host`.

### 3. Chunk conversations

Each conversation is split into 1,000-character chunks with 35% overlap.

That means:

```text
chunk_size = 1000
overlap = 350
step = 650
```

The overlap helps preserve context across chunk boundaries but also increases the total number of stored vectors.

### 4. Generate embeddings

Every chunk is encoded with `all-MiniLM-L6-v2` and serialized to:

```text
rag_database.npy
```

### 5. Prototype the RAG tool

The notebook initially implements `search_existing_solution` as a LangChain tool. It:

- embeds the incoming query;
- computes cosine similarity against all stored embeddings;
- applies a `0.70` threshold;
- returns up to two highest-scoring chunks.

### 6. Prototype intent classification

The notebook uses the same five intents as the backend:

```text
Network Issue
Billing
Device Upgrade
Cancellation
General Inquiry
```

### 7. Prototype agent policy

The notebook prototype applies the following policy:

```text
Cancellation / churn signal
        ↓
     ESCALATE

No relevant historical chunks
        ↓
     ESCALATE

Relevant historical context + low churn risk
        ↓
   AUTO_HANDLE
```

The current backend preserves the churn/cancellation branch but does **not** reproduce the notebook's explicit `NO_CHUNKS_FOUND → ESCALATE` behavior. The current tool returns an empty string when no chunk clears the threshold, after which the model may continue without retrieved evidence.

### 8. Notebook evaluation

The notebook includes an 11-example golden set and prints:

```text
Intent Accuracy:      54.54545454545454%
Escalation Accuracy:  36.36363636363637%
```

These results should be treated as a prototype evaluation, not as evidence of production-level reliability.

There is also a label-consistency problem in the evaluation itself. The classifier uses names such as `General Inquiry` and `Device Upgrade`, while the golden set contains `General Enquiry` and `Device Upgradation`. Those spelling differences can produce false negatives even when the semantic classification is correct.

The escalation expectations in the golden set also go beyond the current rule policy. For example, several `Network Issue` and `Device Upgrade` cases are marked as expected escalations, while the current backend only escalates for churn/cancellation conditions.

---

## Frontend

The UI is a Vite + React application using:

- React 19
- React Router
- Zustand for chat state
- Tailwind CSS 4
- `react-markdown`
- Lucide icons

The Vite development server runs on port `3003`.

The chat store sends requests directly to:

```text
http://127.0.0.1:5000/chat
```

It reads the HTTP response body as a stream and appends every received SSE `chunk` to the current agent message. When the backend sends `ESCALATE`, the store changes the UI state to an escalated state and disables normal message entry in favor of the escalation banner.

---

## Requirements

### System requirements

- Python 3.12+ is recommended based on the notebook kernel used in the repository.
- Node.js with npm.
- Ollama installed and available on the local machine.
- The Ollama `llama3.1` model available locally.

### Python packages

The backend currently imports:

```text
Flask
flask-cors
langchain-core
langchain-ollama
sentence-transformers
numpy
```

The notebook additionally uses pandas, Jupyter/IPython, and the LangChain package itself.

The repository does not currently include a backend `requirements.txt`, so dependencies need to be installed manually unless you create one.

---

## Run the Application

### 1. Start Ollama

Install Ollama for your OS, then make sure the model is available:

```bash
ollama pull llama3.1
```

Verify Ollama is running before starting the Flask server.

### 2. Install backend dependencies

From the repository root:

```bash
python -m venv .venv
```

Activate the virtual environment.

**Windows PowerShell:**

```powershell
.venv\Scripts\Activate.ps1
```

**macOS / Linux:**

```bash
source .venv/bin/activate
```

Install the backend dependencies:

```bash
pip install flask flask-cors numpy sentence-transformers langchain-core langchain-ollama
```

### 3. Start the backend

Run the Flask app from inside `api/`:

```bash
cd api
python app.py
```

The API will be available at:

```text
http://127.0.0.1:5000
```

Health check:

```bash
curl http://127.0.0.1:5000/health
```

### 4. Start the frontend

In another terminal:

```bash
cd ui
npm install
npm run dev
```

Open:

```text
http://localhost:3003
```

The frontend is already configured to call the backend at `http://127.0.0.1:5000` and the Flask server is already configured to allow the `http://localhost:3003` origin.

### 5. Test the streaming API directly

With the backend running:

```bash
curl -N http://127.0.0.1:5000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"My family and I have 2 iPhone 7s and 2 iPhone 7 pluses. Are those eligible for trade in for the 8 or X?"}'
```

You should receive SSE events similar to:

```text
data: {"intent":"Device Upgrade","action":"AUTO_HANDLE","chunk":"..."}
```

---

## Rebuilding the RAG Database

The committed `rag_database.npy` means you do not normally need to run the notebook just to start the backend.

To rebuild it from raw data, the notebook expects the TWCS dataset at:

```text
Datasets/twcs/twcs.csv
```

Then run the notebook in order.

The relevant pipeline is:

```text
TWCS CSV
  ↓
filter SprintCare conversations
  ↓
parse timestamps
  ↓
sort chronologically
  ↓
reconstruct conversations
  ↓
1,000-char chunks / 35% overlap
  ↓
all-MiniLM-L6-v2 embeddings
  ↓
rag_database.npy
```

`Datasets` is ignored by Git in the current repository, so the raw dataset is intentionally not committed.

---

## Design Decisions

### Why a local LLM?

The project uses Ollama and `llama3.1`, avoiding a hosted LLM dependency for the demo and keeping inference local.

### Why embeddings instead of keyword search?

Customer-support messages are often semantically similar without sharing exact wording. Embeddings allow a query such as “Can I trade my old iPhones for a newer model?” to retrieve historically similar trade-in conversations even when the exact wording differs.

### Why a 70% threshold?

The threshold is a policy choice in the prototype intended to reject weak matches and reduce unsupported answers. It is not the result of a demonstrated hyperparameter search, so it should be tuned against a larger validation set before production use.

### Why two retrieved chunks?

The prototype deliberately limits the context passed to the model to the two highest-scoring matches. This reduces prompt size but can also discard useful supporting context for complex tickets.

### Why SSE?

The backend uses Server-Sent Events so the UI can display generated response text incrementally instead of waiting for the complete model response.

---

## Known Limitations and Risks

This section is intentionally explicit because the repository is a prototype rather than a production-ready support system.

### 1. The backend agent is recreated for every request

`/chat` constructs a new `CustomerCareAgent()` for each request. Because the in-memory chat history lives inside that object, conversation memory does not persist across separate HTTP requests.

In other words, `InMemoryChatMessageHistory` exists in the implementation, but the current API lifecycle prevents it from functioning as durable per-user conversation memory.

### 2. Memory is not user/session scoped

Even if the agent instance were reused, the current memory object has no user/session identifier. A production design should maintain independent history per conversation and define explicit retention limits.

### 3. RAG is optional rather than enforced

The LLM is allowed to decide whether to call the retrieval tool. The backend does not force retrieval before generating a normal answer.

This weakens the “grounded strictly in historical chunks” guarantee in the system prompt.

### 4. No-hit retrieval is not escalated in the current backend

The notebook explicitly escalates when no sufficiently similar historical chunk is found. The current `Tools._get_existing_solution()` returns an empty string instead, and the agent can continue to generation.

For a customer-support system, this is a meaningful correctness issue: lack of supporting evidence should generally be treated as a handoff condition rather than an invitation to answer from model memory.

### 5. Brute-force vector search

Every query calculates similarity against every stored embedding. This is approximately `O(N·D)` per request and becomes increasingly expensive as the corpus grows.

A real deployment should use a vector index such as FAISS, Qdrant, pgvector, Milvus, Elasticsearch/OpenSearch, or another ANN-capable store.

### 6. The embedding model is reloaded when `Tools` is created

`SentenceTransformer("all-MiniLM-L6-v2")` is initialized in `Tools.__init__`. Since a new `CustomerCareAgent` (and therefore a new `Tools`) is created for every request, model loading can become a major request-time cost.

The embedding model should be initialized once per process and reused.

### 7. The LLM is also initialized repeatedly

`CustomerCareAgent` creates a new `ChatOllama` instance per request, while `Classifier` separately creates another `ChatOllama` instance. These objects should normally be shared or managed as application-level dependencies.

### 8. Escalation policy is hard-coded

The churn keywords are simple substring checks. This can cause both false positives and false negatives. For example, a word such as `cancel` can appear in a sentence that does not actually require escalation, while an angry customer may use completely different language.

### 9. Evaluation coverage is very small

The notebook evaluates only 11 examples. That is far too small to establish reliable quality for five intent classes plus escalation behavior.

### 10. Evaluation labels are inconsistent

`General Inquiry` vs `General Enquiry` and `Device Upgrade` vs `Device Upgradation` are treated as different strings by the exact-match evaluation. This makes the reported accuracy partly a data-labeling problem rather than a pure model-performance measurement.

### 11. SSE framing is minimal

The frontend parses received network chunks by splitting on newline characters. HTTP chunk boundaries and SSE event boundaries are not guaranteed to align. A production-grade SSE client should buffer incomplete events across reads.

### 12. No authentication, persistence, rate limiting, or observability

The API currently has no authentication, persistent conversation store, rate limiting, structured logging, metrics, tracing, or audit layer. Those would be required before exposing the service publicly.

---

## Recommended Next Steps

A sensible productionization sequence would be:

1. **Make retrieval mandatory** for auto-handled replies and escalate on retrieval failure.
2. **Load models once per process** rather than per request.
3. **Introduce session IDs** and store chat history per session.
4. **Move embeddings to an ANN/vector index** instead of full-array brute-force search.
5. **Replace keyword-only escalation** with a deterministic policy built from validated intent + risk signals.
6. **Normalize evaluation labels** and expand the golden set substantially.
7. **Evaluate retrieval separately** using recall@k / precision@k before evaluating answer generation.
8. **Add structured tests** for intent classification, escalation, retrieval, SSE streaming, and API contracts.
9. **Add a real configuration layer** for model names, thresholds, CORS origins, and backend URLs.
10. **Add production controls** such as authentication, rate limiting, monitoring, request tracing, and persistent storage.

---

## Project Structure

```text
Hiver/
├── api/
│   ├── app.py
│   ├── classifier.py
│   ├── customer_care_agent.py
│   └── tools.py
├── ui/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── store/
│   │   └── styles/
│   ├── package.json
│   └── vite.config.js
├── Solution.ipynb
├── rag_database.npy
├── demo.mp4
└── .gitignore
```

---

## Example Behavior

### Automatic handling

A customer asks:

```text
My family and I have 2 iPhone 7s and 2 iPhone 7 pluses. Are those eligible for trade in for the 8 or X?
```

The intended path is:

```text
Device Upgrade
      ↓
retrieve similar historical trade-in conversations
      ↓
generate grounded support reply
      ↓
AUTO_HANDLE
```

### Escalation

A customer asks:

```text
This service is horrible. I want to cancel and switch providers.
```

The current policy detects `horrible`, `cancel`, and `switch`, so the request is escalated immediately:

```text
Cancellation / churn risk
      ↓
ESCALATE
```

---

## Development Notes

The repository currently contains no backend dependency lockfile or `requirements.txt`, no explicit environment-variable configuration, and no automated backend test suite. The README therefore documents the commands inferred from the source code rather than a formal packaging/deployment system.

The raw TWCS dataset is not committed because the repository's `.gitignore` ignores the `Datasets` directory. The generated `rag_database.npy`, however, is committed and is sufficient for running the current retrieval layer.

---

## License

No license is currently specified in the repository. Treat the project as **all rights reserved** unless the repository owner adds an explicit open-source license.

---

## Credits / References

- Repository: https://github.com/vkg001/Hiver
- Embedding model: `sentence-transformers/all-MiniLM-L6-v2`
- Local LLM runtime: Ollama / `llama3.1`
- AI orchestration: LangChain
- Backend: Flask
- Frontend: React + Vite + Zustand + Tailwind CSS
