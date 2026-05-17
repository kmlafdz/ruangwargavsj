/**
 * Biometric Service using Web Authentication API (WebAuthn)
 * Provides real fingerprint/face recognition for web applications.
 */

export interface BiometricCredential {
  id: string;
  publicKey: string;
  counter: number;
}

/**
 * Register a new biometric credential
 */
export async function registerBiometric(username: string): Promise<any> {
  if (!window.PublicKeyCredential) {
    if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
      throw new Error('Autentikasi biometrik membutuhkan koneksi aman (HTTPS) atau dijalankan langsung di HP menggunakan APK Native.');
    }
    throw new Error('Browser ini tidak mendukung autentikasi biometrik.');
  }

  // Challenge from server (mocked for demo, should be random from backend)
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const userId = new Uint8Array(16);
  window.crypto.getRandomValues(userId);

  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: "Ruang Warga VSJ",
      id: window.location.hostname,
    },
    user: {
      id: userId,
      name: username,
      displayName: username,
    },
    pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
    authenticatorSelection: {
      authenticatorAttachment: "platform", // Force use of device biometrics (TouchID, FaceID, Windows Hello)
      userVerification: "required",
    },
    timeout: 60000,
    attestation: "direct",
  };

  try {
    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    }) as any;

    if (!credential) throw new Error('Registrasi dibatalkan.');

    // In a real app, you send the credential to your server to verify and store the public key
    return {
      id: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
      type: credential.type,
    };
  } catch (error: any) {
    console.error('Biometric Registration Error:', error);
    throw error;
  }
}

/**
 * Authenticate using existing biometric credential
 */
export async function authenticateBiometric(credentialId: string): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const allowCredentials: PublicKeyCredentialDescriptor[] = [
    {
      id: Uint8Array.from(atob(credentialId), c => c.charCodeAt(0)),
      type: "public-key",
      transports: ["internal"],
    },
  ];

  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    allowCredentials,
    userVerification: "required",
    timeout: 60000,
  };

  try {
    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    });

    return !!assertion;
  } catch (error) {
    console.error('Biometric Authentication Error:', error);
    return false;
  }
}

/**
 * Check if biometrics are available on this device
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  
  return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
}
