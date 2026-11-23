import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormSheet } from "@/components/shared/form-sheet";
import { AppError } from "@/lib/result";
import { CLEARANCE_SECTIONS } from "@/lib/recruitment-forms";
import { toHijri } from "@/lib/templates";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getClearanceForPrint } from "@/server/services/recruitment";

export const metadata: Metadata = { title: "Clearance form" };

const dmy = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}/ ${String(d.getUTCMonth() + 1).padStart(2, "0")} /${String(d.getUTCFullYear())}`;
const longDate = (d: Date | null) =>
  d
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(d)
    : "";

const td = "border border-black px-1.5 py-[3px] align-middle";

/** Employee Clearance Form, English and Arabic side by side. */
export default async function ClearancePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission("hr.view");
  const { id } = await params;
  const form = await getClearanceForPrint(ctx, id).catch((error: unknown) => {
    if (error instanceof AppError) notFound();
    throw error;
  });
  const { employee, details } = form;
  const line = (key: string) => details.lines[key] ?? { value: "", name: "" };

  const names: [string, string, string | null][] = [
    ["Family Name", "إسم العائلة", employee.familyName],
    ["Last Name", "إسم الجد", employee.lastName],
    ["Middle Name", "إسم الأب", employee.middleName],
    ["First Name", "الاسم الأول", employee.firstName],
  ];
  const ids: [string, string, string][] = [
    ["End Date", "تاريخ الإنتهاء", longDate(form.endDate)],
    ["Join Date", "تاريخ التعيين", longDate(employee.joiningDate)],
    ["Employee ID#", "الرقم الوظيفي", employee.employeeNo],
    ["ID / Iqama #:", "رقم الإقامه", employee.iqama?.iqamaNumber ?? ""],
  ];
  const work: [string, string, string][] = [
    ["Company Name", "اسم الشركة", details.companyName],
    ["Company Location", "موقع الشركة", details.location],
    ["Department / Division", "الدائره /القسم", details.department],
    ["Position", "الوظيفة", details.position],
    ["Department Manager", "مدير القسم", details.departmentManager],
  ];

  return (
    <FormSheet
      backHref="/hr/clearance"
      backLabel="All clearance forms"
      title={`Clearance form — ${employee.fullName}`}
      company={employee.company}
      className="clearance-form font-serif text-[11.5px] leading-tight"
    >
      <div className="mt-1 flex items-end justify-between gap-2">
        <span>Date: {dmy(form.formDate)}</span>
        <span className="text-[14px] font-bold">
          EMPLOYEE CLEARANCE FORM{" "}
          <span dir="rtl" lang="ar">
            نموذج إخلاء طرف
          </span>
        </span>
        <span dir="rtl" lang="ar">
          التاريخ: <bdi dir="ltr">{toHijri(form.formDate)}</bdi>
        </span>
      </div>

      {/* Employee information */}
      <table className="mt-1 w-full table-fixed border-collapse">
        <tbody>
          <tr>
            <td className={td} colSpan={2}>
              EMPLOYEE INFORMATION
            </td>
            <td className={`${td} text-right`} colSpan={2} dir="rtl" lang="ar">
              معلومات الموظف
            </td>
          </tr>
          <tr>
            {names.map(([en, ar]) => (
              <BiLabel key={en} en={en} ar={ar} />
            ))}
          </tr>
          <tr>
            {names.map(([en, , v]) => (
              <td key={en} className={td}>
                {v}
              </td>
            ))}
          </tr>
          <tr>
            {ids.map(([en, ar]) => (
              <BiLabel key={en} en={en} ar={ar} />
            ))}
          </tr>
          <tr>
            {ids.map(([en, , v]) => (
              <td key={en} className={td}>
                {v}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {/* Location and work */}
      <SectionTitle en="LOCATION AND WORK" ar="موقع وطبيعة العمل:" />
      <table className="w-full table-fixed border-collapse border-2 border-black">
        <tbody>
          {work.map(([en, ar, v]) => (
            <tr key={en}>
              <td className={`${td} font-bold`}>
                {en} : {v}
              </td>
              <td className={`${td} text-right font-bold`} dir="rtl" lang="ar">
                {ar} :
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {CLEARANCE_SECTIONS.map((s) => (
        <div key={s.key}>
          {s.key === "it" ? (
            <>
              <SectionTitle en={s.en} ar={s.ar} />
              <table className="w-full table-fixed border-collapse border-2 border-black">
                <tbody>
                  {s.lines.map((l) => (
                    <tr key={l.key}>
                      <td className={`${td} font-bold`}>
                        {l.en} : {line(l.key).value}
                      </td>
                      <td className={`${td} text-right font-bold`} dir="rtl" lang="ar">
                        {l.ar} :
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <table className="mt-3 w-full table-fixed border-collapse">
              <thead>
                <tr className="font-bold">
                  <th className="w-[28%] px-1.5 py-1 text-left">{s.en}</th>
                  <th className="px-1.5 py-1" dir="rtl" lang="ar">
                    التوقيع
                  </th>
                  <th className="px-1.5 py-1" dir="rtl" lang="ar">
                    الاسم
                  </th>
                  <th className="w-[28%] px-1.5 py-1 text-right" dir="rtl" lang="ar">
                    {s.ar}
                  </th>
                </tr>
              </thead>
              <tbody className="border-2 border-black">
                {s.lines.map((l) => (
                  <tr key={l.key}>
                    <td className={`${td} font-bold`}>{l.en}</td>
                    <td className={`${td} font-bold`}>{line(l.key).value}</td>
                    <td className={`${td} font-bold`}>{line(l.key).name}</td>
                    <td className={`${td} text-right font-bold`} dir="rtl" lang="ar">
                      {l.ar}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <SignatureBox
            en={s.signerEn}
            ar={s.signerAr}
            name={details.signers[s.key] ?? ""}
            bold={s.key === "it"}
          />
        </div>
      ))}
    </FormSheet>
  );
}

function BiLabel({ en, ar }: { en: string; ar: string }) {
  return (
    <td className={td}>
      <div className="flex justify-between gap-1">
        <span>{en}</span>
        <span dir="rtl" lang="ar">
          {ar}
        </span>
      </div>
    </td>
  );
}

function SectionTitle({ en, ar }: { en: string; ar: string }) {
  return (
    <div className="mt-3 flex justify-between font-bold">
      <span className="underline">{en}</span>
      <span dir="rtl" lang="ar">
        {ar}
      </span>
    </div>
  );
}

/** "Date: التاريخ: | Signature: التوقيع: | IT Manager: مدير تقنية المعلومات:" */
function SignatureBox({
  en,
  ar,
  name,
  bold,
}: {
  en: string;
  ar: string;
  name: string;
  bold: boolean;
}) {
  const cell = `${td} h-10 align-bottom ${bold ? "font-bold" : ""}`;
  return (
    <table className="mt-3 w-full table-fixed border-collapse border-[3px] border-double border-black">
      <tbody>
        <tr>
          <td className={cell}>
            <div className="flex justify-between">
              <span>Date:</span>
              <span dir="rtl" lang="ar">
                التاريخ:
              </span>
            </div>
          </td>
          <td className={cell}>
            <div className="flex justify-between">
              <span>Signature:</span>
              <span dir="rtl" lang="ar">
                التوقيع:
              </span>
            </div>
          </td>
          <td className={`${cell} w-[44%]`}>
            <div className="flex items-end justify-between gap-2">
              <span>
                {name ? <span className="block font-normal">{name}</span> : null}
                {en}:
              </span>
              <span dir="rtl" lang="ar">
                {ar}:
              </span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
