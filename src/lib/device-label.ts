/** Tên thiết bị đọc được từ user-agent (Chrome trên Windows, Safari trên iPhone, …) */
export function formatDeviceLabel(userAgent?: string | null, label?: string | null): string {
  if (label?.trim()) return label.trim();
  const ua = userAgent?.trim() ?? "";
  if (!ua) return "Thiết bị không rõ";

  if (/iPhone/i.test(ua)) {
    const ios = ua.match(/OS (\d+[_.\d]+)/i);
    return ios ? `iPhone · iOS ${ios[1].replace(/_/g, ".")}` : "iPhone";
  }
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) {
    const model = ua.match(/Android[^;]*;\s*([^)]+)\)/i);
    return model ? `Android · ${model[1].trim()}` : "Android";
  }
  if (/Windows NT 10/i.test(ua)) return "Windows 10/11";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) {
    if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) return "Mac · Chrome";
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "Mac · Safari";
    return "Mac";
  }
  if (/CrOS/i.test(ua)) return "Chromebook";
  if (/Linux/i.test(ua)) return "Linux";

  const browser =
    (/Edg\//i.test(ua) && "Edge") ||
    (/Chrome\//i.test(ua) && "Chrome") ||
    (/Firefox\//i.test(ua) && "Firefox") ||
    (/Safari\//i.test(ua) && "Safari") ||
    null;
  if (browser) return browser;

  return ua.length > 72 ? `${ua.slice(0, 72)}…` : ua;
}
