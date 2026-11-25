import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppError } from "@/lib/result";
import {
  annexures,
  contractBody,
  SALARY_TEXT,
  salutation,
  signaturePage,
  type ContractBlock,
  type ContractValues,
} from "@/lib/employment-contract";
import { listItems } from "@/lib/job-description";
import { contractParticularsSchema } from "@/lib/schemas/hr";
import { requirePagePermission } from "@/server/auth/page-guards";
import { allowanceValue, getContractForPrint } from "@/server/services/contracts";
import { ContractPageNumbers } from "./page-numbers";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Employment contract" };

const money = (v: string | null) =>
  v === null || v === "" ? "" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });

/** The printed employment contract (ADR-004 print path). */
export default async function ContractPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission("hr.contracts.view");
  // The contract states the salary.
  if (!ctx.permissions.has("employees.salary.view")) redirect("/hr/contracts");
  const { id } = await params;
  const c = await getContractForPrint(ctx, id).catch((error: unknown) => {
    if (error instanceof AppError) notFound();
    throw error;
  });

  const p =
    contractParticularsSchema.safeParse(c.particulars ?? {}).data ??
    contractParticularsSchema.parse({});
  const co = c.company;
  const parts = {
    basic: c.basicSalary?.toString() ?? "",
    transport: allowanceValue(c.allowances, "transport") ?? "",
    housing: allowanceValue(c.allowances, "housing") ?? "",
    phone: allowanceValue(c.allowances, "other") ?? "",
    food: allowanceValue(c.allowances, "food") ?? "",
    other: allowanceValue(c.allowances, "additional") ?? "",
  };
  const total = Object.values(parts).reduce(
    (sum, v) => sum + (v ? Math.round(Number(v) * 100) : 0),
    0,
  );
  const position = c.positionTitle ?? c.employee.position?.title ?? "";
  const jdItems = c.jobDescription
    ? listItems(c.jobDescription.departmental).length
      ? listItems(c.jobDescription.departmental)
      : listItems(c.jobDescription.organizational)
    : [];

  const v: ContractValues = {
    date: c.contractDateLabel,
    cityEn: co.city ?? "",
    cityAr: co.cityAr ?? "",
    company: {
      nameEn: co.name,
      nameAr: co.nameAr ?? co.name,
      crNumber: co.crNumber ?? "",
      headOfficeCityEn: co.headOfficeCity ?? co.city ?? "",
      headOfficeCityAr: co.headOfficeCityAr ?? co.cityAr ?? "",
      addressEn: co.addressLine ?? "",
      addressAr: co.addressAr ?? "",
      signatoryEn: co.signatoryName ?? "",
      signatoryAr: co.signatoryNameAr ?? "",
      signatoryTitleEn: co.signatoryTitle ?? "",
      signatoryTitleAr: co.signatoryTitleAr ?? "",
    },
    employee: {
      female: c.employee.gender === "FEMALE",
      nameEn: p.nameEn || c.employee.fullName.toUpperCase(),
      nameAr: p.nameAr,
      nationalityEn: p.nationalityEn,
      nationalityAr: p.nationalityAr,
      iqamaNo: p.iqamaNo,
      passportNo: p.passportNo,
      dateOfBirth: p.dateOfBirth,
      homeAddressEn: p.homeAddressEn,
      homeAddressAr: p.homeAddressAr,
      saudiAddressEn: p.saudiAddressEn,
      saudiAddressAr: p.saudiAddressAr,
      homePhone: p.homePhone,
    },
    position,
    salary: {
      basic: money(parts.basic),
      transport: money(parts.transport),
      housing: money(parts.housing),
      phone: money(parts.phone),
      food: money(parts.food),
      other: money(parts.other),
      total: money((total / 100).toFixed(2)),
    },
    termYears: c.termYears,
    workDaysPerWeek: c.workDaysPerWeek,
    hoursPerDay: c.hoursPerDay,
    tickets: {
      destinationEn: p.ticketDestinationEn,
      destinationAr: p.ticketDestinationAr,
      wife: p.ticketWife,
      children: p.ticketChildren,
    },
    annex7: { title: `${c.jobDescription?.title ?? position} Job Description:`, items: jdItems },
  };

  // What the printout would show as a gap — listed on screen so it can be
  // filled before printing.
  const missing = [
    !co.nameAr && "company Arabic name",
    !co.crNumber && "company CR number",
    !co.addressLine && "company address",
    !co.addressAr && "company Arabic address",
    !co.cityAr && "company city (Arabic)",
    !co.signatoryName && "signatory",
    !co.signatoryNameAr && "signatory (Arabic)",
    !co.signatoryTitle && "signatory title",
    !p.nameAr && "employee Arabic name",
    !p.nationalityEn && "nationality",
    !p.nationalityAr && "nationality (Arabic)",
    !p.passportNo && "passport number",
    !p.homeAddressEn && "home address",
    !p.homeAddressAr && "home address (Arabic)",
    !p.saudiAddressEn && "Saudi address",
    !p.saudiAddressAr && "Saudi address (Arabic)",
    !p.ticketDestinationEn && "ticket destination",
    !p.ticketDestinationAr && "ticket destination (Arabic)",
  ].filter(Boolean);

  const body = contractBody(v);
  const [preamble, appointment, ...articles] = body;
  const sig = signaturePage(v);
  const s = salutation(v.employee);

  return (
    <div className="letter-sheet--form mx-auto w-full max-w-5xl space-y-4 p-6 print:space-y-0 print:p-0">
      <ContractPageNumbers />
      <div className="print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/people/employees/${c.employee.id}`}>
              <ArrowLeft />
              {c.employee.fullName}
            </Link>
          </Button>
          <PrintButton />
        </div>
        {missing.length > 0 ? (
          <p className="text-status-warning mt-3 text-xs">
            Not filled in yet, so blank on the printout: {missing.join(", ")}. Company details are
            in Settings → Companies; employee details on the contract (Edit).
          </p>
        ) : null}
      </div>

      <article className="letter-sheet contract-sheet rounded-lg border bg-white p-8 text-black print:rounded-none print:border-0 print:p-0">
        <table className="letter-frame">
          <thead className="letter-head-group">
            <tr>
              <td>
                <div className="letter-head">
                  {co.headerImageFileId !== null ? (
                    // Session-gated route; next/image cannot fetch it.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/companies/${co.id}/branding/header`}
                      alt={`${co.name} letterhead`}
                      className="w-full object-contain"
                    />
                  ) : (
                    <p className="text-center text-lg font-semibold">{co.name}</p>
                  )}
                </div>
              </td>
            </tr>
          </thead>
          <tfoot className="letter-foot-group">
            <tr>
              <td>
                <div className="letter-foot">
                  {co.footerImageFileId !== null ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/companies/${co.id}/branding/footer`}
                      alt=""
                      className="w-full object-contain"
                    />
                  ) : null}
                </div>
              </td>
            </tr>
          </tfoot>
          <tbody>
            <tr>
              <td>
                <table className="contract-cols">
                  <tbody>
                    <tr>
                      <td className="text-center text-[14px] underline">EMPLOYMENT CONTRACT</td>
                      <td dir="rtl" lang="ar" className="text-center text-[14px] underline">
                        عقـد عمـل
                      </td>
                    </tr>
                    {preamble ? <Row block={preamble} /> : null}
                    {appointment ? <Row block={appointment} /> : null}
                    <tr>
                      <td>
                        <p>
                          <strong>
                            {SALARY_TEXT.en.label} {SALARY_TEXT.en.intro}
                          </strong>
                        </p>
                        <SalaryTable
                          rows={salaryRows(SALARY_TEXT.en.rows, v.salary, parts)}
                          unit={SALARY_TEXT.en.unit}
                        />
                      </td>
                      <td dir="rtl" lang="ar">
                        <p>
                          <strong>
                            {SALARY_TEXT.ar.label} {SALARY_TEXT.ar.intro}
                          </strong>
                        </p>
                        <SalaryTable
                          rows={salaryRows(SALARY_TEXT.ar.rows, v.salary, parts)}
                          unit={SALARY_TEXT.ar.unit}
                        />
                      </td>
                    </tr>
                    {articles.map((b, i) => (
                      <Row key={i} block={b} />
                    ))}
                  </tbody>
                </table>

                {/* Signature page */}
                <table className="contract-cols contract-page">
                  <tbody>
                    <tr>
                      <td>
                        <p>{sig.firstParty.en[0]}</p>
                        <p className="font-bold">{sig.firstParty.en[1]}</p>
                        <p className="mt-10 font-bold">{sig.firstParty.en[2]}</p>
                      </td>
                      <td dir="rtl" lang="ar">
                        <p>{sig.firstParty.ar[0]}</p>
                        <p className="font-bold">{sig.firstParty.ar[1]}</p>
                        <p className="mt-10 font-bold">{sig.firstParty.ar[2]}</p>
                      </td>
                    </tr>
                    <tr>
                      <td className="pt-10">
                        <p>{sig.secondParty.en[0]}</p>
                        <p className="mt-3 font-bold">{sig.secondParty.en[1]}</p>
                        <p className="mt-4 font-bold">Date: {v.date}</p>
                        <p className="mt-3 font-bold">Name: {v.employee.nameEn}</p>
                        <p className="mt-16 font-bold">Signature:</p>
                      </td>
                      <td dir="rtl" lang="ar" className="pt-10">
                        <p>{sig.secondParty.ar[0]}</p>
                        <p className="mt-3 font-bold">{sig.secondParty.ar[1]}</p>
                        <p className="mt-4 font-bold">
                          التاريخ: <bdi dir="ltr">{v.date}</bdi>
                        </p>
                        <p className="mt-3 font-bold">الإسم: {v.employee.nameAr}</p>
                        <p className="mt-16 font-bold">التوقيع:</p>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Annexures, one per page */}
                {annexures(v).map((a) => (
                  <section key={a.number} className="contract-page">
                    {a.ar ? (
                      <table className="contract-cols">
                        <tbody>
                          <tr>
                            <td>
                              <AnnexHead title={a.en.title} subtitle={a.en.subtitle} />
                              <AnnexLines lines={a.en.lines} bold />
                              <SignBlock
                                lines={[
                                  "Second Party",
                                  `Name: ${s.en} ${v.employee.nameEn}`,
                                  "Signature: …………………",
                                  `Date: ${v.date}`,
                                ]}
                              />
                            </td>
                            <td dir="rtl" lang="ar">
                              <AnnexHead title={a.ar.title} subtitle={a.ar.subtitle} />
                              <AnnexLines lines={a.ar.lines} />
                              <SignBlock
                                lines={[
                                  "الطرف الثاني",
                                  `الإسم : ${v.employee.nameAr}`,
                                  "التوقيع:",
                                  `التاريخ: ${v.date}`,
                                ]}
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-[13px]">
                        <p className="text-center underline">{a.en.title}</p>
                        <p className="mt-6 underline">{a.en.subtitle}</p>
                        {a.en.listTitle ? (
                          <p className="mt-4 ml-8 text-[15px] font-bold">{a.en.listTitle}</p>
                        ) : null}
                        <ol
                          className={`mt-2 list-decimal space-y-0.5 pl-14 ${a.en.listTitle ? "" : "mt-6 space-y-4"}`}
                        >
                          {(a.en.list ?? []).map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ol>
                        <div className="mt-6">
                          <p>Second Party</p>
                          <p>
                            Name: <strong>{`${s.en} ${v.employee.nameEn}`}</strong>
                          </p>
                          <p className="mt-12">Signature:</p>
                          <p>
                            Date: <strong>{v.date}</strong>
                          </p>
                        </div>
                      </div>
                    )}
                  </section>
                ))}
              </td>
            </tr>
          </tbody>
        </table>
      </article>
    </div>
  );
}

/** One article: the label in regular weight, the text bold, as on the original. */
function Row({ block }: { block: ContractBlock }) {
  return (
    <tr>
      <td>
        <Side label={block.en.label} lines={block.en.lines} />
      </td>
      <td dir="rtl" lang="ar">
        <Side label={block.ar.label} lines={block.ar.lines} />
      </td>
    </tr>
  );
}

function Side({ label, lines }: { label?: string | undefined; lines: string[] }) {
  return (
    <>
      {lines.map((line, i) =>
        line === "" ? (
          <br key={i} />
        ) : (
          <p key={i}>
            {i === 0 && label ? <span className="font-normal">{label} </span> : null}
            <strong>{line}</strong>
          </p>
        ),
      )}
    </>
  );
}

/** Article 2's lines; food and other allowances only when the contract has them. */
function salaryRows(
  rows: readonly (readonly [string, keyof ContractValues["salary"]])[],
  salary: ContractValues["salary"],
  parts: Record<string, string>,
): (readonly [string, string])[] {
  return rows
    .filter(([, key]) => !OPTIONAL_SALARY_LINES.has(key) || Number(parts[key] || 0) !== 0)
    .map(([label, key]) => [label, salary[key]] as const);
}
const OPTIONAL_SALARY_LINES = new Set<string>(["food", "other"]);

function SalaryTable({ rows, unit }: { rows: (readonly [string, string])[]; unit: string }) {
  return (
    <table className="contract-salary mt-1">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <td className="pe-3">{label}</td>
            <td className="text-center whitespace-nowrap">
              ( <bdi dir="ltr">{value}</bdi> ) {unit}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AnnexHead({ title, subtitle }: { title: string; subtitle?: string | undefined }) {
  return (
    <>
      <p className="underline">{title}</p>
      {subtitle ? <p className="mt-5 text-center underline">{subtitle}</p> : null}
      <br />
    </>
  );
}

function AnnexLines({ lines, bold = false }: { lines: string[]; bold?: boolean }): ReactNode {
  return lines.map((line, i) =>
    line === "" ? (
      <br key={i} />
    ) : (
      <p key={i} className={`mt-1 ${bold ? "font-bold" : ""}`}>
        {line}
      </p>
    ),
  );
}

function SignBlock({ lines }: { lines: string[] }) {
  return (
    <div className="mt-12 font-bold">
      {lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
    </div>
  );
}
