// RT WhatsApp Configuration
// IMPORTANT: Replace these numbers with the actual RT chief phone numbers
export const RT_CONFIG: Record<string, { name: string; whatsapp: string; ketua: string }> = {
  '001': { name: 'RT 001', ketua: 'Ketua RT 001', whatsapp: '6281234567890' },
  '002': { name: 'RT 002', ketua: 'Ketua RT 002', whatsapp: '6281234567891' },
  '003': { name: 'RT 003', ketua: 'Ketua RT 003', whatsapp: '6281234567892' },
  '004': { name: 'RT 004', ketua: 'Ketua RT 004', whatsapp: '6281234567893' },
  '005': { name: 'RT 005', ketua: 'Ketua RT 005', whatsapp: '6281234567894' },
};

export function buildWhatsAppUrl(rt: string, registrationId: string, name: string): string {
  const config = RT_CONFIG[rt];
  if (!config) return '';
  const message = encodeURIComponent(
    `Assalamualaikum Bapak/Ibu ${config.ketua},\n\nSaya ${name} telah mendaftar sebagai warga RW 011 - ${config.name} dengan ID Pendaftaran: *${registrationId}*.\n\nMohon kesediaan Bapak/Ibu untuk memverifikasi pendaftaran saya.\n\nTerima kasih.`
  );
  return `https://wa.me/${config.whatsapp}?text=${message}`;
}
