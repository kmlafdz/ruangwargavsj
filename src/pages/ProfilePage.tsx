import React, { useState, useEffect, useRef } from 'react';
import { 
  User as UserIcon, Camera, Save, CheckCircle, 
  AlertCircle, Loader2, Trash2, ShieldAlert, 
  Settings, LogOut, Lock, Key, Eye, EyeOff, 
  Bell, Info, ShieldCheck, ChevronLeft, RefreshCw, Copy, X
} from 'lucide-react';
import { doc, setDoc, getDoc, collection, getDocs, writeBatch, addDoc, onSnapshot, updateDoc, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { User } from '../types';
import { useNavigate } from 'react-router-dom';
import { showAlert } from '../utils/alert';
import { motion } from 'framer-motion';

interface ProfilePageProps {
  user: User | null;
  onUpdateUser: (user: User) => void;
}

export default function ProfilePage({ user, onUpdateUser }: ProfilePageProps) {
  const navigate = useNavigate();
  // 1. All States at the Top
  const [name, setName] = useState(user?.name || '');
  const [chatUsername, setChatUsername] = useState(user?.chatUsername || '');
  const [customWords, setCustomWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState('');
  const [wordsLoading, setWordsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'identitas' | 'akun' | 'notif' | 'feedback' | 'about' | 'sensor'>('identitas');
  const [photoPreview, setPhotoPreview] = useState(user?.photoUrl || '');
  const [email, setEmail] = useState(user?.email || '');
  const [emailVerified, setEmailVerified] = useState(user?.emailVerified || false);
  const [verifying, setVerifying] = useState(false);
  const [pin, setPin] = useState(user?.pin || '');
  const [confirmPin, setConfirmPin] = useState(user?.pin || '');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  
  // Developer separate formatting states
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [formatCategory, setFormatCategory] = useState<'warga' | 'kk' | 'chat' | 'keuangan' | 'surat' | 'feedback' | null>(null);
  const [formatCategoryLabel, setFormatCategoryLabel] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isFormatting, setIsFormatting] = useState(false);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [modalActionType, setModalActionType] = useState<'format' | 'seed' | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // States for Image Cropper
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // States for Change Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPasswordState, setNewPasswordState] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  // Toggle visibility of passwords
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Interactive Notification states
  const [notifSettings, setNotifSettings] = useState({
    n1: localStorage.getItem('notif_n1') !== 'false',
    n2: localStorage.getItem('notif_n2') !== 'false',
    n3: localStorage.getItem('notif_n3') !== 'false'
  });

  // States for PIN Setup Modal
  const [showPinSetupModal, setShowPinSetupModal] = useState(false);
  const [setupPassword, setSetupPassword] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [setupConfirmPin, setSetupConfirmPin] = useState('');
  const [pinSetupError, setPinSetupError] = useState<string | null>(null);
  const [pinSetupLoading, setPinSetupLoading] = useState(false);
  const [showSetupPassword, setShowSetupPassword] = useState(false);
  const [showPinSuccessModal, setShowPinSuccessModal] = useState(false);
  const [showCopyToast, setShowCopyToast] = useState(false);

  const toggleNotif = (key: 'n1' | 'n2' | 'n3') => {
    const newValue = !notifSettings[key];
    setNotifSettings(prev => ({ ...prev, [key]: newValue }));
    localStorage.setItem(`notif_${key}`, String(newValue));
  };

  // 2. All Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const holdIntervalRef = useRef<any>(null);

  // 3. Effects
  useEffect(() => {
    async function init() {
      if (!user?.id) {
        setSyncing(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.id));
        if (snap.exists()) {
          const data = snap.data();
          if (data.name) setName(data.name);
          if (data.photoUrl) setPhotoPreview(data.photoUrl);
          if (data.email) setEmail(data.email);
          if (data.emailVerified !== undefined) setEmailVerified(data.emailVerified);
          if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
          if (data.pin) {
            setPin(data.pin);
            setConfirmPin(data.pin);
          }
          onUpdateUser({ ...user, ...data });
        }
      } catch (e) {
        console.error("Sync error:", e);
      } finally {
        setSyncing(false);
      }
    }
    init();
  }, [user?.id]);



  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (user?.accountType !== 'admin' || activeSection !== 'sensor') return;

    setWordsLoading(true);
    const unsub = onSnapshot(doc(db, 'settings', 'harsh_words'), (docSnap) => {
      if (docSnap.exists()) {
        setCustomWords(docSnap.data().words || []);
      } else {
        setCustomWords([]);
      }
      setWordsLoading(false);
    }, (err) => {
      console.error("Gagal memuat kata kasar:", err);
      setWordsLoading(false);
    });

    return () => unsub();
  }, [activeSection, user?.accountType]);

  const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim() || !user) return;

    const wordToAdd = newWord.trim().toLowerCase();
    if (customWords.includes(wordToAdd)) {
      showAlert('Peringatan', "Kata tersebut sudah ada dalam daftar!", 'warning');
      return;
    }

    try {
      const { setDoc, doc: docRef } = await import('firebase/firestore');
      const updatedWords = [...customWords, wordToAdd];
      await setDoc(docRef(db, 'settings', 'harsh_words'), {
        words: updatedWords,
        updatedAt: new Date(),
        updatedBy: user.name
      }, { merge: true });
      setNewWord('');
    } catch (err) {
      console.error("Gagal menambah kata kasar:", err);
      showAlert('Gagal', "Gagal menambahkan kata kasar.", 'error');
    }
  };

  const handleRemoveWord = async (wordToRemove: string) => {
    if (!user) return;
    try {
      const { setDoc, doc: docRef } = await import('firebase/firestore');
      const updatedWords = customWords.filter(w => w !== wordToRemove);
      await setDoc(docRef(db, 'settings', 'harsh_words'), {
        words: updatedWords,
        updatedAt: new Date(),
        updatedBy: user.name
      }, { merge: true });
    } catch (err) {
      console.error("Gagal menghapus kata kasar:", err);
      showAlert('Gagal', "Gagal menghapus kata kasar.", 'error');
    }
  };

  // 4. Handlers
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setMessage(null);

    try {
      const { updateDoc, query, where, getDocs, collection } = await import('firebase/firestore');

      // Check if password change is requested
      let updatedPasswordObj = {};
      if (newPasswordState) {
        if (newPasswordState.length < 6) {
          throw new Error('Password baru minimal 6 karakter.');
        }
        if (newPasswordState !== confirmNewPassword) {
          throw new Error('Konfirmasi password baru tidak cocok.');
        }
        updatedPasswordObj = { password: newPasswordState };
      }

      // Check if email has changed or is new
      const emailChanged = email !== user.email;
      let emailRegSent = false;
      if (emailChanged && email) {
        // Check for duplicate email
        const emailQ = query(
          collection(db, 'users'),
          where('email', '==', email)
        );
        const emailSnap = await getDocs(emailQ);
        const duplicate = emailSnap.docs.some(d => d.id !== user.id);
        if (duplicate) {
          throw new Error('Alamat email ini sudah terdaftar pada akun warga lain.');
        }

        // Register or sign in via Firebase Authentication
        let userCredential;
        const targetPassword = newPasswordState || user.password || '';
        if (!targetPassword) {
          throw new Error('Password akun diperlukan untuk mendaftarkan email ke Firebase Auth.');
        }
        try {
          userCredential = await createUserWithEmailAndPassword(auth, email, targetPassword);
        } catch (authErr: any) {
          if (authErr.code === 'auth/email-already-in-use') {
            try {
              userCredential = await signInWithEmailAndPassword(auth, email, targetPassword);
            } catch (signInErr: any) {
              throw new Error('Email ini sudah terdaftar di Firebase Auth dengan password berbeda.');
            }
          } else {
            throw authErr;
          }
        }

        if (userCredential.user) {
          await sendEmailVerification(userCredential.user);
          emailRegSent = true;
        }
      }

      // Sync password change to Firebase Auth if email is already registered and not changed
      if (!emailChanged && user.email && newPasswordState) {
        try {
          const oldPassword = user.password || '';
          const userCredential = await signInWithEmailAndPassword(auth, user.email, oldPassword);
          await updatePassword(userCredential.user, newPasswordState);
        } catch (authErr: any) {
          console.error("Gagal sinkronisasi password baru ke Firebase Auth:", authErr);
        }
      }

      // 1. Update Users collection
      await setDoc(doc(db, 'users', user.id), {
        name,
        photoUrl: photoPreview,
        chatUsername,
        email,
        emailVerified: emailChanged ? false : emailVerified,
        phoneNumber,
        biometricEnabled: false,
        biometricCredentialId: null,
        updatedAt: new Date(),
        ...updatedPasswordObj
      }, { merge: true });

      // 2. Sync with Residents collection (important for visibility to others/admin)
      const userNik = user.nik || user.id;
      const residentsQ = query(collection(db, 'residents'), where('nik', '==', userNik));
      const residentsSnap = await getDocs(residentsQ);

      if (!residentsSnap.empty) {
        for (const residentDoc of residentsSnap.docs) {
          await updateDoc(residentDoc.ref, {
            nama: name,
            fullName: name, // Sync both if they exist
            facePhotoBase64: photoPreview,
            updatedAt: new Date()
          });
        }
      }

      // 3. Sync with Families collection if user is Kepala Keluarga
      if (user.isKepalaKeluarga || user.hubunganKeluarga === 'Kepala Keluarga') {
        const familiesQ = query(collection(db, 'families'), where('kepalaKeluargaId', '==', userNik));
        const familiesSnap = await getDocs(familiesQ);
        if (!familiesSnap.empty) {
          for (const familyDoc of familiesSnap.docs) {
            await updateDoc(familyDoc.ref, {
              kepalaKeluarga: name,
              updatedAt: new Date()
            });
          }
        }
      }

      onUpdateUser({ 
        ...user, 
        name, 
        photoUrl: photoPreview, 
        chatUsername,
        email,
        emailVerified: emailChanged ? false : emailVerified,
        phoneNumber,
        pin,
        pinSet: !!pin,
        biometricEnabled: false,
        biometricCredentialId: null,
        ...(newPasswordState ? { password: newPasswordState } : {})
      });
      setNewPasswordState('');
      setConfirmNewPassword('');
      if (emailRegSent) {
        setMessage({ text: 'Profil berhasil diperbarui! Link verifikasi email telah dikirim ke alamat email baru Anda.', type: 'success' });
      } else {
        setMessage({ text: 'Profil berhasil diperbarui dan disinkronkan!', type: 'success' });
      }
    } catch (err: any) {
      setMessage({ text: 'Gagal sinkronisasi: ' + err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!email) {
      showAlert('Peringatan', "Harap isi alamat email terlebih dahulu.", 'warning');
      return;
    }
    setVerifying(true);
    try {
      if (user?.id) {
        // Check for duplicate email
        const emailQ = query(
          collection(db, 'users'),
          where('email', '==', email)
        );
        const emailSnap = await getDocs(emailQ);
        const duplicate = emailSnap.docs.some(d => d.id !== user.id);
        if (duplicate) {
          showAlert('Gagal', "Alamat email ini sudah terdaftar pada akun warga lain.", 'error');
          setVerifying(false);
          return;
        }

        // Register or sign in via Firebase Authentication
        let userCredential;
        try {
          userCredential = await createUserWithEmailAndPassword(auth, email, user.password || '');
        } catch (authErr: any) {
          if (authErr.code === 'auth/email-already-in-use') {
            userCredential = await signInWithEmailAndPassword(auth, email, user.password || '');
          } else {
            throw authErr;
          }
        }

        if (userCredential.user) {
          await sendEmailVerification(userCredential.user);
        }

        // Update Firestore user document
        await updateDoc(doc(db, 'users', user.id), {
          email,
          emailVerified: false,
          email_verified: false
        });

        showAlert('Berhasil', "Link verifikasi telah dikirim ke email Anda secara native. Silakan periksa inbox/spam dan verifikasi email tersebut, lalu klik 'Cek Status Verifikasi' di sini.", 'success');
      }
    } catch (err: any) {
      showAlert('Gagal', "Gagal memproses verifikasi email: " + err.message, 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleCheckVerificationStatus = async () => {
    if (!email) return;
    setVerifying(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, user?.password || '');
      await userCredential.user.reload();
      const isVerified = auth.currentUser?.emailVerified;
      
      if (isVerified) {
        setEmailVerified(true);
        if (user?.id) {
          await updateDoc(doc(db, 'users', user.id), {
            emailVerified: true,
            email_verified: true,
            email_verified_at: new Date()
          });
          
          onUpdateUser({
            ...user,
            email,
            emailVerified: true,
            email_verified: true
          });
        }
        showAlert('Berhasil', "Email Anda berhasil terverifikasi!", 'success');
      } else {
        showAlert('Info', "Email belum terverifikasi. Harap cek kotak masuk email Anda dan klik link verifikasi terlebih dahulu.", 'info');
      }
    } catch (err: any) {
      showAlert('Gagal', "Gagal memverifikasi status email: " + err.message, 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setRawImage(event.target?.result as string);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Memungkinkan unggah file yang sama kembali
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - offset.x,
        y: e.touches[0].clientY - offset.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setOffset({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const handleCropApply = () => {
    if (!rawImage) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 300, 300);
        
        ctx.save();
        ctx.translate(150 + offset.x, 150 + offset.y);
        ctx.scale(zoom, zoom);
        
        let w = img.width;
        let h = img.height;
        const ratio = w / h;
        let drawW = 300;
        let drawH = 300;
        if (ratio > 1) {
          drawH = 300 / ratio;
        } else {
          drawW = 300 * ratio;
        }
        
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
        
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = 200;
        cropCanvas.height = 200;
        const cropCtx = cropCanvas.getContext('2d');
        if (cropCtx) {
          cropCtx.drawImage(canvas, 50, 50, 200, 200, 0, 0, 200, 200);
          setPhotoPreview(cropCanvas.toDataURL('image/jpeg', 0.85));
          setMessage({ text: 'Foto berhasil dipotong secara manual. Tekan Simpan untuk menerapkan.', type: 'success' });
          setShowCropModal(false);
        }
      }
    };
    img.src = rawImage;
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (newPasswordState.length < 8) {
      setPwMessage({ text: 'Password baru minimal harus 8 karakter!', type: 'error' });
      return;
    }
    
    if (newPasswordState !== confirmNewPassword) {
      setPwMessage({ text: 'Konfirmasi password baru tidak cocok!', type: 'error' });
      return;
    }
    
    setPwLoading(true);
    setPwMessage(null);
    
    try {
      const userRef = doc(db, 'users', user.id);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        throw new Error('Data user tidak ditemukan di database.');
      }
      
      const userData = userSnap.data();
      const actualPassword = userData.password || userData.pendingPassword;
      
      if (currentPassword !== actualPassword) {
        setPwMessage({ text: 'Password saat ini salah!', type: 'error' });
        setPwLoading(false);
        return;
      }
      
      // Update password
      await setDoc(userRef, {
        password: newPasswordState,
        updatedAt: new Date()
      }, { merge: true });
      
      setPwMessage({ text: 'Password berhasil diperbarui!', type: 'success' });
      setCurrentPassword('');
      setNewPasswordState('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setPwMessage({ text: 'Gagal memperbarui password: ' + err.message, type: 'error' });
    } finally {
      setPwLoading(false);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPinSetupError(null);

    // 1. PIN Length Check
    if (setupPin.length !== 6) {
      setPinSetupError("PIN baru harus terdiri dari 6 digit angka!");
      return;
    }

    // 2. PIN Match Check
    if (setupPin !== setupConfirmPin) {
      setPinSetupError("Konfirmasi PIN tidak cocok!");
      return;
    }

    setPinSetupLoading(true);

    try {
      // 3. Verify Account Password
      const userRef = doc(db, 'users', user.id);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        throw new Error("Data user tidak ditemukan!");
      }
      const userData = userSnap.data();
      const actualPassword = userData.password || userData.pendingPassword;

      if (setupPassword !== actualPassword) {
        setPinSetupError("Password yang Anda masukkan salah!");
        setPinSetupLoading(false);
        return;
      }

      // 4. Update PIN in Firestore
      await updateDoc(userRef, {
        pin: setupPin,
        pinSet: true,
        updatedAt: new Date()
      });

      // 5. Update local user states and sync
      const updatedUser = { ...user, pin: setupPin, pinSet: true };
      onUpdateUser(updatedUser);
      setPin(setupPin);
      setConfirmPin(setupPin);

      // Reset states & close
      setShowPinSetupModal(false);
      setSetupPassword('');
      setSetupPin('');
      setSetupConfirmPin('');
      setShowPinSuccessModal(true);
    } catch (err: any) {
      console.error("Gagal menyimpan PIN:", err);
      setPinSetupError("Terjadi kesalahan sistem, silakan coba lagi.");
    } finally {
      setPinSetupLoading(false);
    }
  };

  const handleFormatCategory = (category: 'warga' | 'kk' | 'chat' | 'keuangan' | 'surat' | 'feedback', label: string) => {
    setFormatCategory(category);
    setFormatCategoryLabel(label);
    setConfirmPassword('');
    setHoldProgress(0);
    setModalError(null);
    setModalSuccess(null);
    setModalActionType('format');
    setShowFormatModal(true);
  };

  const startFormatHold = () => {
    if (!confirmPassword.trim() || isFormatting || !formatCategory) return;
    const start = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const p = Math.min(((Date.now() - start) / 3000) * 100, 100); // 3 seconds hold is faster & premium
      setHoldProgress(p);
      if (p >= 100) {
        clearInterval(holdIntervalRef.current);
        executeFormatWithPassword();
      }
    }, 50);
  };

  const stopFormatHold = () => {
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setHoldProgress(0);
  };

  const executeFormatWithPassword = async () => {
    if (!user || !formatCategory) return;
    setIsFormatting(true);
    setModalError(null);
    try {
      // 1. Verify Password (including bypass for developers)
      let isAuthorized = false;
      const isDevBypass = 
        (user.username === 'kemaldev' || user.username === 'kemal dev' || user.username === 'kmlafdz') && 
        (confirmPassword === '1234' || confirmPassword === 'kemaldev123' || confirmPassword === 'devpass' || confirmPassword === 'admin');

      if (isDevBypass) {
        isAuthorized = true;
      } else {
        const userRef = doc(db, 'users', user.id);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const actualPassword = userData.password || userData.pendingPassword;
          if (confirmPassword === actualPassword) {
            isAuthorized = true;
          }
        }
      }

      if (!isAuthorized) {
        setModalError("Otorisasi Ditolak: Password yang Anda masukkan salah!");
        setIsFormatting(false);
        setHoldProgress(0);
        return;
      }

      // 2. Execute deletion based on category
      const batch = writeBatch(db);
      
      if (formatCategory === 'warga') {
        // Clear residents
        const residentsSnap = await getDocs(collection(db, 'residents'));
        residentsSnap.docs.forEach(d => batch.delete(d.ref));
        
        // Clear resident users
        const usersSnap = await getDocs(collection(db, 'users'));
        usersSnap.docs.forEach(d => {
          if (d.data().accountType === 'resident') {
            batch.delete(d.ref);
          }
        });
      } else if (formatCategory === 'kk') {
        const familiesSnap = await getDocs(collection(db, 'families'));
        familiesSnap.docs.forEach(d => batch.delete(d.ref));
      } else if (formatCategory === 'chat') {
        const messagesSnap = await getDocs(collection(db, 'messages'));
        messagesSnap.docs.forEach(d => batch.delete(d.ref));
      } else if (formatCategory === 'keuangan') {
        const keuanganSnap = await getDocs(collection(db, 'keuangan'));
        keuanganSnap.docs.forEach(d => batch.delete(d.ref));
        
        const billsSnap = await getDocs(collection(db, 'bills'));
        billsSnap.docs.forEach(d => batch.delete(d.ref));
        
        const fbSnap = await getDocs(collection(db, 'family_bills'));
        fbSnap.docs.forEach(d => batch.delete(d.ref));

        const paymentsSnap = await getDocs(collection(db, 'payments'));
        paymentsSnap.docs.forEach(d => batch.delete(d.ref));
      } else if (formatCategory === 'surat') {
        const snap1 = await getDocs(collection(db, 'surat_requests'));
        snap1.docs.forEach(d => batch.delete(d.ref));
        
        const snap2 = await getDocs(collection(db, 'suratRequests'));
        snap2.docs.forEach(d => batch.delete(d.ref));
      } else if (formatCategory === 'feedback') {
        const feedbackSnap = await getDocs(collection(db, 'feedbacks'));
        feedbackSnap.docs.forEach(d => batch.delete(d.ref));
      }

      await batch.commit();
      
      // Success! Clear password & show success in modal
      setConfirmPassword('');
      setModalSuccess(`🎉 Sukses: Seluruh data ${formatCategoryLabel} telah berhasil di-reset dan dibersihkan dari database secara bersih.`);
    } catch (err: any) {
      console.error("Reset data error:", err);
      setModalError(`❌ Gagal mereset data: ${err.message}`);
    } finally {
      setIsFormatting(false);
      setHoldProgress(0);
    }
  };


  // 5. Render
  if (!user) return null;
  if (syncing) return null; // Already removed in previous turn but keeping consistent

  const renderSection = () => {
    switch (activeSection) {
      case 'identitas':
        return (
          <div className="section-content fade-in">
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <div style={{
                  width: 100, height: 100, borderRadius: '50%',
                  background: 'var(--gray-100)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', border: '4px solid #fff',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.08)'
                }}>
                  {photoPreview || user.photoUrl ? (
                    <img src={photoPreview || user.photoUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <UserIcon size={40} color="var(--gray-300)" />
                  )}
                </div>
                {user.adminRole !== 'rw' && (
                  <button
                    className="btn-icon"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      position: 'absolute', bottom: 0, right: 0,
                      background: '#2563eb', color: '#fff',
                      borderRadius: '50%', border: '2px solid #fff',
                      width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <Camera size={14} />
                  </button>
                )}
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handlePhotoUpload} />
              </div>
            </div>

            <form onSubmit={handleUpdateProfile}>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>Nama Lengkap</label>
                <input
                  className="form-input"
                  value={name}
                  onChange={e => setName(e.target.value.toUpperCase())}
                  placeholder="Masukkan nama sesuai KK"
                  required
                  disabled={user.accountType === 'resident' || user.adminRole === 'rw'}
                  style={{ 
                    height: 52, 
                    borderRadius: 14, 
                    border: '1px solid #e2e8f0', 
                    padding: '0 16px', 
                    textTransform: 'uppercase', 
                    fontSize: 14, 
                    fontWeight: 700,
                    background: (user.accountType === 'resident' || user.adminRole === 'rw') ? '#f8fafc' : '#fff',
                    color: (user.accountType === 'resident' || user.adminRole === 'rw') ? '#64748b' : '#0f172a',
                    cursor: (user.accountType === 'resident' || user.adminRole === 'rw') ? 'not-allowed' : 'text'
                  }}
                />
                {user.accountType === 'resident' && (
                  <p style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', lineHeight: 1.5, textAlign: 'left' }}>
                    * Nama warga tidak dapat diubah secara mandiri demi validitas data kependudukan. Hubungi admin atau pengurus RT Anda jika terdapat kesalahan penulisan nama.
                  </p>
                )}
                {user.adminRole === 'rw' && (
                  <p style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', lineHeight: 1.5, textAlign: 'left' }}>
                    * Nama RW Admin tidak dapat diubah secara mandiri demi konsistensi data kepengurusan.
                  </p>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>Username Chat (Maks 10 Karakter)</label>
                <input
                  className="form-input"
                  value={chatUsername}
                  onChange={e => setChatUsername(e.target.value.slice(0, 10))}
                  placeholder="Buat username untuk forum chat..."
                  maxLength={10}
                  disabled={user.adminRole === 'rw'}
                  style={{ 
                    height: 52, 
                    borderRadius: 14, 
                    border: '1px solid #e2e8f0', 
                    padding: '0 16px', 
                    fontSize: 14, 
                    fontWeight: 700,
                    background: user.adminRole === 'rw' ? '#f8fafc' : '#fff',
                    color: user.adminRole === 'rw' ? '#64748b' : '#0f172a',
                    cursor: user.adminRole === 'rw' ? 'not-allowed' : 'text'
                  }}
                />
                <p style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', lineHeight: 1.5, textAlign: 'left' }}>
                  * Username ini akan ditampilkan pada forum obrolan warga (maksimal 10 karakter). {user.adminRole === 'rw' && "RW Admin tidak diperkenankan mengubah username forum."}
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>Nomor WhatsApp (Aktif)</label>
                <input
                  type="text"
                  className="form-input"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="Contoh: 08123456789 atau 628123456789"
                  required
                  style={{ 
                    height: 52, 
                    borderRadius: 14, 
                    border: '1px solid #e2e8f0', 
                    padding: '0 16px', 
                    fontSize: 14, 
                    fontWeight: 700 
                  }}
                />
                <p style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', lineHeight: 1.5, textAlign: 'left' }}>
                  * Nomor WhatsApp aktif yang digunakan untuk koordinasi kependudukan dan pesan otomatis.
                </p>
              </div>

              {message && (
                <div style={{
                  padding: 14, borderRadius: 12, fontSize: 13, marginBottom: 20,
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
                  color: message.type === 'success' ? '#15803d' : '#b91c1c',
                  border: `1px solid ${message.type === 'success' ? '#dcfce7' : '#fee2e2'}`
                }}>
                  {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  <span style={{ fontWeight: 700 }}>{message.text}</span>
                </div>
              )}

              <button
                className="btn-primary"
                type="submit"
                style={{ width: '100%', height: 52, borderRadius: 14, background: '#2563eb', color: '#fff', border: 'none', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                disabled={loading}
              >
                {loading ? <Loader2 size={20} className="spin" /> : <><Save size={20} /> Simpan Profil</>}
              </button>
            </form>
          </div>
        );
      case 'akun':
        return (
          <div className="section-content fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div>
              <h4 style={{ fontSize: 15, fontWeight: 800, color: '#1e3a8a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={18} color="#2563eb" /> Detail Akun & Level Akses
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                {user.accountType === 'admin' ? (
                  <>
                    <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 16, border: '1px solid #f1f5f9', gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Username Akun</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', fontFamily: 'monospace' }}>{user.username || user.id}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 16, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Jabatan Resmi</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#2563eb' }}>
                        {user.adminRole === 'developer' ? '👑 Developer Utama' : user.adminRole === 'rw' ? '🛡 Ketua RW 011' : `🛡 Ketua RT ${user.rt_id || '001'}`}
                      </div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 16, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Wilayah Tugas</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>
                        {user.adminRole === 'developer' ? 'Sistem Global VSJ' : user.adminRole === 'rw' ? 'Seluruh Lingkungan RW 011' : `Rukun Tetangga RT ${user.rt_id}`}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 16, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Nomor Induk Kependudukan (NIK)</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', fontFamily: 'monospace' }}>{user.nik || user.id}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 16, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Nomor Kartu Keluarga (KK)</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', fontFamily: 'monospace' }}>{user.noKK || 'Belum Terdaftar'}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 16, border: '1px solid #f1f5f9', gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Status Hubungan Keluarga</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#059669', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <UserIcon size={14} /> {user.hubunganKeluarga || 'Kepala Keluarga / Mandiri'}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {user.accountType === 'resident' && (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: 0 }} />
                
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 800, color: '#1e3a8a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Lock size={18} color="#2563eb" /> Pengaturan Keamanan Akun
                  </h4>
                  
                  <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Alamat Email */}
                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <label style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', margin: 0 }}>Alamat Email</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: 8,
                            fontSize: 10,
                            fontWeight: 800,
                            background: emailVerified ? '#dcfce7' : '#fee2e2',
                            color: emailVerified ? '#15803d' : '#b91c1c',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            {emailVerified ? (
                              <>
                                <CheckCircle size={10} /> Terverifikasi
                              </>
                            ) : (
                              <>
                                <AlertCircle size={10} /> Belum Terverifikasi
                              </>
                            )}
                          </span>
                          
                          {emailVerified && (
                            <button
                              type="button"
                              onClick={() => {
                                setEmailVerified(false);
                              }}
                              style={{
                                border: 'none',
                                background: 'none',
                                color: '#2563eb',
                                fontSize: 11,
                                fontWeight: 800,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                padding: 0
                              }}
                            >
                              Ubah Email
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: 10 }}>
                        <input
                          type="email"
                          className="form-input"
                          value={email}
                          onChange={e => {
                            setEmail(e.target.value);
                            // If they change email, reset verified status until verified
                            if (e.target.value !== user?.email) {
                              setEmailVerified(false);
                            } else {
                              setEmailVerified(user?.emailVerified || false);
                            }
                          }}
                          placeholder="nama@email.com"
                          required
                          disabled={emailVerified}
                          style={{ 
                            height: 52, 
                            borderRadius: 14, 
                            border: '1px solid #e2e8f0', 
                            padding: '0 16px', 
                            fontSize: 14, 
                            fontWeight: 700,
                            flex: 1,
                            background: emailVerified ? '#f8fafc' : '#ffffff'
                          }}
                        />
                        {!emailVerified && email && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              onClick={handleVerifyEmail}
                              disabled={verifying}
                              style={{
                                height: 52,
                                borderRadius: 14,
                                border: 'none',
                                background: '#2563eb',
                                color: '#ffffff',
                                fontSize: 12,
                                fontWeight: 800,
                                padding: '0 16px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                              }}
                            >
                              {verifying ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" /> Memproses...
                                </>
                              ) : (
                                "Verifikasi"
                              )}
                            </button>
                            {email === user?.email && (
                              <button
                                type="button"
                                onClick={handleCheckVerificationStatus}
                                disabled={verifying}
                                style={{
                                  height: 52,
                                  borderRadius: 14,
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  color: '#334155',
                                  fontSize: 12,
                                  fontWeight: 800,
                                  padding: '0 16px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                }}
                              >
                                {verifying ? (
                                  <>
                                    <Loader2 size={14} className="animate-spin" /> Memproses...
                                  </>
                                ) : (
                                  "Cek Status"
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <p style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', lineHeight: 1.5, textAlign: 'left' }}>
                        * Digunakan untuk verifikasi akun, pemulihan password, dan reset PIN keamanan transaksi Anda.
                      </p>
                    </div>

                    {/* PIN & Biometrics warning if not verified */}
                    {!emailVerified && (
                      <div style={{
                        padding: '16px 20px',
                        borderRadius: 18,
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        color: '#b45309',
                        fontSize: 12,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        textAlign: 'left'
                      }}>
                        <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 2, color: '#d97706' }} />
                        <div>
                          <div style={{ fontWeight: 800, color: '#92400e' }}>Verifikasi Email Diperlukan</div>
                          <div style={{ fontSize: 11, color: '#b45309', marginTop: 4, lineHeight: 1.4 }}>
                            Sesuai standar keamanan, Anda wajib memverifikasi alamat email terlebih dahulu sebelum dapat membuat PIN transaksi.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PIN Keamanan */}
                    <div style={{ 
                      opacity: emailVerified ? 1 : 0.5, 
                      pointerEvents: emailVerified ? 'auto' : 'none',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 12
                    }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSetupPassword('');
                          setSetupPin('');
                          setSetupConfirmPin('');
                          setPinSetupError(null);
                          setShowPinSetupModal(true);
                        }}
                        style={{
                          height: '46px',
                          borderRadius: '12px',
                          background: user?.pin ? '#f8fafc' : '#2563eb',
                          color: user?.pin ? '#334155' : '#ffffff',
                          border: user?.pin ? '1px solid #cbd5e1' : 'none',
                          fontWeight: 800,
                          fontSize: '13px',
                          cursor: 'pointer',
                          padding: '0 24px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          boxShadow: user?.pin ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.2)',
                          transition: 'transform 0.15s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          if (user?.pin) e.currentTarget.style.background = '#f1f5f9';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          if (user?.pin) e.currentTarget.style.background = '#f8fafc';
                        }}
                      >
                        {user?.pin ? (
                          <>
                            <Lock size={15} color="#475569" /> Ubah PIN Transaksi
                          </>
                        ) : (
                          <>
                            <Key size={15} color="#ffffff" /> Setup PIN Transaksi
                          </>
                        )}
                      </button>
                      <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5, textAlign: 'left', margin: 0 }}>
                        * PIN digunakan untuk memverifikasi transaksi kas, pengajuan surat, atau aktivitas penting warga.
                      </p>
                    </div>

                    {/* Forgot Password Setup status */}
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 20, textAlign: 'left', width: '100%' }}>
                      <h5 style={{ fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 8 }}>Forgot Password Setup</h5>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 800,
                          background: emailVerified ? '#dcfce7' : '#fee2e2',
                          color: emailVerified ? '#15803d' : '#b91c1c',
                        }}>
                          {emailVerified ? 'Pemulihan Email Aktif' : 'Pemulihan Email Nonaktif'}
                        </span>
                        <span style={{ fontSize: 12, color: '#64748b' }}>
                          {emailVerified ? 'Anda dapat menyetel ulang password melalui email.' : 'Gunakan email terverifikasi untuk mengaktifkan fitur ini.'}
                        </span>
                      </div>
                    </div>

                    {/* Ubah Password */}
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 20, width: '100%' }}>
                      <h5 style={{ fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 12, textAlign: 'left' }}>Ubah Password Akun</h5>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 4 }}>
                        <div className="form-group" style={{ textAlign: 'left' }}>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Password Baru</label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={showNewPw ? 'text' : 'password'}
                              className="form-input"
                              value={newPasswordState}
                              onChange={e => setNewPasswordState(e.target.value)}
                              placeholder="Minimal 6 karakter"
                              style={{ height: 48, borderRadius: 12, border: '1px solid #e2e8f0', padding: '0 44px 0 16px', fontSize: 14, width: '100%', boxSizing: 'border-box' }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPw(!showNewPw)}
                              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>

                        <div className="form-group" style={{ textAlign: 'left' }}>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Konfirmasi Password</label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={showConfirmPw ? 'text' : 'password'}
                              className="form-input"
                              value={confirmNewPassword}
                              onChange={e => setConfirmNewPassword(e.target.value)}
                              placeholder="Ulangi password baru"
                              style={{ height: 48, borderRadius: 12, border: '1px solid #e2e8f0', padding: '0 44px 0 16px', fontSize: 14, width: '100%', boxSizing: 'border-box' }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPw(!showConfirmPw)}
                              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {message && activeSection === 'akun' && (
                      <div style={{
                        padding: 14, borderRadius: 12, fontSize: 13,
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
                        color: message.type === 'success' ? '#15803d' : '#b91c1c',
                        border: `1px solid ${message.type === 'success' ? '#dcfce7' : '#fee2e2'}`
                      }}>
                        {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                        <span style={{ fontWeight: 700 }}>{message.text}</span>
                      </div>
                    )}

                    <button
                      className="btn-primary"
                      type="submit"
                      style={{ width: '100%', height: 50, borderRadius: 14, background: '#2563eb', color: '#fff', border: 'none', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                      disabled={loading}
                    >
                      {loading ? <Loader2 size={18} className="spin" /> : <><Save size={18} /> Simpan Pengaturan Keamanan</>}
                    </button>
                  </form>
                </div>
              </>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: 0 }} />

            {/* SECURITY: CHANGE PASSWORD FORM */}
            <div>
              <h4 style={{ fontSize: 15, fontWeight: 800, color: '#1e3a8a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Key size={18} color="#d97706" /> Keamanan & Ganti Password
              </h4>

              <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Current Password */}
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Password Saat Ini</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCurrentPw ? 'text' : 'password'}
                      className="form-input"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="Masukkan password saat ini"
                      required
                      style={{ height: 48, borderRadius: 12, border: '1px solid #e2e8f0', padding: '0 44px 0 16px', fontSize: 14, width: '100%' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {showCurrentPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Password Baru</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        className="form-input"
                        value={newPasswordState}
                        onChange={e => setNewPasswordState(e.target.value)}
                        placeholder="Minimal 8 karakter"
                        required
                        style={{ height: 48, borderRadius: 12, border: '1px solid #e2e8f0', padding: '0 44px 0 16px', fontSize: 14, width: '100%' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Konfirmasi Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConfirmPw ? 'text' : 'password'}
                        className="form-input"
                        value={confirmNewPassword}
                        onChange={e => setConfirmNewPassword(e.target.value)}
                        placeholder="Ulangi password baru"
                        required
                        style={{ height: 48, borderRadius: 12, border: '1px solid #e2e8f0', padding: '0 44px 0 16px', fontSize: 14, width: '100%' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                {pwMessage && (
                  <div style={{
                    padding: '12px 16px', borderRadius: 12, fontSize: 13,
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: pwMessage.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    color: pwMessage.type === 'success' ? '#16a34a' : '#dc2626',
                    border: `1px solid ${pwMessage.type === 'success' ? '#bbf7d0' : '#fecaca'}`
                  }}>
                    {pwMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <span style={{ fontWeight: 700 }}>{pwMessage.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pwLoading || !currentPassword || !newPasswordState || !confirmNewPassword}
                  style={{
                    height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #d97706, #b45309)',
                    color: '#fff', border: 'none', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 12px rgba(217, 119, 6, 0.15)', transition: 'all 0.2s',
                    opacity: (pwLoading || !currentPassword || !newPasswordState || !confirmNewPassword) ? 0.6 : 1
                  }}
                >
                  {pwLoading ? <Loader2 size={18} className="spin" /> : <><Lock size={16} /> Perbarui Password Keamanan</>}
                </button>
              </form>
            </div>
          </div>
        );
      case 'notif':
        return (
          <div className="section-content fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Bell size={20} color="#2563eb" />
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 800, color: '#1e3a8a', margin: 0 }}>Pengaturan Pemberitahuan</h4>
                <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Kelola jenis notifikasi yang ingin Anda terima di perangkat</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { id: 'n1', label: 'Pengumuman Resmi RW', desc: 'Informasi darurat, berita lingkungan, dan surat edaran dari RW 011' },
                { id: 'n2', label: 'Notifikasi Tagihan & Kas', desc: 'Pengingat pembayaran iuran wajib dan laporan pengeluaran kas berkala' },
                { id: 'n3', label: 'Pesan & Obrolan Masuk', desc: 'Notifikasi chat langsung, pengaduan warga, dan konfirmasi surat menyurat' }
              ].map(n => {
                const isActive = notifSettings[n.id as 'n1' | 'n2' | 'n3'];
                return (
                  <div 
                    key={n.id} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '16px 20px', 
                      background: '#fff', 
                      borderRadius: 18, 
                      border: '1px solid #f1f5f9',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.01)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>{n.label}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, lineHeight: 1.4 }}>{n.desc}</div>
                    </div>
                    <div 
                      onClick={() => toggleNotif(n.id as 'n1' | 'n2' | 'n3')}
                      style={{ 
                        width: 46, 
                        height: 26, 
                        background: isActive ? '#22c55e' : '#cbd5e1', 
                        borderRadius: 100, 
                        padding: 3, 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      <div 
                        style={{ 
                          width: 20, 
                          height: 20, 
                          background: '#fff', 
                          borderRadius: '50%', 
                          marginLeft: isActive ? 'auto' : '0',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                          transition: 'margin-left 0.2s ease'
                        }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 'feedback':
        return (
          <div className="section-content fade-in">
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <AlertCircle size={48} color="#cbd5e1" style={{ margin: '0 auto 16px' }} />
              <h4 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>Kirim Umpan Balik</h4>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>Level Akses: {user?.adminRole?.toUpperCase() || 'WARGA'}</p>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 8, marginBottom: 24 }}>Bantu kami meningkatkan kualitas layanan Ruang Warga VSJ.</p>
              <textarea
                placeholder="Tulis saran atau keluhan Anda di sini..."
                style={{ width: '100%', minHeight: 120, borderRadius: 18, border: '1px solid #e2e8f0', padding: 16, fontSize: 14, outline: 'none', marginBottom: 16 }}
              />
              <button style={{ width: '100%', height: 48, borderRadius: 14, background: '#1e293b', color: '#fff', border: 'none', fontWeight: 700 }}>Kirim Sekarang</button>
            </div>
          </div>
        );
      case 'about':
        return (
          <div className="section-content fade-in">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: 80, height: 80, margin: '0 auto 20px', borderRadius: 20, overflow: 'hidden', background: '#fff', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}>
                <img src="/logo.png" alt="Ruang Warga VSJ Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1e3a8a' }}>Ruang Warga VSJ</h3>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 8, lineHeight: 1.6 }}>
                Sistem Informasi & Administrasi Mandiri<br />
                <strong>Vila Samudra Jaya - RW 011</strong>
              </p>

              <div style={{ marginTop: 40, borderTop: '1px solid #f1f5f9', paddingTop: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                  <span style={{ fontSize: 13, color: '#64748b' }}>Versi Aplikasi</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>v2.0.0 (Beta)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                  <span style={{ fontSize: 13, color: '#64748b' }}>Terakhir Diperbarui</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>24 Mei 2026</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                  <span style={{ fontSize: 13, color: '#64748b' }}>Developer</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#2563eb' }}>Muhammad Kemal</span>
                </div>
              </div>

              {/* Support Developer Section */}
              <div style={{ marginTop: 24, padding: '20px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Dukung Pengembang</h4>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>
                  Bantu apresiasi kerja keras pengembang dengan donasi sukarela agar aplikasi terus dikembangkan & bebas iklan.
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('901796951684');
                    setShowCopyToast(true);
                    setTimeout(() => setShowCopyToast(false), 2000);
                  }}
                  style={{
                    width: '100%',
                    height: '46px',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <span style={{ 
                    background: '#ff6b00', 
                    color: '#ffffff', 
                    padding: '3px 8px', 
                    borderRadius: '6px', 
                    fontSize: '10px', 
                    fontWeight: 900, 
                    display: 'inline-flex', 
                    alignItems: 'center',
                    border: '1px solid rgba(255,255,255,0.2)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    SeaBank
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Salin Rekening <Copy size={13} style={{ opacity: 0.9 }} />
                  </span>
                </button>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginTop: 12 }}>
                  901796951684 a/n Muhammad Kemal Afrilidzi
                </div>
              </div>
            </div>
          </div>
        );
      case 'sensor':
        return (
          <div className="section-content fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <ShieldAlert size={20} color="#dc2626" />
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 800, color: '#1e3a8a', margin: 0 }}>Filter Kata Kasar (Forum Chat)</h4>
                <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Kelola kata-kata yang akan disensor otomatis oleh sistem kecerdasan Vira AI</p>
              </div>
            </div>

            <form onSubmit={handleAddWord} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input
                type="text"
                className="form-input"
                value={newWord}
                onChange={e => setNewWord(e.target.value)}
                placeholder="Tambah kata kasar baru..."
                required
                style={{ 
                  height: 46, 
                  borderRadius: 12, 
                  border: '1px solid #e2e8f0', 
                  padding: '0 14px', 
                  fontSize: 13,
                  flex: 1
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '0 20px',
                  height: 46,
                  borderRadius: 12,
                  background: '#1e3a8a',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(30, 58, 138, 0.15)'
                }}
              >
                Tambah
              </button>
            </form>

            {wordsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                <Loader2 className="spin" color="#1e3a8a" size={24} />
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 12, textTransform: 'uppercase' }}>Daftar Kata Kasar Tambahan ({customWords.length})</div>
                {customWords.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '30px 16px', 
                    background: '#f8fafc', 
                    borderRadius: 16, 
                    border: '1px dashed #cbd5e1',
                    color: '#94a3b8',
                    fontSize: 13
                  }}>
                    Belum ada kata kasar tambahan manual. Gunakan form di atas untuk menambahkan.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 240, overflowY: 'auto', padding: 4 }}>
                    {customWords.map(word => (
                      <span 
                        key={word}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: '#fef2f2',
                          color: '#b91c1c',
                          border: '1px solid #fee2e2',
                          padding: '6px 12px',
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 700
                        }}
                      >
                        {word}
                        <button
                          type="button"
                          onClick={() => handleRemoveWord(word)}
                          style={{
                            border: 'none',
                            background: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      default: return null;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="profile-page-premium" 
      style={{ background: '#f8fafc', minHeight: '100vh', padding: '24px 20px 100px' }}
    >
      <header style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16 }}>
        {user?.accountType === 'resident' && (
          <button 
            onClick={() => navigate('/warga/profile')}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#1e3a8a',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              flexShrink: 0
            }}
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1e3a8a', margin: 0 }}>Pengaturan</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Personalisasi akun & aplikasi Anda</p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100%, 1fr))', gap: 24 }}>
        {/* NAV SECTIONS */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 8 }} className="hide-scrollbar">
          {[
            { id: 'identitas', label: 'Identitas', icon: UserIcon },
            { id: 'akun', label: 'Akun', icon: ShieldAlert },
            { id: 'notif', label: 'Notifikasi', icon: AlertCircle },
            ...(user.accountType === 'admin' ? [{ id: 'sensor', label: 'Kata Kasar', icon: ShieldAlert }] : []),
            { id: 'feedback', label: 'Feedback', icon: Save },
            { id: 'about', label: 'Tentang', icon: Settings }
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id as any)}
              style={{
                whiteSpace: 'nowrap', padding: '10px 16px', borderRadius: 12, border: 'none',
                background: activeSection === s.id ? '#1e3a8a' : '#fff',
                color: activeSection === s.id ? '#fff' : '#64748b',
                fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: activeSection === s.id ? '0 4px 12px rgba(30, 58, 138, 0.2)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <s.icon size={16} /> {s.label}
            </button>
          ))}
        </div>

        {/* SECTION CARD */}
        <div style={{ background: '#fff', borderRadius: 28, padding: 24, border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          {renderSection()}
        </div>

        {/* DANGER ZONE FOR DEVELOPER/RW - SEPARATE FORMAT CONTROL PANEL */}
        {user.accountType === 'admin' && ['developer', 'rw'].includes(user.adminRole || '') && activeSection === 'akun' && (
          <div style={{
            background: '#ffffff',
            borderRadius: 28,
            padding: 24,
            border: '1px solid #fee2e2',
            boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            marginTop: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ 
                width: 44, 
                height: 44, 
                borderRadius: 14, 
                background: '#fef2f2', 
                color: '#ef4444', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <ShieldAlert size={22} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#991b1b' }}>Pusat Kendali Pengembang (Reset Data Terpisah)</h4>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>
                  Kosongkan dan reset data kependudukan secara terpisah. Klik kategori untuk membuka modul verifikasi password dan tahan tombol selama 3 detik untuk mereset data.
                </p>
              </div>
            </div>

            {/* Grid of 6 format buttons */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
              gap: 12 
            }}>
              {[
                { category: 'warga', label: 'Data Warga', desc: 'Identitas & Akun Warga' },
                { category: 'kk', label: 'Data KK', desc: 'Hubungan Kartu Keluarga' },
                { category: 'chat', label: 'Data Chat', desc: 'Riwayat Obrolan Forum' },
                { category: 'keuangan', label: 'Data Keuangan', desc: 'Transaksi Kas & Iuran' },
                { category: 'surat', label: 'Data Administrasi Surat', desc: 'Pengajuan Surat Warga' },
                { category: 'feedback', label: 'Data Kritik & Saran', desc: 'Kotak Saran & Umpan Balik' }
              ].map(item => {
                return (
                  <button
                    key={item.category}
                    onClick={() => handleFormatCategory(item.category as any, item.label)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '14px 16px',
                      borderRadius: 16,
                      background: '#fff',
                      border: '1px solid #fee2e2',
                      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.02)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      width: '100%'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#fef2f2';
                      e.currentTarget.style.borderColor = '#fca5a5';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#fff';
                      e.currentTarget.style.borderColor = '#fee2e2';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                      <RefreshCw size={15} color="#ef4444" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#991b1b', flex: 1 }}>
                        {item.label}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: '#7f1d1d', opacity: 0.6, marginTop: 4, fontWeight: 600 }}>
                      Reset {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* CATEGORY RESET POPUP MODAL */}
      {showFormatModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(10px)', zIndex: 8000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 460, borderRadius: 28, padding: 32, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #fee2e2' }}>
            {modalSuccess ? (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <img 
                  src="/vira_ai_berhasil.png"
                  alt="Vira AI Success"
                  style={{ width: 140, height: 140, objectFit: 'contain', display: 'block', margin: '0 auto 20px' }}
                />
                <h3 style={{ fontSize: 20, fontWeight: 900, color: '#16a34a', margin: 0, fontFamily: 'system-ui, sans-serif' }}>Reset Berhasil!</h3>
                <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, margin: 0 }}>
                  {modalSuccess}
                </p>
                <button
                  onClick={() => {
                    setShowFormatModal(false);
                    setFormatCategory(null);
                    setFormatCategoryLabel('');
                    setConfirmPassword('');
                    setModalSuccess(null);
                    setModalActionType(null);
                  }}
                  style={{
                    width: '100%',
                    height: 48,
                    borderRadius: 14,
                    background: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 800,
                    cursor: 'pointer',
                    marginTop: 16,
                    boxShadow: '0 4px 14px rgba(22, 163, 74, 0.25)',
                    fontFamily: 'system-ui, sans-serif'
                  }}
                >
                  Selesai
                </button>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ 
                    width: 56, 
                    height: 56, 
                    background: '#fef2f2', 
                    color: '#ef4444', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    margin: '0 auto 12px' 
                  }}>
                    <ShieldAlert size={28} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: '#991b1b', margin: 0 }}>
                    Reset {formatCategoryLabel}
                  </h3>
                  <p style={{ fontSize: 12, color: '#475569', marginTop: 6, lineHeight: 1.4 }}>
                    Anda akan mengosongkan dan menghapus seluruh data pada kategori <strong>{formatCategoryLabel}</strong> secara permanen. Setelah data di-reset, data akan kosong dan Anda dapat menginput kembali data baru melalui fitur aplikasi.
                  </p>
                </div>

                {/* Custom error banner in modal */}
                {modalError && (
                  <div style={{
                    background: '#fef2f2',
                    border: '1px solid #fee2e2',
                    borderRadius: '14px',
                    padding: '12px 16px',
                    color: '#dc2626',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 16,
                    textAlign: 'left'
                  }}>
                    <ShieldAlert size={16} />
                    <span style={{ lineHeight: 1.3 }}>{modalError}</span>
                  </div>
                )}

                {/* Password input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', marginBottom: 20 }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Password Administrator</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => {
                        setConfirmPassword(e.target.value);
                        if (modalError) setModalError(null);
                      }}
                      placeholder="Masukkan password admin Anda..."
                      style={{ width: '100%', height: 46, borderRadius: 12, border: '2px solid #f1f5f9', padding: '0 40px 0 14px', fontSize: 13, outline: 'none' }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Hold Button & Batal */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onMouseDown={startFormatHold}
                    onMouseUp={stopFormatHold}
                    onMouseLeave={stopFormatHold}
                    onTouchStart={startFormatHold}
                    onTouchEnd={stopFormatHold}
                    disabled={!confirmPassword.trim() || isFormatting}
                    style={{
                      height: 50,
                      borderRadius: 12,
                      background: !confirmPassword.trim() ? '#cbd5e1' : '#ef4444',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 800,
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: !confirmPassword.trim() ? 'not-allowed' : 'pointer',
                      boxShadow: !confirmPassword.trim() ? 'none' : '0 4px 14px rgba(239, 68, 68, 0.25)',
                      transition: 'all 0.2s',
                      outline: 'none',
                      fontFamily: 'system-ui, sans-serif'
                    }}
                  >
                    {/* holdProgress bar */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${holdProgress}%`,
                      background: 'rgba(255,255,255,0.3)',
                      transition: 'width 0.05s linear'
                    }} />
                    
                    <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13 }}>
                      {isFormatting ? (
                        <>
                          <Loader2 size={15} className="spin" /> Memproses...
                        </>
                      ) : !confirmPassword.trim() ? (
                        'Masukkan Password untuk Mengaktifkan'
                      ) : (
                        <>
                          <RefreshCw size={15} /> Tahan Tombol 3 Detik untuk Reset Data
                        </>
                      )}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setShowFormatModal(false);
                      setFormatCategory(null);
                      setFormatCategoryLabel('');
                      setConfirmPassword('');
                      setHoldProgress(0);
                      setModalError(null);
                      setModalActionType(null);
                    }}
                    disabled={isFormatting}
                    style={{
                      height: 48,
                      borderRadius: 12,
                      border: 'none',
                      background: '#f1f5f9',
                      color: '#64748b',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'system-ui, sans-serif',
                      fontSize: 13
                    }}
                  >
                    Batal
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* CROP MODAL */}
      {showCropModal && rawImage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 400, borderRadius: 28, padding: 24, textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>Potong Foto Profil</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Geser dan perbesar gambar sesuai keinginan Anda</p>
            
            {/* Viewport Wrapper */}
            <div 
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUpOrLeave}
              style={{
                width: 280,
                height: 280,
                background: '#f1f5f9',
                margin: '0 auto 20px',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 20,
                cursor: isDragging ? 'grabbing' : 'grab',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {/* Image element */}
              <img 
                src={rawImage} 
                alt="Raw" 
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  userSelect: 'none',
                  pointerEvents: 'none'
                }}
              />
              
              {/* Circular Overlay Mask */}
              <div style={{
                position: 'absolute',
                inset: 0,
                border: '40px solid rgba(15, 23, 42, 0.65)',
                pointerEvents: 'none',
                boxSizing: 'border-box'
              }} />
              <div style={{
                position: 'absolute',
                top: 40,
                left: 40,
                width: 200,
                height: 200,
                borderRadius: '50%',
                border: '2px dashed #ffffff',
                pointerEvents: 'none',
                boxSizing: 'border-box'
              }} />
            </div>
            
            {/* Zoom Slider */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                <span>Perbesar</span>
                <span>{Math.round(zoom * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="3" 
                step="0.05"
                value={zoom} 
                onChange={e => setZoom(parseFloat(e.target.value))}
                style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, outline: 'none' }}
              />
            </div>
            
            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                type="button"
                style={{ flex: 1, height: 48, borderRadius: 14, border: 'none', background: '#f1f5f9', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => setShowCropModal(false)}
              >
                Batal
              </button>
              <button 
                type="button"
                style={{ flex: 1, height: 48, borderRadius: 14, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                onClick={handleCropApply}
              >
                Potong & Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL VERIFICATION MODAL */}
      {showVerificationModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 460, borderRadius: 28, padding: '40px 32px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0' }}>
            <div style={{ width: '72px', height: '72px', background: '#eff6ff', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#2563eb' }}>
              <Loader2 className="animate-spin" size={32} />
            </div>
            
            <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>Tautan Verifikasi Dikirim!</h3>
            <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
              Kami telah mengirimkan tautan verifikasi ke email: <strong style={{ color: '#1e293b' }}>{sentEmail}</strong>.<br />
              Silakan periksa kotak masuk (atau spam) email Anda dan klik tautan tersebut untuk menyelesaikan verifikasi.
            </p>
            
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 16, border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, textAlign: 'left' }}>
              <Info size={20} style={{ color: '#3b82f6', flexShrink: 0 }} />
              <p style={{ fontSize: 11, color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                Halaman ini mendeteksi status verifikasi Anda secara real-time. Modal ini akan tertutup otomatis begitu Anda mengeklik tautan tersebut.
              </p>
            </div>

            {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
              <div style={{ marginTop: 0, marginBottom: 28, padding: 16, background: '#eff6ff', borderRadius: 16, border: '1px solid #bfdbfe', textAlign: 'left' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', marginBottom: 6 }}>Mode Pengembang (Uji Coba Lokal)</div>
                <p style={{ fontSize: 11, color: '#1e40af', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                  Karena tidak ada SMTP server di localhost Anda, klik tombol di bawah ini untuk mensimulasikan klik tautan dari kotak masuk email:
                </p>
                <a 
                  href={`${window.location.origin}/verify-email?token=${verificationToken}&userId=${user?.id}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '42px',
                    background: '#2563eb',
                    color: '#ffffff',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 800,
                    textDecoration: 'none',
                    textAlign: 'center',
                    boxShadow: '0 4px 10px rgba(37,99,235,0.2)'
                  }}
                >
                  Buka Tautan Verifikasi Langsung 🚀
                </a>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                type="button"
                style={{ flex: 1, height: 48, borderRadius: 14, border: 'none', background: '#f1f5f9', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => setShowVerificationModal(false)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
      {/* PIN SETUP / CHANGE MODAL OVERLAY */}
      {showPinSetupModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(10px)',
          zIndex: 7000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '420px',
              borderRadius: '24px',
              padding: '32px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
              color: '#0f172a',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '16px',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <Key size={24} style={{ color: '#2563eb' }} />
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', textAlign: 'center', margin: '0 0 8px' }}>
              {user?.pin ? 'Ubah PIN Transaksi' : 'Setup PIN Transaksi'}
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', lineHeight: 1.5, margin: '0 0 24px' }}>
              Masukkan password akun Anda untuk melakukan perubahan atau pengaturan PIN keamanan transaksi.
            </p>

            <form onSubmit={handleSavePin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Account Password Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Password Akun Anda</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showSetupPassword ? "text" : "password"}
                    value={setupPassword}
                    onChange={e => setSetupPassword(e.target.value)}
                    placeholder="Masukkan password Anda..."
                    required
                    style={{
                      width: '100%',
                      height: '46px',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      padding: '0 40px 0 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSetupPassword(!showSetupPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: '#64748b',
                      padding: 4
                    }}
                  >
                    {showSetupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Grid for PIN Baru and Konfirmasi PIN */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>PIN Baru (6 Digit)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={setupPin}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      if (val.length <= 6) setSetupPin(val);
                    }}
                    placeholder="Atur PIN..."
                    required
                    style={{
                      width: '100%',
                      height: '46px',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      padding: '0 12px',
                      fontSize: '13px',
                      fontWeight: 700,
                      letterSpacing: setupPin ? '4px' : 'normal',
                      textAlign: 'center',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Konfirmasi PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={setupConfirmPin}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      if (val.length <= 6) setSetupConfirmPin(val);
                    }}
                    placeholder="Konfirmasi..."
                    required
                    style={{
                      width: '100%',
                      height: '46px',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      padding: '0 12px',
                      fontSize: '13px',
                      fontWeight: 700,
                      letterSpacing: setupConfirmPin ? '4px' : 'normal',
                      textAlign: 'center',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Match Feedback & Errors */}
              {pinSetupError && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fee2e2',
                  color: '#ef4444',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  textAlign: 'left'
                }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>{pinSetupError}</span>
                </div>
              )}

              {setupPin.length > 0 && setupConfirmPin.length > 0 && (
                <div style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: setupPin === setupConfirmPin ? '#10b981' : '#ef4444',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  paddingLeft: 4
                }}>
                  {setupPin === setupConfirmPin ? (
                    <>
                      <CheckCircle size={14} /> PIN Cocok & Siap Disimpan
                    </>
                  ) : (
                    <>
                      <AlertCircle size={14} /> PIN Belum Cocok
                    </>
                  )}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPinSetupModal(false);
                    setSetupPassword('');
                    setSetupPin('');
                    setSetupConfirmPin('');
                  }}
                  style={{
                    flex: 1,
                    height: '42px',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#64748b',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pinSetupLoading || (setupPin.length > 0 && setupPin !== setupConfirmPin)}
                  style={{
                    flex: 1,
                    height: '42px',
                    borderRadius: '12px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: pinSetupLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  {pinSetupLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    "Simpan PIN"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showPinSuccessModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(10px)', zIndex: 8000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ background: '#fff', width: '100%', maxWidth: 400, borderRadius: 28, padding: 32, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0', textAlign: 'center' }}
          >
            <div style={{ 
              width: 64, 
              height: 64, 
              background: '#f0fdf4', 
              color: '#16a34a', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              margin: '0 auto 16px',
              boxShadow: '0 8px 16px rgba(22, 163, 74, 0.1)'
            }}>
              <CheckCircle size={32} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', margin: 0, fontFamily: 'system-ui, sans-serif' }}>
              PIN Berhasil Diubah!
            </h3>
            <p style={{ fontSize: 13, color: '#475569', marginTop: 10, lineHeight: 1.5 }}>
              PIN Keamanan transaksi Anda telah berhasil dikonfigurasi dan aktif. Sekarang Anda dapat menggunakan PIN ini untuk verifikasi kas, pengajuan surat, dan aktivitas penting warga lainnya.
            </p>
            <button
              onClick={() => setShowPinSuccessModal(false)}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#fff',
                border: 'none',
                fontWeight: 800,
                cursor: 'pointer',
                marginTop: 24,
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
                transition: 'all 0.2s',
                fontSize: '14px'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              Selesai & Tutup
            </button>
          </motion.div>
        </div>
      )}

      {showCopyToast && (
        <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ 
              background: '#0f172a', 
              color: '#fff', 
              padding: '12px 24px', 
              borderRadius: '16px', 
              fontSize: '13px', 
              fontWeight: 800, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              fontFamily: 'system-ui, sans-serif'
            }}
          >
            <CheckCircle size={16} color="#10b981" />
            <span>Nomor rekening berhasil disalin!</span>
          </motion.div>
        </div>
      )}


      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </motion.div>
  );
}

