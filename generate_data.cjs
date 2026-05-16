const fs = require('fs');

const firstNames = ['ADITYA', 'SITI', 'BUDI', 'DEWI', 'EKO', 'RINA', 'AGUS', 'MAYA', 'IWAN', 'ANI', 'FAJAR', 'DIAN', 'HENDRA', 'LISA', 'RIZKY', 'PUTRI', 'ARIS', 'NINA', 'DEDI', 'RATNA'];
const lastNames = ['PRATAMA', 'AISYAH', 'SANTOSO', 'LESTARI', 'PRASETYO', 'SARI', 'KURNIAWAN', 'PUSPITA', 'HIDAYAT', 'WULANDARI', 'SAPUTRA', 'UTAMI', 'WIJAYA', 'INDRIANI', 'RAMADHAN', 'FITRIANI', 'SETIAWAN', 'RAHAYU', 'NUGROHO', 'Mulyani'];
const occupations = ['KARYAWAN SWASTA', 'IBU RUMAH TANGGA', 'WIRASWASTA', 'GURU', 'DRIVING ONLINE', 'PEGAWAI NEGERI', 'BURUH', 'MAHASISWA', 'PEDAGANG', 'TNI/POLRI'];
const status = ['Tetap', 'Kontrak'];
const rts = ['001', '002', '003', '004', '005'];

const data = [];

for (let i = 1; i <= 400; i++) {
  const isMale = Math.random() > 0.5;
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const gender = isMale ? 'LAKI-LAKI' : 'PEREMPUAN';
  const rt = rts[Math.floor(Math.random() * rts.length)];
  const st = Math.random() > 0.2 ? 'Tetap' : 'Kontrak';
  const occ = occupations[Math.floor(Math.random() * occupations.length)];
  
  // Realistic NIK generation
  const nik = `321606${Math.floor(Math.random() * 31 + 1).toString().padStart(2, '0')}${Math.floor(Math.random() * 12 + 1).toString().padStart(2, '0')}${Math.floor(Math.random() * 30 + 70)}${i.toString().padStart(4, '0')}`;
  
  data.push({
    id: `res-${i.toString().padStart(3, '0')}`,
    nik: nik,
    nama: `${firstName} ${lastName}`,
    rt_id: rt,
    jenisKelamin: gender,
    status: st,
    pekerjaan: occ,
    alamat: `Villa Samudra Jaya Blok ${String.fromCharCode(65 + Math.floor(i/80))}${Math.floor(i/40) + 1}/${(i % 40) + 1}`
  });
}

fs.writeFileSync('c:/Users/ThinkPad/.gemini/antigravity/scratch/rw-project/dummy_residents_400.json', JSON.stringify(data, null, 2));
console.log('Generated 400 residents to dummy_residents_400.json');
