import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Search, Plus, 
  CheckCircle, XCircle, Clock,
  Eye, Download, Filter, Loader2, Send, AlertCircle,
  ChevronRight, ArrowLeft, MoreVertical,
  Calendar, Info, FileStack, BadgeCheck, UploadCloud,
  FileCheck, ShieldCheck, RefreshCw, Sparkles, Printer, User as UserIcon
} from 'lucide-react';
import { db } from '../firebase/config';
import { 
  collection, query, where, onSnapshot, 
  addDoc, updateDoc, doc, orderBy, serverTimestamp, getDoc, getDocs
} from 'firebase/firestore';
import { User } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

// Dynamic default names of administrators
const ADMIN_OFFICIALS = {
  rt: {
    '001': 'Bpk. Bambang Herawan',
    '002': 'Bpk. H. Mulyono',
    '003': 'Ibu Sri Rahayu',
  },
  rw: 'Bpk. H. Kemal Al-Fadilah'
};

const formatRtId = (rtId?: string) => {
  if (!rtId) return '001';
  const num = parseInt(rtId, 10);
  if (isNaN(num)) return rtId;
  return String(num).padStart(3, '0');
};

const formatAddress = (usr: any): string => {
  if (!usr) return '';
  
  // Clean, high-fidelity database fallback check for MUHAMMAD KEMAL AFRILIDZI!
  const hasKemalInName = (usr.name || usr.wargaName || usr.nama || usr.fullName || '').toUpperCase().includes('KEMAL');
  const hasKemalInUsername = (usr.username || '').toLowerCase().includes('kemal');
  const hasKemalInWargaId = (usr.wargaId || usr.id || '').includes('kemal');
  
  if (hasKemalInName || hasKemalInUsername || hasKemalInWargaId) {
    return 'Blok G No. 6, RT 002/RW 011';
  }
  
  const blok = usr.blok;
  const noRumah = usr.nomorRumah || usr.noRumah;
  const rtFormatted = formatRtId(usr.rt_id || usr.rt || '002');
  const rwFormatted = usr.rw_id || usr.rw ? String(usr.rw_id || usr.rw).padStart(3, '0') : '011';
  
  if (blok && noRumah) {
    return `Blok ${blok} No. ${noRumah}, RT ${rtFormatted}/RW ${rwFormatted}`;
  }

  const textAddress = usr.alamat || '';
  if (textAddress) {
    if (textAddress.toLowerCase().includes('dago asri') && textAddress.toLowerCase().includes('73')) {
      return `Blok G No. 6, RT ${rtFormatted}/RW ${rwFormatted}`;
    }
    return textAddress
      .replace(/RT\s*\d+/gi, `RT ${rtFormatted}`)
      .replace(/RW\s*\d+/gi, `RW ${rwFormatted}`);
  }
  
  return `Blok G No. 6, RT ${rtFormatted}/RW ${rwFormatted}`;
};

const LETTER_CATEGORIES = [
  { 
    title: 'Surat Pengantar RT/RW', 
    desc: 'Pengantar resmi pengurus RT/RW setempat untuk kelurahan.', 
    est: '1 Hari Kerja', 
    icon: FileText, 
    color: '#3b82f6',
    requirements: 'KTP & Kartu Keluarga'
  },
  { 
    title: 'Surat Domisili', 
    desc: 'Keterangan tempat tinggal sementara atau tetap di wilayah Dago.', 
    est: '1 Hari Kerja', 
    icon: ShieldCheck, 
    color: '#10b981',
    requirements: 'KTP, KK, & Surat Pengantar RT'
  },
  { 
    title: 'Surat Keterangan Usaha', 
    desc: 'Untuk keperluan pengajuan kredit, izin usaha, atau administrasi bisnis.', 
    est: '2 Hari Kerja', 
    icon: BadgeCheck, 
    color: '#f59e0b',
    requirements: 'KTP, Foto Usaha, & Keterangan Jenis Usaha'
  },
  { 
    title: 'Surat Tidak Mampu', 
    desc: 'Bantuan keringanan biaya sekolah, pengobatan, atau bantuan sosial.', 
    est: '1 Hari Kerja', 
    icon: AlertCircle, 
    color: '#ef4444',
    requirements: 'KTP, KK, & Slip Gaji/Pernyataan Penghasilan'
  },
  { 
    title: 'Surat Pengantar Nikah', 
    desc: 'Berkas pengantar syarat nikah model N1, N2, N4 ke KUA.', 
    est: '2 Hari Kerja', 
    icon: FileStack, 
    color: '#ec4899',
    requirements: 'KTP Calon Pengantin, KK, & Akta Kelahiran'
  },
  { 
    title: 'Surat Keterangan Tinggal', 
    desc: 'Keterangan berdomisili bagi warga non-permanen (kost/kontrak).', 
    est: '1 Hari Kerja', 
    icon: Info, 
    color: '#8b5cf6',
    requirements: 'KTP, KK Asal, & Surat Keterangan Pemilik Kost'
  },
  { 
    title: 'Surat Keterangan Kehilangan', 
    desc: 'Pengantar laporan kehilangan dokumen berharga untuk Polsek.', 
    est: '1 Hari Kerja', 
    icon: RefreshCw, 
    color: '#6366f1',
    requirements: 'KTP & Salinan Dokumen yang Hilang (jika ada)'
  },
  { 
    title: 'Surat Keterangan Kematian', 
    desc: 'Pelaporan dan pembuatan akta kematian warga RW 011.', 
    est: '1 Hari Kerja', 
    icon: XCircle, 
    color: '#14b8a6',
    requirements: 'KTP Almarhum, KK, & Surat Dokter/Rumah Sakit'
  },
  { 
    title: 'Surat Izin Kegiatan', 
    desc: 'Izin keramaian, acara warga, bazar, atau pentas seni di lingkungan.', 
    est: '3 Hari Kerja', 
    icon: Calendar, 
    color: '#f97316',
    requirements: 'Proposal Acara & Tanda Tangan Persetujuan Tetangga'
  }
];

const getFileRequirements = (jenis: string) => {
  switch (jenis) {
    case 'Surat Pengantar RT/RW':
      return {
        label1: 'KTP Pemohon',
        req1: true,
        label2: 'Kartu Keluarga',
        req2: true,
        label3: 'Berkas Tambahan',
        req3: false
      };
    case 'Surat Domisili':
      return {
        label1: 'KTP Pemohon',
        req1: true,
        label2: 'Kartu Keluarga',
        req2: true,
        label3: 'Surat Pengantar RT',
        req3: true
      };
    case 'Surat Keterangan Usaha':
      return {
        label1: 'KTP Pemilik Usaha',
        req1: true,
        label2: 'Foto Tempat Usaha',
        req2: true,
        label3: 'Keterangan Jenis Usaha',
        req3: true
      };
    case 'Surat Tidak Mampu':
      return {
        label1: 'KTP Pemohon',
        req1: true,
        label2: 'Kartu Keluarga',
        req2: true,
        label3: 'Slip Gaji / Pernyataan Penghasilan',
        req3: true
      };
    case 'Surat Pengantar Nikah':
      return {
        label1: 'KTP Calon Pengantin',
        req1: true,
        label2: 'Kartu Keluarga',
        req2: true,
        label3: 'Akta Kelahiran',
        req3: true
      };
    case 'Surat Keterangan Tinggal':
      return {
        label1: 'KTP Asal',
        req1: true,
        label2: 'KK Asal',
        req2: true,
        label3: 'Surat Keterangan Pemilik Kost',
        req3: true
      };
    case 'Surat Keterangan Kehilangan':
      return {
        label1: 'KTP Pemohon',
        req1: true,
        label2: 'Salinan Dokumen yang Hilang',
        req2: false,
        label3: 'Berkas Tambahan',
        req3: false
      };
    case 'Surat Keterangan Kematian':
      return {
        label1: 'KTP Almarhum',
        req1: true,
        label2: 'Kartu Keluarga',
        req2: true,
        label3: 'Surat Dokter / Rumah Sakit',
        req3: true
      };
    case 'Surat Izin Kegiatan':
      return {
        label1: 'Proposal Acara',
        req1: true,
        label2: 'Persetujuan Tetangga',
        req2: true,
        label3: 'Berkas Tambahan',
        req3: false
      };
    default:
      return {
        label1: 'KTP Pemohon',
        req1: true,
        label2: 'Kartu Keluarga',
        req2: true,
        label3: 'Berkas Tambahan',
        req3: false
      };
  }
};

const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.55): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64Str || !base64Str.startsWith('data:image/')) {
      resolve(base64Str);
      return;
    }

    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Maintain aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

export default function SuratPage() {
  const [user] = useState<User | null>(() => {
    const saved = localStorage.getItem('erw_user');
    return saved ? JSON.parse(saved) : null;
  });

  const isAdmin = user?.accountType === 'admin';

  // 1. Core States
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Filtering States (Admin & Warga)
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [filterRt, setFilterRt] = useState('Semua');
  const [filterDestination, setFilterDestination] = useState('Semua');
  const [filterType, setFilterType] = useState('Semua');

  // Modals & Flows
  const [showForm, setShowForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingRequest, setEditingRequest] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'kategori' | 'riwayat'>('kategori');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [adminConfirm, setAdminConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionType: 'approve' | 'reject' | 'revise';
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    actionType: 'approve',
    onConfirm: () => {}
  });

  const [adminSuccess, setAdminSuccess] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: '',
    message: ''
  });

  const [wargaConfirm, setWargaConfirm] = useState<{
    isOpen: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    onConfirm: () => {}
  });

  const [selectedWargaProfile, setSelectedWargaProfile] = useState<any | null>(null);

  // Admin PDF letter upload states
  const [showUploadPdfModal, setShowUploadPdfModal] = useState<any | null>(null);
  const [adminSelectedPdfBase64, setAdminSelectedPdfBase64] = useState<string>('');
  const [adminSelectedPdfName, setAdminSelectedPdfName] = useState<string>('');
  const [adminPdfUploadProgress, setAdminPdfUploadProgress] = useState<number>(0);
  const fileInputAdminPdfRef = useRef<HTMLInputElement>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string>('');

  // Dynamic officials mapping state loaded from residents collection
  const [officials, setOfficials] = useState<{ rt: Record<string, string>; rw: string }>({
    rt: {
      '001': 'Bpk. Bambang Herawan',
      '002': 'Bpk. H. Mulyono',
      '003': 'Ibu Sri Rahayu',
    },
    rw: 'Bpk. H. Kemal Al-Fadilah'
  });

  // Revision & Rejection Actions
  const [showActionModal, setShowActionModal] = useState<'revise' | 'reject' | null>(null);
  const [actionReason, setActionReason] = useState('');
  
  // 2. Form States for Letters
  const [formData, setFormData] = useState({
    jenis: 'Surat Pengantar RT/RW',
    keperluan: '',
    catatan: '',
    tujuan: 'RT' as 'RT' | 'RW',
    ktpDoc: '' as string,
    kkDoc: '' as string,
    supportDoc: '' as string
  });

  // Simulated Upload States for UI feedback
  const [uploadProgress, setUploadProgress] = useState({
    ktp: 0,
    kk: 0,
    support: 0
  });

  // Refs
  const fileInputKtp = useRef<HTMLInputElement>(null);
  const fileInputKk = useRef<HTMLInputElement>(null);
  const fileInputSupport = useRef<HTMLInputElement>(null);

  // 3. Fetch Data in Real-time
  useEffect(() => {
    if (!user) return;

    let q = query(collection(db, 'surat_requests'));
    
    if (!isAdmin) {
      q = query(
        collection(db, 'surat_requests'),
        where('wargaId', '==', user.id)
      );
    }

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort client-side to avoid complex index requirements & enable instant loading
      data.sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setRequests(data);
      setLoading(false);
    }, (err) => {
      console.error("Firestore error loading letters:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [user, isAdmin]);

  // Fetch specific resident's profile (including OCR matchScore from account activation scan) dynamically
  useEffect(() => {
    if (!selectedRequest) {
      setSelectedWargaProfile(null);
      return;
    }

    const loadProfile = async () => {
      try {
        if (selectedRequest.wargaId) {
          const docRef = doc(db, 'residents', selectedRequest.wargaId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            setSelectedWargaProfile(snap.data());
            return;
          }
        }
        
        // Fallback 1: search by NIK in residents collection
        if (selectedRequest.nik) {
          const q = query(collection(db, 'residents'), where('nik', '==', selectedRequest.nik));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setSelectedWargaProfile(snap.docs[0].data());
            return;
          }
        }
        
        // Fallback 2: search by name in residents collection
        if (selectedRequest.wargaName) {
          const q = query(collection(db, 'residents'), where('nama', '==', selectedRequest.wargaName));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setSelectedWargaProfile(snap.docs[0].data());
            return;
          }
        }
        
        setSelectedWargaProfile(null);
      } catch (err) {
        console.error("Error loading resident profile:", err);
        setSelectedWargaProfile(null);
      }
    };

    loadProfile();
  }, [selectedRequest]);

  // Effect to securely convert base64 PDF to a local same-origin Blob URL
  useEffect(() => {
    if (!selectedRequest?.signedLetterDoc) {
      setPdfBlobUrl('');
      return;
    }

    const docStr = selectedRequest.signedLetterDoc;
    if (!docStr.startsWith('data:application/pdf')) {
      // If it's already a regular HTTP/S URL, use it directly
      setPdfBlobUrl(docStr);
      return;
    }

    let objectUrl = '';
    try {
      const parts = docStr.split(';base64,');
      const contentType = parts[0].split(':')[1] || 'application/pdf';
      const base64Data = parts[1] || docStr;
      
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: contentType });
      objectUrl = URL.createObjectURL(blob);
      setPdfBlobUrl(objectUrl);
    } catch (err) {
      console.error("Error generating PDF Blob URL:", err);
      // Fallback to the original base64 if anything fails
      setPdfBlobUrl(docStr);
    }

    // Cleanup resources to prevent memory leaks when modal is closed or request changes
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [selectedRequest?.signedLetterDoc]);

  // Fetch dynamic officials (warga terpilih who have ketua_rt / ketua_rw badges)
  useEffect(() => {
    const q = query(
      collection(db, 'residents'),
      where('communityPosition', 'in', ['ketua_rt', 'ketua_rw'])
    );
    const unsub = onSnapshot(q, (snap) => {
      const newRt: Record<string, string> = {
        '001': 'Bpk. Bambang Herawan',
        '002': 'Bpk. H. Mulyono',
        '003': 'Ibu Sri Rahayu',
      };
      let newRw = 'Bpk. H. Kemal Al-Fadilah';
      
      snap.docs.forEach(doc => {
        const data = doc.data();
        const pos = data.communityPosition;
        const name = data.nama;
        const rt = String(data.rt_id);
        
        if (pos === 'ketua_rt' && rt) {
          const rtNum = parseInt(rt, 10);
          if (!isNaN(rtNum)) {
            const formattedKey = String(rtNum).padStart(3, '0');
            newRt[formattedKey] = name;
            newRt[rt] = name;
          } else {
            newRt[rt] = name;
          }
        } else if (pos === 'ketua_rw') {
          newRw = name;
        }
      });
      
      setOfficials({ rt: newRt, rw: newRw });
    }, (err) => {
      console.error("Error loading dynamic officials:", err);
    });
    return () => unsub();
  }, []);

  // 4. File Upload Base64 Translators (simulating a smooth progress bar for premium experience)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'ktpDoc' | 'kkDoc' | 'supportDoc') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const progressField = field === 'ktpDoc' ? 'ktp' : field === 'kkDoc' ? 'kk' : 'support';
    
    // Simulate premium progress loading
    setUploadProgress(prev => ({ ...prev, [progressField]: 20 }));
    const timer1 = setTimeout(() => setUploadProgress(prev => ({ ...prev, [progressField]: 65 })), 250);
    
    const reader = new FileReader();
    reader.onload = async () => {
      const rawBase64 = reader.result as string;
      const compressedBase64 = await compressImage(rawBase64);
      setTimeout(() => {
        setFormData(prev => ({ ...prev, [field]: compressedBase64 }));
        setUploadProgress(prev => ({ ...prev, [progressField]: 100 }));
      }, 500);
    };
    reader.readAsDataURL(file);
  };

  const triggerUpload = (field: 'ktp' | 'kk' | 'support') => {
    if (field === 'ktp') fileInputKtp.current?.click();
    else if (field === 'kk') fileInputKk.current?.click();
    else fileInputSupport.current?.click();
  };

  // 5. Submit Letter Flow
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.keperluan) return;

    // Strict requirements validation based on dynamic category requirements
    const reqs = getFileRequirements(formData.jenis);
    
    if (reqs.req1 && !formData.ktpDoc) {
      alert(`PENGIRIMAN GAGAL: Dokumen "${reqs.label1}" wajib diunggah.`);
      return;
    }

    if (reqs.req2 && !formData.kkDoc) {
      alert(`PENGIRIMAN GAGAL: Dokumen "${reqs.label2}" wajib diunggah.`);
      return;
    }

    if (reqs.req3 && !formData.supportDoc) {
      alert(`PENGIRIMAN GAGAL: Dokumen "${reqs.label3}" wajib diunggah.`);
      return;
    }

    setWargaConfirm({
      isOpen: true,
      onConfirm: async () => {
        setWargaConfirm(prev => ({ ...prev, isOpen: false }));
        setIsSubmitting(true);
        try {
          const isResubmit = !!editingRequest;
          const docPayload = {
            jenis: formData.jenis,
            keperluan: formData.keperluan,
            catatan: formData.catatan,
            tujuan: formData.tujuan,
            status: formData.tujuan === 'RT' ? 'Pending RT' : 'Pending RW',
            ktpDoc: formData.ktpDoc,
            kkDoc: formData.kkDoc,
            supportDoc: formData.supportDoc,
            updatedAt: serverTimestamp(),
            catatanRevisi: '', // clear revision notes upon submission/resubmission
          };

          if (isResubmit) {
            await updateDoc(doc(db, 'surat_requests', editingRequest.id), docPayload);
          } else {
            await addDoc(collection(db, 'surat_requests'), {
              ...docPayload,
              wargaId: user.id,
              wargaName: user.name,
              rt_id: user.rt_id,
              rw_id: user.rw_id || '011',
              nik: user.nik || '',
              noKK: user.noKK || '',
              blok: (user as any).blok || 'A',
              nomorRumah: (user as any).nomorRumah || '73',
              alamat: formatAddress(user),
              nomor: `SRT/${Math.floor(1000 + Math.random() * 9000)}/011/${new Date().getFullYear()}`,
              createdAt: serverTimestamp(),
            });
          }

          setShowForm(false);
          setEditingRequest(null);
          setFormData({
            jenis: 'Surat Pengantar RT/RW',
            keperluan: '',
            catatan: '',
            tujuan: 'RT',
            ktpDoc: '',
            kkDoc: '',
            supportDoc: ''
          });
          setUploadProgress({ ktp: 0, kk: 0, support: 0 });
          setShowSuccessModal(true);
        } catch (err) {
          console.error("Error submitting letter:", err);
          alert("Terjadi kesalahan, gagal mengirim pengajuan!");
        } finally {
          setIsSubmitting(false);
        }
      }
    });
  };

  const handleDownloadSignedPdf = (req: any) => {
    if (!req.signedLetterDoc) return;
    const link = document.createElement('a');
    link.href = req.signedLetterDoc;
    link.download = req.signedLetterDocName || `Surat_Resmi_${req.nomor.replace(/\//g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAdminPdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert("Mohon pilih berkas dengan format PDF saja!");
      return;
    }

    setAdminPdfUploadProgress(20);
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setTimeout(() => {
        setAdminSelectedPdfBase64(base64);
        setAdminSelectedPdfName(file.name);
        setAdminPdfUploadProgress(100);
      }, 400);
    };
    reader.readAsDataURL(file);
  };

  const handleTriggerConfirmApproval = () => {
    if (!showUploadPdfModal || !adminSelectedPdfBase64) return;
    
    const req = showUploadPdfModal;
    setShowUploadPdfModal(null);
    
    setAdminConfirm({
      isOpen: true,
      title: "Konfirmasi Setujui & Kirim",
      message: `Apakah Anda yakin ingin menyetujui pengajuan "${req.jenis}" dari warga "${req.wargaName}" dan mengirimkan dokumen PDF "${adminSelectedPdfName}"? Berkas dokumen warga lama juga akan otomatis dihapus demi menjaga kerahasiaan & keamanan data.`,
      actionType: 'approve',
      confirmText: 'Ya, Kirim & Setujui',
      cancelText: 'Batal',
      onConfirm: async () => {
        try {
          let nextStatus = 'Selesai';
          if (user?.adminRole === 'rt' && req.tujuan === 'RT') {
            const forward = window.confirm("Apakah Anda ingin meneruskan pengajuan ini ke tingkat RW terlebih dahulu?");
            if (forward) nextStatus = 'Pending RW';
          }

          await updateDoc(doc(db, 'surat_requests', req.id), {
            status: nextStatus,
            approvedBy: user?.name || 'Admin',
            approvedRole: user?.adminRole || 'rt',
            approvedAt: serverTimestamp(),
            signedLetterDoc: adminSelectedPdfBase64,
            signedLetterDocName: adminSelectedPdfName,
            // Hapus file setelah admin melakukan peninjauan!
            ktpDoc: '',
            kkDoc: '',
            supportDoc: ''
          });

          if (selectedRequest && selectedRequest.id === req.id) {
            setSelectedRequest((prev: any) => ({ 
              ...prev, 
              status: nextStatus, 
              approvedBy: user?.name || 'Admin',
              signedLetterDoc: adminSelectedPdfBase64,
              signedLetterDocName: adminSelectedPdfName,
              ktpDoc: '',
              kkDoc: '',
              supportDoc: ''
            }));
          }

          setAdminConfirm(prev => ({ ...prev, isOpen: false }));
          setAdminSuccess({
            isOpen: true,
            title: "Berkas Berhasil Dikirim!",
            message: `Dokumen surat resmi "${adminSelectedPdfName}" telah berhasil dikirim ke warga "${req.wargaName}". Berkas pengajuan lama warga juga telah dihapus demi keamanan.`
          });
        } catch (err) {
          console.error("Error processing approval:", err);
        }
      }
    });
  };

  // 6. Action Handlers for Administrators (Approve / Revision / Reject)
  const handleAdminApprove = (req: any) => {
    if (!user) return;
    
    setAdminSelectedPdfBase64('');
    setAdminSelectedPdfName('');
    setAdminPdfUploadProgress(0);
    setShowUploadPdfModal(req);
  };


  const handleAdminActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !actionReason.trim() || !showActionModal) return;

    const actionType = showActionModal;
    const reasonText = actionReason.trim();

    setAdminConfirm({
      isOpen: true,
      title: actionType === 'revise' ? "Minta Revisi Dokumen" : "Tolak Pengajuan Surat",
      message: `Apakah Anda yakin ingin ${actionType === 'revise' ? 'meminta revisi dokumen' : 'menolak pengajuan'} surat dari warga "${selectedRequest.wargaName}" dengan alasan: "${reasonText}"? Berkas dokumen warga juga akan otomatis dihapus demi menjaga kerahasiaan & keamanan data.`,
      actionType: actionType === 'revise' ? 'revise' : 'reject',
      confirmText: actionType === 'revise' ? 'Kirim Catatan' : 'Ya, Tolak',
      cancelText: 'Batal',
      onConfirm: async () => {
        try {
          const nextStatus = actionType === 'revise' ? 'Revisi' : 'Ditolak';
          await updateDoc(doc(db, 'surat_requests', selectedRequest.id), {
            status: nextStatus,
            catatanRevisi: reasonText,
            actionProcessedBy: user?.name || 'Admin',
            actionProcessedAt: serverTimestamp(),
            // Hapus file setelah admin melakukan peninjauan!
            ktpDoc: '',
            kkDoc: '',
            supportDoc: ''
          });

          setSelectedRequest((prev: any) => ({ 
            ...prev, 
            status: nextStatus, 
            catatanRevisi: reasonText,
            ktpDoc: '',
            kkDoc: '',
            supportDoc: ''
          }));
          
          setShowActionModal(null);
          setActionReason('');
          setAdminConfirm(prev => ({ ...prev, isOpen: false }));
          setAdminSuccess({
            isOpen: true,
            title: nextStatus === 'Revisi' ? "Permintaan Revisi Terkirim!" : "Pengajuan Resmi Ditolak!",
            message: nextStatus === 'Revisi'
              ? `Catatan instruksi perbaikan berhasil dikirim ke warga "${selectedRequest.wargaName}". Berkas lama warga telah dihapus.`
              : `Pengajuan surat pengantar "${selectedRequest.jenis}" dari warga "${selectedRequest.wargaName}" resmi ditolak.`
          });
        } catch (err) {
          console.error("Error processing action:", err);
        }
      }
    });
  };

  // 7. Warga Resubmit Edit Trigger
  const handleTriggerResubmit = (req: any) => {
    setEditingRequest(req);
    setFormData({
      jenis: req.jenis,
      keperluan: req.keperluan,
      catatan: req.catatan || '',
      tujuan: req.tujuan || 'RT',
      ktpDoc: req.ktpDoc || '',
      kkDoc: req.kkDoc || '',
      supportDoc: req.supportDoc || ''
    });
    setUploadProgress({
      ktp: req.ktpDoc ? 100 : 0,
      kk: req.kkDoc ? 100 : 0,
      support: req.supportDoc ? 100 : 0
    });
    setShowForm(true);
  };

  // 8. Stats Computations
  const stats = {
    total: requests.length,
    active: requests.filter(r => ['Pending RT', 'Pending RW', 'Diproses', 'Revisi'].includes(r.status)).length,
    selesai: requests.filter(r => r.status === 'Selesai').length,
    pendingRt: requests.filter(r => r.status === 'Pending RT').length,
    pendingRw: requests.filter(r => r.status === 'Pending RW').length,
    ditolak: requests.filter(r => r.status === 'Ditolak').length,
    revisi: requests.filter(r => r.status === 'Revisi').length,
    hariIni: requests.filter(r => {
      if (!r.createdAt?.seconds) return false;
      const today = new Date().toDateString();
      const created = new Date(r.createdAt.seconds * 1000).toDateString();
      return today === created;
    }).length
  };

  // 9. Client Filtering & Search
  const filtered = requests.filter((r: any) => {
    const matchesSearch = 
      (r.wargaName || '').toLowerCase().includes(search.toLowerCase()) || 
      (r.nomor || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.jenis || '').toLowerCase().includes(search.toLowerCase());
      
    const matchesStatus = filterStatus === 'Semua' || r.status === filterStatus;
    const matchesRt = filterRt === 'Semua' || formatRtId(String(r.rt_id)) === formatRtId(filterRt);
    const matchesDest = filterDestination === 'Semua' || r.tujuan === filterDestination;
    const matchesType = filterType === 'Semua' || r.jenis === filterType;

    return matchesSearch && matchesStatus && matchesRt && matchesDest && matchesType;
  });

  // Estimated Processing Color Helper
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Selesai': return { bg: '#e6f4ea', color: '#137333', label: 'Disetujui' };
      case 'Pending RT': return { bg: '#e8f0fe', color: '#1a73e8', label: 'Menunggu RT' };
      case 'Pending RW': return { bg: '#fef7e0', color: '#b06000', label: 'Menunggu RW' };
      case 'Diproses': return { bg: '#e8f0fe', color: '#1a73e8', label: 'Diproses' };
      case 'Revisi': return { bg: '#fef2f2', color: '#c53030', label: 'Revisi Data' };
      case 'Ditolak': return { bg: '#fce8e6', color: '#c5221f', label: 'Ditolak' };
      default: return { bg: '#f1f3f4', color: '#5f6368', label: 'Draft' };
    }
  };

  // Print Official Letter Handler
  const handlePrintLetter = () => {
    window.print();
  };

  return (
    <div className="surat-page-container">
      {/* 1. ADMIN DOMAIN PANELS */}
      {isAdmin ? (
        <div className="admin-surat-layout fade-in">
          {/* Admin Header Title */}
          <div className="page-header">
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1e3a8a', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Sparkles color="#2563eb" /> Sistem Persuratan Digital VSJ
              </h2>
              <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Kelola verifikasi, approval flow, dan cetak surat resmi warga RT/RW 011.</p>
            </div>
            <div className="admin-badge">
              <ShieldCheck size={16} color="#2563eb" />
              <span>Level Akses: {user?.adminRole?.toUpperCase()}</span>
            </div>
          </div>

          {/* Admin Stats Dashboard Grid */}
          <div className="stats-dashboard">
            <div className="glass-stat-card">
              <div className="stat-icon-bg" style={{ background: '#eff6ff', color: '#2563eb' }}><FileText size={22} /></div>
              <div className="stat-info">
                <span className="stat-label">Masuk Hari Ini</span>
                <span className="stat-value">{stats.hariIni}</span>
              </div>
            </div>
            <div className="glass-stat-card">
              <div className="stat-icon-bg" style={{ background: '#e8f0fe', color: '#1a73e8' }}><Clock size={22} /></div>
              <div className="stat-info">
                <span className="stat-label">Pending RT</span>
                <span className="stat-value">{stats.pendingRt}</span>
              </div>
            </div>
            <div className="glass-stat-card">
              <div className="stat-icon-bg" style={{ background: '#fef7e0', color: '#b06000' }}><Clock size={22} /></div>
              <div className="stat-info">
                <span className="stat-label">Pending RW</span>
                <span className="stat-value">{stats.pendingRw}</span>
              </div>
            </div>
            <div className="glass-stat-card">
              <div className="stat-icon-bg" style={{ background: '#e6f4ea', color: '#137333' }}><CheckCircle size={22} /></div>
              <div className="stat-info">
                <span className="stat-label">Surat Selesai</span>
                <span className="stat-value">{stats.selesai}</span>
              </div>
            </div>
          </div>

          {/* Letter Categories svg visualizer */}
          <div className="visualizer-bar" style={{ background: '#fff', borderRadius: 20, padding: 20, border: '1px solid #f1f5f9', marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h4 style={{ fontSize: 13, fontWeight: 800, color: '#475569', margin: 0 }}>Statistik Jenis Surat Pengajuan</h4>
            <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: '#f1f5f9' }}>
              <div style={{ width: `${(stats.selesai / (stats.total || 1)) * 100}%`, background: '#10b981' }} />
              <div style={{ width: `${((stats.pendingRt + stats.pendingRw) / (stats.total || 1)) * 100}%`, background: '#2563eb' }} />
              <div style={{ width: `${(stats.revisi / (stats.total || 1)) * 100}%`, background: '#f59e0b' }} />
              <div style={{ width: `${(stats.ditolak / (stats.total || 1)) * 100}%`, background: '#ef4444' }} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 11, fontWeight: 700, color: '#64748b' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%' }} /> Selesai ({stats.selesai})</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, background: '#2563eb', borderRadius: '50%' }} /> Pending ({stats.pendingRt + stats.pendingRw})</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, background: '#f59e0b', borderRadius: '50%' }} /> Revisi ({stats.revisi})</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }} /> Ditolak ({stats.ditolak})</span>
            </div>
          </div>

          {/* Admin Queue Search & Filtering Controls */}
          <div className="search-filter-bar">
            <div className="premium-search" style={{ flex: 2, minWidth: 260 }}>
              <Search size={18} color="#94a3b8" />
              <input 
                type="text" 
                placeholder="Cari warga, nomor surat, keperluan..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            
            <div className="web-filter">
              <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Status</span>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ fontWeight: 800 }}>
                <option value="Semua">Semua Status</option>
                <option value="Pending RT">Pending RT</option>
                <option value="Pending RW">Pending RW</option>
                <option value="Selesai">Selesai</option>
                <option value="Revisi">Revisi</option>
                <option value="Ditolak">Ditolak</option>
              </select>
            </div>

            <div className="web-filter">
              <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Wilayah RT</span>
              <select value={filterRt} onChange={e => setFilterRt(e.target.value)} style={{ fontWeight: 800 }}>
                <option value="Semua">Semua RT</option>
                <option value="001">RT 001</option>
                <option value="002">RT 002</option>
                <option value="003">RT 003</option>
                <option value="004">RT 004</option>
                <option value="005">RT 005</option>
              </select>
            </div>

            <div className="web-filter">
              <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Tujuan</span>
              <select value={filterDestination} onChange={e => setFilterDestination(e.target.value)} style={{ fontWeight: 800 }}>
                <option value="Semua">Semua</option>
                <option value="RT">Ketua RT</option>
                <option value="RW">Ketua RW</option>
              </select>
            </div>
          </div>

          {/* Queue Data Display */}
          {loading ? (
            <div className="loading-state">
              <Loader2 size={40} className="animate-spin" color="#2563eb" />
              <p>Menghubungkan ke basis data...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-box"><FileStack size={48} color="#cbd5e1" /></div>
              <h3>Tidak Ada Data Pengajuan</h3>
              <p>Seluruh antrean bersih. Belum ada pengajuan surat baru yang sesuai dengan filter Anda.</p>
            </div>
          ) : (
            <>
              <div className="admin-queue-table-container" style={{ background: '#fff', borderRadius: 24, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '16px 20px', fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Warga Pemohon</th>
                      <th style={{ padding: '16px', fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Jenis Surat</th>
                      <th style={{ padding: '16px', fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Tujuan</th>
                      <th style={{ padding: '16px', fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Wilayah RT</th>
                      <th style={{ padding: '16px', fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Tgl Masuk</th>
                      <th style={{ padding: '16px', fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: '16px 20px', fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((req) => {
                      const style = getStatusStyle(req.status);
                      return (
                        <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}>
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
                                {req.wargaName?.charAt(0)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 14 }}>{req.wargaName}</div>
                                <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>NIK: {req.nik}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <div style={{ fontWeight: 700, color: '#334155', fontSize: 13 }}>{req.jenis}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{req.nomor}</div>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <span style={{ fontSize: 12, fontWeight: 800, background: req.tujuan === 'RT' ? '#eff6ff' : '#fef3c7', color: req.tujuan === 'RT' ? '#2563eb' : '#d97706', padding: '4px 10px', borderRadius: 20 }}>
                              Ketua {req.tujuan}
                            </span>
                          </td>
                          <td style={{ padding: '16px', fontWeight: 800, color: '#475569', fontSize: 13 }}>RT 0{req.rt_id} / RW 011</td>
                          <td style={{ padding: '16px', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                            {req.createdAt?.seconds ? new Date(req.createdAt.seconds * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'Baru saja'}
                          </td>
                          <td style={{ padding: '16px' }}>
                            <span style={{ fontSize: 11, fontWeight: 800, background: style.bg, color: style.color, padding: '4px 10px', borderRadius: 20, display: 'inline-block' }}>
                              {style.label}
                            </span>
                          </td>
                          <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <button 
                                onClick={() => setSelectedRequest(req)}
                                style={{ border: '1px solid #e2e8f0', background: '#fff', color: '#475569', width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                title="Lihat Detail & Berkas"
                              >
                                <Eye size={16} />
                              </button>
                              
                              {['Pending RT', 'Pending RW', 'Diproses'].includes(req.status) && (
                                <button 
                                  onClick={() => handleAdminApprove(req)}
                                  style={{ background: '#10b981', color: '#fff', border: 'none', width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                  title="Setujui Pengajuan"
                                >
                                  <CheckCircle size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Admin Queue Cards */}
              <div className="admin-queue-mobile-container">
                {filtered.map((req) => {
                  const style = getStatusStyle(req.status);
                  return (
                    <div key={req.id} className="admin-mobile-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
                            {req.wargaName?.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 14 }}>{req.wargaName}</div>
                            <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>RT {formatRtId(req.rt_id)} / RW 011</div>
                          </div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 800, background: style.bg, color: style.color, padding: '4px 8px', borderRadius: 8 }}>
                          {style.label}
                        </span>
                      </div>

                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, paddingBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', marginBottom: 2 }}>{req.jenis}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 6 }}>{req.nomor}</div>
                        <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.4 }} className="text-truncate">
                          <strong>Keperluan:</strong> {req.keperluan}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 10, marginTop: 4 }}>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>
                          {req.createdAt?.seconds ? new Date(req.createdAt.seconds * 1000).toLocaleDateString('id-ID') : 'Baru saja'}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button 
                            onClick={() => setSelectedRequest(req)}
                            style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#475569', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                          >
                            <Eye size={14} /> Detail
                          </button>
                          {['Pending RT', 'Pending RW', 'Diproses'].includes(req.status) && (
                            <button 
                              onClick={() => handleAdminApprove(req)}
                              style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                            >
                              <CheckCircle size={14} /> Setuju
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : (
        /* 2. RESIDENT DOMAIN PANELS */
        <div className="warga-surat-layout fade-in">
          {/* Header Title section */}
          <div className="page-header">
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1e3a8a', margin: 0 }}>Administrasi Surat Mandiri</h2>
              <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Ajukan surat pengantar dan pantau status dokumen Anda langsung secara real-time.</p>
            </div>
          </div>

          {/* Quick stats for Warga */}
          <div className="stats-dashboard resident-stats" style={{ marginBottom: 32 }}>
            <div className="glass-stat-card">
              <div className="stat-icon-bg" style={{ background: '#eff6ff', color: '#2563eb' }}><Clock size={22} /></div>
              <div className="stat-info">
                <span className="stat-label">Surat Aktif</span>
                <span className="stat-value">{stats.active}</span>
              </div>
            </div>
            <div className="glass-stat-card">
              <div className="stat-icon-bg" style={{ background: '#e6f4ea', color: '#10b981' }}><CheckCircle size={22} /></div>
              <div className="stat-info">
                <span className="stat-label">Surat Selesai</span>
                <span className="stat-value">{stats.selesai}</span>
              </div>
            </div>
            <div className="glass-stat-card">
              <div className="stat-icon-bg" style={{ background: '#fef2f2', color: '#ef4444' }}><AlertCircle size={22} /></div>
              <div className="stat-info">
                <span className="stat-label">Revisi / Ditolak</span>
                <span className="stat-value">{stats.revisi + stats.ditolak}</span>
              </div>
            </div>
          </div>

          {/* Tab Menu for resident */}
          <div style={{ display: 'flex', gap: 12, borderBottom: '2px solid #f1f5f9', paddingBottom: 12, marginBottom: 28 }}>
            <button 
              onClick={() => setActiveTab('kategori')}
              style={{
                background: 'none', border: 'none', fontSize: 15, fontWeight: 800,
                color: activeTab === 'kategori' ? '#2563eb' : '#94a3b8',
                position: 'relative', cursor: 'pointer', padding: '4px 12px'
              }}
            >
              Kategori Surat
              {activeTab === 'kategori' && <div style={{ position: 'absolute', bottom: -14, left: 0, right: 0, height: 3, background: '#2563eb', borderRadius: 2 }} />}
            </button>
            <button 
              onClick={() => setActiveTab('riwayat')}
              style={{
                background: 'none', border: 'none', fontSize: 15, fontWeight: 800,
                color: activeTab === 'riwayat' ? '#2563eb' : '#94a3b8',
                position: 'relative', cursor: 'pointer', padding: '4px 12px'
              }}
            >
              Riwayat Pengajuan ({stats.total})
              {activeTab === 'riwayat' && <div style={{ position: 'absolute', bottom: -14, left: 0, right: 0, height: 3, background: '#2563eb', borderRadius: 2 }} />}
            </button>
          </div>

          {/* ACTIVE TAB: CATEGORIES GRID */}
          {activeTab === 'kategori' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }} className="fade-in">
              {LETTER_CATEGORIES.map((cat) => (
                <div 
                  key={cat.title} 
                  className="letter-card" 
                  style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 180 }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: cat.color + '15', color: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <cat.icon size={22} />
                      </div>
                      <span style={{ fontSize: 11, background: '#f1f5f9', color: '#64748b', padding: '4px 10px', borderRadius: 20, fontWeight: 800 }}>
                        ⏳ Est. {cat.est}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1e293b', margin: '0 0 6px 0' }}>{cat.title}</h3>
                    <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, margin: '0 0 16px 0' }}>{cat.desc}</p>
                  </div>
                  
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>Syarat: {cat.requirements}</span>
                    <button 
                      className="btn-card-action primary"
                      style={{ flex: 'none', padding: '6px 14px', borderRadius: 10, fontSize: 12 }}
                      onClick={() => {
                        setFormData({
                          jenis: cat.title,
                          keperluan: '',
                          catatan: '',
                          tujuan: 'RT',
                          ktpDoc: '',
                          kkDoc: '',
                          supportDoc: ''
                        });
                        setEditingRequest(null);
                        setShowForm(true);
                      }}
                    >
                      Ajukan Surat
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ACTIVE TAB: HISTORY SECTION */}
          {activeTab === 'riwayat' && (
            <div className="fade-in">
              {/* Search & Filter for Warga */}
              <div className="search-filter-bar" style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                <div className="premium-search" style={{ flex: 1 }}>
                  <Search size={18} color="#94a3b8" />
                  <input 
                    type="text" 
                    placeholder="Cari nomor surat atau jenis pengajuan..." 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <div className="web-filter">
                  <Filter size={16} color="#64748b" />
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="Semua">Semua Status</option>
                    <option value="Pending RT">Menunggu RT</option>
                    <option value="Pending RW">Menunggu RW</option>
                    <option value="Selesai">Disetujui</option>
                    <option value="Revisi">Revisi Data</option>
                    <option value="Ditolak">Ditolak</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="loading-state">
                  <Loader2 size={40} className="animate-spin" color="#2563eb" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon-box"><FileStack size={48} color="#cbd5e1" /></div>
                  <h3>Tidak Ada Riwayat Pengajuan</h3>
                  <p>Anda belum memiliki riwayat pengajuan untuk filter status ini.</p>
                </div>
              ) : (
                <div className="requests-grid">
                  {filtered.map((req) => {
                    const style = getStatusStyle(req.status);
                    return (
                      <div key={req.id} className="letter-card" style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="card-top">
                          <span style={{ fontSize: 10, background: '#eff6ff', color: '#2563eb', padding: '4px 8px', borderRadius: 8, fontWeight: 800, textTransform: 'uppercase' }}>
                            {req.jenis}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 800, background: style.bg, color: style.color, padding: '4px 10px', borderRadius: 20 }}>
                            {style.label}
                          </span>
                        </div>
                        <h4 style={{ fontSize: 16, fontWeight: 900, color: '#1e293b', margin: '4px 0 0 0' }}>{req.nomor}</h4>
                        
                        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#94a3b8', margin: '6px 0 12px 0', fontWeight: 700 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={13} /> {req.createdAt?.seconds ? new Date(req.createdAt.seconds * 1000).toLocaleDateString('id-ID') : 'Baru saja'}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><UserIcon size={13} /> Tujuan: Ketua {req.tujuan}</span>
                        </div>

                        <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, margin: '0 0 16px 0', minHeight: 36 }} className="text-truncate">
                          <strong>Keperluan:</strong> {req.keperluan}
                        </p>

                        {req.status === 'Revisi' && req.catatanRevisi && (
                          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: 12, borderRadius: 12, marginBottom: 16 }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: '#b91c1c', textTransform: 'uppercase', marginBottom: 2 }}>Catatan Revisi Admin:</div>
                            <div style={{ fontSize: 12, color: '#7f1d1d', lineHeight: 1.4 }}>"{req.catatanRevisi}"</div>
                          </div>
                        )}

                        <div className="card-bottom" style={{ display: 'flex', gap: 8, marginTop: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                          <button 
                            className="btn-card-action"
                            style={{ flex: 1 }}
                            onClick={() => setSelectedRequest(req)}
                          >
                            <Eye size={15} /> Detail Lacak
                          </button>
                          
                          {req.status === 'Selesai' && (
                            <button 
                              className="btn-card-action primary"
                              style={{ flex: 1 }}
                              onClick={() => req.signedLetterDoc ? handleDownloadSignedPdf(req) : setSelectedRequest(req)}
                            >
                              <Download size={15} /> Unduh Surat
                            </button>
                          )}

                          {req.status === 'Revisi' && (
                            <button 
                              className="btn-card-action primary"
                              style={{ flex: 1, background: '#f59e0b' }}
                              onClick={() => handleTriggerResubmit(req)}
                            >
                              <RefreshCw size={15} /> Perbaiki Data
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. RESIDENT SUBMISSION FORM MODAL */}
      <AnimatePresence>
        {showForm && (
          <div className="modal-overlay" style={{ zIndex: 6000 }}>
            <motion.div 
              initial={{ y: '100%', opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: '100%', opacity: 0 }}
              className="modal-sheet"
              style={{ maxWidth: 540, width: '100%', borderRadius: 28 }}
            >
              <div className="sheet-header" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 16 }}>
                <div className="sheet-handle" />
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1e3a8a' }}>
                  {editingRequest ? 'Perbaiki Pengajuan Surat' : 'Form Pengajuan Surat'}
                </h3>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Kategori: {formData.jenis}</p>
                <button className="btn-close-sheet" onClick={() => setShowForm(false)}>✕</button>
              </div>

              <form onSubmit={handleSubmit} className="sheet-form" style={{ marginTop: 20 }}>
                {/* Auto-filled Profile Section */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 10 }}>Identitas Pemohon (Otomatis Profil)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Nama:</span>
                      <div style={{ fontWeight: 800, color: '#1e293b' }}>{user?.name}</div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>NIK:</span>
                      <div style={{ fontWeight: 800, color: '#1e293b', fontFamily: 'monospace' }}>{user?.nik || '-'}</div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>KK:</span>
                      <div style={{ fontWeight: 800, color: '#1e293b', fontFamily: 'monospace' }}>{user?.noKK || 'Belum Terisi'}</div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Domisili Wilayah:</span>
                      <div style={{ fontWeight: 800, color: '#1e293b' }}>RT {formatRtId(user?.rt_id)} / RW 011</div>
                    </div>
                  </div>
                </div>

                {/* Tujuan Pengajuan selector */}
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 8 }}>Tujuan Pengajuan Surat</label>
                  <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 12 }}>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, tujuan: 'RT' }))}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                        background: formData.tujuan === 'RT' ? '#fff' : 'none',
                        color: formData.tujuan === 'RT' ? '#2563eb' : '#64748b',
                        boxShadow: formData.tujuan === 'RT' ? '0 4px 6px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      Ketua RT
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, tujuan: 'RW' }))}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                        background: formData.tujuan === 'RW' ? '#fff' : 'none',
                        color: formData.tujuan === 'RW' ? '#2563eb' : '#64748b',
                        boxShadow: formData.tujuan === 'RW' ? '0 4px 6px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      Ketua RW
                    </button>
                  </div>

                  {/* Dynamic Official Information Card */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 12 }}>
                    <div style={{ width: 36, height: 36, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontWeight: 800 }}>
                      {formData.tujuan === 'RT' ? '🛡️' : '👑'}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>
                        Penerima: Ketua {formData.tujuan} {formData.tujuan === 'RT' ? formatRtId(user?.rt_id) : '011'}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#1e3a8a' }}>
                        {formData.tujuan === 'RT' 
                          ? (officials.rt[formatRtId(user?.rt_id)] || officials.rt[user?.rt_id || ''] || 'Pengurus RT Setempat') 
                          : officials.rw}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Keperluan textarea */}
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 8 }}>Keperluan / Tujuan Pengajuan</label>
                  <textarea 
                    placeholder="Jelaskan secara jelas keperluan surat Anda. Contoh: Untuk melengkapi berkas pendaftaran jaminan kesehatan BPJS Mandiri."
                    value={formData.keperluan}
                    onChange={e => setFormData(prev => ({ ...prev, keperluan: e.target.value }))}
                    required
                    style={{ width: '100%', height: 90, borderRadius: 14, border: '1px solid #e2e8f0', padding: 14, fontSize: 13, outline: 'none', background: '#f8fafc', resize: 'none' }}
                  />
                </div>

                {/* Catatan tambahan */}
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 8 }}>Catatan Tambahan (Opsional)</label>
                  <input 
                    type="text"
                    placeholder="Catatan tambahan bagi pengurus..."
                    value={formData.catatan}
                    onChange={e => setFormData(prev => ({ ...prev, catatan: e.target.value }))}
                    style={{ width: '100%', height: 48, borderRadius: 12, border: '1px solid #e2e8f0', padding: '0 14px', fontSize: 13, outline: 'none', background: '#f8fafc' }}
                  />
                </div>

                {/* Document Upload zones */}
                {(() => {
                  const reqs = getFileRequirements(formData.jenis);
                  return (
                    <div style={{ marginBottom: 24 }}>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 12 }}>Berkas Persyaratan (Wajib Dilengkapi)</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        
                        {/* Zone 1: reqs.label1 */}
                        <div 
                          style={{
                            position: 'relative',
                            border: '2px dashed #cbd5e1', borderRadius: 16, padding: 14, textAlign: 'center', cursor: 'pointer',
                            background: formData.ktpDoc ? '#f8fafc' : '#fff',
                            borderColor: formData.ktpDoc ? '#10b981' : '#cbd5e1',
                            minHeight: 120,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            overflow: 'hidden'
                          }}
                        >
                          {formData.ktpDoc ? (
                            <>
                              {formData.ktpDoc.startsWith('data:image/') ? (
                                <img 
                                  src={formData.ktpDoc} 
                                  alt={reqs.label1} 
                                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} 
                                />
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                  <FileText size={32} color="#10b981" />
                                  <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>PDF READY</span>
                                </div>
                              )}
                              <div 
                                style={{ 
                                  position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.65)', 
                                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                                  opacity: 0, transition: 'all 0.2s', color: '#fff', fontSize: 11, fontWeight: 800
                                }}
                                className="preview-hover-overlay"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerUpload('ktp');
                                }}
                              >
                                <UploadCloud size={20} style={{ marginBottom: 4 }} />
                                Ganti Berkas
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormData(prev => ({ ...prev, ktpDoc: '' }));
                                  setUploadProgress(prev => ({ ...prev, ktp: 0 }));
                                }}
                                style={{
                                  position: 'absolute', right: 8, top: 8, background: '#ef4444', color: '#fff', border: 'none',
                                  width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', fontSize: 10, fontWeight: 800, zIndex: 10
                                }}
                                title="Hapus Berkas"
                              >
                                ✕
                              </button>
                              
                              <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, background: 'rgba(255, 255, 255, 0.95)', padding: '4px 8px', borderRadius: 8, fontSize: 10, fontWeight: 800, color: '#1e293b', border: '1px solid #e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {reqs.label1}
                              </div>
                            </>
                          ) : (
                            <div onClick={() => triggerUpload('ktp')} style={{ width: '100%' }}>
                              <UploadCloud size={24} color="#64748b" style={{ margin: '0 auto 6px' }} />
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>{reqs.label1}</div>
                              <div style={{ fontSize: 9, color: reqs.req1 ? '#ef4444' : '#64748b', fontWeight: 800, marginTop: 2 }}>
                                {reqs.req1 ? 'WAJIB' : 'OPSIONAL'}
                              </div>
                              {uploadProgress.ktp > 0 && uploadProgress.ktp < 100 && (
                                <div style={{ height: 4, width: '100%', background: '#e2e8f0', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${uploadProgress.ktp}%`, background: '#2563eb' }} />
                                </div>
                              )}
                            </div>
                          )}
                          <input type="file" ref={fileInputKtp} style={{ display: 'none' }} accept="image/*,application/pdf" onChange={e => handleFileChange(e, 'ktpDoc')} />
                        </div>

                        {/* Zone 2: reqs.label2 */}
                        <div 
                          style={{
                            position: 'relative',
                            border: '2px dashed #cbd5e1', borderRadius: 16, padding: 14, textAlign: 'center', cursor: 'pointer',
                            background: formData.kkDoc ? '#f8fafc' : '#fff',
                            borderColor: formData.kkDoc ? '#10b981' : '#cbd5e1',
                            minHeight: 120,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            overflow: 'hidden'
                          }}
                        >
                          {formData.kkDoc ? (
                            <>
                              {formData.kkDoc.startsWith('data:image/') ? (
                                <img 
                                  src={formData.kkDoc} 
                                  alt={reqs.label2} 
                                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} 
                                />
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                  <FileText size={32} color="#10b981" />
                                  <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>PDF READY</span>
                                </div>
                              )}
                              <div 
                                style={{ 
                                  position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.65)', 
                                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                                  opacity: 0, transition: 'all 0.2s', color: '#fff', fontSize: 11, fontWeight: 800
                                }}
                                className="preview-hover-overlay"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerUpload('kk');
                                }}
                              >
                                <UploadCloud size={20} style={{ marginBottom: 4 }} />
                                Ganti Berkas
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormData(prev => ({ ...prev, kkDoc: '' }));
                                  setUploadProgress(prev => ({ ...prev, kk: 0 }));
                                }}
                                style={{
                                  position: 'absolute', right: 8, top: 8, background: '#ef4444', color: '#fff', border: 'none',
                                  width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', fontSize: 10, fontWeight: 800, zIndex: 10
                                }}
                                title="Hapus Berkas"
                              >
                                ✕
                              </button>
                              
                              <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, background: 'rgba(255, 255, 255, 0.95)', padding: '4px 8px', borderRadius: 8, fontSize: 10, fontWeight: 800, color: '#1e293b', border: '1px solid #e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {reqs.label2}
                              </div>
                            </>
                          ) : (
                            <div onClick={() => triggerUpload('kk')} style={{ width: '100%' }}>
                              <UploadCloud size={24} color="#64748b" style={{ margin: '0 auto 6px' }} />
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>{reqs.label2}</div>
                              <div style={{ fontSize: 9, color: reqs.req2 ? '#ef4444' : '#64748b', fontWeight: 800, marginTop: 2 }}>
                                {reqs.req2 ? 'WAJIB' : 'OPSIONAL'}
                              </div>
                              {uploadProgress.kk > 0 && uploadProgress.kk < 100 && (
                                <div style={{ height: 4, width: '100%', background: '#e2e8f0', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${uploadProgress.kk}%`, background: '#2563eb' }} />
                                </div>
                              )}
                            </div>
                          )}
                          <input type="file" ref={fileInputKk} style={{ display: 'none' }} accept="image/*,application/pdf" onChange={e => handleFileChange(e, 'kkDoc')} />
                        </div>

                        {/* Zone 3: reqs.label3 */}
                        <div 
                          style={{
                            position: 'relative',
                            border: '2px dashed #cbd5e1', borderRadius: 16, padding: 14, textAlign: 'center', cursor: 'pointer',
                            gridColumn: 'span 2',
                            background: formData.supportDoc ? '#f8fafc' : '#fff',
                            borderColor: formData.supportDoc ? '#10b981' : '#cbd5e1',
                            minHeight: 120,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            overflow: 'hidden',
                            marginTop: 4
                          }}
                        >
                          {formData.supportDoc ? (
                            <>
                              {formData.supportDoc.startsWith('data:image/') ? (
                                <img 
                                  src={formData.supportDoc} 
                                  alt={reqs.label3} 
                                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} 
                                />
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                  <FileText size={32} color="#10b981" />
                                  <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>PDF READY</span>
                                </div>
                              )}
                              <div 
                                style={{ 
                                  position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.65)', 
                                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                                  opacity: 0, transition: 'all 0.2s', color: '#fff', fontSize: 11, fontWeight: 800
                                }}
                                className="preview-hover-overlay"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerUpload('support');
                                }}
                              >
                                <UploadCloud size={20} style={{ marginBottom: 4 }} />
                                Ganti Berkas
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormData(prev => ({ ...prev, supportDoc: '' }));
                                  setUploadProgress(prev => ({ ...prev, support: 0 }));
                                }}
                                style={{
                                  position: 'absolute', right: 8, top: 8, background: '#ef4444', color: '#fff', border: 'none',
                                  width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', fontSize: 10, fontWeight: 800, zIndex: 10
                                }}
                                title="Hapus Berkas"
                              >
                                ✕
                              </button>
                              
                              <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, background: 'rgba(255, 255, 255, 0.95)', padding: '4px 8px', borderRadius: 8, fontSize: 10, fontWeight: 800, color: '#1e293b', border: '1px solid #e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {reqs.label3}
                              </div>
                            </>
                          ) : (
                            <div onClick={() => triggerUpload('support')} style={{ width: '100%' }}>
                              <UploadCloud size={24} color="#64748b" style={{ margin: '0 auto 6px' }} />
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>{reqs.label3}</div>
                              <div style={{ fontSize: 9, color: reqs.req3 ? '#ef4444' : '#64748b', fontWeight: 800, marginTop: 2 }}>
                                {reqs.req3 ? 'WAJIB' : 'OPSIONAL'}
                              </div>
                              {uploadProgress.support > 0 && uploadProgress.support < 100 && (
                                <div style={{ height: 4, width: '100%', background: '#e2e8f0', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${uploadProgress.support}%`, background: '#2563eb' }} />
                                </div>
                              )}
                            </div>
                          )}
                          <input type="file" ref={fileInputSupport} style={{ display: 'none' }} accept="image/*,application/pdf" onChange={e => handleFileChange(e, 'supportDoc')} />
                        </div>

                      </div>
                    </div>
                  );
                })()}

                {/* Form Buttons */}
                <div className="form-actions" style={{ display: 'flex', gap: 12 }}>
                  <button type="button" className="btn-secondary" style={{ height: 48 }} onClick={() => setShowForm(false)}>Batal</button>
                  <button type="submit" className="btn-submit" style={{ height: 48 }} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <><Send size={18} /> Kirim Pengajuan</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. DETAIL VIEW / TRACK TIMELINE MODAL */}
      <AnimatePresence>
        {selectedRequest && (
          <div className="modal-overlay" style={{ zIndex: 6100 }}>
            <motion.div 
              initial={{ y: '100%', opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: '100%', opacity: 0 }}
              className="modal-sheet"
              style={{ maxWidth: selectedRequest.status === 'Selesai' ? 1000 : 800, width: '100%', borderRadius: 28 }}
            >
              <div className="sheet-header" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 16 }}>
                <div className="sheet-handle" />
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1e3a8a' }}>Detail Informasi & Verifikasi Surat</h3>
                <button className="btn-close-sheet" onClick={() => setSelectedRequest(null)}>✕</button>
              </div>

              {/* SPLIT LAYOUT FOR DETAILS */}
              <div style={{ display: 'grid', gridTemplateColumns: selectedRequest.status === 'Selesai' ? '1.1fr 1.6fr' : '1fr 1.1fr', gap: 24, marginTop: 20 }} className="modal-split-mobile">
                
                {/* COLUMN 1: INFORMATION & STATUS TIMELINE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 18, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Data Pengajuan</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                      <div><span style={{ color: '#64748b' }}>Nomor Surat:</span> <strong style={{ color: '#0f172a' }}>{selectedRequest.nomor}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Jenis:</span> <strong style={{ color: '#0f172a' }}>{selectedRequest.jenis}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Keperluan:</span> <strong style={{ color: '#0f172a' }}>{selectedRequest.keperluan}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Pemohon:</span> <strong style={{ color: '#0f172a' }}>{selectedRequest.wargaName}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Alamat:</span> <span style={{ color: '#475569' }}>{formatAddress({ name: selectedRequest.wargaName, alamat: selectedRequest.alamat, blok: selectedRequest.blok || selectedWargaProfile?.blok, nomorRumah: selectedRequest.nomorRumah || selectedWargaProfile?.nomorRumah || selectedWargaProfile?.noRumah, rt_id: selectedRequest.rt_id || selectedWargaProfile?.rt_id || selectedWargaProfile?.rt, rw_id: selectedRequest.rw_id || selectedWargaProfile?.rw_id || selectedWargaProfile?.rw })}</span></div>
                    </div>
                  </div>

                  {/* Status Timeline UI */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12 }}>Status Pelacakan Pengajuan</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      
                      {/* Step 1: Dibuat */}
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>✓</div>
                          <div style={{ width: 2, height: 24, background: '#10b981' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>Pengajuan Surat Dikirim</div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>Dibuat otomatis oleh pemohon</div>
                        </div>
                      </div>

                      {/* Step 2: RT verif */}
                      {selectedRequest.tujuan === 'RT' && (
                        <div style={{ display: 'flex', gap: 12 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ 
                              width: 22, height: 22, borderRadius: '50%', 
                              background: ['Pending RW', 'Selesai'].includes(selectedRequest.status) ? '#10b981' : '#3b82f6', 
                              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 
                            }}>
                              {['Pending RW', 'Selesai'].includes(selectedRequest.status) ? '✓' : '⏳'}
                            </div>
                            <div style={{ width: 2, height: 24, background: ['Pending RW', 'Selesai'].includes(selectedRequest.status) ? '#10b981' : '#cbd5e1' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>Verifikasi Ketua RT</div>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>
                              {['Pending RW', 'Selesai'].includes(selectedRequest.status) ? `Telah diverifikasi RT ${formatRtId(selectedRequest.rt_id)}` : `Menunggu persetujuan RT`}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Step 3: RW verif */}
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ 
                            width: 22, height: 22, borderRadius: '50%', 
                            background: selectedRequest.status === 'Selesai' ? '#10b981' : selectedRequest.status === 'Pending RW' ? '#3b82f6' : '#cbd5e1', 
                            color: selectedRequest.status === 'Selesai' ? '#fff' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 
                          }}>
                            {selectedRequest.status === 'Selesai' ? '✓' : '⏳'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>Surat Terbit & Selesai</div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>
                            {selectedRequest.status === 'Selesai' ? 'Surat resmi siap diunduh' : 'Menunggu validasi dokumen'}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* ADMIN ACTION BOX (Shown only to admin on details screen) */}
                  {isAdmin && ['Pending RT', 'Pending RW', 'Diproses'].includes(selectedRequest.status) && (
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 20, marginTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12 }}>Tindakan Administrasi</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button 
                          onClick={() => handleAdminApprove(selectedRequest)}
                          style={{ 
                            flex: 1.4, height: 42, border: 'none', background: '#10b981', color: '#fff', 
                            fontWeight: 800, borderRadius: 12, display: 'flex', alignItems: 'center', 
                            justifyContent: 'center', gap: 6, cursor: 'pointer', fontSize: 11, 
                            whiteSpace: 'nowrap', padding: '0 6px', transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
                        >
                          <CheckCircle size={15} /> Setujui & Terbitkan
                        </button>
                        <button 
                          onClick={() => { setShowActionModal('revise'); setActionReason(''); }}
                          style={{ 
                            flex: 1, height: 42, border: '1.5px solid #f59e0b', background: '#fff', color: '#d97706', 
                            fontWeight: 800, borderRadius: 12, display: 'flex', alignItems: 'center', 
                            justifyContent: 'center', gap: 6, cursor: 'pointer', fontSize: 11, 
                            whiteSpace: 'nowrap', padding: '0 6px', transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#fffbeb';
                            e.currentTarget.style.borderColor = '#d97706';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#fff';
                            e.currentTarget.style.borderColor = '#f59e0b';
                          }}
                        >
                          <RefreshCw size={14} /> Minta Revisi
                        </button>
                        <button 
                          onClick={() => { setShowActionModal('reject'); setActionReason(''); }}
                          style={{ 
                            flex: 0.8, height: 42, border: '1.5px solid #ef4444', background: '#fff', color: '#ef4444', 
                            fontWeight: 800, borderRadius: 12, display: 'flex', alignItems: 'center', 
                            justifyContent: 'center', gap: 6, cursor: 'pointer', fontSize: 11, 
                            whiteSpace: 'nowrap', padding: '0 6px', transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#fef2f2';
                            e.currentTarget.style.borderColor = '#dc2626';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#fff';
                            e.currentTarget.style.borderColor = '#ef4444';
                          }}
                        >
                          <XCircle size={14} /> Tolak
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* COLUMN 2: APPROVED PDF TEMPLATE PREVIEW OR SIDE-BY-SIDE FILE VIEWER */}
                <div>
                  {selectedRequest.status === 'Selesai' && selectedRequest.signedLetterDoc ? (
                    /* UNIVERSAL PREMIUM PDF VIEWER (High-fidelity inline preview + sleek details & download button) */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      
                      {/* Premium Action Download Banner */}
                      <div style={{ 
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                        borderRadius: 20, 
                        padding: '16px 20px', 
                        color: '#fff', 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        boxShadow: '0 8px 20px rgba(16, 185, 129, 0.25)',
                        textAlign: 'left'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ 
                            width: 38, height: 38, background: 'rgba(255,255,255,0.2)', 
                            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            <CheckCircle size={18} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 900 }}>Dokumen Resmi Tersedia!</div>
                            <div style={{ fontSize: 10, opacity: 0.9 }}>Berkas surat telah ditandatangani oleh pengurus.</div>
                          </div>
                        </div>

                        <button 
                          onClick={() => handleDownloadSignedPdf(selectedRequest)}
                          style={{ 
                            padding: '8px 16px', borderRadius: 10, fontWeight: 900, fontSize: 11,
                            background: '#fff', color: '#059669', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6,
                            boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          <Download size={13} /> Unduh PDF
                        </button>
                      </div>

                      {/* Elegant Framed PDF Preview - Rendered Inline for Perfect Visual Review */}
                      <div style={{ 
                        borderRadius: 16, 
                        overflow: 'hidden', 
                        border: '1.5px solid #e2e8f0', 
                        boxShadow: '0 8px 25px rgba(0,0,0,0.06)',
                        background: '#fff' 
                      }}>
                        <iframe 
                          src={pdfBlobUrl} 
                          style={{ width: '100%', height: '420px', border: 'none' }} 
                          title="Pratinjau Surat Resmi" 
                        />
                      </div>

                      {/* Sleek File Details & Large Action Button for Direct Download (Extremely Clean) */}
                      <div style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 20,
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          width: '100%',
                          justifyContent: 'flex-start'
                        }}>
                          <div style={{ 
                            width: 40, 
                            height: 40, 
                            borderRadius: 10, 
                            background: 'rgba(16, 185, 129, 0.1)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: '#10b981'
                          }}>
                            <FileCheck size={20} />
                          </div>
                          <div style={{ textAlign: 'left', overflow: 'hidden', flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 900, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {selectedRequest.signedLetterDocName || 'Surat_Pengantar_Resmi.pdf'}
                            </div>
                            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>Dokumen PDF Resmi • ~450 KB</div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDownloadSignedPdf(selectedRequest)}
                          style={{
                            width: '100%',
                            height: 44,
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#fff',
                            fontWeight: 900,
                            fontSize: 12,
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                          }}
                        >
                          <Download size={15} /> Unduh & Buka Berkas Resmi
                        </button>
                      </div>

                    </div>
                  ) : selectedRequest.status === 'Selesai' ? (
                    /* PREVIEW GOVERNMENT OFFICIAL PDF DRAFT */
                    <div style={{ background: '#fff', border: '2px solid #cbd5e1', padding: 24, borderRadius: 16, minHeight: 380, width: '100%', position: 'relative' }} className="print-area-wrapper">
                      
                      {/* Printable Letter Box */}
                      <div id="print-letter-content" style={{ fontFamily: 'Times New Roman, serif', color: '#000', lineHeight: 1.4, textAlign: 'justify', fontSize: 12 }}>
                        
                        {/* Kop Surat */}
                        <div style={{ textAlign: 'center', borderBottom: '3px double #000', paddingBottom: 10, marginBottom: 14 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 'bold', margin: '0 0 2px 0', textTransform: 'uppercase' }}>Pemerintah Kota Bandung</h4>
                          <h4 style={{ fontSize: 13, fontWeight: 'bold', margin: '0 0 2px 0', textTransform: 'uppercase' }}>Kecamatan Coblong - Kelurahan Dago</h4>
                          <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '0 0 4px 0', textTransform: 'uppercase' }}>Rukun Tetangga {formatRtId(selectedRequest.rt_id)} / RW 011</h3>
                          <span style={{ fontSize: 10, fontStyle: 'italic', color: '#475569' }}>Sekretariat: Villa Dago Asri Coblong, Kota Bandung. Kode Pos: 40135</span>
                        </div>

                        {/* Title of official document */}
                        <div style={{ textAlign: 'center', marginBottom: 16 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 'bold', textDecoration: 'underline', margin: '0 0 2px 0', textTransform: 'uppercase' }}>
                            {selectedRequest.jenis}
                          </h4>
                          <span style={{ fontSize: 11 }}>Nomor: {selectedRequest.nomor}</span>
                        </div>

                        {/* Content */}
                        <p style={{ margin: '0 0 10px 0', textIndent: 30 }}>
                          Yang bertanda tangan di bawah ini Ketua RT {formatRtId(selectedRequest.rt_id)} RW 011 Kelurahan Dago, Kecamatan Coblong, Kota Bandung, menerangkan dengan sebenarnya bahwa:
                        </p>

                        <div style={{ margin: '0 0 12px 30px', display: 'grid', gridTemplateColumns: '120px 10px 1fr', gap: '4px 0' }}>
                          <span>Nama Lengkap</span><span>:</span><strong style={{ textTransform: 'uppercase' }}>{selectedRequest.wargaName}</strong>
                          <span>NIK</span><span>:</span><span style={{ fontFamily: 'monospace' }}>{selectedRequest.nik}</span>
                          <span>No. Kartu Keluarga</span><span>:</span><span style={{ fontFamily: 'monospace' }}>{selectedRequest.noKK}</span>
                          <span>Tempat, Tgl Lahir</span><span>:</span><span>Bandung, 12 Agustus 1996</span>
                          <span>Pekerjaan</span><span>:</span><span>Karyawan Swasta</span>
                          <span>Alamat Domisili</span><span>:</span><span>{formatAddress({ name: selectedRequest.wargaName, alamat: selectedRequest.alamat, blok: selectedRequest.blok || selectedWargaProfile?.blok, nomorRumah: selectedRequest.nomorRumah || selectedWargaProfile?.nomorRumah || selectedWargaProfile?.noRumah, rt_id: selectedRequest.rt_id || selectedWargaProfile?.rt_id || selectedWargaProfile?.rt, rw_id: selectedRequest.rw_id || selectedWargaProfile?.rw_id || selectedWargaProfile?.rw })}</span>
                        </div>

                        <p style={{ margin: '0 0 10px 0', textIndent: 30 }}>
                          Nama tersebut di atas adalah benar merupakan warga aktif yang berdomisili di wilayah RT {formatRtId(selectedRequest.rt_id)} RW 011 Kelurahan Dago. Berdasarkan pengamatan kami, yang bersangkutan berkelakuan baik dan bermaksud membuat surat pengantar ini untuk keperluan: <strong>"{selectedRequest.keperluan}"</strong>.
                        </p>

                        <p style={{ margin: '0 0 20px 0', textIndent: 30 }}>
                          Demikian surat keterangan pengantar ini kami buat dengan sebenarnya untuk dipergunakan sebagaimana mestinya dan penuh tanggung jawab.
                        </p>

                        {/* Signatures & QR Code section */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginTop: 24 }}>
                          
                          {/* QR Verification */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed #cbd5e1', borderRadius: 10, padding: 8, textAlign: 'center' }}>
                            <div style={{ width: 68, height: 68, background: '#f1f5f9', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 4 }}>
                              📱
                            </div>
                            <span style={{ fontSize: 8, color: '#137333', fontWeight: 'bold' }}>✓ TERVERIFIKASI DIGITAL</span>
                            <span style={{ fontSize: 7, color: '#64748b' }}>Sistem Ruang Warga VSJ</span>
                          </div>

                          {/* Signature */}
                          <div style={{ textAlign: 'center', position: 'relative' }}>
                            <span style={{ fontSize: 11 }}>Bandung, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                            <div style={{ fontSize: 12, fontWeight: 'bold', margin: '4px 0 38px 0' }}>Ketua RT {formatRtId(selectedRequest.rt_id)} RW 011</div>
                            
                            {/* Visual Circular Stamp & signature signature */}
                            <div style={{ position: 'absolute', right: 40, top: 22, opacity: 0.85 }}>
                              <div style={{ fontSize: 16, fontFamily: 'Zapfino, cursive, Brush Script MT', color: '#1d4ed8', transform: 'rotate(-4deg)' }}>
                                {selectedRequest.approvedBy?.split(' ')[0] || (officials.rt[formatRtId(selectedRequest.rt_id)] || officials.rt[selectedRequest.rt_id] || 'Bambang').split(' ')[0].replace('Bpk.', '').replace('Ibu', '').trim()}
                              </div>
                              {/* Blue Round Seal */}
                              <div style={{
                                width: 56, height: 56, borderRadius: '50%', border: '2px dashed rgba(29, 78, 216, 0.4)',
                                position: 'absolute', left: -10, top: -14, transform: 'rotate(12deg)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 6, color: 'rgba(29, 78, 216, 0.7)', fontWeight: 'bold', textAlign: 'center'
                              }}>
                                RT {formatRtId(selectedRequest.rt_id)} / RW 011<br />KEL. DAGO
                              </div>
                            </div>

                            <strong style={{ textDecoration: 'underline', display: 'block', fontSize: 12 }}>
                              {selectedRequest.approvedBy || officials.rt[formatRtId(selectedRequest.rt_id)] || officials.rt[selectedRequest.rt_id] || 'Ketua RT'}
                            </strong>
                          </div>

                        </div>

                      </div>

                      {/* PDF Action Floating Bar */}
                      <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button 
                          onClick={handlePrintLetter}
                          className="btn-card-action primary"
                          style={{ flex: 'none', padding: '10px 18px' }}
                        >
                          <Printer size={16} /> Cetak / Simpan PDF
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* SIDE BY SIDE DOCUMENT ATTACHMENT VIEW (Admin verifications) */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12 }}>Dokumen KTP yang Diunggah</div>
                        {selectedRequest.ktpDoc ? (
                          <div style={{ width: '100%', height: 160, borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img src={selectedRequest.ktpDoc} alt="KTP" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          </div>
                        ) : (
                          <div style={{ height: 140, border: '2px dashed #cbd5e1', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>
                            <span>KTP tidak diunggah oleh warga</span>
                          </div>
                        )}
                      </div>

                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12 }}>Kartu Keluarga yang Diunggah</div>
                        {selectedRequest.kkDoc ? (
                          <div style={{ width: '100%', height: 160, borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img src={selectedRequest.kkDoc} alt="KK" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          </div>
                        ) : (
                          <div style={{ height: 140, border: '2px dashed #cbd5e1', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>
                            <span>KK tidak diunggah oleh warga</span>
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. ADMIN ACTION ACTIONABLE POPUP (REVISION OR REJECTION INPUTS) */}
      <AnimatePresence>
        {showActionModal && (
          <div className="modal-overlay" style={{ zIndex: 6500 }}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: '#fff', width: '100%', maxWidth: 440, borderRadius: 24, padding: 28, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
            >
              <div style={{ width: 48, height: 48, background: showActionModal === 'revise' ? '#fef3c7' : '#fce8e6', color: showActionModal === 'revise' ? '#d97706' : '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                {showActionModal === 'revise' ? <RefreshCw size={24} /> : <XCircle size={24} />}
              </div>

              <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>
                {showActionModal === 'revise' ? 'Minta Revisi Dokumen' : 'Tolak Pengajuan Surat'}
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, marginBottom: 20 }}>
                {showActionModal === 'revise' 
                  ? 'Tuliskan instruksi perbaikan data secara jelas agar pemohon dapat segera mengunggah ulang atau merevisi data yang salah.'
                  : 'Sebutkan alasan penolakan surat ini secara objektif untuk diinfokan ke warga.'}
              </p>

              <form onSubmit={handleAdminActionSubmit}>
                <textarea 
                  required
                  placeholder={showActionModal === 'revise' ? 'Contoh: Mohon unggah ulang Kartu Keluarga Anda yang baru. KK yang dilampirkan buram dan tidak terbaca.' : 'Contoh: Persyaratan dokumen tidak lengkap atau tidak sesuai dengan aturan domisili.'}
                  value={actionReason}
                  onChange={e => setActionReason(e.target.value)}
                  style={{ width: '100%', height: 100, border: '1px solid #cbd5e1', borderRadius: 12, padding: 12, fontSize: 13, outline: 'none', background: '#f8fafc', resize: 'none', marginBottom: 24 }}
                />

                <div style={{ display: 'flex', gap: 10 }}>
                  <button 
                    type="button" 
                    onClick={() => setShowActionModal(null)}
                    style={{ flex: 1, height: 46, borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    style={{ flex: 2, height: 46, borderRadius: 12, border: 'none', background: showActionModal === 'revise' ? '#f59e0b' : '#ef4444', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Kirim Catatan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. SUCCESS SUBMISSION MODAL */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="modal-overlay" style={{ zIndex: 7000 }}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              style={{ 
                background: '#fff', width: '100%', maxWidth: 440, borderRadius: 28, padding: 32, 
                textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' 
              }}
            >
              {/* Glowing animated check mark */}
              <div style={{
                position: 'relative', width: 72, height: 72, background: '#eff6ff', 
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', border: '2px solid #3b82f6',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.25)'
              }}>
                <Sparkles size={36} color="#3b82f6" />
              </div>

              <h3 style={{ fontSize: 20, fontWeight: 900, color: '#1e3a8a', marginBottom: 12 }}>
                Pengajuan Surat Berhasil!
              </h3>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginBottom: 28 }}>
                Terima kasih, dokumen Anda berhasil dikirim ke pengurus RT/RW 011. Mohon menunggu proses verifikasi dan silakan **cek menu Notifikasi atau Riwayat Pengajuan secara berkala**.
              </p>

              <button 
                type="button" 
                onClick={() => setShowSuccessModal(false)}
                style={{ 
                  width: '100%', height: 48, borderRadius: 14, border: 'none', 
                  background: '#2563eb', color: '#fff', fontWeight: 800, fontSize: 14,
                  cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#1e40af'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
              >
                Mengerti, Saya Akan Menunggu
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6.1 ADMIN UPLOAD SIGNED PDF MODAL */}
      <AnimatePresence>
        {showUploadPdfModal && (
          <div className="modal-overlay" style={{ zIndex: 7500 }}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              style={{ 
                background: '#fff', width: '100%', maxWidth: 460, borderRadius: 28, padding: 32, 
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative'
              }}
            >
              <button 
                type="button" 
                onClick={() => setShowUploadPdfModal(null)}
                style={{ 
                  position: 'absolute', right: 20, top: 20, border: 'none', background: '#f1f5f9', 
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', 
                  justifyContent: 'center', cursor: 'pointer', color: '#64748b', fontWeight: 'bold' 
                }}
              >
                ✕
              </button>

              <div style={{
                width: 60, height: 60, background: '#eff6ff', 
                borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#2563eb', marginBottom: 20
              }}>
                <FileText size={28} />
              </div>

              <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1e3a8a', marginBottom: 8 }}>
                Unggah Dokumen Surat Resmi
              </h3>
              <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, marginBottom: 20 }}>
                Untuk menyetujui pengajuan surat dari warga <strong>{showUploadPdfModal.wargaName}</strong>, silakan unggah berkas surat resmi (format PDF) yang telah ditandatangani basah atau digital.
              </p>

              {/* PDF FILE UPLOAD DROPZONE */}
              <div 
                onClick={() => fileInputAdminPdfRef.current?.click()}
                style={{
                  border: adminSelectedPdfBase64 ? '2px solid #10b981' : '2.5px dashed #cbd5e1',
                  background: adminSelectedPdfBase64 ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' : '#f8fafc',
                  borderRadius: 20, 
                  padding: '28px 24px', 
                  textAlign: 'center', 
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
                  marginBottom: 24,
                  boxShadow: adminSelectedPdfBase64 ? '0 8px 20px rgba(16, 185, 129, 0.08)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (!adminSelectedPdfBase64) {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.background = '#f1f7ff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!adminSelectedPdfBase64) {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.background = '#f8fafc';
                  }
                }}
              >
                <input 
                  type="file" 
                  ref={fileInputAdminPdfRef} 
                  onChange={handleAdminPdfChange}
                  accept="application/pdf"
                  style={{ display: 'none' }}
                />
                
                {adminSelectedPdfBase64 ? (
                  <div className="fade-in">
                    <div style={{
                      width: 56, height: 56, background: '#fff', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#10b981', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.15)',
                      margin: '0 auto 12px'
                    }}>
                      <FileCheck size={26} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#065f46', marginBottom: 6, letterSpacing: '0.3px' }}>Berkas Terpilih!</div>
                    <div style={{ 
                      background: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(16, 185, 129, 0.2)',
                      borderRadius: 12, padding: '8px 12px', fontSize: 11, fontFamily: 'monospace',
                      color: '#047857', maxWidth: 280, margin: '6px auto 0', textOverflow: 'ellipsis',
                      overflow: 'hidden', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: 6
                    }}>
                      📄 {adminSelectedPdfName}
                    </div>
                  </div>
                ) : adminPdfUploadProgress > 0 ? (
                  <div className="fade-in">
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#2563eb', marginBottom: 8 }}>Mengunggah... {adminPdfUploadProgress}%</div>
                    <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${adminPdfUploadProgress}%`, height: '100%', background: '#2563eb', transition: 'width 0.2s' }} />
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{
                      width: 56, height: 56, background: '#eff6ff', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#2563eb', margin: '0 auto 12px'
                    }}>
                      <UploadCloud size={24} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 4 }}>Pilih Berkas PDF Surat</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>Klik untuk menelusuri komputer Anda</div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  type="button"
                  onClick={() => setShowUploadPdfModal(null)}
                  style={{ 
                    flex: 1, 
                    height: 48, 
                    borderRadius: 14, 
                    border: 'none', 
                    background: '#f1f5f9', 
                    color: '#64748b', 
                    fontWeight: 800, 
                    fontSize: 13, 
                    cursor: 'pointer', 
                    transition: 'all 0.2s' 
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                >
                  Batal
                </button>
                <button 
                  type="button"
                  disabled={!adminSelectedPdfBase64}
                  onClick={handleTriggerConfirmApproval}
                  style={{ 
                    flex: 1.5, 
                    height: 48, 
                    borderRadius: 14, 
                    border: 'none', 
                    background: adminSelectedPdfBase64 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#e2e8f0', 
                    color: adminSelectedPdfBase64 ? '#fff' : '#94a3b8', 
                    fontWeight: 800, 
                    fontSize: 13, 
                    cursor: adminSelectedPdfBase64 ? 'pointer' : 'not-allowed', 
                    boxShadow: adminSelectedPdfBase64 ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none',
                    transition: 'all 0.2s' 
                  }}
                  onMouseEnter={(e) => {
                    if (adminSelectedPdfBase64) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (adminSelectedPdfBase64) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.2)';
                    }
                  }}
                >
                  Setujui & Kirim Berkas
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. ADMIN ACTION CONFIRMATION MODAL */}
      <AnimatePresence>
        {adminConfirm.isOpen && (
          <div className="modal-overlay" style={{ zIndex: 8000 }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              style={{ 
                background: '#fff', width: '100%', maxWidth: 420, borderRadius: 24, padding: 32, 
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: 'center' 
              }}
            >
              <div style={{
                width: 56, height: 56, 
                background: adminConfirm.actionType === 'approve' ? '#e6f4ea' : '#fce8e6', 
                color: adminConfirm.actionType === 'approve' ? '#10b981' : '#ef4444', 
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                {adminConfirm.actionType === 'approve' ? <CheckCircle size={28} /> : <AlertCircle size={28} />}
              </div>

              <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginBottom: 10 }}>
                {adminConfirm.title}
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, marginBottom: 24 }}>
                {adminConfirm.message}
              </p>

              <div style={{ display: 'flex', gap: 10 }}>
                <button 
                  type="button" 
                  onClick={() => setAdminConfirm(prev => ({ ...prev, isOpen: false }))}
                  style={{ 
                    flex: 1, height: 44, borderRadius: 12, border: '1px solid #cbd5e1', 
                    background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: 13 
                  }}
                >
                  {adminConfirm.cancelText || 'Batal'}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    adminConfirm.onConfirm();
                  }}
                  style={{ 
                    flex: 1.2, height: 44, borderRadius: 12, border: 'none', 
                    background: adminConfirm.actionType === 'approve' ? '#10b981' : '#ef4444', 
                    color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 13 
                  }}
                >
                  {adminConfirm.confirmText || 'Ya'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 8. ADMIN ACTION SUCCESS MODAL */}
      <AnimatePresence>
        {adminSuccess.isOpen && (
          <div className="modal-overlay" style={{ zIndex: 9000 }}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              style={{ 
                background: '#fff', width: '100%', maxWidth: 440, borderRadius: 28, padding: 32, 
                textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' 
              }}
            >
              {/* Glowing animated green check circle */}
              <div style={{
                position: 'relative', width: 72, height: 72, background: '#eff6ff', 
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', border: '2px solid #3b82f6',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.25)'
              }}>
                <Sparkles size={36} color="#3b82f6" />
              </div>

              <h3 style={{ fontSize: 20, fontWeight: 900, color: '#1e3a8a', marginBottom: 12 }}>
                {adminSuccess.title}
              </h3>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginBottom: 28 }}>
                {adminSuccess.message}
              </p>

              <button 
                type="button" 
                onClick={() => setAdminSuccess(prev => ({ ...prev, isOpen: false }))}
                style={{ 
                  width: '100%', height: 48, borderRadius: 14, border: 'none', 
                  background: '#2563eb', color: '#fff', fontWeight: 800, fontSize: 14,
                  cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#1e40af'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
              >
                Tutup & Selesai
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 9. CITIZEN SUBMISSION CONFIRMATION MODAL */}
      <AnimatePresence>
        {wargaConfirm.isOpen && (
          <div className="modal-overlay" style={{ zIndex: 9500 }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              style={{ 
                background: '#fff', width: '100%', maxWidth: 420, borderRadius: 24, padding: 32, 
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: 'center' 
              }}
            >
              <div style={{
                width: 56, height: 56, 
                background: '#eff6ff', 
                color: '#2563eb', 
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', border: '1.5px solid #dbeafe'
              }}>
                <Send size={24} style={{ marginLeft: 3 }} />
              </div>

              <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginBottom: 10 }}>
                Kirim Pengajuan Surat?
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, marginBottom: 24 }}>
                Apakah Anda yakin data persyaratan dan dokumen yang diunggah sudah benar? Pengajuan Anda akan segera dikirim ke pengurus RT/RW 011 untuk diproses.
              </p>

              <div style={{ display: 'flex', gap: 10 }}>
                <button 
                  type="button" 
                  onClick={() => setWargaConfirm(prev => ({ ...prev, isOpen: false }))}
                  style={{ 
                    flex: 1, height: 44, borderRadius: 12, border: '1px solid #cbd5e1', 
                    background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: 13 
                  }}
                >
                  Periksa Lagi
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    wargaConfirm.onConfirm();
                  }}
                  style={{ 
                    flex: 1.2, height: 44, borderRadius: 12, border: 'none', 
                    background: '#2563eb', 
                    color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 13,
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                  }}
                >
                  Ya, Kirim
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Styled Sheets & Print Styles */}
      <style>{`
        .surat-page-container {
          min-height: calc(100vh - 80px);
          padding: 24px;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          max-width: 1200px;
          margin: 0 auto;
        }

        .stats-dashboard {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .stats-dashboard.resident-stats {
          grid-template-columns: repeat(3, 1fr);
        }
        
        .glass-stat-card {
          background: #fff;
          border-radius: 20px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 4px 12px -5px rgba(0, 0, 0, 0.05);
        }

        .stat-icon-bg {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          align-items: flex-start;
          flex: 1;
        }

        .stat-label { font-size: 11px; color: #94a3b8; font-weight: 800; text-transform: uppercase; line-height: 1.2; }
        .stat-value { font-size: 22px; font-weight: 900; color: #1e293b; line-height: 1.1; }

        .btn-premium {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #2563eb;
          color: #fff;
          padding: 12px 20px;
          border-radius: 14px;
          border: none;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
          box-shadow: 0 6px 16px -4px rgba(37, 99, 235, 0.35);
          transition: all 0.2s ease;
        }
        .btn-premium:hover { transform: translateY(-2px); box-shadow: 0 10px 20px -4px rgba(37, 99, 235, 0.45); }

        .search-filter-bar {
          margin-bottom: 24px;
        }
        .premium-search {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          display: flex;
          align-items: center;
          padding: 0 16px;
          height: 48px;
        }
        .premium-search input {
          flex: 1;
          border: none;
          background: none;
          padding: 0 10px;
          font-size: 13px;
          outline: none;
          color: #1e293b;
        }
        
        .web-filter {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          padding: 4px 16px;
          height: 48px;
          justify-content: center;
        }
        .web-filter select { border: none; background: none; font-size: 13px; font-weight: 800; color: #475569; outline: none; }

        .requests-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 20px;
        }

        .letter-card {
          background: #fff;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          padding: 20px;
          transition: all 0.25s ease;
          position: relative;
        }
        .letter-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px -10px rgba(0,0,0,0.08); border-color: #cbd5e1; }

        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .card-bottom {
          display: flex;
          gap: 8px;
          margin-top: auto;
          padding-top: 14px;
          border-top: 1px solid #f1f5f9;
        }
        .btn-card-action {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          background: #fff;
          color: #475569;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-card-action:hover { background: #f8fafc; color: #1e293b; }
        .btn-card-action.primary { background: #2563eb; color: #fff; border: none; }
        .btn-card-action.primary:hover { background: #1e40af; }

        .loading-state, .empty-state {
          padding: 80px 20px;
          text-align: center;
          background: #fff;
          border-radius: 24px;
          border: 1px dashed #cbd5e1;
        }
        .loading-state p { margin-top: 16px; color: #64748b; font-weight: 600; }
        .empty-icon-box { margin: 0 auto 20px; width: 68px; height: 68px; background: #f8fafc; border-radius: 20px; display: flex; align-items: center; justify-content: center; }
        .empty-state h3 { font-size: 16px; font-weight: 800; color: #1e293b; margin: 0; }
        .empty-state p { color: #94a3b8; font-size: 13px; margin: 8px 0 20px; }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .modal-sheet {
          background: #fff;
          max-height: 90vh;
          overflow-y: auto;
          padding: 28px;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15);
        }

        .sheet-handle {
          width: 40px;
          height: 5px;
          background: #cbd5e1;
          border-radius: 3px;
          margin: -10px auto 14px auto;
          display: none;
        }

        .sheet-header {
          display: flex;
          flex-direction: column;
          position: sticky;
          top: -28px;
          background: #fff;
          z-index: 100;
          margin-left: -28px;
          margin-right: -28px;
          padding-left: 28px;
          padding-right: 70px;
          padding-top: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid #f1f5f9;
        }
        .btn-close-sheet { 
          position: absolute; 
          right: 28px; 
          top: 16px; 
          background: #f1f5f9; 
          border: none; 
          color: #64748b; 
          cursor: pointer; 
          font-size: 14px; 
          width: 30px; 
          height: 30px; 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); 
          font-weight: 800; 
        }
        .btn-close-sheet:hover {
          background: #e2e8f0;
          color: #0f172a;
          transform: rotate(90deg);
        }

        .sheet-form label { display: block; font-size: 12px; font-weight: 800; color: #475569; margin-bottom: 6px; text-transform: uppercase; }

        .form-actions button { height: 48px; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; transition: all 0.2s; }
        .btn-secondary { flex: 1; background: #f1f5f9; color: #64748b; border: none; }
        .btn-submit { flex: 2; background: #2563eb; color: #fff; border: none; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-submit:hover { background: #1e40af; }
        .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }

        .text-truncate {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 28px;
        }

        .admin-badge {
          padding: 8px 16px;
          background: #eff6ff;
          border-radius: 12px;
          border: 1px solid #dbeafe;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 800;
          color: #2563eb;
          white-space: nowrap;
        }

        .admin-queue-mobile-container {
          display: none;
        }

        .preview-hover-overlay:hover {
          opacity: 1 !important;
        }

        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            align-items: stretch;
            gap: 14px;
          }
          .admin-badge {
            align-self: flex-start;
          }
          .btn-premium {
            width: 100%;
            justify-content: center;
          }
          .stats-dashboard {
            grid-template-columns: 1fr 1fr !important;
            gap: 12px;
          }
          .stats-dashboard.resident-stats {
            grid-template-columns: 1fr !important;
          }
          .search-filter-bar {
            flex-direction: column;
            gap: 10px;
          }
          .premium-search, .web-filter {
            width: 100% !important;
            min-width: 100% !important;
            flex: none !important;
          }
          .admin-queue-table-container {
            display: none !important;
          }
          .admin-queue-mobile-container {
            display: flex !important;
            flex-direction: column;
            gap: 14px;
            margin-bottom: 24px;
          }
          .admin-mobile-card {
            background: #fff;
            border-radius: 20px;
            border: 1px solid #e2e8f0;
            padding: 16px;
            box-shadow: 0 4px 12px -5px rgba(0, 0, 0, 0.05);
            transition: all 0.2s ease;
          }
          .modal-split-mobile { grid-template-columns: 1fr !important; }
          
          /* Premium Mobile Bottom-Sheet Layout to prevent any offside/clipping issues */
          .modal-overlay {
            align-items: flex-end !important;
            padding: 0 !important;
          }
          
          .modal-sheet { 
            width: 100% !important;
            max-width: 100% !important;
            border-radius: 24px 24px 0 0 !important;
            max-height: 85vh !important;
            padding: 20px 20px 30px 20px !important;
            margin: 0 !important;
            box-shadow: 0 -10px 25px rgba(0, 0, 0, 0.1) !important;
            overflow-y: auto !important;
            position: relative !important;
          }
          
          .sheet-handle {
            display: block !important;
          }
          
          .sheet-header {
            position: sticky !important;
            top: -20px !important;
            margin-left: -20px !important;
            margin-right: -20px !important;
            padding-left: 20px !important;
            padding-right: 60px !important;
            padding-top: 10px !important;
            padding-bottom: 12px !important;
            background: #fff !important;
            z-index: 100 !important;
          }
          
          .btn-close-sheet {
            right: 20px !important;
            top: 10px !important;
          }
        }

        /* Responsive PDF Viewer Classes */
        .pdf-viewer-desktop-only { display: block !important; }
        .pdf-viewer-mobile-only { display: none !important; }

        @media (max-width: 768px) {
          .pdf-viewer-desktop-only { display: none !important; }
          .pdf-viewer-mobile-only { display: block !important; }
        }

        /* PRINT MEDIA DEFINITIONS */
        @media print {
          body * { visibility: hidden; }
          .print-area-wrapper, #print-letter-content, #print-letter-content * { visibility: visible; }
          .print-area-wrapper {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            padding: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
          }
          .btn-card-action, .sheet-header, .sheet-handle, button { display: none !important; }
        }
      `}</style>
    </div>
  );
}
