import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormSheet, Tick } from "@/components/shared/form-sheet";
import { AppError } from "@/lib/result";
import { dmy, LEAVE_BOXES } from "@/lib/leave-form";
import { requirePageAnyPermission } from "@/server/auth/page-guards";
import { getLeaveForPrint } from "@/server/services/leave";

export const metadata: Metadata = { title: "Leave request" };

const cell = "border border-black px-1 py-0.5";
const head = `${cell} text-center font-bold leading-tight`;

/** English on the left, Arabic on the right, as each row of the form reads. */
function Bi({ en, ar, className = "" }: { en: string; ar: string; className?: string }) {
  return (
    <div className={`flex justify-between gap-2 font-bold ${className}`}>
      <span>{en}</span>
      <span dir="rtl" lang="ar">
        {ar}
      </span>
    </div>
  );
}

/** A labelled line with a dotted rule, value typed on it. */
function DottedLine({ en, ar, value }: { en: string; ar: string; value: string }) {
  return (
    <div className="flex items-end gap-2 py-px">
      <span className="w-28 shrink-0 font-bold">{en}</span>
      <span className="flex-1 border-b border-dotted border-black px-1">{value}</span>
      <span className="w-32 shrink-0 text-right font-bold" dir="rtl" lang="ar">
        {ar}
      </span>
    </div>
  );
}

/** The company's Leave Request form (طلب اجازه), filled from the record. */
export default async function LeavePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePageAnyPermission(["hr.leave.view", "hr.leave.request"]);
  const { id } = await params;
  const leave = await getLeaveForPrint(ctx, id).catch((error: unknown) => {
    if (error instanceof AppError) notFound();
    throw error;
  });
  const { employee, form } = leave;
  const days = Number(leave.days);
  const ticked = (types: readonly string[]) => types.includes(leave.leaveType.key);
  const from = dmy(leave.startDate);
  const to = dmy(leave.endDate);

  return (
    <FormSheet
      backHref="/people/leave"
      backLabel="All leave"
      title={`${leave.extendsLeave ? "Leave extension" : "Leave request"} — ${employee.fullName}`}
      subtitle={`${leave.leaveType.name} · ${from} to ${to}`}
      company={employee.company}
      footer
      className="leave-form text-[9.5px] leading-tight"
    >
      <h2 className="mb-1 text-center text-[13px] font-bold underline">
        Leave Request{" "}
        <span dir="rtl" lang="ar">
          طلب اجازه
        </span>
      </h2>
      {leave.extendsLeave ? (
        <p className="mb-1 text-center text-[11px] font-bold">
          Extension of leave from {dmy(leave.extendsLeave.startDate)} to{" "}
          {dmy(leave.extendsLeave.endDate)}{" "}
          <span dir="rtl" lang="ar">
            تمديد اجازة
          </span>
        </p>
      ) : null}

      {/* Employee no. and date */}
      <table className="w-full table-fixed border-collapse">
        <tbody>
          <tr>
            <td className="w-[16%] px-1 text-center font-bold">Employee No</td>
            <td className={`${cell} w-[16%] text-center`}>{employee.employeeNo}</td>
            <td className="w-[14%] px-1 text-center font-bold" dir="rtl" lang="ar">
              رقم الموظف
            </td>
            <td className="w-[14%] px-1 text-right font-bold">Date</td>
            <td className={`${cell} w-[16%] text-center`}>{dmy(leave.createdAt)}</td>
            <td className="w-[10%] px-1 text-center font-bold" dir="rtl" lang="ar">
              التاريخ
            </td>
          </tr>
        </tbody>
      </table>

      {/* Department / joining / job / name */}
      <table className="mt-1 w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-[18%]" />
          <col className="w-[16%]" />
          <col className="w-[22%]" />
          <col className="w-[44%]" />
        </colgroup>
        <tbody>
          <tr>
            <td className={head}>
              <span lang="ar">القسم</span>
              <br />
              Department
            </td>
            <td className={head}>
              <span lang="ar">تاريخ مباشرة العمل</span>
              <br />
              Joining Date
            </td>
            <td className={head}>
              <span lang="ar">الوظيفة (العمل الذي تقوم به حاليا)</span>
              <br />
              Job Description(Title)
            </td>
            <td className={head}>
              <span lang="ar">اسم الموظف</span>
              <br />
              Employee&apos;s Name
            </td>
          </tr>
          <tr className="h-5 text-center">
            <td className={cell}>{employee.department?.name ?? ""}</td>
            <td className={cell}>{dmy(employee.joiningDate)}</td>
            <td className={cell}>{employee.position?.title ?? ""}</td>
            <td className={cell}>{employee.fullName}</td>
          </tr>
        </tbody>
      </table>

      {/* Leave requested */}
      <Bi en="Leave Requested:" ar="نوع الاجازة المطلوبة:" className="mt-2" />
      <div className="mt-1 grid grid-cols-5 gap-2 border border-black px-2 py-1.5">
        {LEAVE_BOXES.map((b) => (
          <div key={b.key} className="flex items-center justify-center gap-2">
            <Tick on={ticked(b.types)} mark="check" />
            <span className="text-center leading-tight font-bold">
              <span lang="ar">{b.ar}</span>
              <br />
              {b.en}
            </span>
          </div>
        ))}
      </div>

      {/* Country, destination, dates, days */}
      <table className="w-full table-fixed border-collapse">
        <tbody>
          <tr>
            {(
              [
                ["الدولة", "Country"],
                ["جهة السفر", "Destination"],
                ["من تاريخ", "From"],
                ["الى تاريخ", "To"],
                ["عدد ايام الاجازة", "Leave Days"],
              ] as const
            ).map(([ar, en]) => (
              <td key={en} className={head}>
                <span lang="ar">{ar}</span>
                <br />
                {en}
              </td>
            ))}
          </tr>
          <tr className="h-5 text-center">
            <td className={cell}>{form.country}</td>
            <td className={cell}>{form.destination}</td>
            <td className={cell}>{from}</td>
            <td className={cell}>{to}</td>
            <td className={cell}>{days}</td>
          </tr>
        </tbody>
      </table>

      {/* Contact */}
      <div className="mt-2 border border-black px-1 py-0.5">
        <DottedLine en="Home Address:" ar="عنوان الموظف في بلده:" value={form.homeAddress} />
        <DottedLine en="P.O. BOX:" ar="ص ب :" value={form.poBox} />
        <DottedLine en="City / Country:" ar="المدينة و الدولة:" value={form.cityCountry} />
        <DottedLine en="Tel. No. Home:" ar="هاتف المنزل:" value={form.telHome} />
        <DottedLine en="Tel. No. Relative:" ar="هاتف أحد الاقارب:" value={form.telRelative} />
        <DottedLine en="E-mail Address:" ar="البريد الالكتروني:" value={form.email} />
      </div>

      {/* Signature and substitute */}
      <table className="w-full table-fixed border-collapse">
        <tbody>
          <tr>
            <td className={`${cell} h-14 align-top`}>
              <Bi en="Employee Signature" ar="توقيع الموظف" />
            </td>
            <td className={`${cell} align-top`}>
              <Bi en="Substitute Employee:" ar="الموظف البديل:" />
              <Bi
                en={`Name: ${leave.handoverTo?.fullName ?? ""}`}
                ar="الاسم:"
                className="mt-1.5 font-normal"
              />
              <Bi en="Signature:" ar="التوقيع:" className="mt-1.5" />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Department head's approval, filled with the recorded leave */}
      <Bi en="Department Head's Approval:" ar="موافقة مدير الدائرة:" className="mt-1" />
      <div className="border border-black px-1 py-0.5">
        <div className="flex justify-between">
          <span>
            <b>Leave approved for(</b> {days} <b>days)</b>
          </span>
          <span dir="rtl" lang="ar" className="font-bold">
            لا مانع من اعطاء المذكور الاجازة المطلوبة ( <bdi>{days}</bdi> يوما)
          </span>
        </div>
        <div className="mt-1 flex justify-between">
          <span>
            <b>starting from</b> {from} <b>to</b> {to}
          </span>
          <span dir="rtl" lang="ar" className="font-bold">
            تبدا من تاريخ <bdi dir="ltr">{from}</bdi> الى تاريخ <bdi dir="ltr">{to}</bdi>
          </span>
        </div>
      </div>

      <table className="w-full table-fixed border-collapse">
        <tbody>
          <tr>
            <td className={`${cell} h-14 align-top`}>
              <Bi en="General Manager's Signature:" ar="توقيع المدير العام:" />
              <Bi en="Dept. Head's Signature:" ar="توقيع مدير الادارة:" className="mt-5" />
            </td>
            <td className={`${cell} align-top`}>
              <Bi en="Section Head's Approval:" ar="موافقة رئيس الشعبة:" />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Administration & personnel */}
      <Bi
        en="For Administration & Personnel Department Use Only:"
        ar="لاستخدام قسم الشئون الادارية وشئون الموظفين فقط:"
        className="mt-1"
      />
      <table className="w-full table-fixed border-collapse">
        <tbody>
          <tr>
            {(
              [
                ["الاجازة تستحق حسب العقد كل", "Leave due every"],
                ["تاريخ عودة الموظف من أخر اجازة", "Date of arrival from last vacation"],
                ["التذاكر المستحقة للموظف", "Tickets due Self"],
                ["التذاكر المستحقة للزوجة", "Tickets due Wife"],
                ["التذاكر المستحقة للاطفال عدد", "Tickets due Children"],
              ] as const
            ).map(([ar, en]) => (
              <td key={en} className={head}>
                <span lang="ar">{ar}</span>
                <br />
                {en}
              </td>
            ))}
          </tr>
          <tr className="h-5 text-center">
            <td className={cell}>{form.leaveDueEvery}</td>
            <td className={cell}>{form.lastArrival}</td>
            <td className={cell}>{form.ticketsSelf}</td>
            <td className={cell}>{form.ticketsWife}</td>
            <td className={cell}>{form.ticketsChildren}</td>
          </tr>
        </tbody>
      </table>

      <p className="mt-1.5 font-bold underline">PERSONNEL AFFAIRS:</p>
      <div className="grid grid-cols-[1.2fr_repeat(7,1fr)] items-end gap-x-1 text-center leading-tight">
        <div className="text-left font-bold">
          <span lang="ar">شعبة الجوازات</span>
          <br />
          Passport Section
        </div>
        {(
          [
            ["مرة واحدة", "Single", form.visaType === "SINGLE"],
            ["متعددة لمدة 6 شهور", "Multiple 6 months", form.visaType === "MULTIPLE"],
            ["خروج نهائي", "Exit", form.visaType === "EXIT"],
            ["مدة التاشيرة", "Visa Period", null],
            ["على حساب الموظف", "On Employee A/c", form.visaAccount === "EMPLOYEE"],
            ["على حساب الشركة", "On Company A/c", form.visaAccount === "COMPANY"],
            ["أخرى", "Others", form.visaAccount === "OTHER"],
          ] as const
        ).map(([ar, en, on]) => (
          <div key={en} className="font-bold">
            <span lang="ar">{ar}</span>
            <br />
            {en}
            <div className="mx-auto mt-0.5 flex h-5 w-14 items-center justify-center border border-black font-normal">
              {on === null ? form.visaPeriod : on ? "✓" : ""}
            </div>
          </div>
        ))}
        <div className="text-left font-bold">
          Exit Reentry Visa
          <br />
          <span lang="ar">تأشيرة خروج و عودة</span>
        </div>
      </div>

      <div className="mt-1 grid grid-cols-[1.2fr_repeat(5,1fr)_2fr] items-end gap-x-1 text-center leading-tight">
        <div className="text-left font-bold">
          <span lang="ar">شعبة الرواتب</span>
          <br />
          Payroll Section:
        </div>
        {(
          [
            ["مستحقات الاجازة", "Vacation Money due"],
            ["راتب أيام الدوام", "Salary for Present Days"],
            ["قيمة تذاكر السفر", "Tickets Due"],
            ["العمل الاضافي", "Overtime"],
            ["أخرى", "Others"],
          ] as const
        ).map(([ar, en]) => (
          <div key={en} className="font-bold">
            <span lang="ar">{ar}</span>
            <br />
            {en}
            <div className="mx-auto mt-0.5 h-5 w-14 border border-black" />
          </div>
        ))}
        <div className="border-b border-dotted border-black" />
      </div>

      <Bi en="Special Remarks:" ar="ملاحظات خاصة:" className="mt-2 underline" />
      <p className="min-h-[1.2rem] border-b border-dotted border-black px-1 whitespace-pre-wrap">
        {form.specialRemarks}
      </p>
      <p className="h-4 border-b border-dotted border-black" />

      <div className="mt-3 font-bold">
        <p dir="rtl" lang="ar" className="w-fit">
          مدير الشئون الادارية وشئون الموظفين
        </p>
        <p>Administration &amp; Personnel Manager</p>
      </div>
    </FormSheet>
  );
}
