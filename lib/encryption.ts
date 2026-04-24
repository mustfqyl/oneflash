import CryptoJS from "crypto-js";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "";

export function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY not set");
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

export function decrypt(ciphertext: string): string {
  if (!ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY not set");
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}
