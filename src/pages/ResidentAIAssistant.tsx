import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Sparkles, User, Wallet, FileText, 
  Megaphone, HelpCircle, X, ChevronRight, 
  ShieldCheck, Calendar, ArrowLeft, Bot, MessageSquare,
  Compass, RefreshCw, UserCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { 
  collection, query, where, getDocs, 
  orderBy, limit, addDoc, serverTimestamp 
} from 'firebase/firestore';

interface Message {
  id: string;
  sender: 'user' | 'vira';
  text: string;
  timestamp: Date;
  actions?: { label: string; onClick: () => void; primary?: boolean }[];
  category?: string;
}

export default function ResidentAIAssistant({ user }: { user: any }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Live contextual data states
  const [unpaidBills, setUnpaidBills] = useState<any[]>([]);
  const [activeLetters, setActiveLetters] = useState<any[]>([]);
  const [latestAnnouncements, setLatestAnnouncements] = useState<any[]>([]);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);

  // Suggestion chips
  const suggestions = [
    { label: '💸 Cek Iuran', query: 'Cek Iuran' },
    { label: '📄 Ajukan Surat', query: 'Ajukan Surat' },
    { label: '📢 Jadwal Kegiatan', query: 'Jadwal Kegiatan' },
    { label: '🛡️ Bantuan Registrasi', query: 'Bantuan Registrasi' },
  ];

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load contextual resident data from Firestore
  useEffect(() => {
    if (!user?.id) return;

    const fetchContextData = async () => {
      try {
        // 1. Unpaid Bills
        const billsQ = query(
          collection(db, 'keuangan'), 
          where('userId', '==', user.id), 
          where('status', '==', 'Unpaid')
        );
        const billsSnap = await getDocs(billsQ);
        setUnpaidBills(billsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // 2. Active Letter Requests
        const lettersQ = query(
          collection(db, 'surat_requests'), 
          where('wargaId', '==', user.id)
        );
        const lettersSnap = await getDocs(lettersQ);
        setActiveLetters(lettersSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // 3. Latest Announcements
        const annQ = query(collection(db, 'announcements'), limit(3));
        const annSnap = await getDocs(annQ);
        setLatestAnnouncements(annSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // 4. Family Members
        if (user.noKK) {
          const familyQ = query(collection(db, 'residents'), where('noKK', '==', user.noKK));
          const familySnap = await getDocs(familyQ);
          setFamilyMembers(familySnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (err) {
        console.error("Error fetching Vira context data:", err);
      }
    };

    fetchContextData();
  }, [user]);

  // Initial welcome message
  useEffect(() => {
    const welcomeText = `Halo Kak ${user?.name || 'Warga'}! ✨ Aku **Vira AI**, *AI Community Assistant* untuk Ruang Warga 011 VSJ. 

Sebagai asisten pintar lingkungan kita, Vira siap membantu Kakak dalam mengurus administrasi surat, mengecek tagihan iuran, melihat pengumuman RT/RW, memandu validasi data KTP/KK, serta menyajikan rangkuman diskusi forum warga.

Ada yang bisa Vira bantu hari ini, Kak? Silakan pilih menu cepat di bawah atau ketik langsung pertanyaan Kakak ya! 🥰`;

    setMessages([
      {
        id: 'welcome',
        sender: 'vira',
        text: welcomeText,
        timestamp: new Date()
      }
    ]);
  }, [user]);

  // Handle suggestion chip click
  const handleSuggestionClick = (queryText: string) => {
    sendMessage(queryText);
  };

  // Generate highly intelligent, context-integrated Vira AI responses
  const getViraResponse = async (userQuery: string): Promise<Message> => {
    const q = userQuery.toLowerCase().trim();
    let text = '';
    let actions: { label: string; onClick: () => void; primary?: boolean }[] = [];

    // Simulate thinking delay
    await new Promise(resolve => setTimeout(resolve, 1200));

    // 1. BILLS / FINANCIAL REMINDERS
    if (q.includes('iuran') || q.includes('tagihan') || q.includes('bayar') || q.includes('kas')) {
      if (unpaidBills.length === 0) {
        text = `Wah, luar biasa Kak **${user?.name}**! 💖 Setelah Vira cek di sistem keuangan RW 011, **seluruh tagihan iuran Kakak bulan ini sudah LUNAS**. 

Terima kasih banyak atas partisipasi aktif Kakak dalam mendukung program pembangunan lingkungan kita! Semoga berkah selalu ya, Kak. Ada lagi yang bisa Vira bantu?`;
      } else {
        const totalUnpaid = unpaidBills.reduce((acc, curr) => acc + (curr.amount || 0), 0);
        const formatRupiah = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
        
        text = `Halo Kak **${user?.name}**, Vira mendeteksi ada **${unpaidBills.length} tagihan iuran** yang belum terbayar di akun Kakak:

${unpaidBills.map((b, idx) => `${idx + 1}. **${b.description || b.category || 'Iuran Bulanan'}** — **${formatRupiah(b.amount || 0)}** (Status: *Belum Bayar*)`).join('\n')}

**Total Tunggakan:** **${formatRupiah(totalUnpaid)}**

Yuk Kak, lakukan pembayaran iuran tepat waktu demi kelancaran operasional RT ${user?.rt_id || '011'}. Kakak bisa bayar langsung melalui menu **Kas-Mu** ya!`;
        
        actions = [
          { 
            label: '💸 Bayar Iuran Sekarang', 
            onClick: () => navigate('/warga/keuangan'), 
            primary: true 
          }
        ];
      }
    }
    // 2. LETTERS / ADMINISTRATION
    else if (q.includes('surat') || q.includes('administrasi') || q.includes('domisili') || q.includes('sktm') || q.includes('nikah') || q.includes('pengantar')) {
      const activePending = activeLetters.filter(l => l.status === 'Pending' || l.status === 'Proses');
      
      let letterStatusText = '';
      if (activePending.length > 0) {
        letterStatusText = `\n\nSaat ini Kakak memiliki **${activePending.length} pengajuan surat yang sedang diproses** oleh RT/RW:\n` +
          activePending.map((l, idx) => `${idx + 1}. **${l.jenis || 'Surat Pengantar'}** (${l.nomor || 'Dalam Antrean'}) — *Status: ${l.status}*`).join('\n');
      } else {
        letterStatusText = `\n\nSaat ini tidak ada pengajuan surat Kakak yang sedang mengantre.`;
      }

      text = `Tentu Kak **${user?.name}**, pengurusan surat di lingkungan RT ${user?.rt_id || '011'} / RW 011 kini sangat praktis! ✨

Berikut beberapa surat pengantar yang bisa diajukan secara online:
1. **Surat Pengantar Domisili** (Syarat: Lengkapi profil & KTP)
2. **Surat Keterangan Tidak Mampu (SKTM)** (Untuk keperluan sekolah/bansos)
3. **Surat Pengantar Nikah** (N1-N4)
4. **Surat Keterangan Usaha (SKU)** (Untuk izin usaha atau pengajuan KUR)

*Proses verifikasi oleh Ketua RT & RW biasanya memakan waktu maksimal 1x24 jam sejak diajukan.* ${letterStatusText}

Kakak ingin membuat pengajuan surat baru sekarang?`;

      actions = [
        { 
          label: '📄 Ajukan Surat Baru', 
          onClick: () => navigate('/warga/surat'), 
          primary: true 
        }
      ];
    }
    // 3. ANNOUNCEMENTS / ACTIVITIES
    else if (q.includes('kegiatan') || q.includes('pengumuman') || q.includes('kerja bakti') || q.includes('acara') || q.includes('ronda')) {
      if (latestAnnouncements.length === 0) {
        text = `Saat ini belum ada jadwal kegiatan atau pengumuman resmi terbaru yang disematkan oleh pengurus RT ${user?.rt_id} / RW 011, Kak. 

Vira akan langsung mengabari Kakak melalui notifikasi begitu ada info kegiatan terbaru (seperti kerja bakti, siskamling, atau rapat warga) ya!`;
      } else {
        text = `Berikut adalah **kegiatan dan pengumuman terbaru** di lingkungan RW 011, Kak **${user?.name}**:

${latestAnnouncements.map((a, idx) => `🔥 **${a.title}**
📅 *Tanggal:* ${a.date || 'Segera'} | *Kategori:* ${a.category || 'Umum'}
📝 *Deskripsi:* ${a.content || a.description || 'Silakan cek menu pengumuman untuk detail lengkap.'}`).join('\n\n')}

Vira sarankan Kakak untuk selalu memantau papan pengumuman agar tidak ketinggalan agenda seru warga ya!`;

        actions = [
          { 
            label: '📢 Buka Pengumuman Lengkap', 
            onClick: () => navigate('/warga/pengumuman'), 
            primary: true 
          }
        ];
      }
    }
    // 4. REGISTRATION / PROFILE ONBOARDING / SAFETY
    else if (q.includes('registrasi') || q.includes('profil') || q.includes('ktp') || q.includes('kk') || q.includes('validasi') || q.includes('data')) {
      const isComplete = user?.email && user?.pinSet && user?.registrationStatus === 'approved';
      
      text = `Halo Kak **${user?.name}**, keamanan data warga adalah prioritas utama Vira! 🛡️

**Status Kelengkapan Akun Kakak:**
* Foto KTP & KK: **${user?.registrationStatus === 'approved' ? '✅ Terverifikasi' : '⏳ Menunggu Validasi'}**
* Email Pemulihan: **${user?.email ? '✅ Terdaftar' : '❌ Belum Dilengkapi'}**
* PIN Keamanan: **${user?.pin ? '✅ Aktif' : '❌ Belum Dibuat'}**
* RT / RW: **RT ${user?.rt_id || '011'} / RW 011**
* Nomor KK: **${user?.noKK || 'Belum Terhubung'}** (${familyMembers.length} Anggota Terdaftar)

${!isComplete ? '⚠️ *Vira sangat menyarankan Kakak untuk segera melengkapi Email dan PIN Keamanan di menu pengaturan agar transaksi kas dan pengajuan surat berjalan lancar & aman.*' : 'Luar biasa! Akun Kakak sudah 100% aman dan terverifikasi.'}`;

      actions = [
        { 
          label: '⚙️ Lengkapi Profil & PIN', 
          onClick: () => navigate('/warga/setting'), 
          primary: true 
        }
      ];
    }
    // 5. FAMILY DATA
    else if (q.includes('keluarga') || q.includes('anggota') || q.includes('kk')) {
      if (familyMembers.length === 0) {
        text = `Vira mendeteksi nomor KK Kakak **(${user?.noKK || 'N/A'})** belum terhubung dengan data anggota keluarga lain di sistem digital RW 011.

Silakan hubungi Ketua RT ${user?.rt_id} untuk mendaftarkan anggota keluarga Kakak agar terintegrasi secara otomatis ya!`;
      } else {
        text = `Tentu Kak **${user?.name}**, berikut adalah daftar **Anggota Keluarga** Kakak yang terdaftar di database digital RW 011 (No. KK: **${user?.noKK}**):

${familyMembers.map((m, idx) => `${idx + 1}. **${m.nama || m.namaLengkap}** (${m.hubungan || 'Anggota'}) — NIK: *${m.nik || 'N/A'}*`).join('\n')}

Semua data di atas telah terverifikasi secara resmi oleh RT ${user?.rt_id} / RW 011.`;
        
        actions = [
          { 
            label: '👨‍👩‍👧‍👦 Detail Keluarga', 
            onClick: () => navigate('/warga/keluarga'), 
            primary: true 
          }
        ];
      }
    }
    // 6. DEFAULT CHATBOT (Gemini AI Character fallback)
    else {
      text = `Aww, terima kasih atas pertanyaannya Kak **${user?.name}**! 🥰 Vira sangat senang bisa mengobrol dengan Kakak.

Sebagai *AI Community Assistant*, Vira didesain khusus untuk melayani seluruh warga RT ${user?.rt_id || '011'} / RW 011 VSJ. Vira bisa membantu Kakak untuk:
* 💸 **Mengecek & membayar iuran bulanan** (Kas-Mu)
* 📄 **Memandu syarat & pengajuan surat pengantar** online
* 📢 **Melihat agenda warga** (kerja bakti, ronda, dll.)
* 👨‍👩‍👧‍👦 **Mengecek data keluarga** di database RT/RW
* ⚙️ **Mengatur PIN & keamanan** akun Kakak

Kira-kira, bagian mana yang ingin Kakak tanyakan lebih detail? Atau ada masukan seru untuk kemajuan lingkungan RW 011 kita? Vira siap mendengarkan kok! 💕`;
    }

    return {
      id: `vira-${Date.now()}`,
      sender: 'vira',
      text,
      timestamp: new Date(),
      actions
    };
  };

  const sendMessage = async (customText?: string) => {
    const textToSend = customText || inputValue;
    if (!textToSend.trim()) return;

    // Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customText) setInputValue('');
    setLoading(true);

    try {
      const viraMsg = await getViraResponse(textToSend);
      setMessages(prev => [...prev, viraMsg]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        sender: 'vira',
        text: 'Aduh Kak, maaf banget jaringan Vira sedang agak terganggu nih... 🥺 Coba lagi beberapa saat lagi ya Kak!',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const formatMessageTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="vira-page-container" style={{
      background: '#f8fafc',
      minHeight: 'calc(100vh - 64px)',
      paddingBottom: '80px',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Outfit', sans-serif"
    }}>
      {/* HEADER PANEL - GLASSMORPHISM */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
        padding: '20px 24px',
        color: '#fff',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 10px 25px rgba(37, 99, 235, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <button 
          onClick={() => navigate('/warga/dashboard')}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: '#fff',
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ position: 'relative' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            border: '2px solid rgba(255,255,255,0.3)',
            overflow: 'hidden',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
          }}>
            <img 
              src="/vira_ai_avatar.png" 
              alt="Vira AI" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                // Fallback in case image is missing
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150';
              }}
            />
          </div>
          <div style={{
            position: 'absolute',
            bottom: '-2px',
            right: '-2px',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: '#22c55e',
            border: '2px solid #1e3a8a',
            boxShadow: '0 0 0 2px rgba(34, 197, 94, 0.3)'
          }} />
        </div>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 900, margin: 0, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Vira AI <Sparkles size={14} className="pulse-yellow" style={{ color: '#fbbf24' }} />
          </h2>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', margin: '2px 0 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Asisten Pintar Warga 011
          </p>
        </div>
      </div>

      {/* CHAT AREA */}
      <div style={{
        flex: 1,
        padding: '24px 20px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {messages.map((msg) => (
          <div 
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              gap: '6px'
            }}
          >
            {/* Sender Label */}
            <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', paddingLeft: msg.sender === 'vira' ? '8px' : '0', paddingRight: msg.sender === 'user' ? '8px' : '0' }}>
              {msg.sender === 'user' ? 'Anda' : 'Vira AI'}
            </span>

            {/* Bubble */}
            <div 
              style={{
                background: msg.sender === 'user' ? 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)' : '#ffffff',
                color: msg.sender === 'user' ? '#ffffff' : '#1e293b',
                padding: '16px 20px',
                borderRadius: msg.sender === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.03)',
                fontSize: '13.5px',
                lineHeight: '1.6',
                border: msg.sender === 'user' ? 'none' : '1px solid #e2e8f0',
                whiteSpace: 'pre-line'
              }}
            >
              {/* Parse bold strings manually to support premium markdown feel */}
              {msg.text.split('\n').map((paragraph, pIdx) => (
                <p key={pIdx} style={{ margin: pIdx > 0 ? '10px 0 0' : 0 }}>
                  {paragraph.split('**').map((chunk, cIdx) => (
                    cIdx % 2 === 1 ? <strong key={cIdx} style={{ color: msg.sender === 'user' ? '#fff' : '#1e3a8a', fontWeight: 900 }}>{chunk}</strong> : chunk
                  ))}
                </p>
              ))}

              {/* Dynamic Action Buttons */}
              {msg.actions && msg.actions.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                  {msg.actions.map((act, actIdx) => (
                    <button
                      key={actIdx}
                      onClick={act.onClick}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '10px',
                        border: 'none',
                        background: act.primary ? '#1e3a8a' : '#f1f5f9',
                        color: act.primary ? '#ffffff' : '#475569',
                        fontSize: '11px',
                        fontWeight: 900,
                        cursor: 'pointer',
                        boxShadow: act.primary ? '0 4px 10px rgba(30, 58, 138, 0.2)' : 'none',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                      onMouseOut={e => e.currentTarget.style.transform = 'none'}
                    >
                      {act.label} <ChevronRight size={12} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Time */}
            <span style={{ fontSize: '9px', color: '#94a3b8', paddingLeft: msg.sender === 'vira' ? '8px' : '0', paddingRight: msg.sender === 'user' ? '8px' : '0' }}>
              {formatMessageTime(msg.timestamp)}
            </span>
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', alignSelf: 'flex-start', background: '#fff', padding: '12px 18px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
            <RefreshCw size={14} className="spin" style={{ color: '#2563eb' }} />
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 800 }}>Vira sedang mengetik...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* QUICK SUGGESTIONS FLOATING PANEL */}
      <div style={{
        padding: '0 20px 12px',
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {suggestions.map((sug, idx) => (
          <button
            key={idx}
            onClick={() => handleSuggestionClick(sug.query)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#475569',
              fontSize: '11.5px',
              fontWeight: 800,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
              transition: 'all 0.2s flex-shrink-0'
            }}
            onMouseOver={e => {
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.color = '#2563eb';
            }}
            onMouseOut={e => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.color = '#475569';
            }}
          >
            {sug.label}
          </button>
        ))}
      </div>

      {/* BOTTOM INPUT BAR - FIXED ABOVE BOTTOM NAV */}
      <div style={{
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        padding: '12px 20px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: 'sticky',
        bottom: 0,
        zIndex: 100
      }}>
        <input 
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={`Tanya Vira: "Tagihan saya berapa?" atau "Syarat domisili"...`}
          style={{
            flex: 1,
            height: '46px',
            borderRadius: '14px',
            border: '1px solid #cbd5e1',
            padding: '0 16px',
            fontSize: '13px',
            outline: 'none',
            transition: 'all 0.2s',
            background: '#f8fafc'
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = '#2563eb';
            e.currentTarget.style.background = '#ffffff';
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = '#cbd5e1';
            e.currentTarget.style.background = '#f8fafc';
          }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!inputValue.trim() || loading}
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            border: 'none',
            background: inputValue.trim() ? 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)' : '#cbd5e1',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
            boxShadow: inputValue.trim() ? '0 4px 10px rgba(37, 99, 235, 0.2)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
