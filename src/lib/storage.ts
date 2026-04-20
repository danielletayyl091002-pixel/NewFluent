export function getStoredData<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const item = localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : null;
  } catch {
    return null;
  }
}

export function setStoredData<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    console.error(`Failed to save data for key: ${key}`);
  }
}

export function removeStoredData(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}
