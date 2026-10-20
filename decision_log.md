# Decision Log - AI Voice Sales Bot

**Assignment:** Sankar Group - AI Voice Sales Bot  
**Repository:** `ai-voice-sales-bot`  
**Product branding:** VoicePilot  
**Status:** In progress

## Decision history

### D-001: Use a browser-based voice interface for the MVP

- **Status:** Accepted
- **Decision:** Implement the initial calling experience in the browser rather than integrating a telephony provider.
- **Context:** The assignment requires an interactive voice conversation within 48 hours, but does not require actual phone-number dialing.
- **Rationale:** Browser microphone input, speech recognition, speech synthesis, and audio recording reduce integration complexity and time to first working demo.
- **Alternatives considered:** Telephony providers and dedicated real-time voice platforms.
- **Trade-offs:** Browser compatibility and speech-recognition availability may vary. This MVP does not make outbound telephone calls.
- **Validation:** Complete a real two-way voice conversation in desktop Chrome.

### D-002: Keep AI credentials and model requests on the backend

- **Status:** Accepted
- **Decision:** Call Gemini through the FastAPI backend; do not expose the API key in frontend code.
- **Context:** Browser code is visible to users, so frontend environment variables cannot protect a secret.
- **Rationale:** Keeps provider credentials out of the client and provides one place to validate requests and handle AI responses.
- **Alternatives considered:** Calling Gemini directly from React.
- **Trade-offs:** Requires a running backend and introduces an additional network request.
- **Validation:** Confirm that AI requests succeed through FastAPI and that no secret appears in frontend bundles or Git history.

### D-003: Ground sales conversations in a defined demo product

- **Status:** Accepted
- **Decision:** Use fictional LeadPilot CRM product information as the source of truth for the demonstration.
- **Context:** The bot must explain a SaaS product, answer questions, handle objections, and attempt conversion.
- **Rationale:** A fixed product description makes sales responses more consistent and allows unsupported claims to be identified.
- **Alternatives considered:** Allowing the model to invent product details or introducing a configurable product catalogue in the first version.
- **Trade-offs:** The initial demo covers one product and must not invent pricing, integrations, guarantees, or capabilities that have not been specified.
- **Validation:** Test common questions and unsupported-product-detail questions.

### D-004: Use structured AI output for post-call intelligence

- **Status:** Accepted
- **Decision:** Represent the post-call summary, customer requirements, objections, next steps, and sales status as structured data.
- **Context:** The assignment requires consistent summaries and one of six exact sales statuses.
- **Rationale:** Structured responses are easier to validate, store, display, and test than free-form text.
- **Alternatives considered:** Generating a paragraph and inferring the sales status from its wording in the frontend.
- **Trade-offs:** Model output must be validated, and malformed or invalid statuses need safe error handling.
- **Validation:** Reject or handle missing fields and statuses outside `Converted`, `Interested`, `Follow-up Required`, `Not Interested`, `Demo Requested`, and `No Response`.

### D-005: Use browser speech APIs and MediaRecorder for the initial voice implementation

- **Status:** Accepted
- **Decision:** Use browser speech recognition for customer input, speech synthesis for bot replies, and MediaRecorder for audio capture.
- **Context:** The first release needs live voice interaction, readable transcripts, and a recording that can be replayed.
- **Rationale:** These APIs provide a lightweight implementation without requiring a separate voice infrastructure service.
- **Alternatives considered:** External speech-to-text, text-to-speech, or real-time voice services.
- **Trade-offs:** Speech recognition support, language availability, microphone permissions, and audio capture behavior vary by browser. Speech recognition and MediaRecorder may not produce identical audio or transcript timing across environments.
- **Validation:** Test permissions, interruptions, end-call behavior, recording playback, and supported language behavior in the target browser.

### D-006: Require explicit recording consent

- **Status:** Accepted
- **Decision:** Ask for consent before recording and do not start recording unless the user consents.
- **Context:** Call recordings must be collected with appropriate consent.
- **Rationale:** Makes recording behavior transparent and satisfies the assignment's consent requirement.
- **Alternatives considered:** Starting recording automatically when a call begins.
- **Trade-offs:** The application needs a clear consent state and must handle refusal without breaking the conversation.
- **Validation:** Confirm that refusal prevents recording and that consent is obtained before recording starts.

### D-007: Persist completed calls for history and playback

- **Status:** Proposed
- **Decision:** Use SQLite initially for call metadata, transcripts, summaries, and sales statuses, with recording storage handled separately or through a persisted file reference.
- **Context:** Previous calls must remain available after the current conversation ends.
- **Rationale:** SQLite keeps the initial database simple and local to the application.
- **Alternatives considered:** In-memory state, a managed database, or storing all recording bytes directly in database rows.
- **Trade-offs:** In-memory state would lose history on restart. SQLite and local recording files require persistent storage and a suitable deployment strategy.
- **Validation:** Restart the backend and confirm that completed calls and recordings remain accessible. Reassess storage before deployment.

### D-008: Test the backend before building the full voice workflow

- **Status:** Implemented
- **Decision:** Establish backend health and AI connectivity before proceeding to voice features.
- **Context:** Voice interaction depends on a functioning backend for model requests.
- **Rationale:** Isolates basic infrastructure and provider failures from later browser-audio issues.
- **Evidence:** FastAPI started successfully and the health endpoint returned HTTP 200, as reported during development.
- **Trade-offs:** A successful health check alone does not prove that the Gemini integration works.
- **Next validation:** Verify the frontend-to-backend connection and receive a real Gemini response.

### D-009: Pin compatible frontend dependencies

- **Status:** Proposed - pending verification
- **Decision:** Replace incompatible latest-version Vite dependencies with versions compatible with the current Node.js installation.
- **Context:** Node.js 20.16.0 was used with Vite 8 and Rolldown, which require a newer Node.js version; startup also failed because a native Rolldown binding was missing.
- **Rationale:** Avoids unnecessary runtime upgrades during the assignment and makes dependency installation more reproducible.
- **Alternatives considered:** Upgrade Node.js to a supported version and retain Vite 8.
- **Trade-offs:** Older tooling may lack newer features, and package compatibility must be verified.
- **Validation:** Clean installation, successful `npm run dev`, and successful production build.

### D-010: Keep API request and response contracts explicit

- **Status:** Accepted
- **Decision:** Define and validate backend request/response structures rather than accepting arbitrary unvalidated payloads.
- **Context:** Frontend, AI integration, and later call-history features need predictable data contracts.
- **Rationale:** Improves API consistency, error handling, and testability.
- **Implementation note:** The backend model module was renamed from `schemas.py` to `state.py` during development. Imports and module responsibilities must remain consistent.
- **Trade-offs:** Schema changes require coordinated updates to callers and tests.
- **Validation:** Exercise invalid requests and confirm that API errors are predictable.

### D-011: Resolve local environment configuration from an explicit path

- **Status:** Implemented and verified
- **Decision:** Load the backend environment file using a path resolved from `backend/app/config.py`, rather than relying on the process working directory.
- **Context:** Starting Uvicorn from different directories can cause environment loading to target the wrong `.env` file.
- **Rationale:** Makes local startup behavior predictable and avoids misleading missing-key errors.
- **Validation:** Confirm the key is loaded without printing its value, then verify a successful `/api/ai-test` response