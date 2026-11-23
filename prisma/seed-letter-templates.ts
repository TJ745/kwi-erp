/**
 * Default letter templates.
 *
 * Bilingual (Decision D): English body plus an Arabic body rendered RTL below
 * it. Deliberately generic — no real company wording, salaries, or names.
 *
 * Kept out of seed.ts because the HTML would otherwise bury the rest of it.
 */

export type SeedTemplate = {
  key: string;
  name: string;
  type:
    | "EMPLOYMENT_LETTER"
    | "SALARY_LETTER"
    | "EXPERIENCE_LETTER"
    | "MEMO";
  bodyHtml: string;
  bodyHtmlAr: string | null;
};

const SIGNATURE = `
  <p style="margin-top: 32px">Sincerely,</p>
  <p style="margin-top: 40px"><strong>Human Resources Department</strong><br />{{company_name}}</p>
  <p style="font-size: 11px; color: #666">
    This letter is issued at the request of the employee and does not constitute a financial
    obligation on the company. Reference: {{letter_no}}
  </p>
`;

const SIGNATURE_AR = `
  <p style="margin-top: 32px">وتفضلوا بقبول فائق الاحترام،</p>
  <p style="margin-top: 40px"><strong>إدارة الموارد البشرية</strong><br />{{company_name}}</p>
  <p style="font-size: 11px; color: #666">
    صدر هذا الخطاب بناءً على طلب الموظف ولا يترتب عليه أي التزام مالي على الشركة.
    الرقم المرجعي: {{letter_no}}
  </p>
`;

export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    key: "employment_letter",
    name: "Employment Letter (To Whom It May Concern)",
    type: "EMPLOYMENT_LETTER",
    bodyHtml: `
      <h2 style="text-align: center">TO WHOM IT MAY CONCERN</h2>
      <p>This is to certify that <strong>{{employee_name}}</strong>, holder of Iqama number
      {{iqama_number}} and of {{employee_nationality}} nationality, is an employee of
      {{company_name}} (CR {{company_cr}}).</p>
      <p>{{employee_name}} joined the company on {{joining_date}} and currently holds the
      position of <strong>{{position}}</strong> in the {{department}} department, under employee
      number {{employee_id}}.</p>
      <p>This letter is issued upon the employee's request on {{today}} without any liability
      on the company.</p>
      ${SIGNATURE}
    `,
    bodyHtmlAr: `
      <h2 style="text-align: center">إلى من يهمه الأمر</h2>
      <p>نفيد بأن السيد/ة <strong>{{employee_name_ar}}</strong>، حامل الإقامة رقم
      {{iqama_number}} والجنسية {{employee_nationality}}، يعمل لدى {{company_name}}
      (سجل تجاري رقم {{company_cr}}).</p>
      <p>وقد التحق بالعمل بتاريخ {{joining_date}} ويشغل حالياً وظيفة
      <strong>{{position}}</strong> بإدارة {{department}}، ورقمه الوظيفي {{employee_id}}.</p>
      <p>وقد صدر هذا الخطاب بناءً على طلبه بتاريخ {{today}} دون أدنى مسؤولية على الشركة.</p>
      ${SIGNATURE_AR}
    `,
  },
  {
    key: "salary_certificate",
    name: "Salary Certificate",
    type: "SALARY_LETTER",
    bodyHtml: `
      <h2 style="text-align: center">SALARY CERTIFICATE</h2>
      <p>This is to certify that <strong>{{employee_name}}</strong> (employee number
      {{employee_id}}) has been employed with {{company_name}} since {{joining_date}} as
      <strong>{{position}}</strong>.</p>
      <table>
        <tbody>
          <tr><th style="width: 40%">Basic salary</th><td>{{salary}} {{currency}} per month</td></tr>
          <tr><th>Contract period</th><td>{{contract_start}} to {{contract_end}}</td></tr>
          <tr><th>Iqama number</th><td>{{iqama_number}}</td></tr>
        </tbody>
      </table>
      <p>Issued on {{today}} at the employee's request.</p>
      ${SIGNATURE}
    `,
    bodyHtmlAr: `
      <h2 style="text-align: center">شهادة راتب</h2>
      <p>نفيد بأن السيد/ة <strong>{{employee_name_ar}}</strong> (الرقم الوظيفي
      {{employee_id}}) يعمل لدى {{company_name}} منذ تاريخ {{joining_date}} بوظيفة
      <strong>{{position}}</strong>.</p>
      <table>
        <tbody>
          <tr><th style="width: 40%">الراتب الأساسي</th><td>{{salary}} {{currency}} شهرياً</td></tr>
          <tr><th>مدة العقد</th><td>من {{contract_start}} إلى {{contract_end}}</td></tr>
          <tr><th>رقم الإقامة</th><td>{{iqama_number}}</td></tr>
        </tbody>
      </table>
      <p>صدر بتاريخ {{today}} بناءً على طلب الموظف.</p>
      ${SIGNATURE_AR}
    `,
  },
  {
    key: "experience_letter",
    name: "Experience Letter",
    type: "EXPERIENCE_LETTER",
    bodyHtml: `
      <h2 style="text-align: center">EXPERIENCE CERTIFICATE</h2>
      <p>This is to certify that <strong>{{employee_name}}</strong>, passport number
      {{passport_number}}, was employed with {{company_name}} from {{joining_date}} to
      {{last_working_date}}.</p>
      <p>During this period {{employee_name}} served as <strong>{{position}}</strong> in the
      {{department}} department and discharged the assigned duties satisfactorily.</p>
      <p>We wish {{employee_name}} every success in future endeavours.</p>
      ${SIGNATURE}
    `,
    bodyHtmlAr: `
      <h2 style="text-align: center">شهادة خبرة</h2>
      <p>نفيد بأن السيد/ة <strong>{{employee_name_ar}}</strong>، حامل جواز السفر رقم
      {{passport_number}}، قد عمل لدى {{company_name}} في الفترة من {{joining_date}} حتى
      {{last_working_date}}.</p>
      <p>وقد شغل خلال هذه الفترة وظيفة <strong>{{position}}</strong> بإدارة {{department}}
      وأدى المهام الموكلة إليه على أكمل وجه.</p>
      <p>ونتمنى له التوفيق والنجاح في حياته العملية.</p>
      ${SIGNATURE_AR}
    `,
  },
  {
    key: "internal_memo",
    name: "Internal Memo",
    type: "MEMO",
    bodyHtml: `
      <h2>INTERNAL MEMORANDUM</h2>
      <table>
        <tbody>
          <tr><th style="width: 25%">To</th><td>{{employee_name}} — {{position}}</td></tr>
          <tr><th>From</th><td>Human Resources, {{company_name}}</td></tr>
          <tr><th>Date</th><td>{{today}}</td></tr>
          <tr><th>Reference</th><td>{{letter_no}}</td></tr>
        </tbody>
      </table>
      <h3>Subject</h3>
      <p>Replace this paragraph with the subject of the memo.</p>
      <h3>Details</h3>
      <p>Replace this paragraph with the body of the memo.</p>
      ${SIGNATURE}
    `,
    bodyHtmlAr: null,
  },
];
