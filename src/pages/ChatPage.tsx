import React, { useState, useEffect, useRef } from 'react';
import { Send, User as UserIcon, Loader2, MessageSquare, ShieldCheck, Star, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  collection, query, orderBy, limit, 
  onSnapshot, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from '../types';
import { CommunityPosition } from '../components/SocialBadge';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderFullName?: string;
  senderUsername?: string;
  senderPhoto?: string;
  senderPosition?: CommunityPosition;
  isKepalaKeluarga?: boolean;
  text: string;
  createdAt: any;
}

export default function ChatPage({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInitial = useRef(true);
  const [selectedUser, setSelectedUser] = useState<{
    name: string;
    username: string;
    photoUrl?: string;
    position?: string;
  } | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(data.reverse());
      setLoading(false);
      
      if (isInitial.current) {
        setTimeout(() => scrollToBottom('auto'), 50);
        isInitial.current = false;
      } else {
        setTimeout(() => scrollToBottom('smooth'), 50);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    scrollRef.current?.scrollIntoView({ behavior });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inputText.trim()) return;

    const text = inputText.trim();
    setInputText('');

    const displayUsername = (user.chatUsername || user.username || user.name).slice(0, 10).toLowerCase();

    try {
      await addDoc(collection(db, 'messages'), {
        senderId: user.id,
        senderName: displayUsername,
        senderFullName: user.name,
        senderUsername: displayUsername,
        senderPhoto: user.photoUrl || null,
        senderPosition: user.communityPosition || 'Warga',
        isKepalaKeluarga: user.isKepalaKeluarga || false,
        text,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const getPositionBadge = (pos?: string) => {
    if (!pos || pos === 'Warga' || pos.toLowerCase() === 'warga') return null;
    const posLower = pos.toLowerCase();
    
    if (posLower === 'ketua_rw') {
      return (
        <span style={{ 
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: '#fef3c7', color: '#92400e', 
          padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800,
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        }}>
          Ketua RW
        </span>
      );
    }
    
    if (posLower === 'ketua_rt' || posLower.startsWith('ketua_rt_')) {
      const rtNum = posLower.startsWith('ketua_rt_') ? posLower.split('_')[2] : '';
      return (
        <span style={{ 
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: '#dbeafe', color: '#1e40af', 
          padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800,
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        }}>
          Ketua RT {rtNum}
        </span>
      );
    }
    
    return null;
  };

  if (!user) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="chat-container-wrapper"
    >
      <div className="chat-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ 
          background: '#ffffff', 
          borderBottom: '1px solid #e2e8f0', 
          padding: '16px 20px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          transform: 'translate3d(0, 0, 0)',
          WebkitFontSmoothing: 'antialiased',
          backfaceVisibility: 'hidden'
        }}>
          {user && (
            <button 
              type="button"
              onClick={() => navigate(-1)}
              style={{
                background: '#f8fafc',
                border: 'none',
                color: '#1e293b',
                width: 38,
                height: 38,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#f8fafc'}
            >
              <ChevronLeft size={20} />
            </button>
          )}
          
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: '#1e3a8a', letterSpacing: '-0.5px' }}>Forum Warga VSJ</div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Obrolan Komunitas RW 011</div>
          </div>
        </div>

        <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', background: '#f1f5f9' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader2 className="animate-spin" color="#1e3a8a" /></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {messages.map((msg) => {
                const isMe = msg.senderId === user.id;
                const badge = getPositionBadge(msg.senderPosition);

                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      {!isMe && (
                        <div 
                          onClick={() => setSelectedUser({
                            name: msg.senderFullName || msg.senderName,
                            username: msg.senderUsername || msg.senderName,
                            photoUrl: msg.senderPhoto,
                            position: msg.senderPosition
                          })}
                          style={{ width: 34, height: 34, borderRadius: '50%', background: badge ? '#1e3a8a' : '#94a3b8', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 800, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', cursor: 'pointer' }}
                        >
                          {msg.senderPhoto ? <img src={msg.senderPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : msg.senderName.charAt(0)}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                        {!isMe && (
                          <div style={{ 
                            fontSize: '11px', 
                            fontWeight: 700, 
                            color: '#475569',
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            marginLeft: '4px',
                            marginBottom: '2px'
                          }}>
                            <span style={{ fontWeight: 800, color: '#1e3a8a' }}>{msg.senderName}</span>
                            {badge}
                          </div>
                        )}
                        <div style={{ 
                          maxWidth: 'min(78%, 480px)', padding: '10px 14px', 
                          borderRadius: isMe ? '20px 4px 20px 20px' : '4px 20px 20px 20px',
                          background: isMe ? '#1e3a8a' : '#fff', color: isMe ? '#fff' : '#1e293b',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: 14, lineHeight: 1.5,
                          textAlign: 'left',
                          minWidth: '75px'
                        }}>
                          <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                            <span>{msg.text}</span>
                            <span style={{ 
                              fontSize: 9, 
                              opacity: 0.6, 
                              fontWeight: 700,
                              color: isMe ? '#ffffff' : '#64748b',
                              whiteSpace: 'nowrap',
                              marginLeft: '8px',
                              display: 'inline-block',
                              verticalAlign: 'bottom',
                              lineHeight: 1
                            }}>
                              {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) : '...'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>
          )}
        </div>

        <div className="chat-footer" style={{ borderTop: '1px solid #e2e8f0', background: '#fff' }}>
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 12 }}>
            <input className="form-input" placeholder="Tulis pesan..." style={{ flex: 1, height: 50, borderRadius: 16, paddingLeft: 20, background: '#f8fafc', border: '1px solid #e2e8f0' }} value={inputText} onChange={e => setInputText(e.target.value)} />
            <button type="submit" className="btn btn-primary" style={{ width: 50, height: 50, borderRadius: 16, padding: 0, justifyContent: 'center', boxShadow: '0 10px 15px -3px rgba(30,58,138,0.3)' }} disabled={!inputText.trim()}><Send size={20} /></button>
          </form>
        </div>
      </div>
      {selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 7000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 360, borderRadius: 28, padding: 32, textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative' }}>
            <button 
              type="button"
              onClick={() => setSelectedUser(null)} 
              style={{ position: 'absolute', top: 20, right: 20, background: '#f1f5f9', border: 'none', color: '#64748b', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 14 }}
            >
              ✕
            </button>
            
            <div style={{ width: 100, height: 100, borderRadius: '50%', overflow: 'hidden', margin: '0 auto 16px', border: '4px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e3a8a', color: '#fff', fontSize: 36, fontWeight: 900 }}>
              {selectedUser.photoUrl ? (
                <img src={selectedUser.photoUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                selectedUser.name.charAt(0)
              )}
            </div>

            <div style={{ display: 'inline-block', marginBottom: 12 }}>
              {getPositionBadge(selectedUser.position) || (
                <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800 }}>👤 Warga</span>
              )}
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginBottom: 4, textTransform: 'uppercase' }}>{selectedUser.name}</h3>
            <p style={{ color: '#2563eb', fontSize: 14, fontWeight: 800, margin: 0, fontFamily: 'monospace' }}>@{selectedUser.username}</p>
            
            <div style={{ marginTop: 24, borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>
              <button 
                type="button"
                onClick={() => setSelectedUser(null)}
                style={{ width: '100%', height: 48, borderRadius: 14, border: 'none', background: '#1e3a8a', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .chat-page-main-area {
          padding: 0 !important;
          margin: 0 !important;
          height: 100vh !important;
          background: #f1f5f9 !important;
          width: 100% !important;
          overflow: hidden !important;
        }
        .chat-page-content {
          padding: 0 !important;
          margin: 0 !important;
          height: 100% !important;
          overflow: hidden !important;
        }
        .chat-page-content-wrapper {
          height: 100% !important;
          overflow: hidden !important;
        }
        .chat-container-wrapper { 
          height: 100vh; 
          background: #f1f5f9; 
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          transform: translate3d(0, 0, 0);
          backface-visibility: hidden;
          perspective: 1000px;
          overflow: hidden !important;
        }
        .chat-container {
          max-width: 850px;
          width: 100%;
          margin: 0 auto;
          background: #ffffff;
          box-shadow: 0 10px 30px rgba(0,0,0,0.03);
          height: 100%;
          border-left: 1px solid #e2e8f0;
          border-right: 1px solid #e2e8f0;
        }
        .chat-messages { padding: 24px; }
        .chat-footer { padding: 20px 24px; }
        
        /* On desktop (width > 768px), clear the persistent 260px sidebar for admin */
        @media (min-width: 769px) {
          .app-layout:not(.is-resident) .chat-page-main-area {
            padding-left: 260px;
          }
        }
        
        @media (max-width: 768px) { 
          .chat-page-main-area {
            padding: 0 !important;
            margin: 0 !important;
            padding-left: 0 !important;
            height: 100vh !important;
            overflow: hidden !important;
          }
          .chat-page-content {
            margin-top: 0 !important; /* Forces 0 margin-top on mobile chat to avoid white gap */
            height: 100vh !important;
            overflow: hidden !important;
          }
          .chat-container-wrapper { 
            height: 100vh !important; 
            overflow: hidden !important;
          } 
          .chat-container {
            max-width: 100%;
            border-left: none;
            border-right: none;
            box-shadow: none;
            height: 100% !important;
          }
          .chat-messages { padding: 16px 12px; }
          .chat-footer { padding: 12px 14px; }
        }
      `}</style>
    </motion.div>
  );
}
