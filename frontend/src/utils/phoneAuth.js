export const PHONE_JWT_STORAGE_KEY = 'coders-hub-phone-jwt';

export function getStoredPhoneJwt() {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(PHONE_JWT_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function setStoredPhoneJwt(token) {
  sessionStorage.setItem(PHONE_JWT_STORAGE_KEY, token);
}

export function clearStoredPhoneJwt() {
  try {
    sessionStorage.removeItem(PHONE_JWT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
