import Swal, { SweetAlertIcon, SweetAlertResult } from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

/**
 * Global custom pop-up for Alerts (Success, Error, Info, Warning)
 * Replaces native `window.alert()`
 */
export const showAlert = (
  title: string,
  text?: string,
  icon: SweetAlertIcon = 'info'
) => {
  return MySwal.fire({
    title,
    text,
    icon,
    confirmButtonColor: '#2563eb', // Matches blue-600
    confirmButtonText: 'Tutup',
    customClass: {
      popup: 'rounded-3xl',
      confirmButton: 'rounded-xl px-6 py-3 font-bold',
    },
  });
};

/**
 * Global custom pop-up for Confirmation
 * Replaces native `window.confirm()`
 */
export const showConfirm = async (
  title: string,
  text?: string,
  confirmText: string = 'Ya',
  cancelText: string = 'Batal'
): Promise<boolean> => {
  const result: SweetAlertResult = await MySwal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444', // Matches red-500
    cancelButtonColor: '#94a3b8', // Matches slate-400
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true, // Put confirm on the right
    customClass: {
      popup: 'rounded-3xl',
      confirmButton: 'rounded-xl px-6 py-3 font-bold',
      cancelButton: 'rounded-xl px-6 py-3 font-bold',
    },
  });

  return result.isConfirmed;
};
