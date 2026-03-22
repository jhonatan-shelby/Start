import { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import { Smartphone, ShieldCheck, LogOut, MessageSquare, Send, Bell, Key } from 'lucide-react'
import axios from 'axios'
import './App.css'

// Apunta a localhost por defecto, o a la URL del túnel si está en prod
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const SESSION_ID = 'default_session_1'

interface SessionState {
  status: string;
  qrCode?: string;
  phoneNumber?: string;
  name?: string;
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
  const [session, setSession] = useState<SessionState>({ status: apiKey ? 'AWAITING_SOCKET' : 'REQUIRES_API_KEY' });
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [destNumber, setDestNumber] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Apply API key globally to Axios
  useEffect(() => {
    if (apiKey) {
      axios.defaults.headers.common['X-API-Key'] = apiKey;
      localStorage.setItem('baileys_api_key', apiKey);
    }
  }, [apiKey]);

  useEffect(() => {
    if (isEditingKey || !apiKey) return;

    // 1. Conectar al WebSocket del Backend
    const newSocket = io(API_URL);

    // 2. Traer el estado inicial de la sesión
    const fetchSession = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/sessions`);
        const existingSession = res.data.data.find((s:any) => s.id === SESSION_ID);
        if (existingSession) {
          setSession(existingSession);
        } else {
          // Si no existe, crear la sesión
          setSession({ status: 'INITIALIZING' });
          await axios.post(`${API_URL}/api/sessions`, { sessionId: SESSION_ID });
        }
      } catch (err: any) {
        console.error("Error fetching session state:", err);
        if (err.response && err.response.status === 401) {
          setSession({ status: 'UNAUTHORIZED' });
          setIsEditingKey(true);
        } else {
          setSession({ status: 'ERROR_CONECTANDO' });
        }
      }
    };
    
    fetchSession();

    // 3. Escuchar actualizaciones de QR y conexión
    newSocket.on('sessionUpdate', (data: any) => {
      if (data.sessionId === SESSION_ID) {
        setSession(prev => ({ ...prev, ...data }));
      }
    });

    // 4. Escuchar mensajes nuevos en tiempo real
    newSocket.on('message', (data: any) => {
      if (data.sessionId === SESSION_ID) {
        setMessages(prev => [...prev, data.message]);
      }
    });

    return () => {
      newSocket.disconnect();
    }
  }, [apiKey, isEditingKey]);

  // Auto-scroll al final del chat cuando llega un mensaje
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText || !destNumber || !apiKey) return;
    try {
      const formattedNum = destNumber.includes('@s.whatsapp.net') 
        ? destNumber 
        : `${destNumber.replace(/\+/g, '')}@s.whatsapp.net`;

      await axios.post(`${API_URL}/api/messages/send`, {
        sessionId: SESSION_ID,
        to: formattedNum,
        text: inputText
      });
      
      // Añadir mensaje enviado a la UI manualmente
      const fakeMsg: WhatsAppMessage = {
        pushName: "Tú (API)",
        messageTimestamp: Math.floor(Date.now() / 1000),
        message: { conversation: inputText }
      };
      setMessages(p => [...p, fakeMsg]);
      setInputText('');
    } catch (err) {
      alert("Error al enviar el mensaje. Verifica tu API Key o conexión.");
    }
  };

  const handleDisconnect = async () => {
    try {
      await axios.delete(`${API_URL}/api/sessions/${SESSION_ID}`);
      setSession({ status: 'DISCONNECTED' });
      setMessages([]);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error(err);
    }
  };

  const isConnected = session.status === 'CONNECTED';

  return (
    <div className="app-container">
      {/* LATERAL: PANEL DE DISPOSITIVO Y QR */}
      <div className="glass-panel sidebar">
        <div>
          <h1 className="header"><Smartphone size={24} color="var(--accent)" /> Dispositivo</h1>
          <p className="subtitle">Gestión de sesión Baileys + React</p>
        </div>

        {/* API KEY INPUT */}
        {isEditingKey ? (
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--text-muted)' }}>
              <Key size={16} /> <span style={{ fontSize: '0.85rem' }}>Autenticación API</span>
            </div>
            <input 
              type="password" 
              className="input-field" 
              placeholder="Ingresa tu X-API-Key" 
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              style={{ width: '100%', marginBottom: '12px' }}
            />
            <button className="btn" onClick={() => {
              if(apiKey) {
                setIsEditingKey(false);
                setSession({ status: 'AWAITING_SOCKET' });
              }
            }}>
              Guardar y Conectar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={14} /> API Key Guardada
            </span>
            <button onClick={() => setIsEditingKey(true)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}>
              Cambiar
            </button>
          </div>
        )}

        {!isEditingKey && (
          <>
            <div className={`status-badge ${isConnected ? 'connected' : ''}`}>
              <div className={`status-indicator ${isConnected ? 'connected' : ''}`}></div>
              {isConnected ? 'Vinculado a WhatsApp' : (session.status === 'UNAUTHORIZED' ? 'API Key Inválida' : session.status || 'Desconectado')}
            </div>

            {/* CONTENEDOR DE QR CODE PARA ESCANEAR */}
            {!isConnected && session.qrCode && (
              <div className="qr-container">
                <p style={{marginBottom: "16px", fontSize: "0.9rem", color: "var(--text-muted)", textAlign: "center"}}>
                  Ve a Dispositivos Vinculados en tu celular y escanea:
                </p>
                <img src={session.qrCode} alt="WhatsApp QR Code" width={220} height={220} />
              </div>
            )}

            {/* PANTALLA DE CARGA */}
            {!isConnected && !session.qrCode && session.status !== 'INITIALIZING' && session.status !== 'UNAUTHORIZED' && (
              <div className="qr-container" style={{ borderStyle: 'solid', animation: 'none' }}>
                <div className="loader"></div>
                <p style={{ marginTop: '16px', fontSize: '0.9rem', color: "var(--text-muted)" }}>
                  {session.status === 'ERROR_CONECTANDO' ? 'Error: ¿Api Apagada?' : 'Conectando al servidor...'}
                </p>
              </div>
            )}

            {/* PANEL CONECTADO (NÚMERO VINCULADO) */}
            {isConnected && (
              <div style={{ marginTop: '20px', background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)' }}>
                    <ShieldCheck size={28} color="white" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{session.name || 'API Robot'}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      +{session.phoneNumber}
                    </div>
                  </div>
                </div>
                <button className="btn btn-danger" onClick={handleDisconnect}>
                  <LogOut size={18} /> Cerrar Sesión Segura
                </button>
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: 'auto', fontSize: '0.75rem', color: 'rgba(148, 163, 184, 0.5)', textAlign: 'center' }}>
          By Antigravity — Producción Fast-Track
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL: DEMO DE CHAT & API */}
      <div className="glass-panel main-content">
        <h2 className="header" style={{ marginBottom: '24px' }}>
          <MessageSquare size={24} color="var(--accent)" /> 
          Consola Transaccional Webhook
        </h2>

        {!isConnected ? (
          <div className="message-area">
            <Bell size={64} className="message-icon" />
            <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-main)', fontSize: '1.2rem' }}>A la espera de la app</h3>
            <p style={{ maxWidth: '300px' }}>Vincula tu cuenta escaneando el código de la izquierda para comenzar la comunicación bidireccional.</p>
          </div>
        ) : (
          <>
            <div className="chat-list">
              {messages.length === 0 ? (
                <div className="message-area" style={{ flex: 1, border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                  <p>Escuchando WebSockets en vivo...</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>Pídele a alguien que te envíe un mensaje a tu WhatsApp vinculado y aparecerá mágicamente aquí.</p>
                </div>
              ) : (
                messages.map((m, idx) => (
                  <div key={idx} className="chat-item">
                    <div className="chat-item-header">
                      <span className="chat-name">{m.pushName || m.key?.remoteJid?.split('@')[0]}</span>
                      <span className="chat-time">
                        {new Date(m.messageTimestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <div className="chat-message">
                      {m.message?.conversation || m.message?.extendedTextMessage?.text || '📱 [Nuevo tipo de mensaje entrante]'}
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
                placeholder="Teléfono (Ej: 521XXXXXXXXXX)" 
                value={destNumber}
                onChange={e => setDestNumber(e.target.value)}
                style={{ flex: '0 0 30%' }}
              />
              <input 
                type="text" 
                className="input-field" 
                placeholder="Disparar un mensaje vía API..." 
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSend()}
              />
              <button className="btn" style={{ width: 'auto', padding: '0 20px' }} onClick={handleSend} disabled={!inputText || !destNumber}>
                <Send size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default App
