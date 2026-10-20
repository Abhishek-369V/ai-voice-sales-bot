import { useState } from 'react'
import { Activity, Bot, CheckCircle2, CircleAlert, ExternalLink, Mic, ShieldCheck, Sparkles } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export default function App() {
  const [apiStatus, setApiStatus] = useState('not-checked')
  const [aiStatus, setAiStatus] = useState('idle')
  const [message, setMessage] = useState('Can LeadPilot CRM help my team remember to follow up with new leads?')
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const connected = apiStatus === 'connected'

  async function checkApi() {
    setApiStatus('checking'); setError('')
    try {
      const response = await fetch(`${API_BASE}/health`)
      if (!response.ok) throw new Error()
      const data = await response.json()
      setApiStatus(data.status === 'ok' ? 'connected' : 'error')
    } catch {
      setApiStatus('error')
      setError(`Cannot reach backend at ${API_BASE}. Start FastAPI and try again.`)
    }
  }

  async function testAi(event) {
    event.preventDefault()
    setAiStatus('loading'); setError(''); setReply('')
    try {
      const response = await fetch(`${API_BASE}/api/ai-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || `Request failed: HTTP ${response.status}`)
      setReply(data.reply); setAiStatus('success')
    } catch (err) {
      setAiStatus('error'); setError(err.message || 'AI request failed.')
    }
  }

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="/"><span className="brand-icon"><Bot size={22}/></span><span>Voice<span className="brand-light">Pilot</span><small>AI SALES WORKSPACE</small></span></a>
      <span className="phase-tag"><span className="status-dot"/> PHASE 1 · FOUNDATION</span>
    </header>

    <section className="hero">
      <div className="eyebrow"><Sparkles size={15}/> SANKAR GROUP · INTERN ASSIGNMENT</div>
      <h1>Your AI sales<br/><span>conversation starts here.</span></h1>
      <p className="hero-copy">We’re setting up the foundation for a voice-first sales assistant that understands customer needs, handles questions, and helps teams move leads forward.</p>
    </section>

    <section className="product-card">
      <div className="product-symbol"><Activity size={24}/></div>
      <div className="product-info"><div className="product-label">DEMO PRODUCT</div><h2>LeadPilot CRM</h2><p>A fictional SaaS product for small businesses to organize leads, track sales opportunities, and manage follow-ups.</p></div>
      <span className="demo-badge">DEMO</span>
    </section>

    <section className="section-heading"><div><div className="eyebrow">SYSTEM CHECK</div><h2>Phase 1 readiness</h2></div><span className="muted">Foundation only</span></section>
    <section className="status-grid">
      <article className="status-card">
        <div className="status-card-top"><span className="status-icon"><Activity size={18}/></span><span className={`pill ${connected ? 'pill-good' : apiStatus === 'error' ? 'pill-bad' : ''}`}>{connected ? 'CONNECTED' : apiStatus === 'checking' ? 'CHECKING' : apiStatus === 'error' ? 'OFFLINE' : 'NOT CHECKED'}</span></div>
        <h3>Backend API</h3><p>FastAPI health endpoint and frontend connectivity.</p>
        <button className="secondary-button" onClick={checkApi} disabled={apiStatus === 'checking'}>{apiStatus === 'checking' ? 'Checking…' : 'Check connection'}</button>
      </article>
      <article className="status-card">
        <div className="status-card-top"><span className="status-icon purple"><Sparkles size={18}/></span><span className={`pill ${aiStatus === 'success' ? 'pill-good' : aiStatus === 'error' ? 'pill-bad' : ''}`}>{aiStatus === 'success' ? 'READY' : aiStatus === 'loading' ? 'TESTING' : aiStatus === 'error' ? 'FAILED' : 'NOT TESTED'}</span></div>
        <h3>AI response</h3><p>Test the product-aware sales assistant through the backend.</p><span className="inline-note"><ShieldCheck size={14}/> API key stays on backend</span>
      </article>
    </section>

    <section className="test-panel">
      <div className="panel-title"><span className="status-icon purple"><Mic size={18}/></span><div><h2>Test the sales assistant</h2><p>Send a sample customer message to verify the AI connection.</p></div></div>
      <form onSubmit={testAi}><label htmlFor="customer-message">CUSTOMER MESSAGE</label><textarea id="customer-message" value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} required/><button className="primary-button" type="submit" disabled={aiStatus === 'loading' || !message.trim()}><Sparkles size={16}/>{aiStatus === 'loading' ? 'Generating response…' : 'Test AI response'}</button></form>
      {error && <div className="error-box"><CircleAlert size={17}/><span>{error}</span></div>}
      {reply && <div className="reply-box"><div className="reply-label"><CheckCircle2 size={16}/> AI SALES ASSISTANT</div><p>{reply}</p></div>}
    </section>

    <section className="next-panel"><div className="next-icon"><CheckCircle2 size={20}/></div><div><h3>What comes next?</h3><p>Phase 2 adds real browser voice input and spoken AI replies. Call controls, recording, summaries, sales status, and history will follow in later phases.</p></div></section>
    <footer><span>VoicePilot · AI Voice Sales Bot</span><a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer">API documentation <ExternalLink size={13}/></a></footer>
  </main>
}
