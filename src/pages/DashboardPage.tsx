import React, { useState, useEffect } from 'react';
import {
  Users, Home, FileText, Wallet,
  TrendingUp, TrendingDown, Clock,
  AlertCircle, ArrowUpRight, Bell,
  UserCheck, Activity, Megaphone,
  ChevronRight, RefreshCw, CheckCircle2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area
} from 'recharts';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { User } from '../types';

interface DashboardPageProps { user?: User | null; }

function timeAgo(ts: any): string {
  if (!ts) return '-';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}d lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
const STATUS_COLORS = { active: '#10b981', waiting_admin_approval: '#f59e0b', rejected: '#ef4444', pending_registration: '#6366f1' };
const PIE_COLORS = ['#10b981','#f59e0b','#ef4444','#6366f1','#3b82f6'];

export default function DashboardPage({ user }: DashboardPageProps) {
  const [stats, setStats] = useState({ totalWarga: 0, totalKK: 0, pendingApproval: 0, suratPending: 0, pemasukan: 0, pengeluaran: 0, pengaduan: 0, pendingPengaduan: 0 });
  const [activities, setActivities] = useState<any[]>([]);
  const [rtChartData, setRtChartData] = useState<any[]>([]);
  const [statusPieData, setStatusPieData] = useState<any[]>([]);
  const [financeChartData, setFinanceChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetch = async () => {
    setLoading(true);
    try {
      const [usersSnap, familiesSnap, suratSnap, financeSnap, pengaduanSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'families')),
        getDocs(collection(db, 'suratRequests')),
        getDocs(collection(db, 'keuangan')),
        getDocs(collection(db, 'pengaduan')),
      ]);

      const wargaDocs = usersSnap.docs.filter(d => d.data().role === 'warga');

      // Stats
      setStats({
        totalWarga: wargaDocs.length,
        totalKK: familiesSnap.size,
        pendingApproval: wargaDocs.filter(d => d.data().accountStatus === 'waiting_admin_approval').length,
        suratPending: suratSnap.docs.filter(d => d.data().status === 'Pending').length,
        pemasukan: financeSnap.docs.filter(d => d.data().type === 'Masuk').reduce((a, d) => a + (d.data().amount || 0), 0),
        pengeluaran: financeSnap.docs.filter(d => d.data().type === 'Keluar').reduce((a, d) => a + (d.data().amount || 0), 0),
        pengaduan: pengaduanSnap.size,
        pendingPengaduan: pengaduanSnap.docs.filter(d => d.data().status === 'Baru').length,
      });

      // RT Bar Chart
      const rtMap: Record<string, number> = {};
      wargaDocs.forEach(d => {
        const rt = d.data().rt_id || 'N/A';
        rtMap[rt] = (rtMap[rt] || 0) + 1;
      });
      setRtChartData(Object.entries(rtMap).sort(([a],[b]) => a.localeCompare(b)).map(([rt, count]) => ({ name: `RT ${rt}`, warga: count })));

      // Status Pie Chart
      const statusMap: Record<string, number> = {};
      wargaDocs.forEach(d => {
        const s = d.data().accountStatus || 'unknown';
        statusMap[s] = (statusMap[s] || 0) + 1;
      });
      const statusLabel: Record<string, string> = { active: 'Aktif', waiting_admin_approval: 'Menunggu', rejected: 'Ditolak', pending_registration: 'Registrasi' };
      setStatusPieData(Object.entries(statusMap).map(([k, v]) => ({ name: statusLabel[k] || k, value: v })));

      // Monthly Finance Chart
      const monthlyMap: Record<number, { masuk: number; keluar: number }> = {};
      for (let i = 0; i < 6; i++) monthlyMap[i] = { masuk: 0, keluar: 0 };
      financeSnap.docs.forEach(d => {
        const data = d.data();
        const date = data.date ? new Date(data.date) : null;
        if (!date) return;
        const monthsAgo = (new Date().getMonth() - date.getMonth() + 12) % 12;
        if (monthsAgo < 6) {
          const idx = 5 - monthsAgo;
          if (data.type === 'Masuk') monthlyMap[idx].masuk += data.amount || 0;
          else monthlyMap[idx].keluar += data.amount || 0;
        }
      });
      const now = new Date();
      setFinanceChartData(Array.from({ length: 6 }, (_, i) => ({
        name: MONTHS[(now.getMonth() - 5 + i + 12) % 12],
        masuk: monthlyMap[i].masuk,
        keluar: monthlyMap[i].keluar,
      })));

      // Activities
      const acts: any[] = [];
      wargaDocs.filter(d => d.data().createdAt).sort((a, b) => (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0)).slice(0, 4).forEach(d => {
        acts.push({ id: d.id, type: 'warga', text: `Pendaftaran: ${d.data().name}`, time: timeAgo(d.data().createdAt), status: d.data().accountStatus });
      });
      setActivities(acts);
      setLastUpdated(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); const t = setInterval(fetch, 60000); return () => clearInterval(t); }, []);

  const fmt = (n: number) => n >= 1e6 ? `Rp ${(n/1e6).toFixed(1)}Jt` : n >= 1e3 ? `Rp ${(n/1e3).toFixed(0)}K` : `Rp ${n}`;
  const saldo = stats.pemasukan - stats.pengeluaran;

  const Skeleton = () => <div style={{ height: 48, borderRadius: 10, background: 'linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', marginBottom: 10 }} />;

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-800)', margin: '0 0 4px' }}>Dashboard Analitik</h2>
          <p style={{ fontSize: 12, color: 'var(--gray-400)', margin: 0 }}>
            Diperbarui: {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button onClick={fetch} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'var(--gray-50)', border: '1px solid var(--gray-200)', fontSize: 13, fontWeight: 700, color: 'var(--gray-600)', cursor: 'pointer' }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Perbarui
        </button>
      </div>

      {/* Stat Cards */}
      <div className="dash-stat-grid">
        {[
          { title: 'Total Warga', value: stats.totalWarga, sub: `${stats.pendingApproval} menunggu`, icon: Users, g: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', alert: stats.pendingApproval },
          { title: 'Kartu Keluarga', value: stats.totalKK, sub: 'KK terdaftar', icon: Home, g: 'linear-gradient(135deg,#10b981,#059669)', alert: 0 },
          { title: 'Surat Pending', value: stats.suratPending, sub: 'Perlu diproses', icon: FileText, g: 'linear-gradient(135deg,#f59e0b,#d97706)', alert: stats.suratPending },
          { title: 'Saldo Kas', value: fmt(saldo), sub: `+${fmt(stats.pemasukan)} / -${fmt(stats.pengeluaran)}`, icon: Wallet, g: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', alert: 0 },
        ].map((c, i) => (
          <div key={i} style={{ background: c.g, borderRadius: 20, padding: 20, color: '#fff', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,.12)', transition: 'transform .2s, box-shadow .2s', cursor: 'default' }}
            onMouseEnter={e => { (e.currentTarget as any).style.transform = 'translateY(-4px)'; (e.currentTarget as any).style.boxShadow = '0 12px 30px rgba(0,0,0,.18)'; }}
            onMouseLeave={e => { (e.currentTarget as any).style.transform = ''; (e.currentTarget as any).style.boxShadow = '0 4px 20px rgba(0,0,0,.12)'; }}>
            <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,.1)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <c.icon size={22} color="#fff" />
              </div>
              {c.alert > 0 && <span style={{ background: '#fff', color: '#ef4444', fontSize: 11, fontWeight: 900, padding: '2px 8px', borderRadius: 50 }}>{c.alert}</span>}
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, marginBottom: 4 }}>{loading ? '…' : c.value}</div>
            <div style={{ fontSize: 13, fontWeight: 700, opacity: .9, marginBottom: 4 }}>{c.title}</div>
            <div style={{ fontSize: 11, opacity: .7 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="dash-charts-grid">

        {/* Bar Chart: Warga per RT */}
        <div className="dash-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--gray-800)', margin: 0 }}>Warga per RT</h3>
            </div>
          </div>
          {loading ? <Skeleton /> : rtChartData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gray-400)', fontSize: 13 }}>Belum ada data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={rtChartData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.12)', fontSize: 12 }} />
                <Bar dataKey="warga" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie Chart: Status Akun */}
        <div className="dash-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--gray-800)', margin: 0 }}>Status Akun Warga</h3>
          </div>
          {loading ? <Skeleton /> : statusPieData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gray-400)', fontSize: 13 }}>Belum ada data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusPieData} cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {statusPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.12)', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>

      {/* Finance Area Chart */}
      <div className="dash-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' }} />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--gray-800)', margin: 0 }}>Tren Keuangan 6 Bulan Terakhir</h3>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, fontWeight: 700 }}>
            <span style={{ color: '#10b981' }}>● Pemasukan</span>
            <span style={{ color: '#ef4444' }}>● Pengeluaran</span>
          </div>
        </div>
        {loading ? <Skeleton /> : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={financeChartData}>
              <defs>
                <linearGradient id="gMasuk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gKeluar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(0)}Jt` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : String(v)} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.12)', fontSize: 12 }} formatter={(v: any) => fmt(v)} />
              <Area type="monotone" dataKey="masuk" stroke="#10b981" strokeWidth={2.5} fill="url(#gMasuk)" dot={{ fill: '#10b981', r: 4 }} />
              <Area type="monotone" dataKey="keluar" stroke="#ef4444" strokeWidth={2.5} fill="url(#gKeluar)" dot={{ fill: '#ef4444', r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom Row: Activity + Right Panel */}
      <div className="dash-bottom-grid">

        {/* Activity Feed */}
        <div className="dash-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--gray-800)', margin: 0 }}>Aktivitas Terbaru</h3>
            </div>
          </div>
          {loading ? [1,2,3].map(i => <Skeleton key={i} />) : activities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-400)', fontSize: 13 }}>Belum ada aktivitas</div>
          ) : activities.map((act, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 12, borderBottom: i < activities.length - 1 ? '1px solid var(--gray-100)' : 'none', marginBottom: i < activities.length - 1 ? 12 : 0 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <UserCheck size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{act.text}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={11} color="var(--gray-400)" />
                  <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{act.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Finance + Complaints */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="dash-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' }} />
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--gray-800)', margin: 0 }}>Ringkasan Kas</h3>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              {[{ label: 'Pemasukan', val: fmt(stats.pemasukan), color: '#059669', Icon: TrendingUp },
                { label: 'Pengeluaran', val: fmt(stats.pengeluaran), color: '#dc2626', Icon: TrendingDown }].map((item, i) => (
                <div key={i} style={{ flex: 1, padding: '12px', background: 'var(--gray-50)', borderRadius: 12, border: '1px solid var(--gray-100)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <item.Icon size={14} color={item.color} />
                    <span style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 600 }}>{item.label}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: item.color }}>{loading ? '…' : item.val}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 12, border: '1px solid var(--gray-100)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)' }}>Saldo Bersih</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: saldo >= 0 ? '#059669' : '#dc2626' }}>{loading ? '…' : (saldo >= 0 ? '+' : '') + fmt(saldo)}</span>
            </div>
          </div>

          <div className="dash-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--gray-800)', margin: 0 }}>Pengaduan</h3>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { icon: AlertCircle, color: '#f59e0b', val: stats.pendingPengaduan, label: 'Baru' },
                { icon: CheckCircle2, color: '#10b981', val: stats.pengaduan - stats.pendingPengaduan, label: 'Selesai' },
                { icon: Bell, color: '#3b82f6', val: stats.pengaduan, label: 'Total' },
              ].map((item, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', padding: '12px 6px', background: 'var(--gray-50)', borderRadius: 12, border: '1px solid var(--gray-100)' }}>
                  <item.icon size={18} color={item.color} style={{ marginBottom: 6 }} />
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--gray-800)' }}>{loading ? '…' : item.val}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 700 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {stats.pendingApproval > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 16, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertCircle size={16} color="#d97706" />
                <span style={{ fontSize: 14, fontWeight: 800, color: '#92400e' }}>{stats.pendingApproval} Persetujuan Menunggu</span>
              </div>
              <p style={{ fontSize: 12, color: '#78350f', margin: '0 0 12px', lineHeight: 1.5 }}>Ada warga yang perlu diverifikasi segera.</p>
              <button onClick={() => window.location.href = '/admin/approvals'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: '#d97706', color: '#fff', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                Tinjau Sekarang <ArrowUpRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .dash-card { background:#fff; border-radius:20px; padding:20px; border:1px solid var(--gray-100); box-shadow:0 2px 12px rgba(0,0,0,.04); margin-bottom:0; }
        .dash-stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:20px; }
        .dash-charts-grid { display:grid; grid-template-columns:1.4fr 1fr; gap:20px; margin-bottom:20px; }
        .dash-bottom-grid { display:grid; grid-template-columns:1.4fr 1fr; gap:20px; }
        @media(max-width:1024px) {
          .dash-stat-grid { grid-template-columns:repeat(2,1fr); }
          .dash-charts-grid { grid-template-columns:1fr; }
          .dash-bottom-grid { grid-template-columns:1fr; }
        }
        @media(max-width:640px) {
          .dash-stat-grid { grid-template-columns:1fr 1fr; gap:10px; }
          .dash-card { padding:14px; border-radius:16px; }
        }
      `}</style>
    </div>
  );
}
