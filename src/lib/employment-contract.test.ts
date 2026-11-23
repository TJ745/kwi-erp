import { describe, expect, it } from "vitest";
import { annexures, contractBody, signaturePage, type ContractValues } from "./employment-contract";
import { contractParticularsSchema } from "./schemas/hr";

// The values of the company's sample contract (02/02/2026).
const sample: ContractValues = {
  date: "02/02/2026",
  cityEn: "Riyadh",
  cityAr: "الرياض",
  company: {
    nameEn: "Al Kuhaimi Wood Industries",
    nameAr: "شركة الكحيمي للصناعات الخشبيه",
    crNumber: "1010478612",
    headOfficeCityEn: "Dammam",
    headOfficeCityAr: "الدمام",
    addressEn: "P.O Box 17544|Riyadh, 11494, Saudi Arabia",
    addressAr: "ص.ب 17544   الرياض  11494 ، المملكـة العربيـة السعوديـة",
    signatoryEn: "Mr. Mohammad Al Kuhaimi",
    signatoryAr: "السيد/ محمد أحمد الكحيمي",
    signatoryTitleEn: "President",
    signatoryTitleAr: "الرئيس",
  },
  employee: {
    female: false,
    nameEn: "HAITHAM FATHI JAMEEL MULHIM",
    nameAr: "هيثم فتحي جميل ملحم",
    nationalityEn: "Jordanian",
    nationalityAr: "الاردن",
    iqamaNo: "2024513646",
    passportNo: "S0392184",
    dateOfBirth: "29/09/1967",
    homeAddressEn: "Building 47, Mihyar Street, Shifa badran, Amman, Jordan",
    homeAddressAr: "عمارة 47, شارع مهيار, شفا بدران, عمان, الاردن",
    saudiAddressEn: "7908 Ibn Al Ramli Street, Malaz District, Riyadh, KSA",
    saudiAddressAr: "7908 شارع ابن الرملي, حي الملز, الرياض",
    homePhone: "+962 7 9679 6433",
  },
  position: "Sales Manager",
  salary: { basic: "14,667", transport: "1,466", housing: "3,667", phone: "200", total: "20,000" },
  termYears: 1,
  workDaysPerWeek: 5,
  hoursPerDay: 8,
  tickets: { destinationEn: "Amman", destinationAr: "عمان", wife: true, children: 2 },
  annex7: {
    title: "Sales Job Description:",
    items: ["Responsible to achieve monthly & annual sales target."],
  },
};

const article = (v: ContractValues, n: number) => {
  const block = contractBody(v).find((b) => b.en.label?.startsWith(`${String(n)}/`));
  return {
    en: [block?.en.label ?? "", ...(block?.en.lines ?? [])].join(" "),
    ar: [block?.ar.label ?? "", ...(block?.ar.lines ?? [])].join(" "),
  };
};

describe("employment contract", () => {
  it("has the preamble and articles 1–39 (article 2 is laid out by the page)", () => {
    const labels = contractBody(sample)
      .map((b) => b.en.label)
      .filter(Boolean)
      .map((l) => Number(l!.split("/")[0]));
    const expected = Array.from({ length: 39 }, (_, i) => i + 1).filter((n) => n !== 2);
    expect(labels).toEqual(expected);
  });

  it("never prints a missing value as 'undefined' or 'null'", () => {
    const all = JSON.stringify([contractBody(sample), annexures(sample), signaturePage(sample)]);
    expect(all).not.toMatch(/undefined|null|\[object/);
  });

  it("fills the preamble like the sample", () => {
    const [pre] = contractBody(sample);
    const en = pre!.en.lines.join("\n");
    expect(en).toContain("On 02/02/2026 in the city of Riyadh, Saudi Arabia.");
    expect(en).toContain(
      "A) Al Kuhaimi Wood Industries, CR No. 1010478612, a Saudi Company with its head office in the city of Dammam",
    );
    expect(en).toContain("B) Mr. HAITHAM FATHI JAMEEL MULHIM,");
    expect(en).toContain(
      "Nationality-Jordanian Iqama No. 2024513646, with address in his country of origin at: Building 47",
    );
    const ar = pre!.ar.lines.join("\n");
    expect(ar).toContain("2- السيد /   هيثم فتحي جميل ملحم");
    expect(ar).toContain("الجنسية/ الاردن يحمل إقامة نظامية رقم 2024513646");
  });

  it("reproduces the sample's articles 4, 13 and 23 word for word", () => {
    expect(article(sample, 4).en).toContain(
      "Normal working days are (5) and (8) hours per day and Friday and Saturday is the weekly rest",
    );
    expect(article(sample, 4).ar).toContain(
      "مدة العمل الأسبوعية خمسة أيام والدوام اليومي ثماني ساعات باليوم ويوم الجمعة و السبت راحة أسبوعية",
    );
    expect(article(sample, 13).ar).toContain(
      "من الرياض إلى عمان ولزوجته وعدد طفلين فقط بحيث لا تزيد أعمارهم عن 18 عام ولا يستحق",
    );
    expect(article(sample, 13).en).toContain(
      "from Riyadh to Amman and his wife with Two children up to 18 years old,",
    );
    expect(article(sample, 23).ar).toContain("من الرياض إلى عمان له  ولزوجته وعدد طفلين فقط");
  });

  it("changes only the working-time and ticket wording with the choices", () => {
    const six = { ...sample, workDaysPerWeek: 6, hoursPerDay: 9 };
    expect(article(six, 4).en).toContain("(6) and (9) hours per day and Friday is the weekly rest");
    expect(article(six, 4).ar).toContain(
      "ستة أيام والدوام اليومي تسع ساعات باليوم ويوم الجمعة راحة",
    );

    const single = { ...sample, tickets: { ...sample.tickets, wife: false, children: 0 } };
    expect(article(single, 13).en).toContain("from Riyadh to Amman, The second party");
    expect(article(single, 13).ar).toContain("من الرياض إلى عمان ولا يستحق");
    expect(article(single, 23).en).toContain("from Riyadh to Amman at the economy class");

    const wifeOnly = { ...sample, tickets: { ...sample.tickets, wife: true, children: 0 } };
    expect(article(wifeOnly, 13).ar).toContain("إلى عمان ولزوجته ولا يستحق");

    const twoYears = { ...sample, termYears: 2 };
    expect(article(twoYears, 3).en).toContain("The term of this contract is two (2) years");
    expect(annexures(twoYears)[7]!.en.list![0]).toContain("2 years, equivalent to 24 months");
  });

  it("leaves the fixed articles exactly as in the original", () => {
    expect(article(sample, 35).en).toContain(
      "This contract is made in Arabic language which shall prevail in any dispute.",
    );
    expect(article(sample, 6).ar).toContain(
      "تعتبر ستة أشهر الأولى من بداية سريان هذا العقد فترة اختبار",
    );
  });

  it("signs for the company as in the original", () => {
    expect(signaturePage(sample).firstParty.ar[2]).toBe("رئيس الشركة");
  });

  it("uses the passport where there is no Iqama yet", () => {
    const newHire = { ...sample, employee: { ...sample.employee, iqamaNo: "" } };
    expect(contractBody(newHire)[0]!.en.lines.join(" ")).toContain("Passport No. S0392184");
    expect(contractBody(newHire)[0]!.ar.lines.join(" ")).toContain("يحمل جواز سفر رقم S0392184");
  });

  it("has eight annexures, 7 and 8 in English only", () => {
    const a = annexures(sample);
    expect(a.map((x) => x.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(a[6]!.ar).toBeUndefined();
    expect(a[7]!.ar).toBeUndefined();
    expect(a[4]!.en.lines[0]).toContain(
      "I am working at Al Kuhaimi Wood Industries, CR No 1010478612",
    );
  });

  it("validates the particulars", () => {
    expect(contractParticularsSchema.parse({}).ticketChildren).toBe(0);
    expect(contractParticularsSchema.safeParse({ ticketChildren: "9" }).success).toBe(false);
    expect(contractParticularsSchema.safeParse({ unknown: "x" }).success).toBe(false);
  });
});
