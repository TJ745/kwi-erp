/**
 * The Vehicle Maintenance Request, after the company's form: the services
 * that can be asked for, in English and Arabic, and the request number.
 */

export const MAINTENANCE_SERVICES = [
  { key: "engineOil", en: "Engine Oil Change", ar: "تغيير زيت المحرك" },
  { key: "oilFilter", en: "Oil Filter Replacement", ar: "تغيير فلتر الزيت" },
  { key: "airFilter", en: "Air Filter Replacement", ar: "تغيير فلتر الهواء" },
  { key: "acFilter", en: "AC Filter Replacement", ar: "تغيير فلتر المكيف" },
  { key: "battery", en: "Battery Replacement", ar: "تغيير البطارية" },
  { key: "brakes", en: "Brake Repair", ar: "إصلاح الفرامل" },
  { key: "acRepair", en: "AC Repair", ar: "إصلاح المكيف" },
  { key: "radiator", en: "Radiator & Coolant Repair", ar: "إصلاح الرديتر والمياه" },
  { key: "sparkPlugs", en: "Spark Plug Replacement", ar: "تغيير البواجي" },
  { key: "belts", en: "Belt Replacement", ar: "تغيير السيور" },
  { key: "tyres", en: "Tire Balancing & Replacement", ar: "تغيير و التوازن كفرات" },
  { key: "computer", en: "Computer Diagnosis / Programming", ar: "برمجة / فحص كمبيوتر" },
  { key: "other", en: "Other", ar: "أخرى" },
] as const;

export type MaintenanceServiceKey = (typeof MAINTENANCE_SERVICES)[number]["key"];

export const MAINTENANCE_SERVICE_KEYS = MAINTENANCE_SERVICES.map((s) => s.key) as [
  MaintenanceServiceKey,
  ...MaintenanceServiceKey[],
];

/** "KWI/VM/039": per company, three digits. */
export function formatMaintenanceRequestNo(companyCode: string, n: number): string {
  return `${companyCode}/VM/${String(n).padStart(3, "0")}`;
}

/** The record's one-line summary when no description was typed. */
export function servicesSummary(keys: readonly string[], other?: string | null): string {
  const names: string[] = MAINTENANCE_SERVICES.filter(
    (s) => keys.includes(s.key) && s.key !== "other",
  ).map((s) => s.en);
  if (keys.includes("other")) names.push(other ? `Other: ${other}` : "Other");
  return names.join(", ");
}

/**
 * How a handover letter names the vehicle — "the company bus" — taken from
 * the model when it is a kind of vehicle, otherwise just "vehicle".
 */
export function vehicleKind(model: string): string {
  const m = model.trim().toLowerCase();
  for (const kind of ["bus", "pickup", "van", "truck", "car", "minibus", "coaster", "trailer"]) {
    if (m === kind || m.endsWith(` ${kind}`)) return kind;
  }
  return "vehicle";
}
