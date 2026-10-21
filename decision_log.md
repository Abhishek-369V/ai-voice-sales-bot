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

### D-012: Pause speech recognition while the assistant speaks

- **Status:** Implemented in the Phase 2 frontend
- **Decision:** Stop browser speech recognition while a Gemini response is being generated and spoken, then resume listening after speech playback ends.
- **Context:** Continuous microphone recognition can capture the assistant's own spoken response and feed it back as a new customer turn.
- **Rationale:** Sequential turn-taking reduces echo/feedback loops and keeps customer and assistant transcript entries distinct.
- **Alternatives considered:** Leave recognition continuously active and attempt to filter the assistant's audio from recognized text.
- **Trade-offs:** The customer waits until the assistant finishes speaking before the next turn; browser speech APIs may still vary by browser.
- **Validation:** In desktop Chrome or Edge, ask a question by voice, confirm the assistant speaks once, and verify it does not transcribe its own reply as a customer message.

### D-013: Optimize sales responses for concise voice conversations

- **Status:** Implemented 
- **Decision:** Use a consultative sales prompt, limit response length, and reuse the Gemini client.
- **Context:** Initial responses sounded generic and were slower than desirable for a live voice interaction.
- **Rationale:** Direct answers, one discovery question per turn, and shorter output should improve conversational quality and reduce unnecessary generation.
- **Trade-offs:** Short answers may omit detail; the bot must still answer the customer's actual question.
- **Validation:** Test discovery, unsupported-feature, and demo-intent scenarios; compare response time and quality before and after changes.

### D-014: Reduce Gemini reasoning effort for live sales turns

- **Status:** Implemented and validated
- **Decision:** Set Gemini 3.8 Flash thinking level to low and allow 256 output tokens for concise sales responses.
- **Context:** Initial responses were slow and returned incomplete phrases under a restrictive output-token limit.
- **Rationale:** Reduce unnecessary reasoning overhead while giving the model sufficient output space to complete short answers.
- **Trade-offs:** Lower reasoning effort may reduce performance on complex requests; temporary provider outages remain possible.
- **Validation:** Verify complete replies, measure request latency, and test discovery, unsupported-feature, and demo-intent scenarios.


### D-015: Lightweight Automated Testing and CI

- **Status:** Accepted
- **Context:** The assignment has a short implementation window, so quality checks must not delay the working voice-sales MVP.
- **Decision:** Add focused backend regression tests. After the core call flow works, add GitHub Actions to run the tests on pushes and pull requests if time permits. Defer automated deployment unless the hosting platform provides a simple setup.
- **Rationale:** Catch regressions without depending on live Gemini availability, API quotas, or secrets in CI.
- **Consequences:** The main priority remains end-to-end functionality; tests and CI improve reliability without replacing manual call testing.

### D-016: Use a backend Telugu TTS fallback without a cloud API key

- **Status:** Accepted for demo; validate against live network behavior
- **Decision:** Use Python `gTTS` through a backend-only `/api/tts` endpoint for Telugu speech output when the browser does not expose a Telugu speech-synthesis voice. Keep the existing browser speech-synthesis path for English and Hindi.
- **Context:** The tested browser returned an empty list for Telugu voices while Gemini generated a complete Telugu text response. The user no longer has an active Azure free account.
- **Rationale:** Avoids requiring a new cloud subscription or API key and isolates the workaround to Telugu playback.
- **Alternatives considered:** Azure AI Speech, Google Cloud Text-to-Speech, and local TTS models.
- **Trade-offs:** `gTTS` depends on an unofficial upstream Google Translate speech endpoint, requires internet access, and may be rate-limited or change without notice. It is not a production SLA-backed dependency.
- **Validation:** Mock `/api/tts` in automated tests; manually test a real Telugu voice call with network access and confirm audio playback and listening resumption.

### D-017: Record audio only after explicit user consent

- **Status:** Implemented; manual browser validation required
- **Decision:** Add an unchecked recording-consent checkbox. Start `MediaRecorder` only when the user opts in; otherwise save transcript and call intelligence without audio.
- **Context:** The assignment requires a recording that can be replayed after a conversation, with consent.
- **Rationale:** Makes recording explicit and allows a call to continue when the user declines recording.
- **Alternatives considered:** Automatically recording every call or requiring consent to use the call feature at all.
- **Trade-offs:** Browser recording support and microphone permissions vary; the demo currently stores recordings as SQLite BLOBs and caps uploaded audio at 10 MB.
- **Validation:** Confirm unchecked calls save no recording, checked calls save playable audio, and the API rejects audio sent without consent.

### D-018: Persist call history and validated post-call sales intelligence in SQLite

- **Status:** Implemented; end-to-end validation required
- **Decision:** Store call metadata, transcript, structured summary, requirements, objections, next steps, one exact sales status, and optional consented audio in SQLite. Generate structured post-call analysis through Gemini and validate the status against the six required values.
- **Context:** The assignment requires call history, recordings, transcripts, summaries, and one final sales status per call.
- **Rationale:** SQLite keeps the single-instance demo self-contained and provides durable history across page reloads.
- **Alternatives considered:** Keeping calls only in frontend state or using a hosted database.
- **Trade-offs:** Local SQLite is not shared across multiple deployment instances; summary generation requires Gemini for calls with customer messages. Empty customer transcripts receive `No Response` without a model call.
- **Validation:** API tests cover no-response classification, consent enforcement, recording playback, and structured summary validation; manually test a complete call through save and reload.


### D-019: Mix customer microphone and assistant speech in consented recordings

- **Status:** Implemented; browser end-to-end validation required
- **Decision:** Route microphone input and backend-generated assistant audio through a Web Audio `MediaStreamDestination`, then record the mixed stream only when explicit recording consent is enabled. Use the backend TTS endpoint for English, Hindi, and Telugu so the assistant audio is available as a media stream source.
- **Context:** Initial MediaRecorder implementation recorded only the microphone stream; browser `speechSynthesis` output is not directly exposed as a MediaStream.
- **Rationale:** A mixed stream creates a single replayable audio recording containing both sides of the conversation without asking the user to share their screen/tab audio.
- **Alternatives considered:** Keep microphone-only recording, or require `getDisplayMedia` tab-audio sharing, which adds a disruptive browser sharing prompt and is browser-dependent.
- **Trade-offs:** The free `gTTS` path is an unofficial internet-dependent service, can add latency, and may be rate-limited. Browser testing must confirm assistant audio is audible in the recording and that playback remains audible to the user.
- **Validation:** Automated tests cover supported TTS language codes; manually record a consented English, Hindi, and Telugu call and replay each recording. Confirm unchecked consent stores no audio.