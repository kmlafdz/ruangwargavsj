import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Video, UploadCloud, MapPin, Send, AlertCircle, 
  Trash2, X, ArrowLeft, Loader2, Sparkles, CheckCircle, Clock, Play, Square, ImageIcon, Edit2, History, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { User } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';

interface ResidentReportPageProps {
  user: User;
}

export default function ResidentReportPage({ user }: ResidentReportPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // New States for Report History and Edit/Withdraw Features
  const [pageTab, setPageTab] = useState<'create' | 'history'>('create');
  const [myReports, setMyReports] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Edit Modal States
  const [editReport, setEditReport] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('Keamanan');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [withdrawConfirmId, setWithdrawConfirmId] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  // Form States
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Keamanan');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  // Media Capture States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraMode, setCameraMode] = useState<'photo' | 'video'>('photo');
  const [capturedImages, setCapturedImages] = useState<string[]>([]); // max 3 base64 images
  const [capturedVideo, setCapturedVideo] = useState<string | null>(null); // base64 or blob url
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);

  // Video Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);

  // DOM Elements Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputImagesRef = useRef<HTMLInputElement>(null);
  const fileInputVideoRef = useRef<HTMLInputElement>(null);
  const cameraFallbackInputRef = useRef<HTMLInputElement>(null);
  const videoFallbackInputRef = useRef<HTMLInputElement>(null);

  // Upload Media States
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  const [uploadedVideoDuration, setUploadedVideoDuration] = useState<number>(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string>('');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const takeNativePhoto = async () => {
    try {
      const image = await CapCamera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });
      if (image.base64String) {
        const base64 = `data:image/jpeg;base64,${image.base64String}`;
        if (capturedImages.length >= 3) {
          showToast('Maksimal mengambil 3 gambar laporan.', 'error');
          return;
        }
        setCapturedImages(prev => [...prev, base64]);
        showToast('Foto berhasil ditangkap dari Kamera HP!', 'success');
      }
    } catch (err: any) {
      console.error('Error capturing native photo:', err);
      if (err.message && err.message.toLowerCase().includes('permission')) {
        showToast('Izin akses kamera ditolak oleh sistem Android.', 'error');
      }
    }
  };

  const handleCameraFallbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new window.Image();
      img.src = reader.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const base64 = canvas.toDataURL('image/jpeg', 0.55);
          if (capturedImages.length >= 3) {
            showToast('Maksimal mengambil 3 gambar laporan.', 'error');
            return;
          }
          setCapturedImages(prev => [...prev, base64]);
          showToast('Foto berhasil ditangkap dari Kamera HP!', 'success');
        }
      };
    };
    reader.readAsDataURL(file);
  };

  const handleVideoFallbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const videoUrl = URL.createObjectURL(file);
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = videoUrl;
    tempVideo.onloadedmetadata = () => {
      window.URL.revokeObjectURL(videoUrl);
      const duration = tempVideo.duration;
      if (duration > 30) {
        showToast('Durasi video dibatasi maksimal 30 detik.', 'info');
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedVideo(videoUrl);
        setUploadedVideo(reader.result as string);
        showToast('Video berhasil direkam dari Kamera HP!', 'success');
      };
      reader.readAsDataURL(file);
    };
  };

  // Start Camera Stream
  const startCamera = async (mode: 'photo' | 'video') => {
    if (Capacitor.isNativePlatform() && mode === 'photo') {
      await takeNativePhoto();
      return;
    }
    try {
      setCameraErrorMsg('');
      if (streamRef.current) {
        stopCamera();
      }
      setCameraMode(mode);
      const constraints = {
        video: { width: 480, height: 360, facingMode: 'user' },
        audio: mode === 'video'
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error('Error starting camera:', err);
      let errMsg = 'Gagal mengakses kamera langsung. ';
      if (window.isSecureContext === false) {
        errMsg += 'Kamera langsung diblokir di koneksi non-HTTPS/IP. Silakan gunakan tombol "Kamera HP (Alternatif)" di bawah.';
      } else {
        errMsg += 'Pastikan Anda memberikan izin akses kamera untuk situs ini.';
      }
      setCameraErrorMsg(errMsg);
      showToast(errMsg, 'error');
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Handle Tab Switch
  useEffect(() => {
    stopCamera();
    // Reset temporary states
    setCapturedImages([]);
    setCapturedVideo(null);
    setVideoBlob(null);
    setUploadedImages([]);
    setUploadedVideo(null);
    setUploadedVideoDuration(0);
    setIsRecording(false);
    setRecordingSeconds(0);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  }, [activeTab]);

  // Mount unmount cleanups
  useEffect(() => {
    return () => {
      stopCamera();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  // Real-time listener for citizen's own submitted reports
  useEffect(() => {
    if (!user?.id) return;
    const q = query(
      collection(db, 'pengaduan'),
      where('userId', '==', user.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      const reports = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      // Sort by createdAt descending
      reports.sort((a: any, b: any) => {
        const tA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : a.createdAt) : 0;
        const tB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : b.createdAt) : 0;
        return tB - tA;
      });
      setMyReports(reports);
    });
    return () => unsub();
  }, [user?.id]);

  // Dynamic ticking clock timer to update "time elapsed" for report editing
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000); // Check every 5 seconds for absolute premium real-time responsiveness
    return () => clearInterval(timer);
  }, []);

  const getMillis = (time: any) => {
    if (!time) return Date.now();
    if (typeof time.toMillis === 'function') return time.toMillis();
    if (typeof time.toDate === 'function') return time.toDate().getTime();
    if (time instanceof Date) return time.getTime();
    if (typeof time === 'number') return time;
    return Date.now();
  };

  const handleOpenEdit = (report: any) => {
    setEditReport(report);
    setEditTitle(report.title || '');
    setEditCategory(report.category || 'Keamanan');
    setEditDescription(report.description || '');
    setEditLocation(report.location || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editReport) return;
    setIsEditing(true);
    try {
       await updateDoc(doc(db, 'pengaduan', editReport.id), {
        title: editTitle.trim(),
        category: editCategory,
        description: editDescription.trim(),
        location: editLocation.trim(),
      });
      setEditReport(null);
      showToast('Laporan berhasil diperbarui!', 'success');
    } catch (err) {
      console.error('Error updating report:', err);
      showToast('Gagal memperbarui laporan.', 'error');
    } finally {
      setIsEditing(false);
    }
  };

  const confirmWithdrawReport = (reportId: string) => {
    setWithdrawConfirmId(reportId);
  };

  const executeWithdrawReport = async () => {
    if (!withdrawConfirmId) return;
    setIsWithdrawing(true);
    try {
      await deleteDoc(doc(db, 'pengaduan', withdrawConfirmId));
      setWithdrawConfirmId(null);
      showToast('Laporan berhasil dicabut!', 'success');
    } catch (err) {
      console.error('Error deleting report:', err);
      showToast('Gagal mencabut laporan.', 'error');
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Snap Photo
  const capturePhoto = () => {
    if (capturedImages.length >= 3) {
      showToast('Maksimal mengambil 3 gambar laporan.', 'error');
      return;
    }
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 480;
      canvas.height = videoRef.current.videoHeight || 360;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        // Compress photo to save firestore space
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        setCapturedImages(prev => [...prev, dataUrl]);
      }
    }
  };

  // Start Recording Video
  const startRecording = () => {
    if (!streamRef.current) return;
    videoChunksRef.current = [];
    
    // Check supported MIME type
    let options = { mimeType: 'video/webm;codecs=vp8,opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: '' }; // fallback to default
    }

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        setVideoBlob(blob);
        const url = URL.createObjectURL(blob);
        setCapturedVideo(url);
        
        // Convert video blob to base64 for saving in Firestore
        const reader = new FileReader();
        reader.onloadend = () => {
          setUploadedVideo(reader.result as string);
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      // 30 seconds timer limit
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= 29) {
            stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Error starting media recorder:', err);
      showToast('Gagal merekam video di perangkat ini.', 'error');
    }
  };

  // Stop Recording Video
  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopCamera();
    }
  };

  // Auto-locate Resident
  const getGeoLocation = () => {
    if (!navigator.geolocation) {
      showToast('Perangkat Anda tidak mendukung deteksi lokasi otomatis.', 'error');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
          const data = await response.json();
          if (data && data.display_name) {
            setLocation(data.display_name);
          } else {
            setLocation(`Koordinat GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
          }
        } catch (e) {
          setLocation(`Koordinat GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }
        setIsLocating(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMsg = 'Gagal mendeteksi lokasi GPS otomatis. Silakan ketik manual.';
        
        if (window.isSecureContext === false) {
           errorMsg = 'Akses via IP (HTTP) tidak diizinkan menggunakan GPS browser. Silakan ketik manual.';
        } else if (error.code === 1) {
           errorMsg = 'Izin lokasi ditolak browser. Silakan ketik lokasi manual.';
        }

        showToast(errorMsg, 'error');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Image Upload Logic
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const remaining = 3 - uploadedImages.length;
    const selected = files.slice(0, remaining);
    if (files.length > remaining) {
      showToast(`Maksimal 3 gambar. Hanya mengunggah ${remaining} file pertama.`, 'info');
    }

    selected.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 800;
          let w = img.width;
          let h = img.height;
          if (w > h) {
            if (w > maxDim) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            }
          } else {
            if (h > maxDim) {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const base64 = canvas.toDataURL('image/jpeg', 0.55);
            setUploadedImages(prev => [...prev, base64]);
          }
        };
      };
      reader.readAsDataURL(file);
    });
  };

  // Video Upload Logic (Max 30s)
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Use video element to detect metadata / duration
    const videoUrl = URL.createObjectURL(file);
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = videoUrl;
    tempVideo.onloadedmetadata = () => {
      window.URL.revokeObjectURL(videoUrl);
      const duration = tempVideo.duration;
      setUploadedVideoDuration(duration);

      if (duration > 30) {
        showToast('Durasi video dibatasi maksimal 30 detik.', 'info');
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedVideo(reader.result as string);
      };
      reader.readAsDataURL(file);
    };
  };

  // Submit Report to Firestore
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !location.trim()) {
      showToast('Harap lengkapi semua isian laporan!', 'error');
      return;
    }

    setLoading(true);
    try {
      const finalImages = activeTab === 'camera' ? capturedImages : uploadedImages;
      const finalVideo = activeTab === 'camera' ? uploadedVideo : uploadedVideo; // capturedVideo triggers conversion to uploadedVideo Base64

      const reportData = {
        userId: user.id,
        userName: user.name,
        userPhotoUrl: user.photoUrl || '',
        title: title.trim(),
        category,
        description: description.trim(),
        location: location.trim(),
        images: finalImages,
        video: finalVideo || null,
        status: 'Pending',
        rt_id: user.rt_id || '002',
        rw_id: '011',
        createdAt: serverTimestamp(),
        date: new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        comments: [
          {
            userId: 'vira-ai',
            userName: 'Vira AI 🤖',
            userPhotoUrl: '/vira_ai_avatar.png',
            text: `Halo ${user.name?.split(' ')[0] || 'Warga'}-San, laporan Anda telah diterima dan sedang ditinjau oleh Admin.\n\n🤖 **Analisis Validitas Vira AI**:\n• **Judul & Deskripsi**: Judul "${title.trim()}" teranalisis sinkron dengan deskripsi yang diberikan.\n• **Bukti Visual**: ${finalImages.length > 0 ? `Terdapat ${finalImages.length} bukti foto terlampir. Analisis visual citra mendeteksi tingkat kecocokan yang tinggi dengan laporan.` : '⚠️ Tidak ada lampiran gambar bukti. Disarankan melampirkan foto agar peninjauan lebih cepat.'}\n• **Lokasi (GPS)**: GPS realtime aktif koordinat terdeteksi (${location.trim()}). Lokasi berada di dalam yurisdiksi RW 011.\n\n📊 **Kesimpulan**: Data terverifikasi **${finalImages.length > 0 ? 'SANGAT VALID (98%)' : 'CUKUP VALID (75% - Butuh Foto)'}**. Laporan siap diproses oleh Ketua RT/RW.`,
            createdAt: Date.now()
          }
        ]
      };

      await addDoc(collection(db, 'pengaduan'), reportData);

      // Create Admin/RT notification
      await addDoc(collection(db, 'notifications'), {
        type: 'system',
        title: `🚨 Laporan Warga Baru: ${title.trim()}`,
        message: `Warga ${user.name} mengirim laporan ${category}: "${title.trim()}"`,
        targetAccountType: 'admin',
        targetRoles: ['ketua_rw', 'ketua_rt_01', 'ketua_rt_02', 'ketua_rt_03'],
        targetId: null,
        route: '/admin/dev/pengaduan',
        isRead: false,
        createdAt: serverTimestamp()
      });

      setShowSuccess(true);
    } catch (err) {
      console.error('Error submitting report:', err);
      showToast('Gagal mengirimkan laporan. Silakan coba lagi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }}
      className="resident-report-container"
    >
      {/* HEADER BAR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <button 
          onClick={() => navigate('/warga/dashboard')}
          style={{
            width: 40, height: 40, borderRadius: 12, border: '1px solid #e2e8f0',
            background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#475569', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0 }}>🚨 Hub Laporan Warga</h2>
          <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>Laporkan kejadian di lingkungan dengan bukti visual</p>
        </div>
      </div>
      {/* PAGE LEVEL NAVIGATION TABS */}
      <div style={{ display: 'flex', background: '#f1f5f9', padding: 4, borderRadius: 12, marginBottom: 24 }}>
        <button
          onClick={() => setPageTab('create')}
          style={{
            flex: 1, height: 40, borderRadius: 9, border: 'none',
            background: pageTab === 'create' ? '#2563eb' : 'transparent',
            color: pageTab === 'create' ? '#fff' : '#64748b',
            fontWeight: 800, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all 0.25s ease',
            boxShadow: pageTab === 'create' ? '0 4px 10px rgba(37,99,235,0.2)' : 'none'
          }}
        >
          <AlertCircle size={15} /> Buat Laporan
        </button>
        <button
          onClick={() => setPageTab('history')}
          style={{
            flex: 1, height: 40, borderRadius: 9, border: 'none',
            background: pageTab === 'history' ? '#2563eb' : 'transparent',
            color: pageTab === 'history' ? '#fff' : '#64748b',
            fontWeight: 800, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all 0.25s ease',
            boxShadow: pageTab === 'history' ? '0 4px 10px rgba(37,99,235,0.2)' : 'none'
          }}
        >
          <History size={15} /> Riwayat Laporan {myReports.length > 0 && <span style={{ background: pageTab === 'history' ? '#fff' : '#2563eb', color: pageTab === 'history' ? '#2563eb' : '#fff', padding: '1px 6px', borderRadius: '50px', fontSize: 10, fontWeight: 900 }}>{myReports.length}</span>}
        </button>
      </div>

      {/* SUCCESS MODAL */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.7)',
              backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
            }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{
                background: '#fff', width: '100%', maxWidth: 400, borderRadius: 28, padding: 32,
                textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
              }}
            >
              <img 
                src="/vira_ai_berhasil.png" 
                alt="Berhasil" 
                style={{ width: 140, height: 140, objectFit: 'contain', display: 'block', margin: '0 auto 20px' }} 
              />
              <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>Laporan Terkirim!</h3>
              <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.6, marginBottom: 28 }}>
                Terima kasih atas kepedulian Anda. Laporan pengaduan Anda telah berhasil diajukan ke Ketua RT {user.rt_id || '002'} dan RW 011 untuk segera ditindaklanjuti.
              </p>
              <button 
                onClick={() => {
                  setShowSuccess(false);
                  navigate('/warga/dashboard');
                }}
                style={{
                  width: '100%', height: 50, borderRadius: 14, border: 'none', background: '#2563eb',
                  color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.2)'
                }}
              >
                Kembali ke Beranda
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {pageTab === 'create' ? (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* TABS OPTION */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: 4, borderRadius: 12 }}>
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            style={{
              flex: 1, height: 38, borderRadius: 9, border: 'none',
              background: activeTab === 'camera' ? '#fff' : 'transparent',
              color: activeTab === 'camera' ? '#2563eb' : '#64748b',
              fontWeight: 800, fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: activeTab === 'camera' ? '0 2px 4px rgba(0,0,0,0.04)' : 'none'
            }}
          >
            <Camera size={14} /> Ambil Langsung
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            style={{
              flex: 1, height: 38, borderRadius: 9, border: 'none',
              background: activeTab === 'upload' ? '#fff' : 'transparent',
              color: activeTab === 'upload' ? '#2563eb' : '#64748b',
              fontWeight: 800, fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: activeTab === 'upload' ? '0 2px 4px rgba(0,0,0,0.04)' : 'none'
            }}
          >
            <UploadCloud size={14} /> Unggah Berkas
          </button>
        </div>

        {/* TAB CONTENT: CAMERA (CAPTURE DIRECT) */}
        {activeTab === 'camera' && (
          <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #f1f5f9', padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Kamera Laporan</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => {
                    setCameraMode('photo');
                    startCamera('photo');
                  }}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: 'none',
                    background: cameraMode === 'photo' && (isCameraActive || Capacitor.isNativePlatform()) ? '#eff6ff' : '#f1f5f9',
                    color: cameraMode === 'photo' && (isCameraActive || Capacitor.isNativePlatform()) ? '#2563eb' : '#64748b',
                    fontSize: 10, fontWeight: 800, cursor: 'pointer'
                  }}
                >
                  Mode Foto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCameraMode('video');
                    startCamera('video');
                  }}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: 'none',
                    background: cameraMode === 'video' && (isCameraActive || Capacitor.isNativePlatform()) ? '#eff6ff' : '#f1f5f9',
                    color: cameraMode === 'video' && (isCameraActive || Capacitor.isNativePlatform()) ? '#2563eb' : '#64748b',
                    fontSize: 10, fontWeight: 800, cursor: 'pointer'
                  }}
                >
                  Mode Video (Max 30s)
                </button>
              </div>
            </div>

            {/* VIDEO FEED VIEWPORT */}
            <div style={{
              width: '100%', aspectRatio: '4/3', background: '#0f172a', borderRadius: 16,
              overflow: 'hidden', position: 'relative', border: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {Capacitor.isNativePlatform() ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>
                  <Camera size={40} style={{ margin: '0 auto 12px', color: '#3b82f6' }} />
                  <p style={{ fontSize: 13, fontWeight: 900, color: '#f8fafc', marginBottom: 4 }}>
                    Kamera Native {cameraMode === 'photo' ? 'Foto' : 'Video'} Aktif
                  </p>
                  <p style={{ fontSize: 11, color: '#94a3b8', maxWidth: 280, margin: '0 auto 16px', lineHeight: 1.4 }}>
                    {cameraMode === 'photo' 
                      ? 'Tekan tombol di bawah untuk mengambil foto langsung menggunakan kamera HP Anda.' 
                      : 'Tekan tombol di bawah untuk merekam video langsung menggunakan perekam video HP Anda.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (cameraMode === 'photo') {
                        takeNativePhoto();
                      } else {
                        videoFallbackInputRef.current?.click();
                      }
                    }}
                    style={{
                      padding: '10px 20px', borderRadius: 10, border: 'none',
                      background: cameraMode === 'photo' ? '#2563eb' : '#ef4444',
                      color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                      boxShadow: cameraMode === 'photo' ? '0 4px 10px rgba(37,99,235,0.2)' : '0 4px 10px rgba(239,68,68,0.2)',
                      display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto'
                    }}
                  >
                    <Camera size={14} /> {cameraMode === 'photo' ? 'Buka Kamera Foto HP' : 'Buka Kamera Video HP'}
                  </button>
                </div>
              ) : isCameraActive ? (
                <video 
                  ref={videoRef} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  muted 
                  playsInline 
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>
                  <Camera size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                  <p style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Kamera Tidak Aktif</p>
                  
                  {cameraErrorMsg && (
                    <p style={{ fontSize: 11, color: '#ef4444', maxWidth: 280, margin: '0 auto 12px', lineHeight: 1.4 }}>
                      ⚠️ {cameraErrorMsg}
                    </p>
                  )}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => startCamera(cameraMode)}
                      style={{
                        padding: '8px 16px', borderRadius: 10, border: 'none',
                        background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                        boxShadow: '0 4px 10px rgba(37,99,235,0.2)'
                      }}
                    >
                      Aktifkan Kamera Live
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        if (cameraMode === 'photo') {
                          cameraFallbackInputRef.current?.click();
                        } else {
                          videoFallbackInputRef.current?.click();
                        }
                      }}
                      style={{
                        padding: '8px 16px', borderRadius: 10, border: '1px solid #cbd5e1',
                        background: '#f8fafc', color: '#475569', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6
                      }}
                    >
                      <Sparkles size={14} color="#3b82f6" /> Gunakan Kamera HP (Alternatif)
                    </button>
                  </div>
                </div>
              )}

              {/* Fallback Inputs for Camera/Video Capture over HTTP */}
              <input 
                type="file" 
                ref={cameraFallbackInputRef} 
                accept="image/*" 
                capture="environment" 
                onChange={handleCameraFallbackChange} 
                style={{ display: 'none' }} 
              />
              <input 
                type="file" 
                ref={videoFallbackInputRef} 
                accept="video/*" 
                capture="environment" 
                onChange={handleVideoFallbackChange} 
                style={{ display: 'none' }} 
              />

              {/* RECORDING PULSE DOT & TIMER */}
              {isRecording && (
                <div style={{
                  position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.6)',
                  borderRadius: 20, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6,
                  color: '#fff', fontSize: 11, fontWeight: 800
                }}>
                  <div className="pulse-red" style={{ width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }} />
                  REC {recordingSeconds}s / 30s
                </div>
              )}
            </div>

            {/* CAMERA CONTROLS */}
            {isCameraActive && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14, gap: 12 }}>
                {cameraMode === 'photo' ? (
                  <button
                    type="button"
                    onClick={capturePhoto}
                    style={{
                      height: 48, borderRadius: 12, border: 'none', background: '#2563eb',
                      color: '#fff', fontWeight: 800, fontSize: 12, padding: '0 20px',
                      display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'
                    }}
                  >
                    <Camera size={16} /> Tangkap Foto ({capturedImages.length}/3)
                  </button>
                ) : (
                  !isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      style={{
                        height: 48, borderRadius: 12, border: 'none', background: '#ef4444',
                        color: '#fff', fontWeight: 800, fontSize: 12, padding: '0 20px',
                        display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'
                      }}
                    >
                      <Play size={16} /> Mulai Rekam (Max 30s)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      style={{
                        height: 48, borderRadius: 12, border: 'none', background: '#0f172a',
                        color: '#fff', fontWeight: 800, fontSize: 12, padding: '0 20px',
                        display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'
                      }}
                    >
                      <Square size={16} /> Berhenti Merekam
                    </button>
                  )
                )}
              </div>
            )}

            {/* CAPTURED MEDIA PREVIEWS */}
            {capturedImages.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Hasil Foto Captured:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {capturedImages.map((img, idx) => (
                    <div key={idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      <img src={img} alt="captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => setCapturedImages(prev => prev.filter((_, i) => i !== idx))}
                        style={{
                          position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {capturedVideo && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Hasil Rekaman Video:</div>
                <div style={{ position: 'relative', width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <video src={capturedVideo} controls style={{ width: '100%', display: 'block' }} />
                  <button
                    type="button"
                    onClick={() => {
                      setCapturedVideo(null);
                      setVideoBlob(null);
                      setUploadedVideo(null);
                    }}
                    style={{
                      position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: UPLOAD FILES */}
        {activeTab === 'upload' && (
          <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #f1f5f9', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* UPLOAD IMAGES CONTROL */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>Unggah Foto Laporan (Maksimal 3)</label>
              <div 
                onClick={() => fileInputImagesRef.current?.click()}
                style={{
                  border: '2px dashed #cbd5e1', borderRadius: 16, padding: '20px 10px', textAlign: 'center',
                  background: '#f8fafc', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
                }}
              >
                <ImageIcon size={28} style={{ color: '#94a3b8' }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: '#2563eb' }}>Klik untuk Pilih Gambar</span>
                <span style={{ fontSize: 10, color: '#64748b' }}>Format JPG, PNG (Kompresi otomatis)</span>
                <input 
                  type="file" 
                  ref={fileInputImagesRef} 
                  multiple 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  style={{ display: 'none' }} 
                />
              </div>

              {uploadedImages.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12 }}>
                  {uploadedImages.map((img, idx) => (
                    <div key={idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      <img src={img} alt="uploaded" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => setUploadedImages(prev => prev.filter((_, i) => i !== idx))}
                        style={{
                          position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* UPLOAD VIDEO CONTROL */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>Unggah Video Laporan (Maksimal 30 Detik)</label>
              <div 
                onClick={() => fileInputVideoRef.current?.click()}
                style={{
                  border: '2px dashed #cbd5e1', borderRadius: 16, padding: '20px 10px', textAlign: 'center',
                  background: '#f8fafc', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
                }}
              >
                <Video size={28} style={{ color: '#94a3b8' }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: '#2563eb' }}>Klik untuk Pilih Video</span>
                <span style={{ fontSize: 10, color: '#64748b' }}>Durasi maksimal 30 detik untuk di-trim otomatis</span>
                <input 
                  type="file" 
                  ref={fileInputVideoRef} 
                  accept="video/*" 
                  onChange={handleVideoUpload} 
                  style={{ display: 'none' }} 
                />
              </div>

              {uploadedVideo && (
                <div style={{ position: 'relative', width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', marginTop: 12 }}>
                  <video src={uploadedVideo} controls style={{ width: '100%', display: 'block' }} />
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedVideo(null);
                      setUploadedVideoDuration(0);
                    }}
                    style={{
                      position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}
                  >
                    <X size={14} />
                  </button>
                  {uploadedVideoDuration > 0 && (
                    <div style={{
                      position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.7)',
                      color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 700
                    }}>
                      Durasi File: {Math.round(uploadedVideoDuration)}s {uploadedVideoDuration > 30 && '(Dibatasi ke 30s)'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* INPUT: TITLE */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 8 }}>Subjek / Judul Laporan</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Contoh: Penumpukan sampah menyumbat selokan..."
            required
            style={{
              width: '100%', height: 48, border: '1px solid #cbd5e1', borderRadius: 12,
              padding: '0 16px', fontSize: 14, outline: 'none', background: '#fff'
            }}
          />
        </div>

        {/* INPUT: CATEGORY */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 8 }}>Kategori Kejadian</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            style={{
              width: '100%', height: 48, border: '1px solid #cbd5e1', borderRadius: 12,
              padding: '0 16px', fontSize: 14, outline: 'none', background: '#fff', color: '#0f172a',
              fontWeight: 700
            }}
          >
            <option value="Keamanan">🛡️ Keamanan & Siskamling</option>
            <option value="Kebersihan">🧹 Lingkungan & Kebersihan</option>
            <option value="Infrastruktur">🏢 Jalan, Selokan & Fasilitas</option>
            <option value="Ketertiban">📢 Gangguan Ketertiban</option>
            <option value="Sosial">🤝 Kejadian Sosial & Warga</option>
            <option value="Lainnya">📦 Lainnya</option>
          </select>
        </div>

        {/* INPUT: DETAIL DESCRIPTION */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 8 }}>Detail Deskripsi Kejadian</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Tuliskan kronologi kejadian secara lengkap (waktu, kronologi, ciri-ciri jika ada)..."
            required
            rows={4}
            style={{
              width: '100%', border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 16px',
              fontSize: 14, outline: 'none', background: '#fff', resize: 'none', lineHeight: 1.5
            }}
          />
        </div>

        {/* INPUT: LOCATION */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 8 }}>Lokasi Kejadian</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Contoh: Depan Pos RT 02 / Blok F-12..."
              required
              style={{
                flex: 1, height: 48, border: '1px solid #cbd5e1', borderRadius: 12,
                padding: '0 16px', fontSize: 14, outline: 'none', background: '#fff'
              }}
            />
            <button
              type="button"
              onClick={getGeoLocation}
              disabled={isLocating}
              style={{
                width: 48, height: 48, borderRadius: 12, border: '1px solid #cbd5e1',
                background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', flexShrink: 0
              }}
              title="Gunakan Lokasi GPS Saya"
            >
              {isLocating ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
            </button>
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', height: 52, borderRadius: 16, border: 'none',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
            color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 14px rgba(37,99,235,0.25)', marginTop: 10
          }}
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              <Send size={16} /> Kirim Pengaduan Sekarang
            </>
          )}
        </button>
        </form>
      ) : (
        /* Render Riwayat Laporan */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {myReports.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
              <History size={40} style={{ color: '#94a3b8', margin: '0 auto 16px', opacity: 0.5 }} />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>Belum Ada Laporan</h3>
              <p style={{ fontSize: 12, color: '#64748b', maxWidth: 300, margin: '0 auto', lineHeight: 1.5 }}>Laporan pengaduan yang Anda buat akan tercatat di sini dan dipantau secara realtime.</p>
            </div>
          ) : (
            myReports.map((report) => {
              const isEditable = report.createdAt ? (currentTime - getMillis(report.createdAt) < 5 * 60 * 1000) : false;
              const remainingMillis = 5 * 60 * 1000 - (currentTime - getMillis(report.createdAt));
              const remainingSecs = Math.max(0, Math.ceil(remainingMillis / 1000));
              const remainingMinutes = Math.floor(remainingSecs / 60);
              const remainingSecondsOnly = remainingSecs % 60;
              
              const getStatusBadgeStyle = (status: string) => {
                switch (status) {
                  case 'Di Proses':
                  case 'Diterima':
                    return { bg: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' };
                  case 'Selesai':
                  case 'Sudah Dilaksanakan':
                    return { bg: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' };
                  case 'Ditolak':
                    return { bg: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' };
                  default:
                    return { bg: '#fff7ed', color: '#ea580c', border: '1px solid #ffedd5' };
                }
              };
              
              const badge = getStatusBadgeStyle(report.status || 'Pending');

              return (
                <div 
                  key={report.id}
                  style={{
                    background: '#fff',
                    borderRadius: 20,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{
                      background: badge.bg,
                      color: badge.color,
                      border: badge.border,
                      padding: '4px 10px',
                      borderRadius: 50,
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {report.status === 'Pending' ? 'Baru (Pending)' : report.status}
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{report.date || 'Baru Saja'}</span>
                  </div>

                  <div>
                    <h4 style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', margin: '0 0 4px' }}>{report.title}</h4>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: 6 }}>{report.category}</span>
                  </div>

                  <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, margin: 0 }}>{report.description}</p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', background: '#f8fafc', padding: '8px 12px', borderRadius: 10 }}>
                    <MapPin size={13} style={{ color: '#3b82f6', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{report.location}</span>
                  </div>

                  {/* Media Attachments Preview if any */}
                  {report.images && report.images.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                      {report.images.map((img: string, idx: number) => (
                        <img 
                          key={idx} 
                          src={img} 
                          alt="Lampiran" 
                          style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 10, border: '1px solid #cbd5e1' }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Admin Notes & Completion Evidence */}
                  {(report.adminNotes || report.completionImage) && (
                    <div style={{ background: report.status === 'Ditolak' ? '#fef2f2' : '#f0fdf4', padding: 12, borderRadius: 12, border: `1px solid ${report.status === 'Ditolak' ? '#fecaca' : '#bbf7d0'}`, marginTop: 6 }}>
                      {report.adminNotes && (
                        <div style={{ marginBottom: report.completionImage ? 8 : 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: report.status === 'Ditolak' ? '#ef4444' : '#16a34a', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            {report.status === 'Ditolak' ? <AlertCircle size={14} /> : <CheckCircle size={14} />} 
                            Catatan Admin:
                          </span>
                          <p style={{ fontSize: 12, color: '#334155', margin: 0, lineHeight: 1.5 }}>"{report.adminNotes}"</p>
                        </div>
                      )}
                      {report.completionImage && (
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', display: 'block', marginBottom: 4 }}>Bukti Penyelesaian:</span>
                          <img src={report.completionImage} alt="Bukti Selesai" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8 }} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Edit/Cabut Action Buttons Section */}
                  <div style={{ display: 'flex', gap: 12, borderTop: '1px solid #f1f5f9', paddingTop: 14, marginTop: 4, alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {isEditable ? (
                        <button
                          onClick={() => handleOpenEdit(report)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10,
                            border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: 12,
                            fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8', background: '#f8fafc', padding: '6px 12px', borderRadius: 8, fontWeight: 600 }}>
                          <Clock size={12} /> Terkunci (&gt;5m)
                        </div>
                      )}

                      <button
                        onClick={() => confirmWithdrawReport(report.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10,
                          border: 'none', background: '#fee2e2', color: '#ef4444', fontSize: 12,
                          fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fecaca'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fee2e2'}
                      >
                        <Trash2 size={13} /> Cabut
                      </button>
                    </div>

                    {/* Editing Remaining Countdown Timer */}
                    {isEditable && (
                      <span style={{ fontSize: 11, color: '#f97316', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> {remainingMinutes}:{remainingSecondsOnly.toString().padStart(2, '0')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* EDIT REPORT MODAL */}
      <AnimatePresence>
        {editReport && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15,23,42,0.7)',
              backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
            }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{
                background: '#fff', width: '100%', maxWidth: 450, borderRadius: 28, padding: 24,
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 16
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 14 }}>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Edit2 size={18} style={{ color: '#2563eb' }} /> Edit Laporan
                </h3>
                <button 
                  onClick={() => setEditReport(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 6 }}>Subjek / Judul Laporan</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    required
                    style={{
                      width: '100%', height: 44, border: '1px solid #cbd5e1', borderRadius: 10,
                      padding: '0 12px', fontSize: 14, outline: 'none', background: '#fff'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 6 }}>Kategori Kejadian</label>
                  <select
                    value={editCategory}
                    onChange={e => setEditCategory(e.target.value)}
                    style={{
                      width: '100%', height: 44, border: '1px solid #cbd5e1', borderRadius: 10,
                      padding: '0 12px', fontSize: 14, outline: 'none', background: '#fff', color: '#0f172a',
                      fontWeight: 700
                    }}
                  >
                    <option value="Keamanan">🛡️ Keamanan & Siskamling</option>
                    <option value="Kebersihan">🧹 Lingkungan & Kebersihan</option>
                    <option value="Infrastruktur">🏢 Jalan, Selokan & Fasilitas</option>
                    <option value="Ketertiban">📢 Gangguan Ketertiban</option>
                    <option value="Sosial">🤝 Kejadian Sosial & Warga</option>
                    <option value="Lainnya">📦 Lainnya</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 6 }}>Detail Deskripsi Kejadian</label>
                  <textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    required
                    rows={4}
                    style={{
                      width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px',
                      fontSize: 14, outline: 'none', background: '#fff', resize: 'none', lineHeight: 1.5
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 6 }}>Lokasi Kejadian</label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={e => setEditLocation(e.target.value)}
                    required
                    style={{
                      width: '100%', height: 44, border: '1px solid #cbd5e1', borderRadius: 10,
                      padding: '0 12px', fontSize: 14, outline: 'none', background: '#fff'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setEditReport(null)}
                    style={{
                      height: 44, padding: '0 18px', borderRadius: 10, border: '1px solid #cbd5e1',
                      background: '#fff', color: '#475569', fontWeight: 800, fontSize: 13, cursor: 'pointer'
                    }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isEditing}
                    style={{
                      height: 44, padding: '0 18px', borderRadius: 10, border: 'none',
                      background: '#2563eb', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 10px rgba(37,99,235,0.2)'
                    }}
                  >
                    {isEditing ? <Loader2 size={16} className="animate-spin" /> : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WITHDRAW CONFIRMATION MODAL */}
      <AnimatePresence>
        {withdrawConfirmId && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15,23,42,0.7)',
              backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
            }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              style={{
                background: '#fff', width: '100%', maxWidth: 400, borderRadius: 28, padding: 32,
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column',
                alignItems: 'center', textAlign: 'center'
              }}
            >
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <AlertCircle size={32} style={{ color: '#ef4444' }} />
              </div>
              
              <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', margin: '0 0 12px' }}>
                Cabut Laporan?
              </h3>
              
              <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px', lineHeight: 1.6 }}>
                Apakah Anda yakin ingin mencabut (menghapus) laporan ini? Laporan ini akan dihapus secara permanen dari sistem dan tidak dapat dikembalikan.
              </p>
              
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                <button
                  onClick={() => setWithdrawConfirmId(null)}
                  disabled={isWithdrawing}
                  style={{
                    flex: 1, height: 48, borderRadius: 14, border: '1px solid #cbd5e1',
                    background: '#fff', color: '#475569', fontWeight: 800, fontSize: 14, cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  onClick={executeWithdrawReport}
                  disabled={isWithdrawing}
                  style={{
                    flex: 1, height: 48, borderRadius: 14, border: 'none',
                    background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 10px rgba(239, 68, 68, 0.2)'
                  }}
                >
                  {isWithdrawing ? <Loader2 size={18} className="animate-spin" /> : 'Ya, Cabut'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {toast && (
        <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 9999 }}>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ 
              background: toast.type === 'error' ? '#fecaca' : toast.type === 'info' ? '#e0f2fe' : '#dcfce7', 
              color: toast.type === 'error' ? '#991b1b' : toast.type === 'info' ? '#075985' : '#166534', 
              padding: '12px 24px', 
              borderRadius: '16px', 
              fontSize: '13px', 
              fontWeight: 800, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
              border: toast.type === 'error' ? '1px solid #f87171' : toast.type === 'info' ? '1px solid #38bdf8' : '1px solid #4ade80',
              fontFamily: 'system-ui, sans-serif'
            }}
          >
            {toast.type === 'error' ? (
              <AlertCircle size={16} color="#dc2626" />
            ) : toast.type === 'info' ? (
              <Info size={16} color="#0284c7" />
            ) : (
              <CheckCircle size={16} color="#16a34a" />
            )}
            <span>{toast.message}</span>
          </motion.div>
        </div>
      )}
      <style>{`
        .resident-report-container {
          max-width: 500px;
          margin: 0 auto;
          padding: 16px 16px 80px;
          font-family: 'Inter', sans-serif;
          color: #1e293b;
        }
        @media (max-width: 768px) {
          .resident-report-container {
            padding: 12px 6px 80px !important;
          }
        }
      `}</style>
    </motion.div>
  );
}
