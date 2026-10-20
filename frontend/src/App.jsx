import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  Bot,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
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

  const recognitionRef = useRef(null)
  const sessionActiveRef = useRef(false)
  const processingRef = useRef(false)
  const botSpeakingRef = useRef(false)
  const restartTimerRef = useRef(null)
  const callStartedAtRef = useRef(null)

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
      setCallStatus('listening')
      setVoiceError('')
    } catch (err) {
      // Chromium can throw InvalidStateError if start() is called while already active.
      if (err?.name !== 'InvalidStateError') {
        setVoiceError('Could not start speech recognition. Check microphone permission and try again.')
        setCallStatus('error')
      }
    }
  }, [])

  const askAssistant = useCallback(async (customerText) => {
    const cleanText = customerText.trim()
    if (!cleanText || processingRef.current) return

    processingRef.current = true
    setInterimTranscript('')
    setTranscript((items) => [...items, { id: `${Date.now()}-customer`, speaker: 'customer', text: cleanText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }])
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
      setTranscript((items) => [...items, { id: `${Date.now()}-assistant`, speaker: 'assistant', text: answer, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }])

      if (sessionActiveRef.current && 'speechSynthesis' in window) {
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

  function startVoiceCall() {
    if (!voiceSupported) {
      setVoiceError('Voice input is not supported in this browser. Open VoicePilot in desktop Chrome or Edge and allow microphone access.')
      return
    }
    if (sessionActiveRef.current) return

    setVoiceError('')
    setError('')
    setTranscript([])
    setReply('')
    setInterimTranscript('')
    setCallSeconds(0)
    setAiStatus('idle')
    processingRef.current = false
    botSpeakingRef.current = false
    sessionActiveRef.current = true
    callStartedAtRef.current = Date.now()

    const recognition = new SpeechRecognition()
    recognition.lang = language
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

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
    setCallStatus('listening')
    startRecognition()
  }

  function endVoiceCall() {
    sessionActiveRef.current = false
    processingRef.current = false
    botSpeakingRef.current = false
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current)
    try { recognitionRef.current?.stop() } catch { /* recognition may already be stopped */ }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    recognitionRef.current = null
    setInterimTranscript('')
    setCallStatus('ended')
  }

  useEffect(() => {
    let intervalId
    if (callStatus !== 'idle' && callStatus !== 'ended' && callStartedAtRef.current) {
      intervalId = window.setInterval(() => {
        setCallSeconds(Math.floor((Date.now() - callStartedAtRef.current) / 1000))
      }, 1000)
    }
    return () => window.clearInterval(intervalId)
  }, [callStatus])

  useEffect(() => () => {
    sessionActiveRef.current = false
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current)
    try { recognitionRef.current?.stop() } catch { /* ignore unmount cleanup errors */ }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
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
    listening: 'LISTENING',
    thinking: 'THINKING',
    speaking: 'ASSISTANT SPEAKING',
    ended: 'CALL ENDED',
    error: 'NEEDS ATTENTION',
  }[callStatus]

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="/"><span className="brand-icon"><Bot size={22}/></span><span>Voice<span className="brand-light">Pilot</span><small>AI SALES WORKSPACE</small></span></a>
      <span className="phase-tag"><span className="status-dot"/> PHASE 2 · VOICE MVP</span>
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
      <div className="voice-toolbar">
        <label className="language-control">CONVERSATION LANGUAGE
          <select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={sessionActiveRef.current || ['listening', 'thinking', 'speaking'].includes(callStatus)}>
            {SPEECH_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <div className="call-status-block"><span className={`call-status-dot ${callStatus === 'listening' ? 'is-live' : ''}`}/><span>{statusLabel}</span><strong>{formatClock(callSeconds)}</strong></div>
      </div>
      <div className="call-actions">
        <button className="primary-button call-button" onClick={startVoiceCall} disabled={!voiceSupported || ['listening', 'thinking', 'speaking'].includes(callStatus)}><Phone size={16}/>{callStatus === 'ended' ? 'Start another call' : 'Start voice call'}</button>
        <button className="secondary-button call-button" onClick={endVoiceCall} disabled={!['listening', 'thinking', 'speaking', 'error'].includes(callStatus)}><PhoneOff size={16}/>End call</button>
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
      {callStatus === 'ended' && transcript.length > 0 && <p className="session-note">Voice session ended. The transcript is currently held in this page only; call history and saved recordings are part of a later phase.</p>}
    </section>

    <section className="test-panel">
      <div className="panel-title"><span className="status-icon"><Sparkles size={18}/></span><div><h2>Text-based AI test</h2><p>Verify Gemini independently of microphone and speech-recognition support.</p></div></div>
      <form onSubmit={testAi}><label htmlFor="customer-message">CUSTOMER MESSAGE</label><textarea id="customer-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} required/><button className="primary-button" type="submit" disabled={aiStatus === 'loading' || !message.trim()}><Sparkles size={16}/>{aiStatus === 'loading' ? 'Generating response…' : 'Test AI response'}</button></form>
      {error && <div className="error-box"><CircleAlert size={17}/><span>{error}</span></div>}
      {reply && <div className="reply-box"><div className="reply-label"><CheckCircle2 size={16}/> AI SALES ASSISTANT</div><p>{reply}</p></div>}
    </section>

    <section className="next-panel"><div className="next-icon"><CheckCircle2 size={20}/></div><div><h3>Phase 2 milestone</h3><p>Real browser speech input, spoken Gemini replies, live transcript, language selection, and start/end voice-session controls are now included. Recording consent, persistent call history, summaries, and sales-status classification are still pending.</p></div></section>
    <footer><span>VoicePilot · AI Voice Sales Bot</span><a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer">API documentation <ExternalLink size={13}/></a></footer>
  </main>
}