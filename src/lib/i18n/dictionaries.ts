export const LANGS = ["th", "en"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "th";

const th = {
  appName: "ระบบหลังบ้าน Expert Electronic",
  login: "เข้าสู่ระบบ",
  email: "ชื่อผู้ใช้",
  password: "รหัสผ่าน",
  logout: "ออกจากระบบ",
  invalidCredentials: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
  dashboard: "แดชบอร์ด",
  products: "สินค้า",
  movements: "รับ/จ่ายสินค้า",
  projects: "โครงการ",
  users: "ผู้ใช้งาน",
  welcome: "ยินดีต้อนรับ",
  role: "สิทธิ์",
  roles: { admin: "ผู้ดูแลระบบ", manager: "ผู้จัดการ", staff: "พนักงาน" },
  comingSoon: "เร็วๆ นี้",
};

export type Dictionary = typeof th;

const en: Dictionary = {
  appName: "Expert Electronic Back Office",
  login: "Sign in",
  email: "Username",
  password: "Password",
  logout: "Sign out",
  invalidCredentials: "Invalid username or password",
  dashboard: "Dashboard",
  products: "Products",
  movements: "Stock in/out",
  projects: "Projects",
  users: "Users",
  welcome: "Welcome",
  role: "Role",
  roles: { admin: "Admin", manager: "Manager", staff: "Staff" },
  comingSoon: "Coming soon",
};

export const dictionaries: Record<Lang, Dictionary> = { th, en };
