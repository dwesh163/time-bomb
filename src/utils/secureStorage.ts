const STORAGE_PREFIX = 'tb_';
const FIXED_KEY_UUID = 'b387bea4-cfe2-4a07-a88f-7c3e824c77f3';
const TOTAL_ENTRIES = 256;
const TARGET_LENGTH = 88;

async function generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

async function encryptData(text: string, key: CryptoKey): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
}

async function decryptData(encryptedText: string, key: CryptoKey): Promise<string> {
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}

async function exportKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

async function importKey(keyData: string): Promise<CryptoKey> {
    const raw = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
    return await crypto.subtle.importKey(
        'raw',
        raw,
        { name: 'AES-GCM' },
        true,
        ['encrypt', 'decrypt']
    );
}

function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function generateRandomEncrypted(key: CryptoKey): Promise<string> {
    const randomLength = 50 + Math.floor(Math.random() * 30);
    const randomBytes = crypto.getRandomValues(new Uint8Array(randomLength));
    const randomText = btoa(String.fromCharCode(...randomBytes));
    const fakeData = `FAKE:${randomText}:FAKE`;
    return await encryptData(fakeData, key);
}

function padToLength(str: string, targetLen: number): string {
    if (str.length >= targetLen) return str;
    const origLen = str.length.toString(16).padStart(2, '0');
    const padding = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let result = str;
    while (result.length < targetLen - 2) {
        result += padding[Math.floor(Math.random() * padding.length)];
    }
    return result + origLen;
}

function removePadding(str: string): string {
    if (str.length < 2) return str;
    const lenHex = str.substring(str.length - 2);
    const origLen = parseInt(lenHex, 16);
    if (isNaN(origLen) || origLen > str.length - 2) return str;
    return str.substring(0, origLen);
}

export async function initializeSecureStorage(code: string): Promise<void> {
    const keyIdFull = `${STORAGE_PREFIX}${FIXED_KEY_UUID}`;

    const existingKeys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX) && k !== keyIdFull);
    existingKeys.forEach(k => localStorage.removeItem(k));

    let keyData = localStorage.getItem(keyIdFull);
    let key: CryptoKey;

    if (!keyData) {
        key = await generateKey();
        keyData = await exportKey(key);
        const paddedKeyData = padToLength(keyData, TARGET_LENGTH);
        localStorage.setItem(keyIdFull, paddedKeyData);
    } else {
        const cleanKeyData = keyData.substring(0, 44);
        key = await importKey(cleanKeyData);
    }

    const uuids: string[] = [];
    for (let i = 0; i < TOTAL_ENTRIES - 1; i++) {
        uuids.push(generateUUID());
    }

    const realCodePosition = Math.floor(Math.random() * (TOTAL_ENTRIES - 1));

    const randomBefore = crypto.getRandomValues(new Uint8Array(30));
    const randomAfter = crypto.getRandomValues(new Uint8Array(30));
    const randomBeforeText = btoa(String.fromCharCode(...randomBefore));
    const randomAfterText = btoa(String.fromCharCode(...randomAfter));
    const realCodeData = `CODE:${randomBeforeText}:${code}:${randomAfterText}:CODE`;

    const encryptedRealCode = await encryptData(realCodeData, key);
    const paddedRealCode = padToLength(encryptedRealCode, TARGET_LENGTH);

    for (let i = 0; i < TOTAL_ENTRIES - 1; i++) {
        const uuid = uuids[i];
        const storageKey = `${STORAGE_PREFIX}${uuid}`;

        if (i === realCodePosition) {
            localStorage.setItem(storageKey, paddedRealCode);
        } else {
            const fakeEncrypted = await generateRandomEncrypted(key);
            const paddedFake = padToLength(fakeEncrypted, TARGET_LENGTH);
            localStorage.setItem(storageKey, paddedFake);
        }
    }
}

export async function getSecureCode(): Promise<string | null> {
    const keyIdFull = `${STORAGE_PREFIX}${FIXED_KEY_UUID}`;
    const keyData = localStorage.getItem(keyIdFull);
    if (!keyData) {
        return null;
    }

    const cleanKeyData = keyData.substring(0, 44);
    const key = await importKey(cleanKeyData);

    const storageKeys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX) && k !== keyIdFull);

    for (const storageKey of storageKeys) {
        const encryptedData = localStorage.getItem(storageKey);
        if (!encryptedData) continue;

        try {
            const cleanData = removePadding(encryptedData);
            const decryptedData = await decryptData(cleanData, key);

            if (decryptedData.startsWith('CODE:') && decryptedData.endsWith(':CODE')) {
                const parts = decryptedData.split(':');
                if (parts.length >= 5 && parts[0] === 'CODE' && parts[parts.length - 1] === 'CODE') {
                    const codeIndex = parts.length - 3;
                    return parts[codeIndex];
                }
            }
        } catch {
            continue;
        }
    }

    return null;
}

export async function updateSecureCode(newCode: string): Promise<void> {
    const existingKeys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));
    existingKeys.forEach(k => localStorage.removeItem(k));
    await initializeSecureStorage(newCode);
}

export function isSecureStorageInitialized(): boolean {
    const keyIdFull = `${STORAGE_PREFIX}${FIXED_KEY_UUID}`;
    const storageKeys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX) && k !== keyIdFull);
    return storageKeys.length >= TOTAL_ENTRIES - 1 && localStorage.getItem(keyIdFull) !== null;
}
