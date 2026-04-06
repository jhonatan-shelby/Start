import { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import { Smartphone, ShieldCheck, LogOut, MessageSquare, Send, Bell, Key, Plus, RefreshCw, Trash2 } from 'lucide-react'
import axios from 'axios'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface SessionState {
  id: string;
  status: string;
  qrCode?: string;
  phoneNumber?: string;
  name?: string;
  liveStatus?: string;
}

interface WhatsAppMessage {
  pushName?: string;
  messageTimestamp: number;
  key?: {
    remoteJid?: string;
    fromMe?: boolean;
    id?: string;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
  };
}

function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('baileys_api_key') || '');
  const [isEditingKey, setIsEditingKey] = useState(!apiKey);
  const [sessions, setSessions] = useState<SessionState[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messagesBySession, setMessagesBySession] = useState<Record<string, WhatsAppMessage[]>>({});
  
  const [inputText, setInputText] = useState('');
  const [destNumber, setDestNumber] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Active session helper
  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  // Apply API key globally to Axios
  useEffect(() => {
    if (apiKey) {
      axios.defaults.headers.common['X-API-Key'] = apiKey;
      localStorage.setItem('baileys_api_key', apiKey);
    }
  }, [apiKey]);

  const fetchSessions = async () => {
    if (!apiKey) return;
    try {
      const res = await axios.get(`${API_URL}/api/sessions`);
      const fetchedSessions = res.data.data;
      setSessions(fetchedSessions);
      
      // Select first session by default if none active
      if (fetchedSessions.length > 0 && !activeSessionId) {
        setActiveSessionId(fetchedSessions[0].id);
      }
    } catch (err: any) {
      console.error("Error fetching sessions:", err);
      if (err.response?.status === 401) {
        setIsEditingKey(true);
      }
    }
  };

  useEffect(() => {
    if (isEditingKey || !apiKey) return;

    // 1. Connect to WebSocket
    const newSocket = io(API_URL);

    // 2. Fetch initial sessions
    fetchSessions();

    // 3. Listen for updates on ANY session
    newSocket.on('sessionUpdate', (data: any) => {
      setSessions(prev => prev.map(s => 
        s.id === data.sessionId ? { ...s, ...data, id: s.id } : s
      ));
    });

    // 4. Listen for messages on ANY session
    newSocket.on('message', (data: any) => {
      setMessagesBySession(prev => ({
        ...prev,
        [data.sessionId]: [...(prev[data.sessionId] || []), data.message]
      }));
    });

    return () => {
      newSocket.disconnect();
    }
  }, [apiKey, isEditingKey]);

  // Auto-scroll logic
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSessionId, messagesBySession]);

  const handleCreateSession = async () => {
    const newId = `session_${Math.random().toString(36).substring(7)}`;
    try {
      await axios.post(`${API_URL}/api/sessions`, { sessionId: newId });
      await fetchSessions();
      setActiveSessionId(newId);
    } catch (err) {
      alert("Error creando nueva sesión");
    }
  };

  const handleSend = async () => {
    if (!activeSessionId || !inputText || !destNumber || !apiKey) return;
    try {
      const formattedNum = destNumber.includes('@s.whatsapp.net') 
        ? destNumber 
        : `${destNumber.replace(/\+/g, '')}@s.whatsapp.net`;

      await axios.post(`${API_URL}/api/messages/send`, {
        sessionId: activeSessionId,
        to: formattedNum,
        text: inputText
      });
      
      const fakeMsg: WhatsAppMessage = {
        pushName: "Tú (API)",
        messageTimestamp: Math.floor(Date.now() / 1000),
        message: { conversation: inputText }
      };
      
      setMessagesBySession(prev => ({
        ...prev,
        [activeSessionId]: [...(prev[activeSessionId] || []), fakeMsg]
      }));
      setInputText('');
    } catch (err) {
      alert("Error al enviar mensaje");
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar la sesión ${id}?`)) return;
    try {
      await axios.delete(`${API_URL}/api/sessions/${id}`);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSessionId === id) setActiveSessionId(null);
    } catch (err) {
      alert("Error eliminando sesión");
    }
  };

  const isConnected = activeSession?.liveStatus === 'CONNECTED' || activeSession?.status === 'CONNECTED';

  return (
    <div className="app-container">
      {/* SIDEBAR: SESSION LIST */}
      <div className="glass-panel sidebar">
        <div className="sidebar-header">
          <div>
            <h1 className="header" style={{fontSize: '1.2rem'}}><Smartphone size={20} color="var(--accent)" /> Cuentas</h1>
            <p className="subtitle" style={{marginBottom: '10px'}}>Gestiona múltiples WhatsApps</p>
          </div>
          <button className="btn-icon" onClick={handleCreateSession} title="Nueva Cuenta">
            <Plus size={20} />
          </button>
        </div>

        {/* API KEY SECTION */}
        {isEditingKey ? (
          <div className="key-input-box">
            <input 
              type="password" 
              className="input-field" 
              placeholder="X-API-Key" 
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            <button className="btn" onClick={() => { if(apiKey) { setIsEditingKey(false); fetchSessions(); } }}>
              Conectar
            </button>
          </div>
        ) : (
          <div className="key-status-row">
            <span><Key size={12} /> API Activa</span>
            <button onClick={() => setIsEditingKey(true)}>Cambiar</button>
          </div>
        )}

        {/* SESSIONS LIST */}
        <div className="session-list">
          {!isEditingKey && sessions.length === 0 && (
            <p className="empty-msg">No hay cuentas. Haz clic en +</p>
          )}
          {sessions.map(s => (
            <div 
              key={s.id} 
              className={`session-item ${activeSessionId === s.id ? 'active' : ''}`}
              onClick={() => setActiveSessionId(s.id)}
            >
              <div className="session-info">
                <div className="session-name">
                  {s.name || s.id}
                  <div className={`dot ${(s.liveStatus === 'CONNECTED' || s.status === 'CONNECTED') ? 'online' : ''}`}></div>
                </div>
                <div className="session-id">{s.phoneNumber ? `+${s.phoneNumber}` : 'Pendiente vinculación'}</div>
              </div>
              <button className="trash-btn" onClick={(e) => handleDeleteSession(s.id, e)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          By Antigravity — Multi-Account Ready
        </div>
      </div>

      {/* MAIN CONTENT: CHAT & QR */}
      <div className="glass-panel main-content">
        {!activeSessionId ? (
          <div className="message-area">
            <Smartphone size={64} className="message-icon" />
            <h3>Selecciona o crea una cuenta</h3>
            <p>Usa la barra lateral para gestionar tus sesiones de WhatsApp.</p>
          </div>
        ) : (
          <>
            <div className="main-header">
              <h2 className="header" style={{margin: 0}}>
                {activeSession?.name || activeSessionId}
              </h2>
              <div className={`status-badge ${isConnected ? 'connected' : ''}`}>
                {isConnected ? 'Conectado' : (activeSession?.status || 'Desconectado')}
              </div>
            </div>

            <div className="content-grid">
              {/* LEFT: CHAT */}
              <div className="chat-section">
                <div className="chat-list">
                  {(messagesBySession[activeSessionId] || []).length === 0 ? (
                    <div className="empty-chat">
                      <MessageSquare size={48} style={{opacity: 0.1, marginBottom: '10px'}} />
                      <p>Sin mensajes recientes en esta sesión</p>
                    </div>
                  ) : (
                    messagesBySession[activeSessionId].map((m, idx) => (
                      <div key={idx} className="chat-item">
                        <div className="chat-item-header">
                          <span className="chat-name">{m.pushName || m.key?.remoteJid?.split('@')[0]}</span>
                          <span className="chat-time">
                            {new Date(m.messageTimestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <div className="chat-message">
                          {m.message?.conversation || m.message?.extendedTextMessage?.text || '📱 [Mensaje]'}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="input-container">
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Teléfono" 
                    value={destNumber}
                    onChange={e => setDestNumber(e.target.value)}
                    style={{ flex: '0 0 120px' }}
                  />
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Mensaje..." 
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleSend()}
                  />
                  <button className="btn" style={{ width: 'auto', padding: '0 15px' }} onClick={handleSend} disabled={!isConnected || !inputText || !destNumber}>
                    <Send size={18} />
                  </button>
                </div>
              </div>

              {/* RIGHT: QR / STATUS */}
              <div className="status-section">
                {!isConnected ? (
                  <div className="qr-box">
                    {activeSession?.qrCode ? (
                      <>
                        <p>Escanea para vincular:</p>
                        <img src={activeSession.qrCode} alt="QR" />
                        <button className="btn-small" onClick={fetchSessions}><RefreshCw size={14}/> Refrescar</button>
                      </>
                    ) : (
                      <div className="loading-box">
                        <div className="loader"></div>
                        <p>Iniciando sesión...</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="connected-box">
                    <ShieldCheck size={48} color="var(--success)" />
                    <h4>Cuenta Vinculada</h4>
                    <p>+{activeSession?.phoneNumber}</p>
                    <button className="btn btn-danger btn-small" style={{marginTop: '20px'}} onClick={(e) => handleDeleteSession(activeSessionId, e)}>
                      Desconectar Permanentemente
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default App
