import { bytesToB64 } from "./b64";

const enc = new TextEncoder();
const toB64 = (b: ArrayBuffer | Uint8Array) => bytesToB64(new Uint8Array(b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const randomToken = () => toB64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c] ?? "");

export const sha256 = async (s: string) => toB64(await crypto.subtle.digest("SHA-256", enc.encode(s)));

const keyCache = new Map<string, Promise<CryptoKey>>();
const masterKey = (b64: string) => {
  let key = keyCache.get(b64);
  if (!key) {
    key = crypto.subtle.importKey("raw", fromB64(b64), "AES-GCM", false, ["encrypt", "decrypt"]);
    keyCache.set(b64, key);
  }
  return key;
};

// `aad` binds the ciphertext to its row so a secret can't be swapped onto another account.
export async function encryptSecret(masterB64: string, plaintext: string, aad: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(aad) }, await masterKey(masterB64), enc.encode(plaintext));
  return `v1:${toB64(iv)}:${toB64(ct)}`;
}

export async function decryptSecret(masterB64: string, stored: string, aad: string): Promise<string> {
  const [version, iv, ct] = stored.split(":");
  if (version !== "v1" || !iv || !ct) throw new Error("Unknown secret format");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv), additionalData: enc.encode(aad) }, await masterKey(masterB64), fromB64(ct));
  return new TextDecoder().decode(pt);
}
