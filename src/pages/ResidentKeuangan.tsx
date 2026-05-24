/**
 * ResidentKeuangan.tsx
 * Ultimate mobile-first contribution and e-wallet (RuangPay) portal for residents
 */
import React, { useState, useEffect } from 'react';
import { 
  Wallet, Search, Plus, Download, Filter, CreditCard, 
  History, Clock, CheckCircle, AlertCircle, ChevronRight, 
  Smartphone, Send, Upload, FileText, Check, X, ShieldCheck,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import { User } from '../types';
import { 
  subscribeToFamilyBills, 
  subscribeToPayments, 
  payWithRuangPay, 
  submitPaymentProof, 
  topUpRuangPay,
  getAdminPhoneNumber,
  getPaymentSettings,
  FamilyBill,
  Payment 
} from '../services/financeService';

interface ResidentKeuanganProps {
  user: User;
}

export default function ResidentKeuangan({ user }: ResidentKeuanganProps) {
  const [familyBills, setFamilyBills] = useState<FamilyBill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [userData, setUserData] = useState<any>(user);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // Top Up Modal
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [isTopUpSubmitting, setIsTopUpSubmitting] = useState(false);

  // Payment Modal
  const [selectedBill, setSelectedBill] = useState<FamilyBill | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'RuangPay' | 'Transfer Bank' | 'QRIS' | 'E-wallet' | null>(null);
  const [proofImage, setProofImage] = useState<string>('');
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);

  // Dynamic Payment Settings
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);

  // Success WhatsApp Confirmation Screen
  const [lastUploadedPayment, setLastUploadedPayment] = useState<any>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Receipt Modal
  const [activeReceipt, setActiveReceipt] = useState<Payment | null>(null);

  // 1. Listen to Resident User Doc to get live RuangPay balance
  useEffect(() => {
    if (!user?.id) return;
    const unsub = onSnapshot(doc(db, 'users', user.id), (docSnap) => {
      if (docSnap.exists()) {
        setUserData({ id: docSnap.id, ...docSnap.data() });
      }
    });
    return unsub;
  }, [user?.id]);

  // 2. Query Family Cards to get matching nomorKK for this resident
  const [myFamily, setMyFamily] = useState<any>(null);
  useEffect(() => {
    const noKK = userData?.noKK || user?.noKK || (userData as any)?.extractedData?.nomorKK || (user as any)?.extractedData?.nomorKK;
    if (!noKK) {
      console.log("[ResidentKeuangan] No KK found in user object yet.");
      return;
    }

    console.log("[ResidentKeuangan] Found KK:", noKK);

    const unsubFam = onSnapshot(doc(db, 'families', noKK), (famSnap) => {
      if (famSnap.exists()) {
        setMyFamily({ id: famSnap.id, nomorKK: noKK, ...famSnap.data() });
      } else {
        // Fallback
        setMyFamily({ 
          id: noKK, 
          nomorKK: noKK, 
          kepalaKeluarga: userData?.name || user?.name || 'Kepala Keluarga', 
          rt: userData?.rt_id || user?.rt_id || '001' 
        });
      }
    });
    return unsubFam;
  }, [userData?.noKK, user?.noKK, userData?.id]);

  // 3. Listen to Family Bills & Payments
  useEffect(() => {
    if (!myFamily?.nomorKK) return;

    setLoading(true);
    // Subscribe to bills assigned to my KK
    const unsubBills = subscribeToFamilyBills({ nomorKK: myFamily.nomorKK }, (bills) => {
      setFamilyBills(bills);
    });

    // Subscribe to my KK's payments
    const unsubPayments = subscribeToPayments({}, (allPayments) => {
      const myPayments = allPayments.filter(p => p.nomorKK === myFamily.nomorKK);
      setPayments(myPayments);
      setLoading(false);
    });

    return () => {
      unsubBills();
      unsubPayments();
    };
  }, [myFamily?.nomorKK]);

  // Load dynamic payment settings when selected bill changes
  useEffect(() => {
    if (!selectedBill) {
      setPaymentSettings(null);
      return;
    }
    
    const targetRegion = selectedBill.category === 'Setoran Kas RT ke RW' 
      ? 'rw' 
      : (myFamily?.rt || user?.rt_id || '001');

    setLoadingSettings(true);
    getPaymentSettings(targetRegion)
      .then((settings) => {
        setPaymentSettings(settings);
      })
      .catch((err) => {
        console.error("Error loading payment settings for checkout:", err);
      })
      .finally(() => {
        setLoadingSettings(false);
      });
  }, [selectedBill, myFamily?.rt, user?.rt_id]);

  const handleWhatsAppRedirect = async (paymentInfo: { billTitle: string; amount: number; category: string; rt: string; kepalaKeluarga: string; nomorKK: string }) => {
    const targetRole = paymentInfo.category === 'Setoran Kas RT ke RW' ? 'rw' : 'rt';
    const adminPhone = await getAdminPhoneNumber(targetRole, paymentInfo.rt);
    if (!adminPhone) {
      showToast('Nomor WhatsApp admin tidak ditemukan. Silakan hubungi admin secara manual.', 'error');
      return;
    }
    
    const message = `Halo Admin, saya telah mengunggah bukti pembayaran untuk tagihan:\n*${paymentInfo.billTitle}*\nNominal: *Rp ${paymentInfo.amount.toLocaleString('id-ID')}*\nAtas Nama: *${paymentInfo.kepalaKeluarga}* (KK: ${paymentInfo.nomorKK})\n\nMohon bantuannya untuk mengecek bukti pembayaran saya di aplikasi Ruang Warga. Terima kasih!`;
    
    let formattedPhone = adminPhone.trim().replace(/[-+\s]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.substring(1);
    }
    
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const activeBills = familyBills.filter(b => b.status !== 'LUNAS');
  const paidBillsCount = familyBills.filter(b => b.status === 'LUNAS').length;
  const totalOutstanding = activeBills.reduce((acc, b) => acc + b.amount, 0);

  // File Upload Helper
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('Ukuran gambar melebihi 2MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Top Up Submission
  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseInt(topUpAmount);
    if (!amountNum || amountNum <= 0) {
      showToast('Masukkan nominal top up yang valid', 'error');
      return;
    }
    
    setIsTopUpSubmitting(true);
    try {
      await topUpRuangPay(userData.id, amountNum);
      showToast(`Top Up sebesar Rp ${amountNum.toLocaleString('id-ID')} berhasil!`, 'success');
      setShowTopUpModal(false);
      setTopUpAmount('');
    } catch (error: any) {
      showToast(error.message || 'Gagal melakukan top up', 'error');
    } finally {
      setIsTopUpSubmitting(false);
    }
  };

  // Payment Submission
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill || !paymentMethod) return;

    setIsPaymentSubmitting(true);
    try {
      if (paymentMethod === 'RuangPay') {
        showToast('Metode pembayaran RuangPay Instan segera hadir (Coming Soon)!', 'info');
        setIsPaymentSubmitting(false);
        return;
      } else {
        if (!proofImage) {
          showToast('Silakan unggah bukti transfer/pembayaran Anda', 'error');
          setIsPaymentSubmitting(false);
          return;
        }
        const uploadedPayment = {
          billTitle: selectedBill.title,
          amount: selectedBill.amount,
          category: selectedBill.category,
          rt: myFamily?.rt || user?.rt_id || '001',
          kepalaKeluarga: myFamily?.kepalaKeluarga || userData.name,
          nomorKK: myFamily?.nomorKK || ''
        };
        await submitPaymentProof(selectedBill.id, paymentMethod, proofImage, {
          id: myFamily.id,
          nomorKK: myFamily.nomorKK,
          kepalaKeluarga: myFamily.kepalaKeluarga || userData.name,
          rt: myFamily.rt || '001'
        });
        showToast('Bukti pembayaran berhasil diunggah. Menunggu verifikasi admin.', 'success');
        setLastUploadedPayment(uploadedPayment);
        setSelectedBill(null);
      }
    } catch (error: any) {
      showToast(error.message || 'Gagal mengirim pembayaran', 'error');
    } finally {
      setIsPaymentSubmitting(false);
      setPaymentMethod(null);
      setProofImage('');
    }
  };

  // Search/Filter payments history
  const filteredPayments = payments.filter(p => {
    const bill = familyBills.find(b => b.billId === p.billId);
    const titleMatch = (bill?.title || 'Iuran').toLowerCase().includes(search.toLowerCase());
    const catMatch = filterCategory === 'all' || (bill?.category === filterCategory);
    return titleMatch && catMatch;
  });

  const isBankAvailable = paymentSettings ? (paymentSettings.bank?.active ?? false) : true;
  const isEwalletAvailable = paymentSettings ? (paymentSettings.ewallet?.active ?? false) : false;
  const isQrisAvailable = paymentSettings ? (paymentSettings.qris?.active ?? false) : true;

  const bankInfo = paymentSettings?.bank?.active ? {
    name: paymentSettings.bank.bankName,
    number: paymentSettings.bank.accountNumber,
    owner: paymentSettings.bank.accountName
  } : {
    name: 'Transfer Bank Mandiri',
    number: '131-00-1234567-8',
    owner: 'Kas RW 011 VSJ'
  };

  const ewalletInfo = paymentSettings?.ewallet?.active ? {
    provider: paymentSettings.ewallet.provider,
    phone: paymentSettings.ewallet.phoneNumber,
    owner: paymentSettings.ewallet.accountName
  } : null;

  const qrisInfo = paymentSettings?.qris?.active ? {
    name: paymentSettings.qris.qrisName,
    image: paymentSettings.qris.qrisImage
  } : {
    name: 'QRIS Mandiri VSJ',
    image: ''
  };

  return (
    <div className="resident-keuangan-container">
      <style>{`
        .resident-keuangan-container {
          font-family: 'Inter', sans-serif;
          padding: 16px;
          max-width: 500px;
          margin: 0 auto;
          padding-bottom: 100px;
          color: #0f172a;
        }
        .ruangpay-card {
          background: linear-gradient(135deg, #090e1a 0%, #1e1b4b 50%, #0a0a0c 100%);
          border-radius: 24px;
          padding: 26px;
          color: #fff;
          position: relative;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 
                      0 0 40px rgba(99, 102, 241, 0.15), 
                      inset 0 1px 1px rgba(255, 255, 255, 0.15);
          margin-bottom: 24px;
          border: 1px solid rgba(212, 175, 55, 0.25);
        }
        .ruangpay-card::before {
          content: '';
          position: absolute;
          width: 250px;
          height: 250px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
          top: -80px;
          right: -80px;
          border-radius: 50%;
          z-index: 1;
        }
        .ruangpay-card::after {
          content: '';
          position: absolute;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(212, 175, 55, 0.06) 0%, transparent 70%);
          bottom: -150px;
          left: -100px;
          border-radius: 50%;
          z-index: 1;
        }
        .card-chip {
          width: 38px;
          height: 28px;
          background: linear-gradient(135deg, #ffe066 0%, #f5b041 50%, #d4af37 100%);
          border-radius: 6px;
          position: absolute;
          top: 26px;
          right: 26px;
          box-shadow: inset 0 1px 2px rgba(255,255,255,0.4), 0 4px 10px rgba(0,0,0,0.3);
          display: flex;
          flex-wrap: wrap;
          padding: 3px;
          gap: 2px;
          opacity: 0.95;
          z-index: 3;
        }
        .card-chip-inner {
          flex: 1 1 40%;
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 2px;
        }
        .shimmer-effect {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            120deg,
            transparent 30%,
            rgba(255, 255, 255, 0.06) 40%,
            rgba(255, 255, 255, 0.12) 50%,
            rgba(255, 255, 255, 0.06) 60%,
            transparent 70%
          );
          background-size: 200% 100%;
          animation: cardShimmer 6s infinite linear;
          pointer-events: none;
          z-index: 2;
        }
        @keyframes cardShimmer {
          0% { background-position: 150% 0; }
          100% { background-position: -50% 0; }
        }
        .gold-badge {
          background: linear-gradient(135deg, #f5b041 0%, #d4af37 100%);
          color: #000;
          font-weight: 900;
          font-size: 8px;
          padding: 2px 6px;
          border-radius: 4px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          box-shadow: 0 2px 4px rgba(212,175,55,0.3);
        }
        .tagline {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 16px;
          position: relative;
          z-index: 3;
          color: #d4af37;
          text-shadow: 0 0 8px rgba(212,175,55,0.2);
        }
        .balance-label {
          font-size: 11px;
          opacity: 0.6;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          position: relative;
          z-index: 3;
          color: #94a3b8;
        }
        .balance-val {
          font-size: 36px;
          font-weight: 900;
          letter-spacing: -0.5px;
          margin: 4px 0 24px;
          position: relative;
          z-index: 3;
          background: linear-gradient(to right, #ffffff 0%, #e2e8f0 50%, #ffffff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5));
        }
        .pay-actions {
          display: flex;
          gap: 12px;
          position: relative;
          z-index: 3;
        }
        .pay-btn {
          flex: 1;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(10px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .pay-btn:hover {
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(212, 175, 55, 0.4);
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(212,175,55,0.15);
        }
        .metric-cards-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 24px;
        }
        .m-card {
          background: #fff;
          border-radius: 18px;
          padding: 16px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.02);
        }
        .m-card .lbl {
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          margin-bottom: 4px;
        }
        .m-card .val {
          font-size: 18px;
          font-weight: 900;
          color: #1e3a8a;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .section-header h3 {
          font-size: 16px;
          font-weight: 800;
          color: #1e293b;
          margin: 0;
        }
        .bill-card-premium {
          background: #fff;
          border-radius: 20px;
          padding: 18px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 4px 15px rgba(0,0,0,0.02);
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-bottom: 12px;
          transition: all 0.25s ease;
        }
        .bill-card-premium.danger {
          border-left: 4px solid #ef4444;
        }
        .bill-card-premium.warning {
          border-left: 4px solid #f59e0b;
        }
        .bill-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .bill-info-left {
          display: flex;
          gap: 12px;
        }
        .bill-icon-box {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eff6ff;
          color: #3b82f6;
        }
        .bill-title {
          font-size: 14px;
          font-weight: 800;
          color: #1e293b;
          margin-bottom: 2px;
        }
        .bill-category {
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
        }
        .badge-finance {
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .badge-finance.unpaid { background: #eff6ff; color: #3b82f6; }
        .badge-finance.pending { background: #fff7ed; color: #ea580c; }
        .badge-finance.overdue { background: #fef2f2; color: #ef4444; }
        .badge-finance.paid { background: #f0fdf4; color: #16a34a; }
        .bill-details-bar {
          background: #f8fafc;
          border-radius: 12px;
          padding: 10px 14px;
          display: flex;
          justify-content: space-between;
        }
        .detail-item .lbl {
          font-size: 9px;
          font-weight: 700;
          color: #94a3b8;
          margin-bottom: 2px;
        }
        .detail-item .val {
          font-size: 13px;
          font-weight: 800;
          color: #334155;
        }
        .btn-pay-now {
          background: #1e40af;
          color: #fff;
          border: none;
          height: 44px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s;
        }
        .btn-pay-now:hover {
          background: #1d4ed8;
        }
        .history-card {
          background: #fff;
          border-radius: 16px;
          padding: 14px;
          border: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          transition: all 0.15s;
        }
        .history-card:active {
          transform: scale(0.98);
        }
        .h-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .h-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .h-title {
          font-size: 13px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 2px;
        }
        .h-date {
          font-size: 10px;
          color: #94a3b8;
        }
        .h-amount {
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 2px;
        }
        .modal-sheet {
          position: fixed;
          left: 0; right: 0; bottom: 0;
          background: #fff;
          border-radius: 32px 32px 0 0;
          padding: 24px 24px 42px;
          z-index: 11001;
          max-height: 95vh;
          overflow-y: auto;
          box-shadow: 0 -20px 40px rgba(0,0,0,0.1);
        }
        .sheet-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,0.4);
          backdrop-filter: blur(8px);
          z-index: 11000;
        }
        .method-selector {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin: 20px 0;
        }
        .method-card {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: all 0.2s;
        }
        .method-card.selected {
          border-color: #2563eb;
          background: #eff6ff;
        }
        .method-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .method-title {
          font-size: 14px;
          font-weight: 800;
          color: #1e293b;
        }
        .method-desc {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
        }
        .topup-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 16px;
        }
        .topup-opt {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px 6px;
          text-align: center;
          font-size: 13px;
          font-weight: 700;
          color: #475569;
          cursor: pointer;
          transition: all 0.2s;
        }
        .topup-opt:hover {
          border-color: #3b82f6;
          background: #eff6ff;
          color: #2563eb;
        }
        .toast-premium {
          position: fixed;
          top: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 12000;
          background: #0f172a;
          color: #fff;
          border-radius: 16px;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15);
          font-size: 13px;
          font-weight: 700;
        }
        @media (max-width: 768px) {
          .resident-keuangan-container {
            padding: 12px 6px 100px !important;
          }
          .ruangpay-card {
            padding: 20px !important;
          }
        }
      `}</style>

      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: -20, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: -20, opacity: 0, x: '-50%' }}
            className="toast-premium"
          >
            {toast.type === 'success' ? (
              <CheckCircle size={16} style={{ color: '#22c55e' }} />
            ) : toast.type === 'error' ? (
              <AlertCircle size={16} style={{ color: '#ef4444' }} />
            ) : (
              <Info size={16} style={{ color: '#3b82f6' }} />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {/* RuangPay E-Wallet Card */}
        <div className="ruangpay-card">
          <div className="shimmer-effect" />
          <div className="card-chip">
            <div className="card-chip-inner" />
            <div className="card-chip-inner" />
            <div className="card-chip-inner" />
            <div className="card-chip-inner" />
          </div>
          <div className="tagline">
            <Smartphone size={16} style={{ color: '#d4af37' }} />
            <span>RUANGPAY WALLET</span>
            <span className="gold-badge" style={{ marginLeft: 50 }}>PREMIUM</span>
          </div>
          <div className="balance-label">Saldo Aktif Anda</div>
          <div className="balance-val">
            Rp {(userData.ruangPayBalance || 0).toLocaleString('id-ID')}
          </div>
          <div className="pay-actions">
            <button 
              className="pay-btn" 
              onClick={() => showToast('Fitur Isi Saldo RuangPay Instan segera hadir (Coming Soon)!', 'info')}
            >
              <Plus size={18} />
              <span>Isi Saldo</span>
              <span style={{ 
                background: 'linear-gradient(135deg, #f5b041 0%, #d4af37 100%)', 
                color: '#000', 
                fontSize: 8, 
                fontWeight: 900, 
                padding: '1px 4px', 
                borderRadius: 3,
                marginLeft: 2
              }}>SOON</span>
            </button>
            <button className="pay-btn" onClick={() => {
              if (activeBills.length > 0) {
                setSelectedBill(activeBills[0]);
              } else {
                showToast('Semua tagihan iuran Anda sudah lunas!', 'success');
              }
            }}>
              <Send size={18} />
              <span>Bayar Tagihan</span>
            </button>
          </div>
        </div>

        {/* Quick Metrics */}
        <div className="metric-cards-grid">
          <div className="m-card">
            <div className="lbl">TOTAL TUNGGAKAN</div>
            <div className="val" style={{ color: totalOutstanding > 0 ? '#ef4444' : '#10b981' }}>
              Rp {totalOutstanding.toLocaleString('id-ID')}
            </div>
          </div>
          <div className="m-card">
            <div className="lbl">TAGIHAN LUNAS</div>
            <div className="val" style={{ color: '#10b981' }}>
              {paidBillsCount} Iuran
            </div>
          </div>
        </div>

        {/* Active Bills Section */}
        <div className="section-header">
          <h3>Tagihan Aktif</h3>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>Memuat data tagihan...</div>
        ) : activeBills.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, textAlign: 'center', border: '1px solid #f1f5f9', marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#f0fdf4', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <ShieldCheck size={24} />
            </div>
            <h4 style={{ fontWeight: 800, fontSize: 14, margin: 0, color: '#1e293b' }}>Tagihan Anda Lunas!</h4>
            <p style={{ fontSize: 11, color: '#64748b', marginTop: 4, marginBottom: 0 }}>Tidak ada tunggakan iuran untuk Kartu Keluarga Anda.</p>
          </div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            {activeBills.map((bill) => {
              const isOverdue = new Date(bill.dueDate) < new Date() && bill.status === 'BELUM BAYAR';
              const statusLabel = bill.status === 'MENUNGGU VERIFIKASI' ? 'PENDING' : isOverdue ? 'MENUNGGAK' : 'BELUM BAYAR';
              return (
                <div key={bill.id} className={`bill-card-premium ${isOverdue ? 'danger' : 'warning'}`}>
                  <div className="bill-top">
                    <div className="bill-info-left">
                      <div className="bill-icon-box">
                        <CreditCard size={20} />
                      </div>
                      <div>
                        <div className="bill-title">{bill.title}</div>
                        <div className="bill-category">{bill.category}</div>
                      </div>
                    </div>
                    <span className={`badge-finance ${statusLabel === 'PENDING' ? 'pending' : statusLabel === 'MENUNGGAK' ? 'overdue' : 'unpaid'}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <div className="bill-details-bar">
                    <div className="detail-item">
                      <div className="lbl">NOMINAL</div>
                      <div className="val" style={{ fontWeight: 900 }}>Rp {bill.amount.toLocaleString('id-ID')}</div>
                    </div>
                    <div className="detail-item" style={{ textAlign: 'right' }}>
                      <div className="lbl">JATUH TEMPO</div>
                      <div className="val" style={{ color: isOverdue ? '#ef4444' : '#475569' }}>{bill.dueDate}</div>
                    </div>
                  </div>

                  {bill.status === 'BELUM BAYAR' && (
                    <button className="btn-pay-now" onClick={() => setSelectedBill(bill)}>
                      Bayar Sekarang <ChevronRight size={14} />
                    </button>
                  )}
                  {bill.status === 'MENUNGGU VERIFIKASI' && (
                    <button 
                      className="btn-pay-now" 
                      style={{ background: '#25d366', color: '#fff' }}
                      onClick={() => handleWhatsAppRedirect({
                        billTitle: bill.title,
                        amount: bill.amount,
                        category: bill.category,
                        rt: myFamily?.rt || user?.rt_id || '001',
                        kepalaKeluarga: myFamily?.kepalaKeluarga || userData.name,
                        nomorKK: myFamily?.nomorKK || ''
                      })}
                    >
                      <Send size={14} style={{ marginRight: 6 }} /> Kirim Bukti via WhatsApp
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Transaction History Section */}
        <div className="section-header">
          <h3>Riwayat Pembayaran</h3>
        </div>

        <div className="toolbar-premium" style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div className="search-wrapper-premium" style={{ flex: 1, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              placeholder="Cari riwayat..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', height: 38, border: '1px solid #e2e8f0', borderRadius: 10, paddingLeft: 36, fontSize: 12, outline: 'none', background: '#fff' }}
            />
          </div>
          <select 
            value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            style={{ height: 38, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 10px', fontSize: 12, fontWeight: 600, background: '#fff' }}
          >
            <option value="all">Semua Kategori</option>
            <option value="Iuran Bulanan">Iuran Bulanan</option>
            <option value="Iuran Keamanan">Keamanan</option>
            <option value="Iuran Kebersihan">Kebersihan</option>
            <option value="Iuran Kegiatan">Kegiatan</option>
            <option value="Donasi / Amal">Donasi</option>
          </select>
        </div>

        {filteredPayments.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, textAlign: 'center', border: '1px solid #f1f5f9' }}>
            <History size={32} style={{ opacity: 0.2, margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Belum ada riwayat pembayaran</div>
          </div>
        ) : (
          <div>
            {filteredPayments.map((p) => {
              const bill = familyBills.find(b => b.billId === p.billId);
              const statusColor = p.status === 'APPROVED' ? '#dcfce7' : p.status === 'REJECTED' ? '#fef2f2' : '#fff7ed';
              const iconColor = p.status === 'APPROVED' ? '#22c55e' : p.status === 'REJECTED' ? '#ef4444' : '#f59e0b';
              return (
                <div key={p.id} className="history-card" onClick={() => p.status === 'APPROVED' && setActiveReceipt(p)} style={{ cursor: p.status === 'APPROVED' ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div className="h-left">
                      <div className="h-icon" style={{ background: statusColor, color: iconColor }}>
                        {p.status === 'APPROVED' ? <CheckCircle size={18} /> : p.status === 'REJECTED' ? <X size={18} /> : <Clock size={18} />}
                      </div>
                      <div>
                        <div className="h-title">{bill?.title || 'Iuran Bulanan'}</div>
                        <div className="h-date">{p.paymentDate?.toDate ? p.paymentDate.toDate().toLocaleDateString('id-ID') : 'Baru saja'} • {p.paymentMethod}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="h-amount" style={{ color: iconColor }}>
                        Rp {p.amount.toLocaleString('id-ID')}
                      </div>
                      <span className={`badge-finance ${p.status === 'APPROVED' ? 'paid' : p.status === 'REJECTED' ? 'overdue' : 'pending'}`}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                  {p.status === 'PENDING' && (
                    <button
                      className="btn-pay-now"
                      style={{ 
                        background: '#25d366', 
                        color: '#fff', 
                        fontSize: 11, 
                        height: 32, 
                        padding: '0 12px', 
                        borderRadius: 8, 
                        marginTop: 4, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: 6, 
                        border: 'none', 
                        cursor: 'pointer',
                        fontWeight: 700,
                        width: 'fit-content',
                        alignSelf: 'flex-end'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWhatsAppRedirect({
                          billTitle: bill?.title || 'Iuran Bulanan',
                          amount: p.amount,
                          category: bill?.category || 'Iuran Bulanan',
                          rt: myFamily?.rt || user?.rt_id || '001',
                          kepalaKeluarga: myFamily?.kepalaKeluarga || userData.name,
                          nomorKK: myFamily?.nomorKK || ''
                        });
                      }}
                    >
                      <Send size={12} /> Hubungi Admin via WhatsApp
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Top Up Modal Sheet */}
      <AnimatePresence>
        {showTopUpModal && (
          <>
            <div className="sheet-overlay" onClick={() => setShowTopUpModal(false)} />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="modal-sheet"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1e3a8a', margin: 0 }}>Top Up Saldo RuangPay</h3>
                <button onClick={() => setShowTopUpModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>

              <form onSubmit={handleTopUpSubmit}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Nominal Top Up (Rp)</label>
                  <input 
                    type="number" 
                    placeholder="Contoh: 100000" 
                    value={topUpAmount}
                    onChange={e => setTopUpAmount(e.target.value)}
                    required
                    style={{ width: '100%', height: 48, border: '1px solid #e2e8f0', borderRadius: 14, padding: '0 16px', fontSize: 16, fontWeight: 700, outline: 'none' }}
                  />
                </div>

                <div className="topup-grid">
                  {[50000, 100000, 200000, 300000, 500000, 1000000].map((amt) => (
                    <div key={amt} className="topup-opt" onClick={() => setTopUpAmount(amt.toString())}>
                      Rp {amt / 1000}k
                    </div>
                  ))}
                </div>

                <button 
                  type="submit" 
                  disabled={isTopUpSubmitting}
                  style={{ width: '100%', height: 50, background: '#1e40af', color: '#fff', border: 'none', borderRadius: 16, fontSize: 14, fontWeight: 700, marginTop: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {isTopUpSubmitting ? 'Memproses...' : 'Isi Saldo Sekarang'}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Payment Modal Sheet */}
      <AnimatePresence>
        {selectedBill && (
          <>
            <div className="sheet-overlay" onClick={() => { if (!isPaymentSubmitting) setSelectedBill(null); }} />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="modal-sheet"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1e3a8a', margin: 0 }}>Bayar Tagihan Iuran</h3>
                <button onClick={() => setSelectedBill(null)} disabled={isPaymentSubmitting} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>

              <div style={{ background: '#f8fafc', borderRadius: 16, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>TOTAL TAGIHAN</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#1e3a8a', marginTop: 4 }}>Rp {selectedBill.amount.toLocaleString('id-ID')}</div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 8, fontWeight: 600 }}>{selectedBill.title}</div>
              </div>

              <form onSubmit={handlePaymentSubmit}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 10 }}>Pilih Metode Pembayaran</label>
                
                <div className="method-selector">
                  {/* RuangPay Method */}
                  <div 
                    className="method-card"
                    style={{ 
                      opacity: 0.65, 
                      cursor: 'not-allowed', 
                      background: '#f8fafc',
                      borderColor: '#cbd5e1',
                      position: 'relative'
                    }}
                    onClick={() => showToast('Metode pembayaran RuangPay Instan segera hadir (Coming Soon)!', 'info')}
                  >
                    <div className="method-info">
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#cbd5e1', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Smartphone size={20} />
                      </div>
                      <div>
                        <div className="method-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          RuangPay Instan
                          <span style={{ 
                            background: 'linear-gradient(135deg, #f5b041 0%, #d4af37 100%)', 
                            color: '#000', 
                            fontSize: 9, 
                            fontWeight: 800, 
                            padding: '2px 6px', 
                            borderRadius: 4,
                            boxShadow: '0 2px 4px rgba(212,175,55,0.2)'
                          }}>SOON</span>
                        </div>
                        <div className="method-desc">Metode bayar otomatis & instan tanpa upload struk</div>
                      </div>
                    </div>
                  </div>

                  {/* Transfer Bank Method */}
                  {isBankAvailable && (
                    <div 
                      className={`method-card ${paymentMethod === 'Transfer Bank' ? 'selected' : ''}`}
                      onClick={() => setPaymentMethod('Transfer Bank')}
                    >
                      <div className="method-info">
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Wallet size={20} />
                        </div>
                        <div>
                          <div className="method-title">{bankInfo.name}</div>
                          <div className="method-desc">No. Rek: {bankInfo.number}</div>
                        </div>
                      </div>
                      {paymentMethod === 'Transfer Bank' && <Check size={18} style={{ color: '#2563eb' }} />}
                    </div>
                  )}

                  {/* E-wallet Method */}
                  {isEwalletAvailable && ewalletInfo && (
                    <div 
                      className={`method-card ${paymentMethod === 'E-wallet' ? 'selected' : ''}`}
                      onClick={() => setPaymentMethod('E-wallet')}
                    >
                      <div className="method-info">
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0fdf2', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Wallet size={20} />
                        </div>
                        <div>
                          <div className="method-title">{ewalletInfo.provider}</div>
                          <div className="method-desc">No. HP: {ewalletInfo.phone}</div>
                        </div>
                      </div>
                      {paymentMethod === 'E-wallet' && <Check size={18} style={{ color: '#2563eb' }} />}
                    </div>
                  )}

                  {/* QRIS Method */}
                  {isQrisAvailable && (
                    <div 
                      className={`method-card ${paymentMethod === 'QRIS' ? 'selected' : ''}`}
                      onClick={() => setPaymentMethod('QRIS')}
                    >
                      <div className="method-info">
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CreditCard size={20} />
                        </div>
                        <div>
                          <div className="method-title">{qrisInfo.name}</div>
                          <div className="method-desc">Pindai QRIS Merchant</div>
                        </div>
                      </div>
                      {paymentMethod === 'QRIS' && <Check size={18} style={{ color: '#2563eb' }} />}
                    </div>
                  )}
                </div>

                {/* Bank Details Box */}
                {paymentMethod === 'Transfer Bank' && (
                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 14, border: '1px solid #e2e8f0', marginTop: -8, marginBottom: 16, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: '#475569', marginBottom: 4 }}>Detail Rekening Tujuan:</div>
                    <div>Bank: <strong>{bankInfo.name}</strong></div>
                    <div>No. Rekening: <strong style={{ color: '#2563eb', fontSize: 14, fontFamily: 'monospace' }}>{bankInfo.number}</strong></div>
                    <div>Nama Pemilik: <strong>{bankInfo.owner}</strong></div>
                  </div>
                )}

                {/* E-wallet Details Box */}
                {paymentMethod === 'E-wallet' && ewalletInfo && (
                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 14, border: '1px solid #e2e8f0', marginTop: -8, marginBottom: 16, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: '#475569', marginBottom: 4 }}>Detail E-wallet Tujuan:</div>
                    <div>Layanan: <strong>{ewalletInfo.provider}</strong></div>
                    <div>No. HP / ID: <strong style={{ color: '#2563eb', fontSize: 14, fontFamily: 'monospace' }}>{ewalletInfo.phone}</strong></div>
                    <div>Nama Akun: <strong>{ewalletInfo.owner}</strong></div>
                  </div>
                )}

                {/* QRIS Image Preview */}
                {paymentMethod === 'QRIS' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '-8px 0 16px 0', padding: 16, background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 10 }}>Pindai QRIS Merchant: {qrisInfo.name}</div>
                    {qrisInfo.image ? (
                      <img src={qrisInfo.image} alt="QRIS Merchant Barcode" style={{ width: 180, height: 180, objectFit: 'contain' }} />
                    ) : (
                      <div style={{ padding: 24, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                        Gambar QRIS belum dikonfigurasi oleh admin.
                      </div>
                    )}
                  </div>
                )}

                {/* Bank / E-wallet / QRIS Receipt Upload */}
                {(paymentMethod === 'Transfer Bank' || paymentMethod === 'E-wallet' || paymentMethod === 'QRIS') && (
                  <div style={{ marginTop: 12 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Upload Bukti Pembayaran</label>
                    
                    {proofImage ? (
                      <div style={{ position: 'relative', width: '100%', height: 160, borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        <img src={proofImage} alt="Receipt proof" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f8fafc' }} />
                        <button 
                          type="button" 
                          onClick={() => setProofImage('')}
                          style={{ position: 'absolute', right: 10, top: 10, width: 28, height: 28, borderRadius: '50%', background: 'rgba(15,23,42,0.6)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, border: '2px dashed #cbd5e1', borderRadius: 16, cursor: 'pointer', background: '#f8fafc' }}>
                        <Upload size={24} style={{ color: '#64748b', marginBottom: 8 }} />
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Klik untuk pilih foto struk</span>
                        <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                      </label>
                    )}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isPaymentSubmitting || !paymentMethod}
                  style={{ width: '100%', height: 50, background: '#1e40af', color: '#fff', border: 'none', borderRadius: 16, fontSize: 14, fontWeight: 700, marginTop: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {isPaymentSubmitting ? 'Memproses Pembayaran...' : paymentMethod === 'RuangPay' ? 'Bayar Instan Sekarang' : 'Kirim Bukti Pembayaran'}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* digital invoice / receipt Modal */}
      <AnimatePresence>
        {activeReceipt && (
          <div className="sheet-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setActiveReceipt(null)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: '#fff', width: '100%', maxWidth: 360, borderRadius: 24, padding: 24, position: 'relative' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #e2e8f0', paddingBottom: 20, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f0fdf4', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <CheckCircle size={24} />
                </div>
                <h4 style={{ fontWeight: 900, color: '#1e3a8a', fontSize: 16, margin: 0 }}>Bukti Bayar Resmi</h4>
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>RUANG WARGA 011 VSJ</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>No. Transaksi</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{activeReceipt.id.substring(0, 10).toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>Pembayar</span>
                  <span style={{ fontWeight: 700 }}>{activeReceipt.kepalaKeluarga}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>No. KK</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{activeReceipt.nomorKK}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>Metode</span>
                  <span style={{ fontWeight: 700 }}>{activeReceipt.paymentMethod}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>Tanggal</span>
                  <span style={{ fontWeight: 700 }}>{activeReceipt.paymentDate?.toDate ? activeReceipt.paymentDate.toDate().toLocaleString('id-ID') : 'Baru saja'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 4 }}>
                  <span style={{ color: '#1e3a8a', fontWeight: 800 }}>Total Nominal</span>
                  <span style={{ fontWeight: 900, color: '#1e3a8a', fontSize: 15 }}>Rp {activeReceipt.amount.toLocaleString('id-ID')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>Diverifikasi Oleh</span>
                  <span style={{ fontWeight: 700, color: '#10b981' }}>{activeReceipt.verifiedBy}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button 
                  onClick={() => window.print()}
                  style={{ flex: 1, height: 40, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Download size={14} /> Cetak
                </button>
                <button 
                  onClick={() => setActiveReceipt(null)}
                  style={{ flex: 1, height: 40, border: 'none', background: '#1e40af', color: '#fff', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Bottom Sheet (WhatsApp Redirect) */}
      <AnimatePresence>
        {lastUploadedPayment && (
          <>
            <div className="sheet-overlay" onClick={() => setLastUploadedPayment(null)} />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="modal-sheet"
              style={{ paddingBottom: 32 }}
            >
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <CheckCircle size={36} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1e3a8a', margin: '0 0 8px 0' }}>Bukti Berhasil Diunggah!</h3>
                <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 24px 0', lineHeight: 1.5 }}>
                  Bukti pembayaran untuk tagihan <strong>{lastUploadedPayment.billTitle}</strong> sebesar <strong>Rp {lastUploadedPayment.amount.toLocaleString('id-ID')}</strong> telah berhasil diunggah dan sedang menunggu verifikasi dari admin.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <button 
                    onClick={() => {
                      handleWhatsAppRedirect(lastUploadedPayment);
                      setLastUploadedPayment(null);
                    }}
                    style={{ 
                      width: '100%', 
                      height: 50, 
                      background: '#25d366', 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: 16, 
                      fontSize: 14, 
                      fontWeight: 800, 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 10px 15px -3px rgba(37, 211, 102, 0.2)' 
                    }}
                  >
                    <Send size={16} /> Hubungi Admin via WhatsApp
                  </button>

                  <button 
                    onClick={() => setLastUploadedPayment(null)}
                    style={{ 
                      width: '100%', 
                      height: 48, 
                      background: '#f1f5f9', 
                      color: '#475569', 
                      border: 'none', 
                      borderRadius: 16, 
                      fontSize: 14, 
                      fontWeight: 700, 
                      cursor: 'pointer' 
                    }}
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
