import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  Bot,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  History,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  ShieldCheck,
  Sparkles,
  Volume2,
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const SPEECH_LANGUAGES = [
  { value: 'en-IN', label: 'English (India)' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'te-IN', label: 'Telugu' },
  { value: 'en-US', label: 'English (US)' },
]

function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

export default function App() {
  const [apiStatus, setApiStatus] = useState('not-checked')
  const [aiStatus, setAiStatus] = useState('idle')
  const [message, setMessage] = useState('Can LeadPilot CRM help my team remember to follow up with new leads?')
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const [language, setLanguage] = useState('en-IN')
  const [callStatus, setCallStatus] = useState('idle')
  const [transcript, setTranscript] = useState([])
  const [interimTranscript, setInterimTranscript] = useState('')
  const [callSeconds, setCallSeconds] = useState(0)
  const [recordingConsent, setRecordingConsent] = useState(false)
  const [recordingState, setRecordingState] = useState('off')
  const [callSummary, setCallSummary] = useState(null)
  const [callHistory, setCallHistory] = useState([])
  const [historyStatus, setHistoryStatus] = useState('loading')
  const [saveMessage, setSaveMessage] = useState('')
  const [savingCall, setSavingCall] = useState(false)

  const recognitionRef = useRef(null)
  const sessionActiveRef = useRef(false)
  const processingRef = useRef(false)
  const botSpeakingRef = useRef(false)
  const restartTimerRef = useRef(null)
  const callStartedAtRef = useRef(null)
  const transcriptRef = useRef([])
  const mediaRecorderRef = useRef(null)
  const recordingStreamRef = useRef(null)
  const recordingChunksRef = useRef([])
  const audioRef = useRef(null)
  const audioUrlRef = useRef(null)
  const saveStartedRef = useRef(false)

  const connected = apiStatus === 'connected'
  const SpeechRecognition = getSpeechRecognitionConstructor()
  const voiceSupported = Boolean(SpeechRecognition) && typeof window !== 'undefined' && 'speechSynthesis' in window

  async function checkApi() {
    setApiStatus('checking')
    setError('')
    try {
      const response = await fetch(`${API_BASE}/health`)
      if (!response.ok) throw new Error(`Health check failed: HTTP ${response.status}`)
      const data = await response.json()
      setApiStatus(data.status === 'ok' ? 'connected' : 'error')
    } catch {
      setApiStatus('error')
      setError(`Cannot reach backend at ${API_BASE}. Start FastAPI and try again.`)
    }
  }

  const startRecognition = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition || !sessionActiveRef.current || processingRef.current || botSpeakingRef.current) return
    try {
      recognition.start()
      setVoiceError('')
    } catch (err) {
      // Chromium can throw InvalidStateError if start() is called while already active.
      if (err?.name !== 'InvalidStateError') {
        setVoiceError('Could not start speech recognition. Check microphone permission and try again.')
        setCallStatus('error')
      }
    }
  }, [])

  function appendTranscript(item) {
    transcriptRef.current = [...transcriptRef.current, item]
    setTranscript(transcriptRef.current)
  }

  async function refreshCallHistory() {
    setHistoryStatus('loading')
    try {
      const response = await fetch(`${API_BASE}/api/calls`)
      if (!response.ok) throw new Error(`History request failed: HTTP ${response.status}`)
      setCallHistory(await response.json())
      setHistoryStatus('ready')
    } catch {
      setHistoryStatus('error')
    }
  }

  async function finalizeCall(recordingBlob = null, consentGiven = false) {
    if (saveStartedRef.current) return
    if (callStartedAtRef.current === null && transcriptRef.current.length === 0) return
    saveStartedRef.current = true
    setSavingCall(true)
    setSaveMessage('Generating call summary and saving call history…')
    setRecordingState(recordingBlob?.size ? 'saving' : 'off')

    try {
      let recordingBase64 = null
      if (recordingBlob?.size) {
        const bytes = new Uint8Array(await recordingBlob.arrayBuffer())
        let binary = ''
        const chunkSize = 0x8000
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
        }
        recordingBase64 = window.btoa(binary)
      }

      const elapsed = callStartedAtRef.current === null
        ? callSeconds
        : Math.max(0, Math.floor((Date.now() - callStartedAtRef.current) / 1000))
      const response = await fetch(`${API_BASE}/api/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptRef.current,
          duration_seconds: elapsed,
          recording_consent: Boolean(consentGiven && recordingBase64),
          recording_base64: recordingBase64,
          recording_mime_type: recordingBlob?.type || null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || `Saving call failed: HTTP ${response.status}`)
      setCallSummary(data)
      setSaveMessage(`Call #${data.id} saved successfully.`)
      setCallHistory((items) => [data, ...items.filter((item) => item.id !== data.id)])
      setRecordingState(data.has_recording ? 'saved' : 'off')
      setSavingCall(false)
    } catch (err) {
      setSaveMessage(err.message || 'Could not save call history. Check the backend and retry.')
      setRecordingState(recordingBlob?.size ? 'error' : 'off')
      setSavingCall(false)
      saveStartedRef.current = false
    }
  }

  const askAssistant = useCallback(async (customerText) => {
    const cleanText = customerText.trim()
    if (!cleanText || processingRef.current) return

    processingRef.current = true
    setInterimTranscript('')
    appendTranscript({ id: `${Date.now()}-customer`, speaker: 'customer', text: cleanText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
    setCallStatus('thinking')
    setVoiceError('')

    // Stop listening while the model is responding so the bot does not transcribe its own voice.
    try { recognitionRef.current?.stop() } catch { /* already stopped */ }

    try {
      const response = await fetch(`${API_BASE}/api/ai-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: cleanText }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || `Request failed: HTTP ${response.status}`)
      const answer = String(data.reply || '').trim()
      if (!answer) throw new Error('The AI returned an empty response.')

      setReply(answer)
      setAiStatus('success')
      appendTranscript({ id: `${Date.now()}-assistant`, speaker: 'assistant', text: answer, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })

      if (sessionActiveRef.current && language === 'te-IN') {
        try {
          const ttsResponse = await fetch(`${API_BASE}/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: answer, language: 'te' }),
          })
          if (!ttsResponse.ok) {
            const ttsError = await ttsResponse.json().catch(() => ({}))
            throw new Error(ttsError.detail || `Telugu speech failed: HTTP ${ttsResponse.status}`)
          }
          const audioUrl = URL.createObjectURL(await ttsResponse.blob())
          audioUrlRef.current = audioUrl
          const audio = new Audio(audioUrl)
          audioRef.current = audio
          botSpeakingRef.current = true
          setCallStatus('speaking')
          const finishAudio = () => {
            URL.revokeObjectURL(audioUrl)
            audioUrlRef.current = null
            audioRef.current = null
            botSpeakingRef.current = false
            processingRef.current = false
            if (sessionActiveRef.current) {
              setCallStatus('listening')
              startRecognition()
            } else {
              setCallStatus('ended')
            }
          }
          audio.onended = finishAudio
          audio.onerror = () => {
            finishAudio()
            setVoiceError('Telugu audio was generated but could not be played by this browser.')
          }
          await audio.play()
        } catch (ttsErr) {
          botSpeakingRef.current = false
          processingRef.current = false
          setVoiceError(`${ttsErr.message || 'Telugu speech playback failed.'} The response remains available in the transcript.`)
          if (sessionActiveRef.current) startRecognition()
        }
      } else if (sessionActiveRef.current && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(answer)
        utterance.lang = language
        utterance.rate = 1
        utterance.onstart = () => {
          botSpeakingRef.current = true
          setCallStatus('speaking')
        }
        utterance.onend = () => {
          botSpeakingRef.current = false
          processingRef.current = false
          if (sessionActiveRef.current) {
            setCallStatus('listening')
            startRecognition()
          } else {
            setCallStatus('ended')
          }
        }
        utterance.onerror = () => {
          botSpeakingRef.current = false
          processingRef.current = false
          setVoiceError('The reply was generated, but browser speech playback failed. You can still read the transcript.')
          if (sessionActiveRef.current) startRecognition()
        }
        window.speechSynthesis.speak(utterance)
      } else {
        processingRef.current = false
        if (sessionActiveRef.current) startRecognition()
      }
    } catch (err) {
      processingRef.current = false
      setAiStatus('error')
      setVoiceError(err.message || 'The AI request failed.')
      setCallStatus(sessionActiveRef.current ? 'listening' : 'idle')
      if (sessionActiveRef.current) startRecognition()
    }
  }, [language, startRecognition])

  async function startVoiceCall() {
    if (!voiceSupported) {
      setVoiceError('Voice input is not supported in this browser. Open VoicePilot in desktop Chrome or Edge and allow microphone access.')
      return
    }
    if (sessionActiveRef.current) return

    setVoiceError('')
    setError('')
    setTranscript([])
    transcriptRef.current = []
    setCallSummary(null)
    setSaveMessage('')
    setSavingCall(false)
    saveStartedRef.current = false
    recordingChunksRef.current = []
    setReply('')
    setInterimTranscript('')
    setCallSeconds(0)
    setAiStatus('idle')
    processingRef.current = false
    botSpeakingRef.current = false
    sessionActiveRef.current = true
    callStartedAtRef.current = null
    setCallStatus('connecting')

    if (recordingConsent) {
      try {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
          throw new Error('Audio recording is not supported by this browser.')
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (!sessionActiveRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        recordingStreamRef.current = stream
        recordingChunksRef.current = []
        const preferredMime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
          .find((type) => MediaRecorder.isTypeSupported(type))
        const recorder = preferredMime
          ? new MediaRecorder(stream, { mimeType: preferredMime })
          : new MediaRecorder(stream)
        recorder.ondataavailable = (event) => {
          if (event.data?.size) recordingChunksRef.current.push(event.data)
        }
        recorder.onstop = () => {
          const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
          recordingStreamRef.current = null
          mediaRecorderRef.current = null
          if (blob.size) {
            void finalizeCall(blob, true)
          } else {
            setRecordingState('error')
            setSaveMessage('No audio data was captured. Saving the transcript without a recording.')
            void finalizeCall(null, false)
          }
        }
        recorder.start(1000)
        mediaRecorderRef.current = recorder
        setRecordingState('recording')
      } catch (recordingErr) {
        setRecordingState('error')
        setVoiceError(`Recording could not start: ${recordingErr.message || 'browser recording unavailable'}. The call can continue without a recording.`)
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
        recordingStreamRef.current = null
      }
    } else {
      setRecordingState('off')
    }

    const recognition = new SpeechRecognition()
    recognition.lang = language
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      // Ignore a late browser event if the user already ended the call.
      if (!sessionActiveRef.current) {
        try {
          recognition.stop()
        } catch {
          // Recognition may already have stopped.
        }
        return
      }

      // Set the start time only once per call, not on every recognition restart.
      if (callStartedAtRef.current === null) {
        callStartedAtRef.current = Date.now()
      }

      setCallStatus('listening')
      setVoiceError('')
    }
    
    recognition.onresult = (event) => {
      let interim = ''
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const text = result[0]?.transcript || ''
        if (result.isFinal) finalText += `${text} `
        else interim += text
      }
      setInterimTranscript(interim.trim())
      if (finalText.trim()) askAssistant(finalText.trim())
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        sessionActiveRef.current = false
        callStartedAtRef.current = null
        setCallSeconds(0)
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
        else recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
        setCallStatus('error')
        setVoiceError('Microphone permission was denied. Allow microphone access in your browser settings, then start the call again.')
        return
      }
      setVoiceError(`Speech recognition error: ${event.error}. Try restarting the voice session.`)
    }

    recognition.onend = () => {
      if (sessionActiveRef.current && !processingRef.current && !botSpeakingRef.current) {
        if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current)
        restartTimerRef.current = window.setTimeout(() => startRecognition(), 350)
      }
    }

    recognitionRef.current = recognition
    setCallStatus('connecting')
    startRecognition()
  }

  function endVoiceCall() {
    sessionActiveRef.current = false
    processingRef.current = false
    botSpeakingRef.current = false
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current)
    try { recognitionRef.current?.stop() } catch { /* recognition may already be stopped */ }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    recognitionRef.current = null
    setInterimTranscript('')
    setCallStatus('ended')

    if (mediaRecorderRef.current?.state === 'recording') {
      setRecordingState('saving')
      mediaRecorderRef.current.stop()
    } else {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
      recordingStreamRef.current = null
      void finalizeCall(null, false)
    }
  }

  useEffect(() => {
    let intervalId

    const callIsActive = ['listening', 'thinking', 'speaking'].includes(callStatus)

    if (callIsActive && callStartedAtRef.current !== null) {
      intervalId = window.setInterval(() => {
        setCallSeconds(
          Math.floor((Date.now() - callStartedAtRef.current) / 1000)
        )
      }, 1000)
    }

    return () => window.clearInterval(intervalId)
  }, [callStatus])

  useEffect(() => () => {
    sessionActiveRef.current = false
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current)
    try { recognitionRef.current?.stop() } catch { /* ignore unmount cleanup errors */ }
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
    if (audioRef.current) audioRef.current.pause()
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  useEffect(() => {
    void refreshCallHistory()
  }, [])

  async function testAi(event) {
    event.preventDefault()
    setAiStatus('loading')
    setError('')
    setReply('')
    try {
      const response = await fetch(`${API_BASE}/api/ai-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || `Request failed: HTTP ${response.status}`)
      setReply(data.reply)
      setAiStatus('success')
    } catch (err) {
      setAiStatus('error')
      setError(err.message || 'AI request failed.')
    }
  }

  const statusLabel = {
    idle: 'READY TO CALL',
    connecting: 'CONNECTING',
    listening: 'LISTENING',
    thinking: 'THINKING',
    speaking: 'ASSISTANT SPEAKING',
    ended: 'CALL ENDED',
    error: 'NEEDS ATTENTION',
  }[callStatus]

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="/"><span className="brand-icon"><Bot size={22}/></span><span>Voice<span className="brand-light">Pilot</span><small>AI SALES WORKSPACE</small></span></a>
      <span className="phase-tag"><span className="status-dot"/> PHASE 4 · CALL INTELLIGENCE</span>
    </header>

    <section className="hero">
      <div className="eyebrow"><Sparkles size={15}/> SANKAR GROUP · INTERN ASSIGNMENT</div>
      <h1>Make every sales<br/><span>conversation count.</span></h1>
      <p className="hero-copy">Talk naturally with a browser-based AI sales assistant. VoicePilot listens to the customer, asks Gemini for a product-aware response, speaks the answer, and keeps a readable transcript.</p>
    </section>

    <section className="product-card">
      <div className="product-symbol"><Activity size={24}/></div>
      <div className="product-info"><div className="product-label">DEMO PRODUCT</div><h2>LeadPilot CRM</h2><p>A fictional SaaS product for small businesses to organize leads, track sales opportunities, and manage follow-ups.</p></div>
      <span className="demo-badge">DEMO</span>
    </section>

    <section className="section-heading"><div><div className="eyebrow">SYSTEM CHECK</div><h2>Service readiness</h2></div><span className="muted">Real AI · Browser voice</span></section>
    <section className="status-grid">
      <article className="status-card">
        <div className="status-card-top"><span className="status-icon"><Activity size={18}/></span><span className={`pill ${connected ? 'pill-good' : apiStatus === 'error' ? 'pill-bad' : ''}`}>{connected ? 'CONNECTED' : apiStatus === 'checking' ? 'CHECKING' : apiStatus === 'error' ? 'OFFLINE' : 'NOT CHECKED'}</span></div>
        <h3>Backend API</h3><p>FastAPI health endpoint and frontend connectivity.</p>
        <button className="secondary-button" onClick={checkApi} disabled={apiStatus === 'checking'}>{apiStatus === 'checking' ? 'Checking…' : 'Check connection'}</button>
      </article>
      <article className="status-card">
        <div className="status-card-top"><span className="status-icon purple"><Sparkles size={18}/></span><span className={`pill ${aiStatus === 'success' ? 'pill-good' : aiStatus === 'error' ? 'pill-bad' : ''}`}>{aiStatus === 'success' ? 'READY' : aiStatus === 'loading' ? 'TESTING' : aiStatus === 'error' ? 'FAILED' : 'NOT TESTED'}</span></div>
        <h3>Gemini AI</h3><p>Sales responses are generated by the configured Gemini model through FastAPI.</p><span className="inline-note"><ShieldCheck size={14}/> API key stays on backend</span>
      </article>
    </section>

    <section className="voice-panel">
      <div className="panel-title"><span className="status-icon purple"><Mic size={18}/></span><div><h2>Live voice conversation</h2><p>Use desktop Chrome or Edge and allow microphone access when prompted.</p></div></div>
      <label className="recording-consent">
        <input
          type="checkbox"
          checked={recordingConsent}
          onChange={(event) => setRecordingConsent(event.target.checked)}
          disabled={['connecting', 'listening', 'thinking', 'speaking'].includes(callStatus)}
        />
        <span><strong>Consent to record this call</strong><small>If selected, VoicePilot captures microphone audio and saves it with the transcript in call history. Leave unchecked to save only the transcript and summary.</small></span>
      </label>
      {recordingState === 'recording' && <div className="recording-indicator"><span className="recording-dot"/> Recording is active with your consent.</div>}
      <div className="voice-toolbar">
        <label className="language-control">CONVERSATION LANGUAGE
          <select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={sessionActiveRef.current || ['connecting', 'listening', 'thinking', 'speaking'].includes(callStatus)}>
            {SPEECH_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <div className="call-status-block"><span className={`call-status-dot ${callStatus === 'listening' ? 'is-live' : ''}`}/><span>{statusLabel}</span><strong>{formatClock(callSeconds)}</strong></div>
      </div>
      <div className="call-actions">
        <button className="primary-button call-button" onClick={startVoiceCall} disabled={!voiceSupported || savingCall || ['connecting', 'listening', 'thinking', 'speaking'].includes(callStatus)}><Phone size={16}/>{callStatus === 'ended' ? 'Start another call' : 'Start voice call'}</button>
        <button className="secondary-button call-button" onClick={endVoiceCall} disabled={!['connecting', 'listening', 'thinking', 'speaking', 'error'].includes(callStatus)}><PhoneOff size={16}/>End call</button>
      </div>
      {!voiceSupported && <div className="info-box"><CircleAlert size={17}/><span>Browser speech recognition is not available here. Use desktop Chrome or Edge. You can still test Gemini using the text form below.</span></div>}
      {voiceError && <div className="error-box"><CircleAlert size={17}/><span>{voiceError}</span></div>}
      <div className="transcript-panel" aria-live="polite">
        <div className="transcript-heading"><span>CONVERSATION TRANSCRIPT</span><span>{transcript.length} messages</span></div>
        {transcript.length === 0 && !interimTranscript && <div className="empty-transcript"><MicOff size={21}/><p>Your conversation will appear here.</p><span>Start a voice call, then speak after the status changes to LISTENING.</span></div>}
        {transcript.map((item) => <div className={`message-row ${item.speaker}`} key={item.id}><div className="message-avatar">{item.speaker === 'assistant' ? <Bot size={16}/> : <Mic size={15}/>}</div><div className="message-content"><div className="message-meta"><strong>{item.speaker === 'assistant' ? 'VoicePilot' : 'Customer'}</strong><time>{item.time}</time>{item.speaker === 'assistant' && <Volume2 size={13}/>}</div><p>{item.text}</p></div></div>)}
        {interimTranscript && <div className="interim-line"><Mic size={14}/><span>{interimTranscript}</span></div>}
        {callStatus === 'thinking' && <div className="thinking-line"><span className="thinking-pulse"/>VoicePilot is preparing a response…</div>}
      </div>
      {callStatus === 'ended' && transcript.length > 0 && <p className="session-note">Voice session ended. {recordingState === 'saved' ? 'Recording saved.' : recordingConsent ? 'Recording status: ' + recordingState + '.' : 'No audio recording was made.'}</p>}
      {saveMessage && <div className={saveMessage.includes('successfully') ? 'success-box' : 'info-box'}>{saveMessage}</div>}
      {callSummary && <section className="summary-card">
        <div className="summary-card-header"><div><div className="eyebrow">POST-CALL INTELLIGENCE</div><h3>Call #{callSummary.id} summary</h3></div><span className="sales-status-badge">{callSummary.sales_status}</span></div>
        <p>{callSummary.summary}</p>
        <div className="summary-columns">
          <div><strong>Customer requirements</strong>{callSummary.customer_requirements.length ? <ul>{callSummary.customer_requirements.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>None identified</p>}</div>
          <div><strong>Objections</strong>{callSummary.objections.length ? <ul>{callSummary.objections.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>None identified</p>}</div>
          <div><strong>Next steps</strong>{callSummary.next_steps.length ? <ul>{callSummary.next_steps.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>None identified</p>}</div>
        </div>
      </section>}
    </section>

    <section className="history-panel">
      <div className="panel-title"><span className="status-icon"><History size={18}/></span><div><h2>Call history</h2><p>Saved transcripts, summaries, sales statuses, and consented recordings.</p></div><button className="secondary-button history-refresh" onClick={refreshCallHistory}>Refresh</button></div>
      {historyStatus === 'loading' && <p className="muted">Loading saved calls…</p>}
      {historyStatus === 'error' && <div className="info-box">Could not load call history. Check that the backend is running.</div>}
      {historyStatus === 'ready' && callHistory.length === 0 && <p className="muted">No saved calls yet. Complete a voice call to create the first history entry.</p>}
      <div className="history-list">{callHistory.map((item) => <article className="history-item" key={item.id}>
        <div className="history-item-top"><div><strong>Call #{item.id}</strong><span>{new Date(item.created_at).toLocaleString()}</span></div><span className="sales-status-badge">{item.sales_status}</span></div>
        <p>{item.summary}</p>
        <div className="history-meta"><span>{formatClock(item.duration_seconds)}</span><span>{item.transcript.length} messages</span><span>{item.has_recording ? 'Recording saved' : 'Transcript only'}</span></div>
        {item.has_recording && <audio controls preload="none" src={`${API_BASE}/api/calls/${item.id}/recording`} />}
        <details><summary>View transcript and next steps</summary><div className="history-transcript">{item.transcript.map((message, index) => <p key={`${item.id}-${index}`}><strong>{message.speaker === 'customer' ? 'Customer' : 'VoicePilot'}:</strong> {message.text}</p>)}<strong>Next steps</strong><ul>{item.next_steps.map((step, index) => <li key={index}>{step}</li>)}</ul></div></details>
      </article>)}</div>
    </section>

    <section className="test-panel">
      <div className="panel-title"><span className="status-icon"><Sparkles size={18}/></span><div><h2>Text-based AI test</h2><p>Verify Gemini independently of microphone and speech-recognition support.</p></div></div>
      <form onSubmit={testAi}><label htmlFor="customer-message">CUSTOMER MESSAGE</label><textarea id="customer-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} required/><button className="primary-button" type="submit" disabled={aiStatus === 'loading' || !message.trim()}><Sparkles size={16}/>{aiStatus === 'loading' ? 'Generating response…' : 'Test AI response'}</button></form>
      {error && <div className="error-box"><CircleAlert size={17}/><span>{error}</span></div>}
      {reply && <div className="reply-box"><div className="reply-label"><CheckCircle2 size={16}/> AI SALES ASSISTANT</div><p>{reply}</p></div>}
    </section>

    <section className="next-panel"><div className="next-icon"><CheckCircle2 size={20}/></div><div><h3>Phase 4 milestone</h3><p>Live voice conversations, consent-based audio recording, persistent SQLite call history, structured post-call summaries, and one validated sales status are implemented. Telugu playback uses a backend TTS fallback when enabled; its upstream service requires internet access.</p></div></section>
    <footer><span>VoicePilot · AI Voice Sales Bot</span><a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer">API documentation <ExternalLink size={13}/></a></footer>
  </main>
}