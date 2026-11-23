import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormSheet } from "@/components/shared/form-sheet";
import { AppError } from "@/lib/result";
import { MAINTENANCE_SERVICES } from "@/lib/vehicle-maintenance";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getMaintenanceForPrint } from "@/server/services/fleet";

export const metadata: Metadata = { title: "Vehicle maintenance request" };

const longDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
/** "17-Nov-2026", as the form prints the service date. */
const shortDate = (d: Date) => {
  const [day, mon, year] = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(d)
    .split(" ");
  return `${day ?? ""}-${mon ?? ""}-${year ?? ""}`;
};

const cell = "border border-black px-1.5 py-[3px]";
const box = (on: boolean) => (on ? "☑" : "☐");

/** Vehicle Maintenance Request, English and Arabic, as on the company's form. */
export default async function MaintenancePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requirePagePermission("vehicles.maintenance.view");
  const { id } = await params;
  const m = await getMaintenanceForPrint(ctx, id).catch((error: unknown) => {
    if (error instanceof AppError) notFound();
    throw error;
  });
  const { vehicle, driver } = m;
  const requested = new Set(m.services);

  const details: [string, string, string][] = [
    ["Driver Name:", "اسم السائق :", driver?.fullName ?? ""],
    ["Driver Iqama:", "اقامة السائق :", driver?.iqama?.iqamaNumber ?? ""],
    ["Mobile Number:", "رقم الجوال :", driver?.mobile ?? ""],
    ["Vehicle Brand:", "نوع السيارة :", vehicle.make],
    ["Vehicle Model:", "موديل السيارة :", vehicle.model],
    ["Vehicle Year:", "سنة السيارة :", String(vehicle.year)],
    ["Plate Number:", "رقم اللوحة :", vehicle.plateNumber],
    [
      "Previous Milage Reading (KM):",
      "العداد السابقة (كم) :",
      m.previousMileage !== null ? String(m.previousMileage) : "",
    ],
    [
      "Current Mileage Reading (KM):",
      "العداد الحالي (كم) :",
      m.mileage !== null ? String(m.mileage) : "",
    ],
    ["Service Date:", "تاريخ الدخول للصيانة :", shortDate(m.date)],
  ];
  const notes: [string, string, string][] = [
    ["Additional Details :", "تفاصيل إضافية:", m.additionalDetails ?? ""],
    ["Driver Notes :", "ملاحظات السائق:", m.driverNotes ?? ""],
    ["Required Parts :", "القطع المطلوبة:", m.requiredParts ?? ""],
  ];

  return (
    <FormSheet
      backHref={`/vehicles/${vehicle.id}`}
      backLabel="Back to vehicle"
      title={`Maintenance request ${m.requestNo ?? ""} — ${vehicle.plateNumber}`}
      company={vehicle.company}
      letterhead={false}
      className="font-serif text-[12px] leading-tight"
    >
      <h2 className="bg-neutral-300 py-1 text-center text-[17px] font-bold">
        VEHICLE MAINTENANCE REQUEST
      </h2>
      <div className="flex justify-between py-1 text-[13px] font-bold">
        <span>Date: {longDate(m.date)}</span>
        <span>Req. #: {m.requestNo ?? ""}</span>
      </div>

      <table className="w-full table-fixed border-collapse border-2 border-black">
        <colgroup>
          <col className="w-[27%]" />
          <col className="w-[23%]" />
          <col className="w-[23%]" />
          <col className="w-[27%]" />
        </colgroup>
        <tbody>
          {details.map(([en, ar, v]) => (
            <tr key={en}>
              <td className={`${cell} font-bold`}>{en}</td>
              <td className={`${cell} text-center text-[11px]`}>{v}</td>
              <td className={cell} />
              <td className={`${cell} text-right font-bold`} dir="rtl" lang="ar">
                {ar}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="mt-0.5 w-full table-fixed border-collapse border-2 border-black">
        <colgroup>
          <col className="w-[27%]" />
          <col className="w-[7%]" />
          <col className="w-[7%]" />
          <col className="w-[18%]" />
          <col className="w-[7%]" />
          <col className="w-[7%]" />
          <col className="w-[27%]" />
        </colgroup>
        <thead>
          <tr>
            <th colSpan={7} className="border-b border-black py-0.5 text-[15px] font-bold">
              Required Service
            </th>
          </tr>
          <tr className="font-normal">
            <td className={cell}>Service Name</td>
            <td className={`${cell} text-center`}>Yes</td>
            <td className={`${cell} text-center`}>No</td>
            <td className="border-x border-black" />
            <td className={`${cell} text-center`} lang="ar">
              لا
            </td>
            <td className={`${cell} text-center`} lang="ar">
              نعم
            </td>
            <td className={`${cell} text-right`} dir="rtl" lang="ar">
              اسم الخدمة
            </td>
          </tr>
        </thead>
        <tbody>
          {MAINTENANCE_SERVICES.map((s) => {
            const yes = requested.has(s.key);
            const label =
              s.key === "other" && yes && m.otherService ? `Other: ${m.otherService}` : s.en;
            return (
              <tr key={s.key}>
                <td className={cell}>{label}</td>
                <td className={`${cell} text-center`}>{box(yes)}</td>
                <td className={`${cell} text-center`}>{box(!yes)}</td>
                <td className="border-x border-black" />
                <td className={`${cell} text-center`}>{box(!yes)}</td>
                <td className={`${cell} text-center`}>{box(yes)}</td>
                <td className={`${cell} text-right`} dir="rtl" lang="ar">
                  {s.ar}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <table className="mt-0.5 w-full table-fixed border-collapse border-2 border-black">
        <colgroup>
          <col className="w-[27%]" />
          <col className="w-[46%]" />
          <col className="w-[27%]" />
        </colgroup>
        <tbody>
          {notes.map(([en, ar, v]) => (
            <tr key={en} className="h-9">
              <td className={`${cell} font-sans font-bold`}>{en}</td>
              <td className={`${cell} text-[11px] whitespace-pre-wrap`}>{v}</td>
              <td className={`${cell} text-right font-bold`} dir="rtl" lang="ar">
                {ar}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 border-t-[3px] border-double border-black">
        <table className="w-full table-fixed border-collapse">
          <tbody>
            <tr className="h-24">
              <td className="border-x-2 border-b-2 border-black px-1 align-bottom">
                <p>Prepared By: {m.preparedBy}</p>
                <p className="font-bold">Date:</p>
              </td>
              <td className="border-r-2 border-b-2 border-black px-1 align-bottom">
                <p>Driver:</p>
                <p className="font-bold">Date:</p>
              </td>
              <td className="border-r-2 border-b-2 border-black px-1 pb-4 text-center align-bottom">
                Production Manager/Technical Manager
              </td>
            </tr>
            <tr className="h-24">
              <td className="border-x-2 border-b-2 border-black px-1 text-center align-bottom">
                Procurement Supervisor
              </td>
              <td className="border-r-2 border-b-2 border-black px-1 text-center align-bottom">
                General Manager
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </FormSheet>
  );
}
