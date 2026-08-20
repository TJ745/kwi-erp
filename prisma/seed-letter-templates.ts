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
    | "JOINING_LETTER"
    | "CLEARANCE_FORM"
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
    key: "employee_clearance_form",
    name: "Employee Clearance Form",
    type: "CLEARANCE_FORM",
    // A form, not a letter: it is printed to be signed by hand, so most cells
    // are deliberately empty. Only what the system actually knows is filled —
    // the four name parts, iqama, dates, company, department and its manager.
    // The letterhead is NOT here; it comes from company settings and repeats
    // on every page (docs/ARCHITECTURE.md, ADR-004).
    bodyHtml: `
      <table class="form-grid" style="width: 100%; border: 0">
        <tr>
          <td style="border: 0; width: 22%; text-align: left">Date: {{today}}</td>
          <td style="border: 0; width: 56%; text-align: center; font-weight: 700; font-size: 1rem">
            EMPLOYEE CLEARANCE FORM <span dir="rtl" lang="ar">نموذج إخلاء طرف</span>
          </td>
          <td style="border: 0; width: 22%; text-align: right" dir="rtl" lang="ar">
            التاريخ: {{today_hijri}}
          </td>
        </tr>
      </table>

      <table class="form-grid">
        <tr style="background-color: #f2f2f2">
          <td colspan="2" style="font-weight: 700">EMPLOYEE INFORMATION</td>
          <td colspan="2" style="font-weight: 700; text-align: right" dir="rtl" lang="ar">معلومات الموظف</td>
        </tr>
        <tr>
          <td style="width: 25%"><strong>Family Name</strong> <span dir="rtl" lang="ar">إسم العائلة</span></td>
          <td style="width: 25%"><strong>Last Name</strong> <span dir="rtl" lang="ar">إسم الجد</span></td>
          <td style="width: 25%"><strong>Middle Name</strong> <span dir="rtl" lang="ar">إسم الأب</span></td>
          <td style="width: 25%"><strong>First Name</strong> <span dir="rtl" lang="ar">الاسم الأول</span></td>
        </tr>
        <tr>
          <td>{{employee_family_name}}</td>
          <td>{{employee_last_name}}</td>
          <td>{{employee_middle_name}}</td>
          <td>{{employee_first_name}}</td>
        </tr>
        <tr>
          <td><strong>End Date</strong> <span dir="rtl" lang="ar">تاريخ الإنتهاء</span></td>
          <td><strong>Join Date</strong> <span dir="rtl" lang="ar">تاريخ التعيين</span></td>
          <td><strong>Employee ID#</strong> <span dir="rtl" lang="ar">الرقم الوظيفي</span></td>
          <td><strong>ID / Iqama #:</strong> <span dir="rtl" lang="ar">رقم الإقامه</span></td>
        </tr>
        <tr>
          <td>{{last_working_date}}</td>
          <td>{{joining_date}}</td>
          <td>{{employee_id}}</td>
          <td>{{iqama_number}}</td>
        </tr>
      </table>

      <table class="form-grid">
        <tr style="background-color: #f2f2f2">
          <td style="width: 60%; font-weight: 700">LOCATION AND WORK</td>
          <td style="width: 40%; font-weight: 700; text-align: right" dir="rtl" lang="ar">موقع وطبيعة العمل</td>
        </tr>
        <tr>
          <td style="width: 60%"><strong>Company Name :</strong> {{company_name}}</td>
          <td style="width: 40%; text-align: right" dir="rtl" lang="ar">اسم الشركة :</td>
        </tr>
        <tr>
          <td><strong>Company Location :</strong> {{company_city}}</td>
          <td style="text-align: right" dir="rtl" lang="ar">موقع الشركة :</td>
        </tr>
        <tr>
          <td><strong>Department / Division :</strong> {{department}}</td>
          <td style="text-align: right" dir="rtl" lang="ar">الدائره / القسم :</td>
        </tr>
        <tr>
          <td><strong>Position :</strong> {{position}}</td>
          <td style="text-align: right" dir="rtl" lang="ar">الوظيفة :</td>
        </tr>
        <tr>
          <td><strong>Department Manager :</strong> {{department_manager}}</td>
          <td style="text-align: right" dir="rtl" lang="ar">مدير القسم :</td>
        </tr>
      </table>

      <table class="form-grid">
        <tr style="background-color: #f2f2f2">
          <td style="width: 60%; font-weight: 700">IT DEPARTMENT</td>
          <td style="width: 40%; font-weight: 700; text-align: right" dir="rtl" lang="ar">قسم تكنولوجيا المعلومات</td>
        </tr>
        <tr>
          <td style="width: 60%"><strong>Server user name :</strong></td>
          <td style="width: 40%; text-align: right" dir="rtl" lang="ar">اسم المستخدم على السيرفر :</td>
        </tr>
        <tr>
          <td><strong>Email Account :</strong></td>
          <td style="text-align: right" dir="rtl" lang="ar">البريد الإلكتروني :</td>
        </tr>
        <tr>
          <td><strong>ERP Account :</strong></td>
          <td style="text-align: right" dir="rtl" lang="ar">حساب ERP :</td>
        </tr>
        <tr>
          <td><strong>Hardware and Devices :</strong></td>
          <td style="text-align: right" dir="rtl" lang="ar">الكمبيوترات والأجهزه :</td>
        </tr>
        <tr>
          <td><strong>Software :</strong></td>
          <td style="text-align: right" dir="rtl" lang="ar">البرامج :</td>
        </tr>
      </table>

      <table class="form-grid form-sign">
        <tr>
          <td style="width: 25%; padding-top: 1.4rem; vertical-align: bottom"><strong>Date:</strong> <span dir="rtl" lang="ar">التاريخ:</span></td>
          <td style="width: 30%; padding-top: 1.4rem; vertical-align: bottom"><strong>Signature:</strong> <span dir="rtl" lang="ar">التوقيع:</span></td>
          <td style="width: 45%; padding-top: 1.4rem; vertical-align: bottom"><strong>IT Manager:</strong> <span dir="rtl" lang="ar">مدير تقنية المعلومات:</span></td>
        </tr>
      </table>

      <table class="form-grid">
        <tr style="background-color: #f2f2f2">
          <td style="width: 40%; font-weight: 700">DIRECT DEPARTMENT</td>
          <td style="width: 20%; font-weight: 700; text-align: center" dir="rtl" lang="ar">التوقيع</td>
          <td style="width: 20%; font-weight: 700; text-align: center" dir="rtl" lang="ar">الاسم</td>
          <td style="width: 20%; font-weight: 700; text-align: right" dir="rtl" lang="ar">القسم المباشر</td>
        </tr>
        <tr>
          <td><strong>Aramco and Gov. Access Cards</strong></td>
          <td></td>
          <td></td>
          <td style="text-align: right" dir="rtl" lang="ar">بطاقة دخول أرامكو والشركات</td>
        </tr>
        <tr>
          <td><strong>Warehouse</strong></td>
          <td></td>
          <td></td>
          <td style="text-align: right" dir="rtl" lang="ar">المستودع</td>
        </tr>
        <tr>
          <td><strong>Direct Supervisor</strong></td>
          <td></td>
          <td></td>
          <td style="text-align: right" dir="rtl" lang="ar">المسؤول المباشر</td>
        </tr>
      </table>

      <table class="form-grid form-sign">
        <tr>
          <td style="width: 25%; padding-top: 1.4rem; vertical-align: bottom"><strong>Date:</strong> <span dir="rtl" lang="ar">التاريخ:</span></td>
          <td style="width: 30%; padding-top: 1.4rem; vertical-align: bottom"><strong>Signature:</strong> <span dir="rtl" lang="ar">التوقيع:</span></td>
          <td style="width: 45%; padding-top: 1.4rem; vertical-align: bottom"><strong>Department Manager:</strong> {{department_manager}} <span dir="rtl" lang="ar">مدير القسم:</span></td>
        </tr>
      </table>

      <table class="form-grid">
        <tr style="background-color: #f2f2f2">
          <td style="width: 40%; font-weight: 700">HR DEPARTMENT</td>
          <td style="width: 20%; font-weight: 700; text-align: center" dir="rtl" lang="ar">التوقيع</td>
          <td style="width: 20%; font-weight: 700; text-align: center" dir="rtl" lang="ar">الاسم</td>
          <td style="width: 20%; font-weight: 700; text-align: right" dir="rtl" lang="ar">قسم شؤون الموظفين</td>
        </tr>
        <tr>
          <td><strong>ID Access Card</strong></td>
          <td></td>
          <td></td>
          <td style="text-align: right" dir="rtl" lang="ar">بطاقة الدخول</td>
        </tr>
        <tr>
          <td><strong>Cars</strong></td>
          <td></td>
          <td></td>
          <td style="text-align: right" dir="rtl" lang="ar">السيارات</td>
        </tr>
        <tr>
          <td><strong>Sim Card and Mobile</strong></td>
          <td></td>
          <td></td>
          <td style="text-align: right" dir="rtl" lang="ar">الشريحة و الجوال</td>
        </tr>
        <tr>
          <td><strong>Accommodation Officer</strong></td>
          <td></td>
          <td></td>
          <td style="text-align: right" dir="rtl" lang="ar">مسؤول السكن</td>
        </tr>
      </table>

      <table class="form-grid form-sign">
        <tr>
          <td style="width: 25%; padding-top: 1.4rem; vertical-align: bottom"><strong>Date:</strong> <span dir="rtl" lang="ar">التاريخ:</span></td>
          <td style="width: 30%; padding-top: 1.4rem; vertical-align: bottom"><strong>Signature:</strong> <span dir="rtl" lang="ar">التوقيع:</span></td>
          <td style="width: 45%; padding-top: 1.4rem; vertical-align: bottom"><strong>HR Manager:</strong> <span dir="rtl" lang="ar">مدير الموارد البشرية:</span></td>
        </tr>
      </table>

      <table class="form-grid">
        <tr style="background-color: #f2f2f2">
          <td style="width: 40%; font-weight: 700">Finance &amp; Accounts Department</td>
          <td style="width: 20%; font-weight: 700; text-align: center" dir="rtl" lang="ar">التوقيع</td>
          <td style="width: 20%; font-weight: 700; text-align: center" dir="rtl" lang="ar">الاسم</td>
          <td style="width: 20%; font-weight: 700; text-align: right" dir="rtl" lang="ar">قسم المالية و المحاسبة</td>
        </tr>
        <tr>
          <td><strong>Finance &amp; Accounts</strong></td>
          <td></td>
          <td></td>
          <td style="text-align: right" dir="rtl" lang="ar">المالية و الحسابات</td>
        </tr>
      </table>

      <table class="form-grid form-sign">
        <tr>
          <td style="width: 25%; padding-top: 1.4rem; vertical-align: bottom"><strong>Date:</strong> <span dir="rtl" lang="ar">التاريخ:</span></td>
          <td style="width: 30%; padding-top: 1.4rem; vertical-align: bottom"><strong>Signature:</strong> <span dir="rtl" lang="ar">التوقيع:</span></td>
          <td style="width: 45%; padding-top: 1.4rem; vertical-align: bottom"><strong>Finance Manager:</strong> <span dir="rtl" lang="ar">مدير قسم المالية:</span></td>
        </tr>
      </table>
    `,
    // Bilingual inline rather than as a separate Arabic body: the original is
    // one form with English and Arabic side by side in the same cells, and
    // splitting it would produce two forms nobody uses.
    bodyHtmlAr: null,
  },
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
    key: "joining_letter",
    name: "Joining Letter",
    type: "JOINING_LETTER",
    bodyHtml: `
      <h2 style="text-align: center">JOINING LETTER</h2>
      <p>Dear <strong>{{employee_name}}</strong>,</p>
      <p>We are pleased to confirm your joining {{company_name}} as
      <strong>{{position}}</strong> in the {{department}} department, effective
      {{joining_date}}. Your employee number is {{employee_id}}.</p>
      <p>Your employment is governed by the terms of your contract dated {{contract_start}}
      and by the Saudi Labour Law.</p>
      <p>Please report to the Human Resources department on your first working day to complete
      the onboarding formalities.</p>
      ${SIGNATURE}
    `,
    bodyHtmlAr: null,
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
