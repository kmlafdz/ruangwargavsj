import React, { useState, useEffect, useRef } from 'react';
import { Search, X, User as UserIcon, FileText, CreditCard, LayoutDashboard, Settings, MapPin, Inbox, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from '../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export default function GlobalSearchModal({ isOpen, onClose, user }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<{ category: string; items: any[] }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // Handle keyboard shortcut (Ctrl+K or Cmd+K) - Optional, but good for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        // Since we don't have a global state for modal open, we'll let Navbar handle the shortcut if needed,
        // or just let it close from inside here if we had an open toggle.
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Determine user scope for routing
  const getAdminScope = () => {
    if (user?.accountType !== 'admin') return '';
    if (user?.adminRole === 'developer') return 'dev';
    if (user?.adminRole === 'rw') return 'rw011';
    return `rt${user?.rt_id || '001'}`;
  };

  // Static Features
  const getFeatures = () => {
    if (!user) return [];
    
    if (user.accountType === 'admin') {
      const scope = getAdminScope();
      return [
        { title: 'Dashboard Admin', url: `/admin/${scope}`, icon: <LayoutDashboard size={16} /> },
        { title: 'Data Warga', url: `/admin/${scope}/warga`, icon: <UserIcon size={16} /> },
        { title: 'Data Keuangan', url: `/admin/${scope}/keuangan`, icon: <CreditCard size={16} /> },
        { title: 'Data Surat', url: `/admin/${scope}/surat`, icon: <FileText size={16} /> },
        { title: 'Pengaturan Akun', url: `/admin/${scope}/setting`, icon: <Settings size={16} /> },
      ];
    } else {
      return [
        { title: 'Dashboard Warga', url: '/warga/dashboard', icon: <LayoutDashboard size={16} /> },
        { title: 'Data Keluarga', url: '/warga/keluarga', icon: <UserIcon size={16} /> },
        { title: 'Iuran & Tagihan', url: '/warga/iuran', icon: <CreditCard size={16} /> },
        { title: 'Layanan Surat', url: '/warga/surat', icon: <FileText size={16} /> },
        { title: 'Laporan Warga', url: '/warga/laporan', icon: <Inbox size={16} /> },
        { title: 'Pengaturan Akun', url: '/warga/setting', icon: <Settings size={16} /> },
      ];
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const searchLower = query.toLowerCase();
      
      try {
        const newResults = [];

        // 1. Search Features
        const features = getFeatures().filter(f => f.title.toLowerCase().includes(searchLower));
        if (features.length > 0) {
          newResults.push({ category: 'Fitur & Navigasi', items: features });
        }

        // Only fetch from Firestore if query length is >= 2
        if (searchLower.length >= 2) {
          // 2. Search Residents
          const residentsSnap = await getDocs(collection(db, 'residents'));
          const residents = residentsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as any))
            .filter(r => 
              (r.nama && r.nama.toLowerCase().includes(searchLower)) || 
              (r.nik && r.nik.includes(searchLower))
            )
            .slice(0, 5) // Limit to 5
            .map(r => ({
              title: r.nama,
              subtitle: `NIK: ${r.nik || '-'}`,
              url: user?.accountType === 'admin' ? `/admin/${getAdminScope()}/warga` : '/warga/keluarga',
              icon: <UserIcon size={16} />
            }));

          if (residents.length > 0) {
            newResults.push({ category: 'Data Warga', items: residents });
          }

          // 3. Search Bills/Iuran
          const billsSnap = await getDocs(collection(db, 'family_bills'));
          const bills = billsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as any))
            .filter(b => 
              (b.title && b.title.toLowerCase().includes(searchLower)) ||
              (b.type && b.type.toLowerCase().includes(searchLower))
            )
            .slice(0, 3)
            .map(b => ({
              title: b.title || b.type,
              subtitle: `Rp ${(b.amount || 0).toLocaleString('id-ID')}`,
              url: user?.accountType === 'admin' ? `/admin/${getAdminScope()}/keuangan` : '/warga/iuran',
              icon: <CreditCard size={16} />
            }));
            
          if (bills.length > 0) {
            newResults.push({ category: 'Data Iuran', items: bills });
          }

          // 4. Search Surat
          const suratSnap = await getDocs(collection(db, 'surat_requests'));
          const surats = suratSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as any))
            .filter(s => 
              (s.wargaName && s.wargaName.toLowerCase().includes(searchLower)) ||
              (s.type && s.type.toLowerCase().includes(searchLower))
            )
            .slice(0, 3)
            .map(s => ({
              title: s.type,
              subtitle: `Pemohon: ${s.wargaName}`,
              url: user?.accountType === 'admin' ? `/admin/${getAdminScope()}/surat` : '/warga/surat',
              icon: <FileText size={16} />
            }));

          if (surats.length > 0) {
            newResults.push({ category: 'Layanan Surat', items: surats });
          }
        }

        setResults(newResults);
      } catch (error) {
        console.error("Error searching globally:", error);
      } finally {
        setIsSearching(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [query, user]);

  const handleSelect = (url: string) => {
    onClose();
    navigate(url);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9998,
              background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)'
            }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20, x: '-50%' }}
            animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, y: -20, x: '-50%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed', top: '10vh', left: '50%',
              width: '90%', maxWidth: 600, zIndex: 9999,
              background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(20px)',
              borderRadius: 24, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0,0,0,0.05)',
              overflow: 'hidden', display: 'flex', flexDirection: 'column',
              maxHeight: '80vh'
            }}
          >
            {/* Search Input Area */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <Search size={22} color="#64748b" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Cari warga, NIK, fitur, atau iuran..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  flex: 1, border: 'none', background: 'transparent',
                  padding: '0 16px', fontSize: 18, color: '#0f172a',
                  outline: 'none', fontWeight: 500
                }}
              />
              {isSearching ? (
                <Loader2 size={20} color="#3b82f6" className="animate-spin" />
              ) : (
                <button 
                  onClick={onClose}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Results Area */}
            <div style={{ overflowY: 'auto', padding: '12px 0' }}>
              {query.trim() === '' ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                  <Search size={32} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
                  <p style={{ fontSize: 14 }}>Ketik untuk mulai mencari segalanya.</p>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, background: '#f1f5f9', padding: '4px 10px', borderRadius: 12, fontWeight: 600 }}>Nama</span>
                    <span style={{ fontSize: 11, background: '#f1f5f9', padding: '4px 10px', borderRadius: 12, fontWeight: 600 }}>NIK</span>
                    <span style={{ fontSize: 11, background: '#f1f5f9', padding: '4px 10px', borderRadius: 12, fontWeight: 600 }}>Fitur</span>
                    <span style={{ fontSize: 11, background: '#f1f5f9', padding: '4px 10px', borderRadius: 12, fontWeight: 600 }}>Iuran</span>
                  </div>
                </div>
              ) : results.length > 0 ? (
                results.map((category, idx) => (
                  <div key={idx} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, padding: '0 24px', marginBottom: 8 }}>
                      {category.category}
                    </div>
                    {category.items.map((item, itemIdx) => (
                      <div 
                        key={itemIdx}
                        onClick={() => handleSelect(item.url)}
                        className="global-search-item"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 16,
                          padding: '12px 24px', cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(241, 245, 249, 0.5)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {item.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.title}
                          </div>
                          {item.subtitle && (
                            <div style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              ) : !isSearching ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                  <p style={{ fontSize: 14 }}>Tidak ditemukan hasil untuk "{query}"</p>
                </div>
              ) : null}
            </div>
            
            {/* Footer */}
            <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(0,0,0,0.05)', background: '#f8fafc', display: 'flex', justifyContent: 'center', gap: 16 }}>
               <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Cari dengan Cerdas menggunakan Vira AI</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
