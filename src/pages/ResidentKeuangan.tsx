/**
 * ResidentKeuangan.tsx
 * Ultimate mobile-first contribution and e-wallet (RuangPay) portal for residents
 */
import React, { useState, useEffect } from 'react';
import { 
  Wallet, Search, Plus, Download, Filter, CreditCard, 
  History, Clock, CheckCircle, AlertCircle, ChevronRight, 
  Smartphone, Send, Upload, FileText, Check, X, ShieldCheck
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
  const [paymentMethod, setPaymentMethod] = useState<'RuangPay' | 'Transfer Bank' | 'QRIS' | null>(null);
  const [proofImage, setProofImage] = useState<string>('');
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
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
        const success = await payWithRuangPay(selectedBill.id, userData.id, {
          id: myFamily.id,
          nomorKK: myFamily.nomorKK,
          kepalaKeluarga: myFamily.kepalaKeluarga || userData.name,
          rt: myFamily.rt || '001'
        });
        if (success) {
          showToast(`Pembayaran ${selectedBill.title} lunas seketika ditenagai RuangPay!`, 'success');
          setSelectedBill(null);
        }
      } else {
        if (!proofImage) {
          showToast('Silakan unggah bukti transfer/pembayaran Anda', 'error');
          setIsPaymentSubmitting(false);
          return;
        }
        await submitPaymentProof(selectedBill.id, paymentMethod, proofImage, {
          id: myFamily.id,
          nomorKK: myFamily.nomorKK,
          kepalaKeluarga: myFamily.kepalaKeluarga || userData.name,
          rt: myFamily.rt || '001'
        });
        showToast('Bukti pembayaran berhasil diunggah. Menunggu verifikasi admin.', 'success');
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
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
          border-radius: 24px;
          padding: 24px;
          color: #fff;
          position: relative;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(59, 130, 246, 0.25);
          margin-bottom: 24px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .ruangpay-card::before {
          content: '';
          position: absolute;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 60%);
          top: -100px;
          right: -100px;
          border-radius: 50%;
        }
        .tagline {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          opacity: 0.8;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 12px;
        }
        .balance-label {
          font-size: 12px;
          opacity: 0.7;
          font-weight: 500;
        }
        .balance-val {
          font-size: 32px;
          font-weight: 900;
          letter-spacing: -0.5px;
          margin: 4px 0 20px;
        }
        .pay-actions {
          display: flex;
          gap: 12px;
        }
        .pay-btn {
          flex: 1;
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.2);
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
          transition: all 0.2s;
          backdrop-filter: blur(10px);
        }
        .pay-btn:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: translateY(-2px);
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
          z-index: 5001;
          max-height: 95vh;
          overflow-y: auto;
          box-shadow: 0 -20px 40px rgba(0,0,0,0.1);
        }
        .sheet-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,0.4);
          backdrop-filter: blur(8px);
          z-index: 5000;
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
          z-index: 10000;
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
            {toast.type === 'success' ? <CheckCircle size={16} style={{ color: '#22c55e' }} /> : <AlertCircle size={16} style={{ color: '#ef4444' }} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {/* RuangPay E-Wallet Card */}
        <div className="ruangpay-card">
          <div className="tagline">
            <Smartphone size={16} />
            <span>RUANGPAY WALLET</span>
          </div>
          <div className="balance-label">Saldo Aktif Anda</div>
          <div className="balance-val">
            Rp {(userData.ruangPayBalance || 0).toLocaleString('id-ID')}
          </div>
          <div className="pay-actions">
            <button className="pay-btn" onClick={() => setShowTopUpModal(true)}>
              <Plus size={18} />
              <span>Isi Saldo</span>
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
                <div key={p.id} className="history-card" onClick={() => p.status === 'APPROVED' && setActiveReceipt(p)} style={{ cursor: p.status === 'APPROVED' ? 'pointer' : 'default' }}>
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
                    className={`method-card ${paymentMethod === 'RuangPay' ? 'selected' : ''}`}
                    onClick={() => setPaymentMethod('RuangPay')}
                  >
                    <div className="method-info">
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Smartphone size={20} />
                      </div>
                      <div>
                        <div className="method-title">RuangPay Instan</div>
                        <div className="method-desc">Saldo Aktif: Rp {(userData.ruangPayBalance || 0).toLocaleString('id-ID')} (Auto-Verifikasi)</div>
                      </div>
                    </div>
                    {paymentMethod === 'RuangPay' && <Check size={18} style={{ color: '#2563eb' }} />}
                  </div>

                  {/* Transfer Bank Method */}
                  <div 
                    className={`method-card ${paymentMethod === 'Transfer Bank' ? 'selected' : ''}`}
                    onClick={() => setPaymentMethod('Transfer Bank')}
                  >
                    <div className="method-info">
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Wallet size={20} />
                      </div>
                      <div>
                        <div className="method-title">Transfer Bank Mandiri</div>
                        <div className="method-desc">Rek: 131-00-1234567-8 a.n. Kas RW 011 VSJ</div>
                      </div>
                    </div>
                    {paymentMethod === 'Transfer Bank' && <Check size={18} style={{ color: '#2563eb' }} />}
                  </div>

                  {/* QRIS Method */}
                  <div 
                    className={`method-card ${paymentMethod === 'QRIS' ? 'selected' : ''}`}
                    onClick={() => setPaymentMethod('QRIS')}
                  >
                    <div className="method-info">
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CreditCard size={20} />
                      </div>
                      <div>
                        <div className="method-title">QRIS Mandiri VSJ</div>
                        <div className="method-desc">Scan barcode untuk bayar via dompet digital</div>
                      </div>
                    </div>
                    {paymentMethod === 'QRIS' && <Check size={18} style={{ color: '#2563eb' }} />}
                  </div>
                </div>

                {/* Bank / QRIS Receipt Upload */}
                {(paymentMethod === 'Transfer Bank' || paymentMethod === 'QRIS') && (
                  <div style={{ marginTop: 20 }}>
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
    </div>
  );
}
