import React, { useState, useEffect, useRef } from 'react';
import { Send, User as UserIcon, Loader2, MessageSquare } from 'lucide-react';
import { 
  collection, query, orderBy, limit, 
  onSnapshot, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from '../types';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  role: string;
  createdAt: any;
}

export default function ChatPage({ user }: { user: User | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      setTimeout(scrollToBottom, 100);
    });

    return () => unsubscribe();
  }, [user]);

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inputText.trim()) return;

    const text = inputText.trim();
    setInputText('');

    try {
      await addDoc(collection(db, 'messages'), {
        senderId: user.id,
        senderName: user.name,
        senderPhoto: user.photoUrl || null,
        text,
        role: user.role,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  if (!user) return null;

  return (
    <div className="chat-container-wrapper">
      <div className="chat-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="card-header" style={{ background: 'var(--blue-600)', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>Forum Ruang Warga VSJ</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>Ruang diskusi antar warga dan pengurus</div>
            </div>
          </div>
        </div>

        <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f8fafc' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader2 className="spin" color="var(--blue-600)" />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {messages.map((msg) => {
                const isMe = msg.senderId === user.id;
                const isStaff = ['developer', 'rw', 'rt'].includes(msg.role);

                return (
                  <div key={msg.id} style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start' 
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      gap: 8, 
                      alignItems: 'flex-end',
                      flexDirection: isMe ? 'row-reverse' : 'row'
                    }}>
                      <div style={{ 
                        width: 32, height: 32, borderRadius: '50%', 
                        background: isStaff ? 'var(--blue-600)' : 'var(--gray-300)',
                        overflow: 'hidden', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 12, fontWeight: 700
                      }}>
                        {msg.senderPhoto ? (
                          <img src={msg.senderPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          msg.senderName.charAt(0)
                        )}
                      </div>
                      <div style={{ 
                        maxWidth: '300px',
                        padding: '12px 16px',
                        borderRadius: isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                        background: isMe ? 'var(--blue-600)' : '#fff',
                        color: isMe ? '#fff' : 'var(--gray-800)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        fontSize: 14,
                        lineHeight: 1.5
                      }}>
                        {!isMe && (
                          <div style={{ 
                            fontSize: 11, fontWeight: 700, marginBottom: 4, 
                            color: isStaff ? 'var(--blue-700)' : 'var(--gray-500)',
                            display: 'flex', alignItems: 'center', gap: 6
                          }}>
                            {msg.senderName}
                            {isStaff && <span style={{ fontSize: 9, background: 'var(--blue-50)', padding: '1px 5px', borderRadius: 4 }}>{msg.role.toUpperCase()}</span>}
                          </div>
                        )}
                        {msg.text}
                        <div style={{ 
                          fontSize: 9, marginTop: 4, textAlign: 'right', 
                          opacity: 0.7, fontStyle: 'italic'
                        }}>
                          {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
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

        <div className="chat-footer" style={{ padding: '20px', borderTop: '1px solid var(--gray-100)', background: '#fff' }}>
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 12 }}>
            <input 
              className="form-input" 
              placeholder="Ketik pesan di sini..." 
              style={{ flex: 1, height: 46, borderRadius: 23, paddingLeft: 20 }}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
            />
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: 46, height: 46, borderRadius: '50%', padding: 0, justifyContent: 'center' }}
              disabled={!inputText.trim()}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>

      <style>{`
        .chat-container-wrapper {
          height: calc(100vh - 64px);
        }
        @media (max-width: 768px) {
          .chat-container-wrapper {
            height: calc(100vh - 136px);
          }
        }
      `}</style>
    </div>
  );
}
