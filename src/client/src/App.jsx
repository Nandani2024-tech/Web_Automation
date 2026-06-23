import { useState, useEffect, useRef } from 'react';


function App() {
  const [url, setUrl] = useState('https://ui.shadcn.com/docs/forms/react-hook-form');
  const [goal, setGoal] = useState('Locate the form elements on the page (Name/Username and Description fields), automatically fill them, and submit.');
  const [provider, setProvider] = useState('llm');
  const [status, setStatus] = useState('idle'); // idle, running, error
  const [logs, setLogs] = useState([]);
  const [screenshotUrl, setScreenshotUrl] = useState(null);
  const logsEndRef = useRef(null);


  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);


  // Setup SSE for logs
  useEffect(() => {
    const eventSource = new EventSource('/api/logs');


    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLogs((prev) => [...prev, data]);
     
      // Look for screenshot updates in logs
      if (data.message && data.message.includes('Screenshot saved to')) {
        const parts = data.message.split('screenshots');
        let filename = 'filled_form.png'; // fallback
        if (parts.length > 1) {
            // parts[1] will be something like \filled_form_screenshot.png
            filename = parts[1].replace(/^[\\\/]/, '');
        }
        // Force refresh by appending timestamp. Use relative path so it works in production!
        setScreenshotUrl(`/screenshots/${filename}?t=${Date.now()}`);
        setStatus('idle');
      }


      // Check for completion or error
      if (data.message && (data.message.includes('Agent completed') || data.message.includes('Execution failed') || data.message.includes('Agent finished with errors'))) {
         if (status === 'running') {
            setStatus(data.message.includes('completed') ? 'idle' : 'error');
         }
      }
    };


    return () => {
      eventSource.close();
    };
  }, [status]);


  const handleStart = async () => {
    setStatus('running');
    setLogs([]); // Clear previous logs
    setScreenshotUrl(null);


    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, goal, provider }),
      });


      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start automation');
      }
     
    } catch (err) {
      setLogs(prev => [...prev, { level: 'error', message: err.message, timestamp: new Date().toISOString() }]);
      setStatus('error');
    }
  };


  return (
    <>
      <header className="header">
        <h1>AutoAgent Console</h1>
        <div className={`status-badge ${status}`}>
          <div className="status-dot"></div>
          {status === 'idle' ? 'System Ready' : status === 'running' ? 'Execution in Progress...' : 'System Error'}
        </div>
      </header>


      <div className="dashboard-container">
        {/* Sidebar Configuration */}
        <aside className="sidebar glass-panel">
          <h2>Parameters</h2>
         
          <div className="form-group">
            <label>Target Domain URL</label>
            <input
              type="text"
              className="glass-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={status === 'running'}
            />
          </div>


          <div className="form-group">
            <label>Execution Goal</label>
            <textarea
              className="glass-input"
              rows="4"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={status === 'running'}
              style={{ resize: 'vertical' }}
            />
          </div>


          <div className="form-group">
            <label>Inference Engine</label>
            <select
              className="glass-input glass-select"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={status === 'running'}
            >
              <option value="llm">Groq (llama-3.3-70b-versatile)</option>
              <option value="hardcoded">Heuristics (Fallback)</option>
            </select>
          </div>


          <button
            className="glass-button"
            onClick={handleStart}
            disabled={status === 'running'}
            style={{ marginTop: 'auto' }}
          >
            {status === 'running' ? 'Executing...' : 'Initialize Run'}
          </button>
        </aside>


        {/* Main Content Area */}
        <main className="main-content">
         
          {/* Mock Browser Frame */}
          <div className="mock-browser glass-panel">
            <div className="browser-header">
              <div className="browser-dots">
                <div className="dot red"></div>
                <div className="dot yellow"></div>
                <div className="dot green"></div>
              </div>
              <div className="browser-address">{url}</div>
              <button className="glass-button" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>+ Overlay</button>
            </div>
            <div className="browser-content">
              {screenshotUrl ? (
                <img src={screenshotUrl} alt="Browser screenshot" />
              ) : (
                <div className="placeholder-text">
                  {status === 'running' ? 'Waiting for screenshot...' : 'No active session'}
                </div>
              )}
            </div>
          </div>


          {/* Logs Panel */}
          <div className="logs-panel glass-panel">
            <div className="logs-header">
              <span>Agent Event Stream</span>
              <span>{logs.length} events</span>
            </div>
            <div className="logs-content">
              {logs.length === 0 ? (
                <div style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Waiting for connection...</div>
              ) : (
                logs.map((log, index) => {
                  const date = new Date(log.timestamp);
                  const timeStr = date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }) + '.' + date.getMilliseconds().toString().padStart(3, '0');
                 
                  return (
                    <div key={index} className="log-entry">
                      <span className="log-time">[{timeStr}]</span>
                      <span className={`log-level ${log.level}`}>[{log.level.toUpperCase()}]</span>
                      <span className="log-message">{log.message}</span>
                    </div>
                  );
                })
              )}
              <div ref={logsEndRef} />
            </div>
          </div>


        </main>
      </div>
    </>
  );
}


export default App;



