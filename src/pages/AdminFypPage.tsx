import React, { useState, useEffect } from 'react';
import { Compass, Plus, Trash2, Loader2, Link as LinkIcon, Image as ImageIcon, Zap, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase/config';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { User, FypLink } from '../types';

interface AdminFypPageProps {
  user: User | null;
}

export default function AdminFypPage({ user }: AdminFypPageProps) {
  const [links, setLinks] = useState<FypLink[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit state
  const [editingLink, setEditingLink] = useState<FypLink | null>(null);
  const [editForm, setEditForm] = useState({ url: '', title: '', description: '', image: '' });
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // New FYP Link Form state
  const [newLink, setNewLink] = useState({
    url: '',
    title: '',
    description: '',
    image: ''
  });

  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [isOptimizedByVira, setIsOptimizedByVira] = useState(false);

  const optimizeWithViraAI = async (rawTitle: string, rawDescription: string) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'AIzaSy...' || apiKey.trim() === '') {
      console.log("Vite Gemini API Key not configured or placeholder. Skipping Vira AI optimization.");
      return null;
    }

    try {
      const prompt = `
      Anda bertugas sebagai editor konten untuk feed berita di dashboard warga. Tulis ulang judul dan deskripsi tautan berikut agar terasa menarik, alami, dan informatif.

      Aturan penulisan:
      - Gaya bahasa: hangat, bersahabat, informatif.
      - JANGAN tambahkan kata "Warga" di awal atau akhir judul.
      - Tulis judul seperti judul artikel atau postingan media sosial yang natural — bukan seperti pengumuman RT.
      - Singkat, padat, dan langsung ke intinya.

      Batasan:
      - Judul maksimal 60 karakter.
      - Deskripsi maksimal 150 karakter (1-2 kalimat ringkas).

      Data Tautan Asli:
      Judul: "${rawTitle}"
      Deskripsi: "${rawDescription}"

      Kembalikan hasil dalam format JSON murni yang valid tanpa tambahan markdown atau penjelasan:
      {
        "title": "Judul yang sudah dioptimalkan",
        "description": "Deskripsi yang sudah dioptimalkan"
      }
      `;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt
                  }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error("Gagal menghubungi Gemini API");
      }

      const resData = await response.json();
      const text = resData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed.title && parsed.description) {
          return parsed as { title: string; description: string };
        }
      }
    } catch (e) {
      console.error("Gagal optimasi Vira AI:", e);
    }
    return null;
  };

  // Extract YouTube video ID from various YouTube URL formats
  const extractYouTubeId = (url: string): string | null => {
    const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    return watchMatch?.[1] || shortMatch?.[1] || embedMatch?.[1] || null;
  };

  const fetchLinkMetadata = async () => {
    if (!newLink.url) {
      setMetadataError("Silakan masukkan URL terlebih dahulu.");
      return;
    }
    if (!newLink.url.startsWith('http://') && !newLink.url.startsWith('https://')) {
      setMetadataError("URL harus diawali dengan http:// atau https://");
      return;
    }

    setFetchingMetadata(true);
    setMetadataError(null);
    setIsOptimizedByVira(false);

    try {
      let rawTitle = '';
      let rawDescription = '';
      let rawImage = '';

      // --- Special handling: YouTube ---
      const ytVideoId = extractYouTubeId(newLink.url);
      if (ytVideoId) {
        // YouTube oEmbed API: free, no API key, returns title & author
        const oEmbedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(newLink.url)}&format=json`);
        if (oEmbedRes.ok) {
          const oEmbedData = await oEmbedRes.json();
          rawTitle = oEmbedData.title || '';
          rawDescription = `Video oleh ${oEmbedData.author_name || 'YouTube'}. Tonton videonya sekarang di YouTube.`;
          // Use high-quality thumbnail from YouTube CDN (always works, no API key needed)
          rawImage = `https://img.youtube.com/vi/${ytVideoId}/maxresdefault.jpg`;
        } else {
          // fallback thumbnail
          rawImage = `https://img.youtube.com/vi/${ytVideoId}/hqdefault.jpg`;
          rawTitle = 'Video YouTube';
          rawDescription = 'Klik untuk menonton video ini di YouTube.';
        }
      } else {
        // --- General URL: use microlink.io ---
        const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(newLink.url)}`);
        const resData = await response.json();
        if (resData.status === 'success' && resData.data) {
          rawTitle = resData.data.title || '';
          rawDescription = resData.data.description || '';
          rawImage = resData.data.image?.url || '';
        } else {
          setMetadataError("Gagal mengambil data dari URL. Pastikan URL valid.");
          setFetchingMetadata(false);
          return;
        }
      }

      // Try optimizing title & description with Vira AI
      let finalTitle = rawTitle;
      let finalDescription = rawDescription;
      const optimized = await optimizeWithViraAI(rawTitle, rawDescription);
      if (optimized) {
        finalTitle = optimized.title;
        finalDescription = optimized.description;
        setIsOptimizedByVira(true);
      }

      setNewLink(prev => ({
        ...prev,
        title: finalTitle || prev.title,
        description: finalDescription || prev.description,
        image: rawImage || prev.image
      }));

    } catch (err) {
      console.error("Error fetching metadata:", err);
      setMetadataError("Gagal menghubungi server. Periksa koneksi internet Anda.");
    } finally {
      setFetchingMetadata(false);
    }
  };

  // Sync FYP links from Firestore in real-time
  useEffect(() => {
    const q = query(collection(db, 'fyp_links'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: FypLink[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          url: data.url || '',
          title: data.title || '',
          description: data.description || '',
          imageUrl: data.imageUrl || '',
          platform: data.platform || 'other',
          createdAt: data.createdAt
        });
      });

      // Sort by createdAt desc
      items.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      setLinks(items);
      setLoading(false);
    }, (error) => {
      console.error("Gagal sinkronisasi FYP links:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Auto-detect platform from URL
  const detectPlatform = (urlStr: string): FypLink['platform'] => {
    if (!urlStr) return 'other';
    const lower = urlStr.toLowerCase();
    if (lower.includes('instagram.com')) return 'instagram';
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    if (lower.includes('facebook.com')) return 'facebook';
    if (lower.includes('x.com') || lower.includes('twitter.com')) return 'x';
    if (lower.includes('threads.net')) return 'threads';
    if (lower.includes('http://') || lower.includes('https://')) return 'article';
    return 'other';
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Str = event.target?.result as string;
      
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800; // Limit max size to keep base64 lightweight
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.65);
        setNewLink(prev => ({ ...prev, image: compressedBase64 }));
      };
    };
    reader.readAsDataURL(file);
  };

  const handleAddFypLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.url || !newLink.title || !newLink.description) return;
    
    setIsSubmitting(true);
    try {
      const platform = detectPlatform(newLink.url);

      // Add to Firestore fyp_links
      await addDoc(collection(db, 'fyp_links'), {
        url: newLink.url,
        title: newLink.title,
        description: newLink.description,
        imageUrl: newLink.image || '',
        platform: platform,
        createdAt: serverTimestamp()
      });

      // Reset state & close modal
      setNewLink({
        url: '',
        title: '',
        description: '',
        image: ''
      });
      setShowAddModal(false);
    } catch (err) {
      console.error("Gagal menambahkan link FYP:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteLink = async () => {
    if (!linkToDelete) return;
    try {
      await deleteDoc(doc(db, 'fyp_links', linkToDelete));
    } catch (err) {
      console.error("Gagal menghapus link FYP:", err);
    } finally {
      setLinkToDelete(null);
    }
  };

  const openEditModal = (item: FypLink) => {
    setEditingLink(item);
    setEditForm({ url: item.url, title: item.title, description: item.description, image: item.imageUrl || '' });
  };

  const handleEditFypLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink || !editForm.title || !editForm.description) return;
    setIsEditSubmitting(true);
    try {
      const platform = detectPlatform(editForm.url);
      await updateDoc(doc(db, 'fyp_links', editingLink.id), {
        url: editForm.url,
        title: editForm.title,
        description: editForm.description,
        imageUrl: editForm.image || '',
        platform: platform,
      });
      setEditingLink(null);
    } catch (err) {
      console.error("Gagal mengedit link FYP:", err);
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Str = event.target?.result as string;
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        const maxDim = 800;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        setEditForm(prev => ({ ...prev, image: canvas.toDataURL('image/jpeg', 0.65) }));
      };
    };
    reader.readAsDataURL(file);
  };


  const getPlatformLabel = (platform: FypLink['platform']) => {
    switch (platform) {
      case 'instagram': return '📷 Instagram';
      case 'youtube': return '🎥 YouTube';
      case 'facebook': return '👥 Facebook';
      case 'x': return '🐦 X (Twitter)';
      case 'threads': return '🧵 Threads';
      case 'article': return '📄 Artikel Berita';
      default: return '🔗 Website';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        background: '#f8fafc',
        minHeight: '100vh',
        padding: '24px 20px 100px',
        position: 'relative'
      }}
    >
      {/* Header */}
      <header style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Kelola FYP "Untuk Kamu"
            </h2>
            <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0', fontWeight: 600 }}>
              Tambahkan tautan video, postingan sosial media, atau artikel menarik untuk disiarkan di dashboard warga.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => {
              setIsOptimizedByVira(false);
              setShowAddModal(true);
            }}
            style={{
              height: 42,
              borderRadius: 12,
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 13,
              padding: '0 20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
              transition: 'transform 0.1s ease'
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Plus size={16} /> Tambah Konten FYP
          </button>
        </div>
      </header>

      {/* Grid List Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: 13, fontWeight: 700 }}>
          Memuat data konten FYP...
        </div>
      ) : links.length === 0 ? (
        <div style={{
          background: '#ffffff',
          borderRadius: 20,
          padding: 32,
          textAlign: 'center',
          border: '1px solid #e2e8f0',
          color: '#64748b'
        }}>
          <Compass size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <div style={{ fontSize: 14, fontWeight: 800 }}>Belum Ada Konten FYP</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>
            Klik tombol di atas untuk menambahkan link media sosial atau artikel pertama Anda.
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20
        }}>
          {links.map((item) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 20,
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                textAlign: 'left'
              }}
            >
              {/* Cover Image Preview */}
              {item.imageUrl ? (
                <div style={{ width: '100%', height: 160, background: '#f1f5f9', position: 'relative' }}>
                  <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    padding: '4px 10px',
                    borderRadius: 8,
                    fontSize: 10,
                    fontWeight: 800,
                    background: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(4px)',
                    color: '#fff'
                  }}>
                    {getPlatformLabel(item.platform)}
                  </span>
                </div>
              ) : (
                <div style={{ width: '100%', height: 120, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', position: 'relative' }}>
                  <LinkIcon size={24} />
                  <span style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    padding: '4px 10px',
                    borderRadius: 8,
                    fontSize: 10,
                    fontWeight: 800,
                    background: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(4px)',
                    color: '#fff'
                  }}>
                    {getPlatformLabel(item.platform)}
                  </span>
                </div>
              )}

              {/* Body */}
              <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 900, color: '#1e293b', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.3 }}>
                    {item.title}
                  </h4>
                  <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 12px', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                    {item.description}
                  </p>
                  <div style={{ fontSize: 9, color: '#94a3b8', wordBreak: 'break-all', fontFamily: 'monospace', background: '#f8fafc', padding: 6, borderRadius: 8, border: '1px solid #f1f5f9', marginBottom: 12 }}>
                    🔗 {item.url}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <button
                    onClick={() => openEditModal(item)}
                    style={{
                      background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer',
                      padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 700, borderRadius: '6px', transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    onClick={() => setLinkToDelete(item.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: '6px',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <Trash2 size={13} /> Hapus
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* 1. ADD LINK MODAL SHEET */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <div className="sheet-overlay" style={{ zIndex: 11000 }} onClick={() => setShowAddModal(false)} />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="modal-sheet"
              style={{ zIndex: 11001 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1e3a8a', margin: 0 }}>Tambah Konten FYP Warga</h3>
                <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>

              <form onSubmit={handleAddFypLink} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textAlign: 'left' }}>URL Tautan (Link)</label>
                  <div style={{ display: 'flex', gap: 0, border: '1.5px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', background: '#fff', transition: 'border-color 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                    onFocusCapture={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#2563eb'}
                    onBlurCapture={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0'}
                  >
                    <input 
                      type="url" 
                      placeholder="https://youtube.com/watch?v=... atau https://instagram.com/p/..." 
                      value={newLink.url}
                      onChange={e => setNewLink(prev => ({ ...prev, url: e.target.value }))}
                      required
                      style={{ flex: 1, height: 48, border: 'none', background: 'transparent', padding: '0 14px', fontSize: 13, outline: 'none', color: '#1e293b', minWidth: 0 }}
                    />
                    <button
                      type="button"
                      onClick={fetchLinkMetadata}
                      disabled={fetchingMetadata}
                      style={{
                        flexShrink: 0,
                        height: 48,
                        padding: '0 18px',
                        border: 'none',
                        borderLeft: '1.5px solid #e2e8f0',
                        background: fetchingMetadata ? '#f8fafc' : '#2563eb',
                        color: fetchingMetadata ? '#94a3b8' : '#ffffff',
                        fontWeight: 800,
                        fontSize: 12,
                        letterSpacing: '0.01em',
                        cursor: fetchingMetadata ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        transition: 'background 0.2s, color 0.2s',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {fetchingMetadata ? (
                        <><Loader2 className="animate-spin" size={14} /> Mengambil...</>
                      ) : (
                        <><Zap size={13} fill="currentColor" /> Ambil Data</>
                      )}
                    </button>
                  </div>
                  {metadataError && (
                    <div style={{ color: '#ef4444', fontSize: 11, marginTop: 6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                      <span>⚠️</span> {metadataError}
                    </div>
                  )}
                  {isOptimizedByVira && (
                    <div style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      fontSize: 11, 
                      fontWeight: 800, 
                      color: '#2563eb', 
                      background: '#eff6ff', 
                      padding: '6px 12px', 
                      borderRadius: 10, 
                      marginTop: 8,
                      border: '1px solid #bfdbfe'
                    }}>
                      <span>✨ Dioptimalkan oleh Vira AI</span>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textAlign: 'left' }}>Judul Preview</label>
                  <input 
                    type="text" 
                    placeholder="Tuliskan judul menarik untuk warga..." 
                    value={newLink.title}
                    onChange={e => setNewLink(prev => ({ ...prev, title: e.target.value }))}
                    required
                    style={{ width: '100%', height: 48, border: '1px solid #e2e8f0', borderRadius: 14, padding: '0 16px', fontSize: 14, outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textAlign: 'left' }}>Deskripsi Preview</label>
                  <textarea 
                    placeholder="Tuliskan deskripsi ringkas mengenai isi konten tautan..." 
                    rows={3}
                    value={newLink.description}
                    onChange={e => setNewLink(prev => ({ ...prev, description: e.target.value }))}
                    required
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 14, padding: '12px 16px', fontSize: 14, outline: 'none', resize: 'vertical' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textAlign: 'left' }}>Gambar Cover Preview</label>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, border: '1px dashed #cbd5e1', borderRadius: 12, cursor: 'pointer', background: '#f8fafc' }}>
                      <ImageIcon size={18} color="#64748b" />
                      <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                    </label>
                    {newLink.image ? (
                      <div style={{ position: 'relative', width: 48, height: 48, borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        <img src={newLink.image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button type="button" onClick={() => setNewLink(prev => ({ ...prev, image: '' }))} style={{ position: 'absolute', right: 2, top: 2, width: 14, height: 14, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>Belum ada cover yang dipilih (Opsional)</span>
                    )}
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ width: '100%', height: 50, background: '#1e40af', color: '#fff', border: 'none', borderRadius: 16, fontSize: 14, fontWeight: 700, marginTop: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Siarkan ke Dashboard Warga'}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 2. DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {linkToDelete && (
          <div className="sheet-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 12000 }} onClick={() => setLinkToDelete(null)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: '#fff', width: '100%', maxWidth: 380, borderRadius: 24, padding: 24, position: 'relative', textAlign: 'center' }}
              onClick={e => e.stopPropagation()}
            >
              <img src="/vira_ai_confirm.png" alt="Konfirmasi" style={{ width: 72, height: 72, objectFit: 'contain', margin: '0 auto 16px', display: 'block' }} />
              <h4 style={{ fontWeight: 900, color: '#1e3a8a', fontSize: 16, margin: '0 0 8px' }}>Hapus Konten FYP?</h4>
              <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, margin: '0 0 24px' }}>
                Apakah Anda yakin ingin menghapus konten FYP ini dari dashboard warga?
              </p>
              
              <div style={{ display: 'flex', gap: 10 }}>
                <button 
                  onClick={() => setLinkToDelete(null)}
                  style={{ flex: 1, height: 44, borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                >
                  Batal
                </button>
                <button 
                  onClick={confirmDeleteLink}
                  style={{ flex: 1, height: 44, borderRadius: 12, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. EDIT LINK MODAL SHEET */}
      <AnimatePresence>
        {editingLink && (
          <>
            <div className="sheet-overlay" style={{ zIndex: 11500 }} onClick={() => setEditingLink(null)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="modal-sheet"
              style={{ zIndex: 11501 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1e3a8a', margin: 0 }}>Edit Konten FYP</h3>
                <button onClick={() => setEditingLink(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>

              <form onSubmit={handleEditFypLink} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* URL (read-only display) */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textAlign: 'left' }}>URL Tautan</label>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '12px 16px', fontSize: 12, color: '#64748b', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    🔗 {editingLink.url}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textAlign: 'left' }}>Judul Preview</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                    required
                    maxLength={60}
                    style={{ width: '100%', height: 48, border: '1px solid #e2e8f0', borderRadius: 14, padding: '0 16px', fontSize: 14, outline: 'none' }}
                  />
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, textAlign: 'right' }}>{editForm.title.length}/60</div>
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textAlign: 'left' }}>Deskripsi Preview</label>
                  <textarea
                    rows={3}
                    value={editForm.description}
                    onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    required
                    maxLength={150}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 14, padding: '12px 16px', fontSize: 14, outline: 'none', resize: 'vertical' }}
                  />
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, textAlign: 'right' }}>{editForm.description.length}/150</div>
                </div>

                {/* Cover Image */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textAlign: 'left' }}>Gambar Cover</label>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, border: '1px dashed #cbd5e1', borderRadius: 12, cursor: 'pointer', background: '#f8fafc', flexShrink: 0 }}>
                      <ImageIcon size={18} color="#64748b" />
                      <input type="file" accept="image/*" onChange={handleEditImageChange} style={{ display: 'none' }} />
                    </label>
                    {editForm.image ? (
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <img src={editForm.image} alt="Cover" style={{ width: 80, height: 48, objectFit: 'cover', borderRadius: 10, border: '1px solid #e2e8f0' }} />
                        <button type="button" onClick={() => setEditForm(prev => ({ ...prev, image: '' }))} style={{ position: 'absolute', right: -6, top: -6, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', border: 'none', color: '#fff', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>✕</button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>Ganti cover (opsional)</span>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isEditSubmitting}
                  style={{ width: '100%', height: 50, background: '#1e40af', color: '#fff', border: 'none', borderRadius: 16, fontSize: 14, fontWeight: 700, marginTop: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {isEditSubmitting ? <Loader2 className="animate-spin" size={18} /> : <><Pencil size={16} /> Simpan Perubahan</>}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Styled Modal Sheets */}
      <style>{`
        .modal-sheet {
          position: fixed;
          left: 0; right: 0; bottom: 0;
          background: #fff;
          border-radius: 32px 32px 0 0;
          padding: 24px 24px 42px;
          max-height: 95vh;
          overflow-y: auto;
          box-shadow: 0 -20px 40px rgba(0,0,0,0.1);
        }
        .sheet-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,0.4);
          backdrop-filter: blur(8px);
        }
      `}</style>
    </motion.div>
  );
}
