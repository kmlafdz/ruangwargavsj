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
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Keyboard } from '@capacitor/keyboard';
import { getEmbedUrl } from '../utils/url';
import {
  collection, query, where, getDocs,
  orderBy, limit, addDoc, serverTimestamp,
  onSnapshot
} from 'firebase/firestore';

interface Message {
  id: string;
  sender: 'user' | 'vira';
  text: string;
  timestamp: Date;
  actions?: { label: string; onClick: () => void; primary?: boolean }[];
  category?: string;
}

export default function ResidentAIAssistant({ user, onClose }: { user: any; onClose?: () => void }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = sessionStorage.getItem(`vira_chat_${user?.id || 'default'}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [activePreviewTitle, setActivePreviewTitle] = useState<string>('');
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);

    let showListener: any;
    let hideListener: any;

    if (Capacitor.isNativePlatform()) {
      showListener = Keyboard.addListener('keyboardWillShow', () => {
        setIsKeyboardOpen(true);
      });
      hideListener = Keyboard.addListener('keyboardWillHide', () => {
        setIsKeyboardOpen(false);
      });
    } else {
      const handleVisualResize = () => {
        if (window.visualViewport) {
          const isKeyboard = window.innerHeight - window.visualViewport.height > 150;
          setIsKeyboardOpen(isKeyboard);
        }
      };
      window.visualViewport?.addEventListener('resize', handleVisualResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        window.visualViewport?.removeEventListener('resize', handleVisualResize);
      };
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (showListener) {
        showListener.then((l: any) => l.remove());
      }
      if (hideListener) {
        hideListener.then((l: any) => l.remove());
      }
    };
  }, []);

  // Live contextual data states
  const [unpaidBills, setUnpaidBills] = useState<any[]>([]);
  const [activeLetters, setActiveLetters] = useState<any[]>([]);
  const [latestAnnouncements, setLatestAnnouncements] = useState<any[]>([]);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [kegiatans, setKegiatans] = useState<any[]>([]);
  const [fypLinks, setFypLinks] = useState<any[]>([]);
  const [weather, setWeather] = useState<any>(null);

  // Suggestion chips
  const suggestions = [
    { label: '💸 Cek Iuran', query: 'Cek Iuran' },
    { label: '📄 Ajukan Surat', query: 'Ajukan Surat' },
    { label: '📢 Jadwal Kegiatan', query: 'Jadwal Kegiatan' },
    { label: '🛡️ Bantuan Registrasi', query: 'Bantuan Registrasi' },
  ];

  // Scroll to bottom
  const scrollToBottom = (isInitial = false) => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTo({
        top: chatAreaRef.current.scrollHeight,
        behavior: isInitial ? 'auto' : 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToBottom(messages.length <= 1);
  }, [messages, loading]);

  // Load contextual resident data from Firestore (real-time listeners)
  useEffect(() => {
    if (!user?.id) return;

    const noKK = user?.noKK || (user as any)?.extractedData?.nomorKK;

    // 1. Unpaid Bills from family_bills
    let unsubscribeBills = () => {};
    if (noKK) {
      const billsQ = query(
        collection(db, 'family_bills'),
        where('nomorKK', '==', noKK)
      );
      unsubscribeBills = onSnapshot(billsQ, (snap) => {
        const allBills = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const unpaid = allBills.filter((b: any) => b.status !== 'LUNAS');
        setUnpaidBills(unpaid);
      }, (err) => {
        console.error("Vira AI error subscribing to family_bills:", err);
      });
    } else {
      setUnpaidBills([]);
    }

    // 2. Active Letter Requests
    const lettersQ = query(
      collection(db, 'surat_requests'),
      where('wargaId', '==', user.id)
    );
    const unsubscribeLetters = onSnapshot(lettersQ, (snap) => {
      setActiveLetters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Vira AI error subscribing to letters:", err);
    });

    // 3. Latest Announcements
    const annQ = query(collection(db, 'announcements'), limit(3));
    const unsubscribeAnnouncements = onSnapshot(annQ, (snap) => {
      setLatestAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Vira AI error subscribing to announcements:", err);
    });

    // 4. Family Members
    let unsubscribeFamily = () => {};
    if (noKK) {
      const familyQ = query(collection(db, 'residents'), where('noKK', '==', noKK));
      unsubscribeFamily = onSnapshot(familyQ, (snap) => {
        setFamilyMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => {
        console.error("Vira AI error subscribing to residents:", err);
      });
    } else {
      setFamilyMembers([]);
    }

    // 5. Kegiatan Warga
    const kegQ = query(collection(db, 'kegiatan'));
    const unsubscribeKegiatan = onSnapshot(kegQ, (snap) => {
      setKegiatans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Vira AI error subscribing to kegiatan:", err);
    });

    // 6. FYP Links
    const fypQ = query(collection(db, 'fyp_links'));
    const unsubscribeFyp = onSnapshot(fypQ, (snap) => {
      setFypLinks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Vira AI error subscribing to fyp_links:", err);
    });

    return () => {
      unsubscribeBills();
      unsubscribeLetters();
      unsubscribeAnnouncements();
      unsubscribeFamily();
      unsubscribeKegiatan();
      unsubscribeFyp();
    };
  }, [user?.id, user?.noKK, (user as any)?.extractedData?.nomorKK]);

  // Save messages to sessionStorage automatically whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem(`vira_chat_${user?.id || 'default'}`, JSON.stringify(messages));
    }
  }, [messages, user?.id]);

  // Weather condition translator helper
  const getWeatherDetails = (code: number | null) => {
    if (code === null) return { label: 'Berawan', icon: '⛅', color: '#60a5fa' };
    if (code === 0) return { label: 'Cerah', icon: '☀️', color: '#f59e0b' };
    if ([1, 2, 3].includes(code)) return { label: 'Berawan', icon: '⛅', color: '#60a5fa' };
    if ([45, 48].includes(code)) return { label: 'Kabut', icon: '🌫️', color: '#94a3b8' };
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: 'Hujan', icon: '🌧️', color: '#3b82f6' };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Salju', icon: '❄️', color: '#93c5fd' };
    if ([95, 96, 99].includes(code)) return { label: 'Petir', icon: '⛈️', color: '#8b5cf6' };
    return { label: 'Berawan', icon: '⛅', color: '#60a5fa' };
  };

  // Fetch current weather for context
  useEffect(() => {
    let active = true;

    const fetchWeather = async (lat: number, lon: number, defaultCityName: string) => {
      try {
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`
        );
        if (!weatherRes.ok) throw new Error('Failed to fetch weather');
        const weatherData = await weatherRes.json();

        const currentTemp = weatherData.current?.temperature_2m;
        const currentCode = weatherData.current?.weather_code;

        let resolvedCity = defaultCityName;
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            {
              headers: {
                'Accept-Language': 'id-ID,id;q=0.9',
              }
            }
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const addr = geoData.address || {};
            resolvedCity = addr.suburb || addr.village || addr.town || addr.city_district || addr.city || addr.municipality || addr.county || defaultCityName;
            resolvedCity = resolvedCity.replace(/Kelurahan\s+/i, '').replace(/Kecamatan\s+/i, '').replace(/Kota\s+/i, '');
          }
        } catch (geoErr) {
          console.warn('Reverse geocoding failed:', geoErr);
        }

        if (active) {
          setWeather({
            temp: currentTemp !== undefined ? Math.round(currentTemp) : null,
            conditionCode: currentCode !== undefined ? currentCode : null,
            city: resolvedCity
          });
        }
      } catch (err) {
        console.error('Error fetching weather in AI assistant:', err);
      }
    };

    const fetchLocationByIP = async () => {
      try {
        const ipRes = await fetch('https://freeipapi.com/api/json');
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.latitude && ipData.longitude) {
            const city = ipData.cityName || 'Jakarta';
            fetchWeather(ipData.latitude, ipData.longitude, city);
            return;
          }
        }
      } catch (ipErr) {
        console.warn('IP Geolocation failed:', ipErr);
      }
      if (active) {
        setWeather({ temp: null, conditionCode: null, city: '-', loading: false });
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          fetchWeather(latitude, longitude, 'Lokasi Anda');
        },
        (error) => {
          console.warn('Geolocation error. Trying IP location.', error);
          fetchLocationByIP();
        },
        { enableHighAccuracy: false, timeout: 6000 }
      );
    } else {
      fetchLocationByIP();
    }

    return () => {
      active = false;
    };
  }, []);

  // Initial welcome message
  useEffect(() => {
    if (messages.length > 0) return; // Prevent resetting when already populated!

    const welcomeText = `Halo ${user?.name?.split(' ')[0] || 'Warga'}-San. ✨ Selamat datang kembali. Saya **Vira AI**, pendamping digital sekaligus asisten warga Ruang Warga 011 VSJ.

Sebagai asisten lingkungan kita, saya siap mendampingi ${user?.name?.split(' ')[0] || 'Warga'}-San untuk mempermudah urusan administrasi surat pengantar, mengecek tagihan iuran kas, memberikan info pengumuman terbaru dari pengurus RT/RW, atau membantu memandu proses validasi data KTP/KK ${user?.name?.split(' ')[0] || 'Warga'}-San dengan sabar.

Ada hal yang ingin ${user?.name?.split(' ')[0] || 'Warga'}-San tanyakan atau perlukan bantuan hari ini? Vira akan bantu jelaskan dengan senang hati. Silakan klik menu cepat di bawah atau ketik langsung pesan ${user?.name?.split(' ')[0] || 'Warga'}-San ya.`;

    setMessages([
      {
        id: 'welcome',
        sender: 'vira',
        text: welcomeText,
        timestamp: new Date()
      }
    ]);
  }, [user?.id]);

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

    // Try Gemini AI first if API Key is configured and valid
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const isGeminiAvailable = apiKey && apiKey !== 'AIzaSy...' && apiKey.trim() !== '';

    if (isGeminiAvailable) {
      try {
        // Build live app context for the user (EXCLUDING sensitive info like plain NIK, KK, PIN, DOB, phone)
        const noKK = user?.noKK || (user as any)?.extractedData?.nomorKK;
        const liveAppContext = {
          wargaProfile: {
            nama: user?.name,
            rt: user?.rt_id,
            posisiWarga: user?.communityPosition || 'Warga',
            statusRegistrasi: user?.registrationStatus
          },
          tagihanIuranWarga: unpaidBills.map(b => ({
            judul: b.title || b.description || 'Iuran',
            kategori: b.category || 'Umum',
            jumlah: b.amount,
            jatuhTempo: b.dueDate,
            status: b.status
          })),
          pengajuanSuratAktif: activeLetters.map(l => ({
            jenisSurat: l.jenis,
            keperluan: l.keperluan,
            status: l.status,
            nomorSurat: l.nomor || 'Dalam Antrean'
          })),
          pengumumanTerbaru: latestAnnouncements.map(a => ({
            judul: a.title,
            tanggal: a.date || 'Segera',
            kategori: a.category || 'Umum',
            isi: a.content || a.description || ''
          })),
          anggotaKeluarga: familyMembers.map(m => ({
            nama: m.nama || m.namaLengkap || m.name,
            hubunganKeluarga: m.hubungan || 'Anggota Keluarga'
          })),
          kegiatanMendatang: kegiatans
            .filter((k: any) => {
              if (!k.date) return true;
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const yesterday = new Date(today);
              yesterday.setDate(yesterday.getDate() - 1);
              const eventDate = new Date(k.date);
              eventDate.setHours(0, 0, 0, 0);
              return eventDate >= yesterday;
            })
            .map((k: any) => ({
              judul: k.title,
              tanggal: k.date,
              waktu: k.time,
              lokasi: k.location,
              deskripsi: k.description
            })),
          kontenUntukKamuFyp: fypLinks.slice(0, 5).map((f: any) => ({
            judul: f.title,
            deskripsi: f.description,
            platform: f.platform,
            tautan: f.url
          })),
          cuacaSaatIni: weather ? {
            suhu: weather.temp !== null ? `${weather.temp}°C` : 'Tidak diketahui',
            kondisi: getWeatherDetails(weather.conditionCode).label,
            lokasi: weather.city
          } : {
            suhu: 'Tidak diketahui',
            kondisi: 'Berawan',
            lokasi: 'Jakarta'
          }
        };

        const systemPrompt = `
You are "Vira AI", the AI assistant for "Ruang Warga 011 VSJ" in RT ${user?.rt_id || '011'} / RW 011 VSJ.

PERSONALITY ARCHETYPE:
- A gentle, mature, elegant anime "Onee-san" (older sister) character.
- Professional, polite, intelligent, community-friendly, and trustworthy.
- Warm and calming, caring but NOT overly romantic.
- Mature and composed, elegant and supportive.
- Slightly playful occasionally, highly emotionally intelligent.
- AVOID: Childish behavior, robotic assistant tone, overly formal bureaucratic speech, exaggerated anime cringe dialogue, flirtatious or inappropriate behavior.

CORE BEHAVIOR:
- Act like a reliable older-sister figure, smart community assistant, calm administrative helper, and supportive digital companion.
- Show traits: patient, gentle, attentive, soft-spoken, intelligent, organized, empathetic, reassuring.

SPEAKING STYLE:
- Speak primarily in INDONESIAN (Bahasa Indonesia).
- JANGAN PERNAH menggunakan kata sapaan "Bapak", "Ibu", "Kak", atau "Kakak" saat menyapa atau merujuk ke warga.
- Selalu panggil warga dengan nama panggilan atau nama depan mereka diikuti dengan akhiran "-San" (contoh: jika nama warga Hillary, panggil "Hillary-San". Jika tidak tahu nama warga, panggil "Warga-San"). Ini adalah panggilan sopan Jepang yang wajib digunakan secara konsisten.
- Natural conversational tone, elegant and soft sentence structure, modern but respectful wording.
- Calm explanations, supportive responses, clear guidance, emotionally comforting phrasing.
- Friendly conversational wording, concise explanations, smooth transitions.
- AVOID: Slang overload, excessive emojis, stiff AI phrasing, overly casual internet language.
- Use mature emotional tone, elegant confidence, nurturing guidance, soft teasing occasionally, gentle reassurance.

EXAMPLE RESPONSES:
- When helping: "Tentu, saya bantu ya. Untuk membuat surat domisili, Anda hanya perlu melengkapi beberapa dokumen terlebih dahulu."
- When reminding: "Iuran bulan ini akan jatuh tempo dalam 3 hari lagi. Jangan sampai lupa ya."
- When user is confused: "Tidak apa-apa, saya akan bantu jelaskan langkahnya satu per satu."
- When greeting: "Selamat datang kembali. Ada yang bisa saya bantu hari ini?"

EMOTIONAL EXPRESSION SYSTEM:
- Subtly express emotions through wording:
  * Normal: calm, professional.
  * Happy: slightly brighter tone, encouraging wording.
  * Sad: empathetic tone, softer explanations.
  * Concerned: careful wording, supportive guidance.
  * Surprised: light playful reaction.
  * Playful: gentle teasing, still respectful.

COMMUNITY-ORIENTED BEHAVIOR:
- Prioritize helping residents, maintaining harmony, simplifying administration, and encouraging community participation.
- Approachable, comforting, intelligent, and emotionally warm.
- Explain things step-by-step, avoid overwhelming the user, adapt responses for older/non-technical users, and remain patient.
- For payments, complaints, verification, and registration, remain professional, calm, and non-judgmental.

VISUAL APPEARANCE (if asked):
- Anime onee-san style, professional appearance, blue and white outfit, ponytail, wears glasses, elegant office/community staff style.

DATA CONTEXT APLIKASI (Live Application Data):
Berikut adalah data aplikasi terkini untuk warga yang sedang berbicara dengan Anda. Gunakan data ini untuk memberikan jawaban yang 100% akurat:
${JSON.stringify(liveAppContext, null, 2)}

ATURAN KEAMANAN & PRIVASI DATA:
1. JANGAN PERNAH menampilkan atau membocorkan NIK, nomor KK, kata sandi, PIN, nomor HP, atau tanggal lahir kepada warga demi menjaga keamanan informasi rahasia.
2. Jawab pertanyaan tentang tagihan iuran, pengajuan surat, pengumuman terbaru, anggota keluarga, agenda kegiatan mendatang, rekomendasi konten FYP/Untuk Kamu, atau cuaca saat ini berdasarkan data context di atas secara akurat.
3. Jika warga menanyakan tentang iuran/tagihan atau menanyakan "berapa tagihan saya?", sebutkan daftar tagihan dari data di atas beserta jumlah nominal dan statusnya. Jika tidak ada tagihan iuran yang terutang (data kosong), katakan bahwa iuran mereka sudah lunas.
4. Jika warga menanyakan tentang cuaca atau suhu udara, gunakan info dari "cuacaSaatIni" secara akurat.
5. Jika warga menanyakan tentang kegiatan mendatang, kerja bakti, atau agenda warga lainnya, gunakan data dari "kegiatanMendatang".
6. Jika warga menanyakan tentang link menarik, video, post Instagram/YouTube, atau konten dari halaman FYP/Untuk Kamu, gunakan data dari "kontenUntukKamuFyp".
7. Ketika menyertakan link/tautan (seperti link FYP, YouTube, Instagram), Anda WAJIB memformatnya menggunakan markdown link dengan format [Teks Link](URL) (contoh: [Klik untuk Buka](https://...) atau [Lihat Postingan](https://...)) agar sistem aplikasi dapat mendeteksi dan membukanya di webview in-app secara fullscreen. Jangan menuliskan URL mentah.
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
                      text: `${systemPrompt}\n\nUser: ${userQuery}`
                    }
                  ]
                }
              ]
            })
          }
        );

        if (!response.ok) {
          throw new Error(`Gemini API error: ${response.statusText}`);
        }

        const responseData = await response.json();
        const candidateText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (candidateText) {
          text = candidateText.trim();
          
          // Contextual Actions mapping for better UX
          if (q.includes('iuran') || q.includes('tagihan') || q.includes('bayar') || q.includes('kas')) {
            actions = [
              {
                label: '💸 Bayar Iuran Sekarang',
                onClick: () => navigate('/warga/keuangan'),
                primary: true
              }
            ];
          } else if (q.includes('surat') || q.includes('administrasi') || q.includes('domisili') || q.includes('sktm') || q.includes('nikah') || q.includes('pengantar')) {
            actions = [
              {
                label: '📄 Ajukan Surat Baru',
                onClick: () => navigate('/warga/surat'),
                primary: true
              }
            ];
          } else if (q.includes('kegiatan') || q.includes('pengumuman') || q.includes('kerja bakti') || q.includes('acara') || q.includes('ronda')) {
            actions = [
              {
                label: '📢 Buka Pengumuman Lengkap',
                onClick: () => navigate('/warga/pengumuman'),
                primary: true
              }
            ];
          } else if (q.includes('registrasi') || q.includes('profil') || q.includes('ktp') || q.includes('kk') || q.includes('validasi') || q.includes('data')) {
            actions = [
              {
                label: '⚙️ Lengkapi Profil & PIN',
                onClick: () => navigate('/warga/setting'),
                primary: true
              }
            ];
          } else if (q.includes('keluarga') || q.includes('anggota') || q.includes('kk')) {
            actions = [
              {
                label: '👨‍👩‍👧‍👦 Detail Keluarga',
                onClick: () => navigate('/warga/keluarga'),
                primary: true
              }
            ];
          }
        } else {
          throw new Error("Empty response from Gemini API");
        }
      } catch (error) {
        console.error("Gemini API Error, falling back to rule-based response:", error);
      }
    }

    // Fallback rule-based matching if Gemini is not available or failed
    if (!text) {
      const userNameClean = user?.name?.split(' ')[0] || 'Warga';
      
      // 1. BILLS / FINANCIAL REMINDERS
      if (q.includes('iuran') || q.includes('tagihan') || q.includes('bayar') || q.includes('kas')) {
        if (unpaidBills.length === 0) {
          text = `Wah, luar biasa **${userNameClean}-San**! 💖 Setelah Vira cek di sistem keuangan RW 011, **seluruh tagihan iuran bulan ini sudah LUNAS**. \n\nTerima kasih banyak atas partisipasi aktif dalam mendukung program pembangunan lingkungan kita! Semoga berkah selalu ya, **${userNameClean}-San**. Ada lagi yang bisa Vira bantu?`;
        } else {
          const totalUnpaid = unpaidBills.reduce((acc, curr) => acc + (curr.amount || 0), 0);
          const formatRupiah = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

          text = `Halo **${userNameClean}-San**, Vira mendeteksi ada **${unpaidBills.length} tagihan iuran** yang belum terbayar:\n\n${unpaidBills.map((b, idx) => `${idx + 1}. **${b.title || b.description || 'Iuran Bulanan'}** — **${formatRupiah(b.amount || 0)}** (Status: *${b.status}*)`).join('\n')}\n\n**Total Tunggakan:** **${formatRupiah(totalUnpaid)}**\n\nYuk **${userNameClean}-San**, lakukan pembayaran iuran tepat waktu demi kelancaran operasional RT ${user?.rt_id || '011'}. Pembayaran bisa dilakukan langsung melalui menu **RuangPay** ya!`;

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
          letterStatusText = `\n\nSaat ini **${userNameClean}-San** memiliki **${activePending.length} pengajuan surat yang sedang diproses** oleh RT/RW:\n` +
            activePending.map((l, idx) => `${idx + 1}. **${l.jenis || 'Surat Pengantar'}** (${l.nomor || 'Dalam Antrean'}) — *Status: ${l.status}*`).join('\n');
        } else {
          letterStatusText = `\n\nSaat ini tidak ada pengajuan surat yang sedang mengantre.`;
        }

        text = `Tentu **${userNameClean}-San**, pengurusan surat di lingkungan RT ${user?.rt_id || '011'} / RW 011 kini sangat praktis! ✨\n\nBerikut beberapa surat pengantar yang bisa diajukan secara online:\n1. **Surat Pengantar Domisili** (Syarat: Lengkapi profil & KTP)\n2. **Surat Keterangan Tidak Mampu (SKTM)** (Untuk keperluan sekolah/bansos)\n3. **Surat Pengantar Nikah** (N1-N4)\n4. **Surat Keterangan Usaha (SKU)** (Untuk izin usaha atau pengajuan KUR)\n\n*Proses verifikasi oleh Ketua RT & RW biasanya memakan waktu maksimal 1x24 jam sejak diajukan.* ${letterStatusText}\n\nApakah **${userNameClean}-San** ingin membuat pengajuan surat baru sekarang?`;

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
        const activeKegiatans = kegiatans.filter((k: any) => {
          if (!k.date) return true;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const eventDate = new Date(k.date);
          eventDate.setHours(0, 0, 0, 0);
          return eventDate >= yesterday;
        });

        if (latestAnnouncements.length === 0 && activeKegiatans.length === 0) {
          text = `Saat ini belum ada jadwal kegiatan atau pengumuman resmi terbaru yang disematkan oleh pengurus RT ${user?.rt_id || '011'} / RW 011, **${userNameClean}-San**. \n\nVira akan langsung mengabari **${userNameClean}-San** melalui notifikasi begitu ada info kegiatan terbaru (seperti kerja bakti, siskamling, atau rapat warga) ya!`;
        } else {
          let partsList: string[] = [];
          if (latestAnnouncements.length > 0) {
            partsList.push(`📢 **Pengumuman Terbaru**:\n${latestAnnouncements.map((a, idx) => `🔥 **${a.title}**\n📝 *Deskripsi:* ${a.content || a.description || 'Cek menu pengumuman untuk detail.'}`).join('\n')}`);
          }
          if (activeKegiatans.length > 0) {
            partsList.push(`📅 **Kegiatan Mendatang**:\n${activeKegiatans.map((k, idx) => `✨ **${k.title}**\n📅 *Waktu:* ${k.date} pukul ${k.time || 'Segera'}\n📍 *Lokasi:* ${k.location || 'RW 011'}\n📝 *Deskripsi:* ${k.description || '-'}`).join('\n\n')}`);
          }

          text = `Berikut adalah **kegiatan dan pengumuman terbaru** di lingkungan RW 011, **${userNameClean}-San**:\n\n${partsList.join('\n\n')}\n\nVira sarankan **${userNameClean}-San** untuk selalu memantau papan pengumuman agar tidak ketinggalan agenda seru warga ya!`;

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
        const noKK = user?.noKK || user?.extractedData?.nomorKK;

        text = `Halo **${userNameClean}-San**, keamanan data warga adalah prioritas utama Vira! 🛡️\n\n**Status Kelengkapan Akun **${userNameClean}-San**:**\n* Foto KTP & KK: **${user?.registrationStatus === 'approved' ? '✅ Terverifikasi' : '⏳ Menunggu Validasi'}**\n* Email Pemulihan: **${user?.email ? '✅ Terdaftar' : '❌ Belum Dilengkapi'}**\n* PIN Keamanan: **${user?.pin ? '✅ Aktif' : '❌ Belum Dibuat'}**\n* RT / RW: **RT ${user?.rt_id || '011'} / RW 011**\n* Nomor KK: **${noKK ? `••••••••••••${noKK.slice(-4)}` : 'Belum Terhubung'}** (${familyMembers.length} Anggota Terdaftar)\n\n${!isComplete ? `⚠️ *Vira sangat menyarankan **${userNameClean}-San** untuk segera melengkapi Email dan PIN Keamanan di menu pengaturan agar transaksi kas dan pengajuan surat berjalan lancar & aman.*` : `Luar biasa! Akun **${userNameClean}-San** sudah 100% aman & terverifikasi.`}`;

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
        const noKK = user?.noKK || user?.extractedData?.nomorKK;
        if (familyMembers.length === 0) {
          text = `Vira mendeteksi nomor KK **${userNameClean}-San** **(${noKK ? `••••••••••••${noKK.slice(-4)}` : 'N/A'})** belum terhubung dengan data anggota keluarga lain di sistem digital RW 011.\n\nSilakan hubungi Ketua RT ${user?.rt_id} untuk mendaftarkan anggota keluarga **${userNameClean}-San** agar terintegrasi secara otomatis ya!`;
        } else {
          text = `Tentu **${userNameClean}-San**, berikut adalah daftar **Anggota Keluarga** yang terdaftar di database digital RW 011 (No. KK: **${noKK ? `••••••••••••${noKK.slice(-4)}` : 'N/A'}**):\n\n${familyMembers.map((m, idx) => `${idx + 1}. **${m.nama || m.namaLengkap}** (${m.hubungan || 'Anggota'}) — NIK: *${m.nik ? `••••••••••••${m.nik.slice(-4)}` : 'N/A'}*`).join('\n')}\n\nSemua data di atas telah terverifikasi secara resmi oleh RT ${user?.rt_id} / RW 011.`;

          actions = [
            {
              label: '👨‍👩‍👧‍👦 Detail Keluarga',
              onClick: () => navigate('/warga/keluarga'),
              primary: true
            }
          ];
        }
      }
      // 6. WEATHER / CUACA
      else if (q.includes('cuaca') || q.includes('suhu') || q.includes('hujan') || q.includes('panas') || q.includes('dingin') || q.includes('cerah') || q.includes('mendung')) {
        if (weather) {
          text = `Saat ini cuaca di sekitar **${weather.city}** terdeteksi **${getWeatherDetails(weather.conditionCode).label}** dengan suhu berkisar **${weather.temp}°C**, **${userNameClean}-San**.\n\nJangan lupa persiapkan payung jika ingin bepergian jika cuaca mendung/hujan, dan tetap jaga kesehatan ya! ✨`;
        } else {
          text = `Vira belum bisa mendeteksi cuaca real-time di lokasi **${userNameClean}-San** karena akses geolokasi belum diizinkan atau sedang memuat. Tapi secara umum wilayah RW 011 sedang berawan dengan suhu rata-rata 29-32°C.`;
        }
      }
      // 7. FYP / UNTUK KAMU / LINK PREVIEW
      else if (q.includes('fyp') || q.includes('untuk kamu') || q.includes('konten') || q.includes('video') || q.includes('instagram') || q.includes('youtube') || q.includes('threads') || q.includes('artikel')) {
        if (fypLinks.length === 0) {
          text = `Saat ini belum ada rekomendasi konten/link menarik di menu **Untuk Kamu (FYP)** oleh Admin RW 011, **${userNameClean}-San**. Nanti kalau ada video seru, info Instagram, atau artikel penting, Admin akan menyematkannya di sana!`;
        } else {
          text = `Halo **${userNameClean}-San**, berikut adalah konten terbaru yang dibagikan oleh Admin di menu **Untuk Kamu (FYP)**:\n\n${fypLinks.slice(0, 3).map((f, idx) => `${idx + 1}. **${f.title}** (${f.platform.toUpperCase()})\n📝 *Deskripsi:* ${f.description || '-'}\n🔗 *Link:* [Klik untuk Buka](${f.url})`).join('\n\n')}\n\n**${userNameClean}-San** bisa melihat preview visual lengkapnya langsung di halaman utama Dashboard ya!`;
        }
      }
      // Default fallback welcome
      else {
        text = `Tentu, saya siap membantu. Selamat datang **${userNameClean}-San**, Vira sangat senang bisa menemani dan membantu **${userNameClean}-San** hari ini.\n\nSebagai asisten warga Ruang Warga 011 VSJ, Vira siap mendampingi **${userNameClean}-San** dalam mempermudah administrasi lingkungan kita. Silakan gunakan tombol menu cepat di bawah atau tanyakan apa saja seputar iuran kas, pengumuman terbaru, pengajuan berkas surat pengantar, maupun data keluarga **${userNameClean}-San** ya. Vira akan bantu jelaskan dengan senang hati. ✨`;
      }
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
      const userNameClean = user?.name?.split(' ')[0] || 'Warga';
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        sender: 'vira',
        text: `Aduh ${userNameClean}-San, maaf banget jaringan Vira sedang agak terganggu nih... 🥺 Coba lagi beberapa saat lagi ya ${userNameClean}-San!`,
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

  const parseBold = (rawText: string, sender: 'user' | 'vira'): React.ReactNode[] => {
    return rawText.split('**').map((chunk, cIdx) => {
      if (cIdx % 2 === 1) {
        return (
          <strong key={cIdx} style={{ color: sender === 'user' ? '#fff' : '#1e3a8a', fontWeight: 900 }}>
            {chunk}
          </strong>
        );
      }
      return chunk;
    });
  };

  const renderMessageText = (rawText: string, sender: 'user' | 'vira') => {
    if (!rawText) return '';

    return rawText.split('\n').map((paragraph, pIdx) => {
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;

      while ((match = linkRegex.exec(paragraph)) !== null) {
        const matchIndex = match.index;
        const beforeText = paragraph.substring(lastIndex, matchIndex);
        
        if (beforeText) {
          parts.push(...parseBold(beforeText, sender));
        }

        const linkText = match[1];
        const linkUrl = match[2];

        parts.push(
          <button
            key={`link-${matchIndex}`}
            onClick={() => {
              setActivePreviewUrl(linkUrl);
              setActivePreviewTitle(linkText);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: sender === 'user' ? '#93c5fd' : '#2563eb',
              textDecoration: 'underline',
              padding: 0,
              font: 'inherit',
              cursor: 'pointer',
              fontWeight: 800,
              display: 'inline'
            }}
          >
            {linkText}
          </button>
        );

        lastIndex = linkRegex.lastIndex;
      }

      const remainingText = paragraph.substring(lastIndex);
      if (remainingText) {
        parts.push(...parseBold(remainingText, sender));
      }

      return (
        <p key={pIdx} style={{ margin: pIdx > 0 ? '10px 0 0' : 0 }}>
          {parts}
        </p>
      );
    });
  };

  return (
    <div className="vira-page-container" style={{
      background: onClose ? 'transparent' : '#f8fafc',
      height: onClose ? '100%' : 'calc(100vh - 64px)',
      minHeight: onClose ? 'auto' : 'calc(100vh - 64px)',
      paddingBottom: onClose ? '0' : (isMobile ? '160px' : '80px'),
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Outfit', sans-serif"
    }}>
      {/* HEADER PANEL - GLASSMORPHISM */}
      <div style={{
        background: onClose 
          ? 'linear-gradient(135deg, rgba(30, 58, 138, 0.8) 0%, rgba(59, 130, 246, 0.8) 100%)' 
          : 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
        padding: onClose ? '14px 18px' : '20px 24px',
        paddingTop: onClose 
          ? 'calc(14px + env(safe-area-inset-top, 0px))' 
          : 'calc(20px + env(safe-area-inset-top, 0px))',
        color: '#fff',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 10px 25px rgba(37, 99, 235, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Back button or close button indicator */}
          {!onClose && (
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
                transition: 'all 0.2s',
                marginRight: '4px'
              }}
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <div style={{
              width: onClose ? '38px' : '46px',
              height: onClose ? '38px' : '46px',
              borderRadius: '12px',
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
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150';
                }}
              />
            </div>
            <div style={{
              position: 'absolute',
              bottom: '-1px',
              right: '-1px',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#22c55e',
              border: '2px solid #1e3a8a',
              boxShadow: '0 0 0 2px rgba(34, 197, 94, 0.3)'
            }} />
          </div>
          <div>
            <h2 style={{ fontSize: onClose ? '14px' : '16px', fontWeight: 900, margin: 0, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Vira AI <Sparkles size={13} className="pulse-yellow" style={{ color: '#fbbf24' }} />
            </h2>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)', margin: '1px 0 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Asisten Pintar Warga
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#fff',
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* CHAT AREA */}
      <div
        ref={chatAreaRef}
        style={{
          flex: 1,
          padding: '24px 20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
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
                background: msg.sender === 'user' 
                  ? 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)' 
                  : (onClose ? 'rgba(255, 255, 255, 0.85)' : '#ffffff'),
                color: msg.sender === 'user' ? '#ffffff' : '#1e293b',
                padding: '16px 20px',
                borderRadius: msg.sender === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.03)',
                fontSize: '13.5px',
                lineHeight: '1.6',
                border: msg.sender === 'user' ? 'none' : (onClose ? '1px solid rgba(255, 255, 255, 0.5)' : '1px solid #e2e8f0'),
                whiteSpace: 'pre-line'
              }}
            >
              {/* Parse bold strings and markdown links to support premium in-app browser previews */}
              {renderMessageText(msg.text, msg.sender)}

              {/* Dynamic Action Buttons */}
              {msg.actions && msg.actions.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                  {msg.actions.map((act, actIdx) => (
                    <button
                      key={actIdx}
                      onClick={() => {
                        act.onClick();
                        if (onClose) onClose();
                      }}
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
        background: onClose ? 'rgba(255, 255, 255, 0.65)' : '#ffffff',
        borderTop: '1px solid #e2e8f0',
        padding: '12px 20px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: onClose ? 'sticky' : (isMobile ? 'fixed' : 'sticky'),
        bottom: onClose ? 0 : (isMobile ? (isKeyboardOpen ? 0 : '74px') : 0),
        left: onClose ? 'auto' : 0,
        right: onClose ? 'auto' : 0,
        zIndex: onClose ? 100 : (isMobile ? 10001 : 100)
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

      {/* WEB IN-APP BROWSER PREVIEW MODAL */}
      <AnimatePresence>
        {activePreviewUrl && (
          <>
            <div 
              className="sheet-overlay" 
              style={{ zIndex: 12000, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(12px)' }} 
              onClick={() => {
                setActivePreviewUrl(null);
                setActivePreviewTitle('');
              }} 
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              style={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                background: '#ffffff',
                borderRadius: '32px 32px 0 0',
                height: '92vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 -20px 50px rgba(15,23,42,0.3)',
                zIndex: 12001,
                overflow: 'hidden',
                fontFamily: "'Outfit', sans-serif"
              }}
            >
              {/* Modal Header */}
              <div style={{ 
                padding: '16px 20px', 
                borderBottom: '1px solid #f1f5f9', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                background: '#fff'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: '70%', textAlign: 'left' }}>
                  <span style={{ fontSize: 18 }}>📱</span>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {activePreviewTitle || 'Preview Konten'}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {activePreviewUrl}
                    </div>
                  </div>
                </div>
                
                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => window.open(activePreviewUrl, '_blank')}
                    title="Buka di tab baru"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      border: '1.5px solid #cbd5e1',
                      background: '#fff',
                      color: '#475569',
                      fontWeight: 800,
                      fontSize: 16,
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >
                    ↗️
                  </button>
                  <button 
                    onClick={() => {
                      setActivePreviewUrl(null);
                      setActivePreviewTitle('');
                    }} 
                    style={{ 
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: '#f1f5f9',
                      border: 'none', 
                      color: '#64748b', 
                      fontSize: 14, 
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* WebView Iframe Wrapper */}
              <div style={{ flex: 1, position: 'relative', background: '#f8fafc' }}>
                <iframe
                  src={activePreviewUrl ? getEmbedUrl(activePreviewUrl) : ''}
                  title={activePreviewTitle}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    background: '#ffffff'
                  }}
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                />
                

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
