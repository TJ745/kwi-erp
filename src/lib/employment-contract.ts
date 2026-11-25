/**
 * The company's employment contract (39 articles, 8 annexures), English and
 * Arabic, as written in the company's Word original. The wording is fixed;
 * only the values below are filled in. Article 35 makes the Arabic text the
 * binding one, so Arabic here is the company's own wording, never generated —
 * except the small phrases that vary with the choices (rest day, family on the
 * ticket, contract years), which follow the original's own phrasing.
 */

export type ContractParty = {
  /** Company. */
  nameEn: string;
  nameAr: string;
  crNumber: string;
  headOfficeCityEn: string;
  headOfficeCityAr: string;
  addressEn: string;
  addressAr: string;
  /** e.g. "Mr. Mohammad Al Kuhaimi" / "السيد/ محمد أحمد الكحيمي". */
  signatoryEn: string;
  signatoryAr: string;
  /** e.g. "President" / "الرئيس". */
  signatoryTitleEn: string;
  signatoryTitleAr: string;
};

export type ContractEmployee = {
  female: boolean;
  nameEn: string;
  nameAr: string;
  /** The nationality as an adjective, e.g. "Jordanian". */
  nationalityEn: string;
  /** As the original writes it, e.g. "الاردن". */
  nationalityAr: string;
  iqamaNo: string;
  passportNo: string;
  dateOfBirth: string;
  homeAddressEn: string;
  homeAddressAr: string;
  saudiAddressEn: string;
  saudiAddressAr: string;
  homePhone: string;
};

export type ContractValues = {
  date: string;
  cityEn: string;
  cityAr: string;
  company: ContractParty;
  employee: ContractEmployee;
  position: string;
  salary: {
    basic: string;
    transport: string;
    housing: string;
    phone: string;
    food: string;
    other: string;
    total: string;
  };
  termYears: number;
  workDaysPerWeek: number;
  hoursPerDay: number;
  tickets: { destinationEn: string; destinationAr: string; wife: boolean; children: number };
  annex7: { title: string; items: string[] };
};

/** One printed row: English on the left, Arabic on the right. */
export type ContractBlock = {
  en: { label?: string; lines: string[] };
  ar: { label?: string; lines: string[] };
};

export const WORK_DAYS = [5, 6] as const;
export const HOURS_PER_DAY = [8, 9, 10] as const;
export const MAX_CHILDREN = 6;
export const TERM_YEARS = [1, 2] as const;

const AR_DAYS: Record<number, string> = { 5: "خمسة", 6: "ستة" };
const AR_HOURS: Record<number, string> = { 8: "ثماني", 9: "تسع", 10: "عشر" };
const EN_NUMBER = ["", "One", "Two", "Three", "Four", "Five", "Six"];
const AR_CHILDREN: Record<number, string> = {
  1: "طفل واحد",
  2: "طفلين",
  3: "ثلاثة أطفال",
  4: "أربعة أطفال",
  5: "خمسة أطفال",
  6: "ستة أطفال",
};

const restDayEn = (days: number) => (days === 6 ? "Friday" : "Friday and Saturday");
const restDayAr = (days: number) => (days === 6 ? "ويوم الجمعة" : "ويوم الجمعة و السبت");

function familyEn(t: ContractValues["tickets"], leadComma: boolean): string {
  const kids =
    t.children > 0
      ? `${EN_NUMBER[t.children] ?? String(t.children)} ${t.children === 1 ? "child" : "children"} up to 18 years old`
      : "";
  if (t.wife) return `${leadComma ? "," : ""} and his wife${kids ? ` with ${kids}` : ""}`;
  return kids ? `${leadComma ? "," : ""} and ${kids}` : "";
}

function familyAr(t: ContractValues["tickets"]): string {
  const kids =
    t.children > 0
      ? `وعدد ${AR_CHILDREN[t.children] ?? String(t.children)} فقط بحيث لا تزيد أعمارهم عن 18 عام`
      : "";
  if (t.wife) return ` ولزوجته${kids ? ` ${kids}` : ""}`;
  return kids ? ` و${kids.replace(/^وعدد /, "عدد ")}` : "";
}

const termEn = (y: number) => (y === 2 ? "two (2) years" : "one (1) year");
const termAr = (y: number) => (y === 2 ? "(2) سنتان ميلاديتان" : "(1) سنة  ميلادية");
const annex8Term = (y: number) =>
  y === 2 ? "2 years, equivalent to 24 months" : "1 year, equivalent to 12 months";

/** "Mr." / "Ms." and "السيد" / "السيدة". */
export const salutation = (e: ContractEmployee) => ({
  en: e.female ? "Ms." : "Mr.",
  ar: e.female ? "السيدة" : "السيد",
});

/** The identity phrase: Iqama when the employee has one, else the passport. */
function idEn(e: ContractEmployee) {
  return e.iqamaNo ? `Iqama No. ${e.iqamaNo}` : `Passport No. ${e.passportNo}`;
}
function idAr(e: ContractEmployee) {
  return e.iqamaNo ? `يحمل إقامة نظامية رقم ${e.iqamaNo}` : `يحمل جواز سفر رقم ${e.passportNo}`;
}

/** The contract body: preamble, articles 1–39, as printed rows. */
export function contractBody(v: ContractValues): ContractBlock[] {
  const c = v.company;
  const e = v.employee;
  const s = salutation(e);
  return [
    {
      en: {
        lines: [
          `On ${v.date} in the city of ${v.cityEn}, Saudi Arabia. This Contract is hereby agreed upon and concluded between :`,
          `A) ${c.nameEn}, CR No. ${c.crNumber}, a Saudi Company with its head office in the city of ${c.headOfficeCityEn} and address at :`,
          c.addressEn,
          "represented in the Contract by:",
          "",
          `${c.signatoryEn} being ${c.signatoryTitleEn}`,
          "[ Employer - The FIRST PARTY]",
          "And",
          `B) ${s.en} ${e.nameEn},`,
          `Nationality-${e.nationalityEn} ${idEn(e)}, with address in his country of origin at: ${e.homeAddressEn}.`,
          "",
          "Address in the Kingdom of Saudi Arabia at :",
          e.saudiAddressEn,
          "",
          "[ Employee- The SECOND PARTY ]",
        ],
      },
      ar: {
        lines: [
          `بتاريخ اليوم  ${v.date}م ، وفي مدينة ${v.cityAr} بالمملكة العربية  السعوديـة تـم الإتفاق والتراضي بين كـل مـن:`,
          `${c.nameAr} ، سجل تجاري رقم ${c.crNumber}  وهي شـركة سـعودية مقـرها الرئيسي في مدينة ${c.headOfficeCityAr}، وعـنوانها:`,
          c.addressAr,
          "ويمثلهـا فـي هـذا العقـد",
          `1- ${c.signatoryAr}       بصفته: ${c.signatoryTitleAr}`,
          "( صاحب العمل - الطرف الأول )",
          "و",
          `2- ${s.ar} /   ${e.nameAr}`,
          `الجنسية/ ${e.nationalityAr} ${idAr(e)} ، وعنوانه في بلده الأصلي: ${e.homeAddressAr}.`,
          "وعنوانه في المملكة العربية السعودية",
          ` ${e.saudiAddressAr}`,
          "(الموظّف  -  الطرف الثاني )",
        ],
      },
    },
    {
      en: {
        label: "1/ Appointment:",
        lines: [
          `The first party agreed to employ the second party in the position of (${v.position}) in accordance with the duties and obligations related to this position stated in details in Annexure No (1) of this contract which was signed by the two parties and considered as part of this contract.`,
        ],
      },
      ar: {
        label: "1-التعيين:",
        lines: [
          `وافق الطرف الأول، على توظيف الطرف الثاني للعمل لدية في وظيفة(${v.position})   وفقا للواجبات والالتزامات الخاصة بهذه الوظيفة والموضحة تفصيليا في الملحق رقم (1) من هذا العقد والموقع من الطرفين والذي يعتبر جزء لا يتجزأ من هذا العقد.`,
        ],
      },
    },
    // Article 2 (salary) is laid out as a table by the page: see SALARY_TEXT.
    {
      en: {
        label: "3/ Term of Contract:",
        lines: [
          `The term of this contract is ${termEn(v.termYears)} commencing as on the date the second starts work and the first party may renew it for a period which he deems necessary to complete the job per written notice to the Second Party before the expiry of the original or renewed period not exceeding three (3) months. The second party shall disclose its consent to the renewal by sending a notice in writing within one week of receipt of notice from the first party of his desire for renewal. Failing that, the contract shall be deemed to have expired at the end of its original or renewed term.`,
        ],
      },
      ar: {
        label: "3- مدة هذا العقد:",
        lines: [
          `مدة هذا العقد ${termAr(v.termYears)} تبدأ من تاريخ المباشرة بالعمل ويجوز للطرف الأول تجديد هذه بالمدة التي يراها لازمة لإنجاز العمل وذلك بإشعار كتابي يوجهه للطرف الثاني قبل انتهاء المدة الأصلية أو المجددة بمدة لا تزيد عن ثلاثة اشهر وعلى الطرف الثاني الإفصاح عن موافقته على التجديد بإرسال إشعار كتابي بذلك خلال أسبوع من استلامه يشعر الطرف الأول برغبته في التجديد وإلا يعتبر العقد منتهيا بانتهاء مدته الأصلية أو المجددة.`,
        ],
      },
    },
    {
      en: {
        label: "4/: Week Work Hours:",
        lines: [
          `Normal working days are (${String(v.workDaysPerWeek)}) and (${String(v.hoursPerDay)}) hours per day and ${restDayEn(v.workDaysPerWeek)} is the weekly rest unless the first party determines otherwise per the consent of the second party and in accordance with labor law.`,
        ],
      },
      ar: {
        label: "4- مدد العمل الأسبوعية:",
        lines: [
          `مدة العمل الأسبوعية ${AR_DAYS[v.workDaysPerWeek] ?? String(v.workDaysPerWeek)} أيام والدوام اليومي ${AR_HOURS[v.hoursPerDay] ?? String(v.hoursPerDay)} ساعات باليوم ${restDayAr(v.workDaysPerWeek)} راحة أسبوعية، إلا إذا رأى الطرف الأول غير ذلك و بموافقة الطرف الثاني و ضمن متطلبات نظام العمل.`,
        ],
      },
    },
    {
      en: {
        label: "5/ Annual Vacation:",
        lines: [
          "The second party is entitled to a paid annual leave of (30) days after completion of twelve (12) calendar months in service. The leave’s entitlements shall be paid in advance before employee departure. The entitlements of the leave shall be calculated based on the actual salary stated in in Article (2) above. The first party shall specify its date during the accrual year in accordance with work needs and per labor law.",
        ],
      },
      ar: {
        label: "5- الإجازة السنوية:",
        lines: [
          "للطرف الثاني إجازة سنوية مدفوعة الأجر مدتها 30 يوما وتستحق له مرة واحدة كل 12 شهراً ميلادياً من العمل المستمر وتدفع أجور هذه الإجازات مقدماً قبل مغادرته لعمله وتمتعه بإجازته ويحسب أجر الإجازة على أساس الأجر الفعلي الموضح في بند (2) من هذا العقد. ويحدد الطرف الأول موعد تمتع الطرف الثاني بالإجازة حسب مقتضيات سير العمل لديه وطبقا للنظام.",
        ],
      },
    },
    {
      en: {
        label: "6/ Probation Period:",
        lines: [
          "The first six months of the second party employment per this contract shall be considered as probation period during which the first party is entitled to terminate this contract without notice, end of service award or reasons for termination. The probation period may be extended per mutual consent in writing; provided it should not exceed (180) days as per Article (53) of Saudi labor law.",
        ],
      },
      ar: {
        label: "6- مدة التجربة:",
        lines: [
          "تعتبر ستة أشهر الأولى من بداية سريان هذا العقد فترة اختبار يحق للطرفين خلالها إنهاء هذا العقد بدون إنذار أو مكافأة نهاية الخدمة وبدون إبداء أسباب إنهاء العقد، و يجوز باتفاق مكتوب بين الطرفين تمديد فترة التجربة على أن لا تزيد عن ( 180 ) يوما و ذلك حسب المادة ( 53 ) من نظام العمل.",
        ],
      },
    },
    {
      en: {
        label: "7/",
        lines: [
          "In the performance of his work, the second party shall abide by the labor law, dedication, work diligence, diligence in implementing the conditions of the employment, do all that is in the best interests of the business, avoid any behavior or act that interferes with the progress of the work.",
        ],
      },
      ar: {
        label: "7- الالتزام بنظام العمل:",
        lines: [
          "التزم الطرف الثاني خلال قيامة بعمله أن يلتزم بنظام العمل وبالإخلاص والإتقان والحرص على تنفيذ شروط توظيفه و أن يعمل كل ما هو في صالح العمل و أن يتجنب الإتيان بأي تصرف أو فعل يخل بسير العمل أو يؤدى إلى تعطيله.",
        ],
      },
    },
    {
      en: {
        label: "8/ Obligations of the second Party:",
        lines: [
          "The second party shall undertake, during his employment term to:-",
          "",
          "8/1- Perform his duties, obligations and the work assigned to him in the best manner to the satisfaction of the employer. He undertakes to comply with and implement all directives, instructions and orders of the employer and to implement them in the best manner which includes all the directives and instructions, written and verbal orders that may be issued by the first party, including compliance with the internal rules of the company and its implementing regulations. The Second Party declares his knowledge of the internal rules and regulations of the Company by signing Annex No. 2 which shall be part of this contract.",
        ],
      },
      ar: {
        label: "8- التزامات الطرف الثاني:",
        lines: [
          "يتعهد الطرف الثاني طوال مدة استخدامه لدى الطرف الأول بما يلي:",
          "",
          "8/1- أداء واجباته الوظيفية و كافة التزاماته و الأعمال الموكلة إليه على أحسن وجه و بشكل مرض لصاحب العمل كما يتعهد بالتقيد بكافة تعليمات و توجيهات و أوامر صاحب العمل و تنفيذها على أحسن وجه و يشمل ذلك كافة التعليمات و التوجيهات و الأوامر الخطية و الشفوية التي قد يصدرها الطرف الأول، بما فيها الالتزام بالنظام الداخلي للشركة و لائحته التنفيذية، و قد أقرَ الطرف الثاني باطلاعه على النظام الداخلي و اللائحة التنفيذية للشركة بتوقيعه على الملحق رقم (2) والذي يعتبر جزء لا يتجزء من هذا العقد.",
        ],
      },
    },
    {
      en: {
        lines: [
          "8/2- Keep all records, instruments and documents of any kind in a good manner, as well as to maintain files in a good way as arranged in a professional manner so that anyone can refer to it easily and take advantage of its contents. All these records, instruments, documents and correspondence, whether internal or from third parties, or received or sent to third parties are the property of the company and the duties of the second party is to maintain them in good condition. The brochures, technical publications, drawings and engineering accounts, whether internal or obtained from third parties, are the property of the first party and must be preserved. In no case shall these documents be destroyed or transferred outside the company or disclosed to a third party without the written consent of the first party.",
        ],
      },
      ar: {
        lines: [
          "8/2- أن يحافظ على جميع السجلات و الوثائق و المستندات أياً كان نوعها كاملةً و بصورة جيدة، و أن يحتفظ بالملفات على مختلف أنواعها بشكل جيد و مرتبة بطريقة مهنية بحيث تُمكن أي شخص يرغب بالرجوع إليها من الاستفادة من محتوياتها بسهولة و يُسر و بأسرع وقت ممكن،   و تعتبر كافة هذه الوثائق  و المستندات و السجلات و المراسلات سواء كانت داخلية أو كانت مع أطراف ثالثة أو استُلمت أو أرسلت إلى أطراف ثالثة هي ملكاً للشركة و من واجبات الطرف الثاني الحفاظ عليها، كما أن الكتيبات و النشرات الفنية و الرسومات الهندسية و الحسابات الهندسية سواء الداخلية أو التي يتم الحصول عليها من أطراف ثالثة هي ملكاً للطرف الأول و يجب الحفاظ عليها، و لا يجوز بأي حال من الأحوال إتلاف أي من هذه الوثائق المذكورة أو نقلها خارج الشركة أو إطلاع أي طرف ثالث عليها دون موافقة خطية من الطرف الأول.",
        ],
      },
    },
    {
      en: {
        lines: [
          "8/3- In order to ensure that work is not affected in the absence of the second party or in the case of termination or expiry of his services for any reason, the second party is committed to prepare and train a competent person(s) to replace him in the event of his absence or upon termination or end of his contract to perform his duties and obligations stipulated in this contract or in the internal work rules and regulations of the first party.",
        ],
      },
      ar: {
        lines: [
          "8/3- ضماناً لعدم تأثر العمل في حال غياب الطرف الثاني أو في حال إنهاء أو انتهاء خدماته لأي سبب من الأسباب، فإنّ الطرف الثاني يلتزم بإعداد و تدريب شخص أو أشخاص من العاملين ذوي الكفاءة لغايات الحلول محله في حال غيابه أو في حال إنهاء أو انتهاء خدماته في ممارسة كافة أعماله و واجباته و التزاماته سواء تلكَ المنصوص عليها في هذا العقد أو في الأنظمة الداخلية الخاصة بالطرف الأول.",
        ],
      },
    },
    {
      en: {
        lines: [
          "8/4- Maintain all facilities, equipment, tools, documents and property of any kind used by him during his employment with the First Party and shall undertake, at the end of the contract for any reason, to return all such facilities, equipment, instruments and documents in the same conditions he received them.",
        ],
      },
      ar: {
        lines: [
          "8/4-أن يحافظ على جميع التجهيزات و المعدات و الأدوات و الوثائق و الممتلكات مهما كان نوعها و التي قد يستخدمها خلال فترة عمله لدى الطرف الأول، و يتعهد عند انتهاء هذا العقد لأي سبب بأن يعيد كافة تلك التجهيزات و المعدات و الأدوات و الوثائق بالحالة التي استلمها بها.",
        ],
      },
    },
    {
      en: {
        lines: [
          "8/5- Shall update his personal information such as his ID from his country, his passport, home address and mailing address at his country of origin, his mobile No and the address of his close relative and contact No. the second party should provide full information and write the same in the data FORM attached in Annexure (3). He should update such information when there is any change.",
        ],
      },
      ar: {
        lines: [
          "8/5- أن يقوم بتحديث بياناته الخاصة مثل بطاقة الهوية الشخصية الصادرة من بلده الأصلي، و جواز سفره وعنوان سكنه في بلده الأصلي، و عنوان المراسلة في بلده الأصلي، و أرقام الهواتف الخاصة به و عنوان المراسلة لأحد أقربائه المباشرين بالإضافة إلى رقم الهاتف الخاص بالقريب المباشر، و إنه من واجبات الطرف الثاني أن يقدم بياناته كاملة و مكتوبة في نموذج البيانات الملحق رقم ( 3 ) الملحق بهذا العقد وأن يحدث بياناته أولاً بأول بناءً على أي تغيير يطرأ عليها.",
        ],
      },
    },
    {
      en: {
        lines: [
          "8/6- The Second Party undertakes to compensate the Employer for any losses, damages, costs or other claims if the Second Party is responsible for the occurrence thereof, whether directly or indirectly, as a result of the Second Party's breach of its obligations under this contract. The First Party shall be entitled to deduct any losses suffered by him from the salary, entitlements or indemnities due to the second which caused such losses.",
        ],
      },
      ar: {
        lines: [
          "8/6- يتعهد الطرف الثاني بتعويض صاحب العمل عن أي خسائر أو أضرار أو تكاليف أو أي مطالبات أخرى كان الطرف الثاني مسؤولاً عن حدوثها بطريقة مباشرة و غير مباشرة التي تكون ناتجة عن إخلال الطرف الثاني بواجباته بموجب هذا العقد و يحق للطرف الأول اقتطاع أي خسائر لحقت به من راتب و استحقاقات و تعويضات الطرف الثاني الذي سببَ هذه الخسائر.",
        ],
      },
    },
    {
      en: {
        lines: [
          "8/7- The second party undertakes not to accept gifts, donations or rewards whether in cash or in kind from any party related to the nature of the work of the employee or in order to do a legitimate or illegitimate work related to his functions.",
        ],
      },
      ar: {
        lines: [
          "8/7- يتعهد الطرف الثاني بعدم قبول الهدايا أو الهبات أو المكافآت العينية أو النقدية من جهات ذات صلة بطبيعة عمله أو من أجل القيام بعمل مشروع أو غير مشروع يتصل بمهامه الوظيفية.",
        ],
      },
    },
    {
      en: {
        label: "9/ Medical Checkup:",
        lines: [
          "The second party shall carry out the medical checkup and tests requested by the first party before or during employment.",
        ],
      },
      ar: {
        label: "9- الفحوص الطبية:",
        lines: [
          "على الطرف الثاني أن يخضع وفقاً لطلب الطرف الأول للفحوص الطبية التي يرغب في إجرائها عليه قبل أو أثناء الالتحاق بالعمل.",
        ],
      },
    },
    {
      en: {
        label: "10/ Change of Work Place:",
        lines: [
          "The second party shall comply with the instructions of the first party to change the place or type of work for the second party according to the requirements of the work and in accordance with Article 38 and 58 of the Labor Law.",
        ],
      },
      ar: {
        label: "10- تغيير مكان العمل:",
        lines: [
          "التزم الطرف الثاني بتنفيذ طلبات الطرف الأول في تغيير مكان العمل أو نوعه بما تقتضيه متطلبات العمل و بما يتوافق مع المادة ( 38 و 58 ) من نظام العمل.",
        ],
      },
    },
    {
      en: {
        label: "11/ Work with Others:",
        lines: [
          "The second party shall not work, during the term of this contract, directly or indirectly, for third party with or without salary, as this is considered a breach of this contract. The first party is entitled to terminate the services of the second party in accordance with Article (80) of the Labor law.",
        ],
      },
      ar: {
        label: "11- العمل لدى الغير:",
        lines: [
          "التزم الطرف الثاني خلال سريان هذا العقد بعدم العمل بصورة مباشرة أو غير مباشرة لدى الغير سواء كان بأجر أو بدون أجر وتعتبر مخالفة ذلك إخلالا أساسيا ببنود هذا العقد و يحق للطرف الأول إنهاء خدمات الطرف الثاني بموجب المادة ( 80 ) من نظام العمل.",
        ],
      },
    },
    {
      en: {
        label: "12/ Iqama Fees (Second party- Non Saudi):",
        lines: [
          "The first party shall bear all the costs of the recruitment of the second party, Iqama fees, work permit and their renewal, any delay fine, change of profession fees, exit reentry visa, return ticket of the employee and his family to country of origin after end of contractual relation between the two parties. If the second party lost his Iqama he shall bear the cost related the issuance of replacement. The second party shall bear all expenses related to renewal of his passport, exit reentry visa and any other governmental fees if the travel for personal purposes.",
        ],
      },
      ar: {
        label: "12- نفقات الإقامة (خاص بالطرف الثاني الغير سعودي):",
        lines: [
          "التزم الطرف الأول بكافة النفقات المتعلقة باستقدام الطرف الثاني ورسوم الإقامة ورخصة العمل وتجديدها وما يترتب على تأخير ذلك من غرامات ورسوم تغيير المهنة والخروج والعودة، وتذكرة عودة الطرف الثاني وعائلته إلى موطنه بعد انتهاء العلاقة بين الطرفين، وفى حالة إضاعة الطرف الثاني لإقامته فانه يتحمل كافة النفقات المتعلقة بإصدار إقامة بديلة، كما سيتحمل الطرف الثاني كافة النفقات المتعلقة بتجديد جواز سفهره و تأشيرة الخروج والعودة وأي رسوم حكومية أخرى إذ كانت لأغراضه الخاصة وليست للعمل.",
        ],
      },
    },
    {
      en: {
        label: "13/ Air Tickets (Second party- Non Saudi):",
        lines: [
          `The first party shall provide the second party with Airline (2 Way) up and down air tickets on economy class for himself and air tickets from Riyadh to ${v.tickets.destinationEn}${familyEn(v.tickets, false)}, The second party is entitled to such tickets only when he actually enjoys vacation.  Tickets shall be entitled every 12 months of continued service. The second party shall lose such tickets, their full or partial value if he deferred his accrued leave for more than 12 months after the end of the contractual year in question unless he obtains the consent of the first party in writing.`,
        ],
      },
      ar: {
        label: "13-   تذاكر السفر (خاص بالطرف الثاني الغير سعودي ):",
        lines: [
          `يمنح الطرف الأول للطرف الثاني عدد (  واحد  ) تذاكر سفر ذهابا وإياباً بالدرجة السياحية من الرياض إلى ${v.tickets.destinationAr}${familyAr(v.tickets)} ولا يستحق الطرف الثاني هذه التذاكر إلا إذا قرر السفر لقضاء إجازته، وتكون هذه التذاكر مستحقة للطرف الثاني كل اثني عشر شهرا من الخدمة المستمرة. و يفقد الطرف الثاني الحق في هذه التذاكر كما لا يحق له المطالبة بقيمتها أو أي جزء منها إذا قام بتأجيل إجازته المستحقة لفترة تزيد عن (12) شهراً بعد انتهاء السنة التعاقدية المعنية وذلك ما لم يتم الحصول على موافقة خطية من الطرف الأول.`,
        ],
      },
    },
    {
      en: {
        label: "14/ Tax and Fees:",
        lines: [
          "The second party shall pay all tax and fees due from him in accordance with Saudi law and regulations.",
        ],
      },
      ar: {
        label: "14- الضرائب و الرسوم:",
        lines: [
          "التزمَ الطرف الثاني بكافة الضرائب والرسوم المستحقة عليه بموجب الأنظمة السارية في المملكة العربية السعودية.",
        ],
      },
    },
    {
      en: {
        label: "15/ Termination of the Contract:",
        lines: [
          "This work contract shall terminate upon the expiry of its period, the unwillingness of the parties or one of them to renew it or for any of the cases stipulated by law to terminate it. The first party shall also have the right to terminate the contract unilaterally in one of the following cases:-",
        ],
      },
      ar: {
        label: "15- إنهاء العقد:",
        lines: [
          "ينتهي هذا العقد بانتهاء مدته وعدم رغبة الطرفين أو أحدهما في تجديده أو بإحدى الحالات التي نص عليها النظام لإنهائه كما يحق للطرف الأول إنهاء هذا العقد بالإرادة المنفردة في إحدى الحالات التالية:",
        ],
      },
    },
    {
      en: {
        lines: [
          "A) The first party may terminate the contract without advance notice, compensation in lieu, or indemnity only in any of the violations by the second party stipulated in Article (80) of Saudi labour law issued by the Royal Decree No M/51 dated 23/08/1426. In this case the second party agrees to refund to the first party all expenses incurred by the first party for hiring him to Saudi Arabia as follows:-",
        ],
      },
      ar: {
        lines: [
          "أ. من قبل الطرف الأول بدون الحاجة إلى إنذار أو دفع أي مبلغ نقدي بدلا عنه وبدون دفع أي تعويض وذلك بسبب أي من المخالفات التي قد يرتكبها الطرف الثاني طبقا لما هو محدد في المادة (80) من نظام العمل الصادر بالمرسوم الملكي الكريم رقم (م/51) بتاريخ 23/8/1426هـ . وفي هذه الحالة يوافق الطرف الثاني على أن يسدد للطرف الأول كافة النفقات التي تحملها المذكور نظير استقدامه والتعاقد معه للعمل في المملكة العربية السعودية. وتتكون هذه النفقات مما يلي :",
        ],
      },
    },
    {
      en: {
        lines: [
          "(A-1) Cost of ticket from home country to Saudi Arabia at the beginning of the employment",
          "(A-2) Recruitment cost paid by the first party to the recruitment agent.",
          "(A-3) Cost of entry visa and Iqama fees",
          "(A-4) Any other cost.",
        ],
      },
      ar: {
        lines: [
          "(أ-1) قيمة تذكرة القدوم للطرف الثاني من مكان التعاقد إلى المملكة العربية السعودية عند بداية التوظيف.",
          "(أ-2) أجور الاستقدام المدفوعة من قبل الطرف الأول إلي وكيل الاستقدام .",
          "(أ-3) قيمة رسوم تأشيرة الدخول ورسم الإقامة.",
          "(أ-4) نفقات أخرى",
        ],
      },
    },
    {
      en: {
        lines: [
          "B) By the first party during the probation period of three months in accordance with Saudi labor law and provisions of Article (6) of this contract.",
        ],
      },
      ar: {
        lines: [
          "ب. من قبل الطرف الأول, وذلك خلال الثلاثة أشهر الأولى التي تعتبر فترة تجربة بموجب أحكام نظام العمل وما دون في هذا العقد في البند ( 6 ) .",
        ],
      },
    },
    {
      en: {
        lines: [
          "C) If it is proved, at any time during the term of this contract, that the information, documents or certificates submitted by the second party to the first party, based on which this employment contract was entered with the second party, and which the second party acknowledged their correctness in Annexure (4), if it is proved that they are fake documents, information or certificates, the first party has the right to terminate the contract without compensation to the second party. Further, the second party shall be entitled to claim from the Second Party any damage suffered as a result thereof in addition to the expenses referred to in Articles 12 and 13 above, which the First Party has incurred for his contract with the Second Party to work in the Saudi Arabia.",
        ],
      },
      ar: {
        lines: [
          "ج. إذا اتضح في أي وقت من الأوقات خلال سريان هذا العقد أن المعلومات والمستندات والشهادات التي قدمها الطرف الثاني والتي بناء عليها تم التعاقد معه و التي تعهد بصحتها بالملحق رقم ( 4 ), أنها كانت كاذبة أو غير صحيحة فان للطرف الأول الحق في إنهاء هذا العقد بدون دفع أي تعويض قد يستحقه الطرف الثاني بموجب هذا العقد, كما يحق له أيضا أن يطالب الطرف الثاني بالتعويض عن أي أضرار تكون قد لحقت به نتيجة ذلك بالإضافة إلى النفقات المشار إليها في البنود ( 12 و 13 ) أعلاه والتي يكون الطرف الأول قد تحملها نظير تعاقده مع الطرف الثاني للعمل في المملكة العربية السعودية.",
        ],
      },
    },
    {
      en: {
        lines: [
          "D) Termination by the first party in the event of a general deterioration in the Saudi economy, a remarkable increase in competitive pressures in the field of business in which the company operates, reorganizing the company for major work considerations related to effective management, productivity or manpower levels. In this case, a written notice shall be sent to the second party thirty days prior to the end of his service or money in lieu of the notification. Employee is entitled to the service benefits provided for in the contract, namely the end of service award, the return ticket to his country and the accrued leave. The second party shall not be obliged to refund to the first party any unused part of the transportation or housing allowance that has been paid to him.",
        ],
      },
      ar: {
        lines: [
          "د. من قبل الطرف الأول في حالة حدوث تدهور عام في الاقتصاد السعودي أو زيادة ملحوظة في الضغوط التنافسية في المجال الذي تعمل فيه الشركة أو إعادة تنظيم الشركة لاعتبارات عمل رئيسية متعلقة بالإدارة الفعالة أو الإنتاجية أو بمستويات القوى العاملة وفي تلك الحالة يستحق الطرف الثاني إخطارا خطياً قبل ثلاثين يوماً من إنهاء خدمته أو مبلغا نقديا بدلا عن ذلك الإخطار . كما يستحق أيضا فوائد ما بعد الخدمة المنصوص عليها في هذا العقد , وهى مكافأة نهاية الخدمة , وأجرة العودة إلى المكان الذي استقدم منه عن طريق الجو وراتب الإجازة المستحقة. بالإضافة إلى ذلك لن يكون الطرف الثاني ملزماً في هذه الحالة بأن يرد للطرف الأول أي جزء غير مستخدم من بدل الانتقال أو بدل السكن مما يكون قد دفع له.",
        ],
      },
    },
    {
      en: {
        label: "16/ Medical care:",
        lines: [
          "The first party shall provide medical care in the form of insurance to the second party in Saudi, like other employees, in accordance with the labour law and insurance regulations.",
        ],
      },
      ar: {
        label: "16- الرعاية الصحية:",
        lines: [
          "التزم الطرف الأول بأن يوفر للطرف الثاني الرعاية الصحية داخل المملكة من خلال التامين علية لدى شركات التامين المتخصصة شأنه شأن باقي منسوبي الشركة وفقا لنظام العمل ونظام الضمان الصحي التعاوني.",
        ],
      },
    },
    {
      en: {
        label: "17/ Absence:",
        lines: [
          "The second party shall not absence himself from work without a prior approval of the management or a medical report from an approved medical institution per the insurance regulations. If the employee is absent for more than 10 consecutive days or 20 intermitted days during 12 months without permission or a medical report as above, the first party shall apply the provisions of Article (80) Para (7) of Saudi labor law.",
        ],
      },
      ar: {
        label: "17- الغياب عن العمل:",
        lines: [
          "التزم الطرف الثاني بعدم الغياب عن العمل بدون إذن مسبق من الإدارة أو بدون تقرير صادر من الجهة المعتمدة و المتخصصة حسب نظام التأمين الصحي وفى حالة غياب الطرف الثاني عن العمل لمدة تزيد عن عشرة أيام متواصلة أو عشرين يوم متقطعة خلال اثنا عشر شهر من العمل بدون إذن أو دون إحضار التقرير من الطبيب المشار إليه  فإن للطرف الأول تطبيق الجزاء الوارد في المادة (80) فقرة (7) من نظام العمل.",
        ],
      },
    },
    {
      en: {
        label: "18/ Behavior & Conduct:",
        lines: [
          "The second party shall be committed to good behavior and morals during work and at all times. He should abide by the law, customs, norms and public morals applicable in Saudi Arabia. Further, he shall comply with the rules, regulations and instructions applied by the First Party. The Second Party shall bear all fines resulting from violating such laws and regulations.",
        ],
      },
      ar: {
        label: "18-الأخلاق العامة:",
        lines: [
          "يلتزم الطرف الثاني بحسن السلوك و الأخلاق أثناء العمل، و في جميع الأوقات و يلتزم بالأنظمة و الأعراف و العادات و الآداب المرعية في المملكة العربية السعودية، و كذلك بالقواعد و اللوائح و التعليمات المعمول بها لدى الطرف الأول، و يتحمل كافة الغرامات المالية الناتجة عن مخالفته لتلك الأنظمة.",
        ],
      },
    },
    {
      en: {
        label: "19/ Termination of Contract:",
        lines: [
          "The first party has the right to terminate the contract without award, indemnity or notice. However, the second party shall be given chance to state reason to object termination in accordance to cases set forth in Article (80) of Saudi Labour Law.",
        ],
      },
      ar: {
        label: "19- فسخ العقد:",
        lines: [
          "يحق للطرف الأول فسخ العقد دون مكافأة أو إشعار للطرف الثاني أو تعويضه شريطة إتاحة الفرصة للطرف الثاني في إبداء أسباب معارضته للفسخ، و ذلك وفقاً للحالات الواردة في المادة ( 80 ) من نظام العمل .",
        ],
      },
    },
    {
      en: {
        label: "20/ The second party & Contract termination:",
        lines: [
          "The second party shall not terminate this contract before the expiry of its original/ renewed term without a valid cause Article (81) of Saudi Labour Law. Failing that, he shall be subject to Article (77) of labour law and payment of all expenses stated in Article (12- 13) of this contract.",
        ],
      },
      ar: {
        label: "20- الطرف الثاني و إنهاء العقد:",
        lines: [
          "التزمَ الطرف الثاني بعدم إنهاء هذا العقد قبل انتهاء مدته الأصلية أو المجددة دون سبب مشروع و ذلكَ طبقاً للمادة ( 81 ) من نظام العمل وإلا كان عرضةً لسريان حكم المادة ( 77 ) من ذلكَ النظام فضلاً عن تسديده للطرف الأول كافة النفقات المذكورة في البنود ( 12 - 13 ).",
        ],
      },
    },
    {
      en: {
        label: "21/ Leaving the work:",
        lines: [
          "The second party is entitled to leave the work and terminate the contract without notice to the first party while retaining the right to receive all his entitlements, according to the cases mentioned in Article (81) of the Labor Law.",
        ],
      },
      ar: {
        label: "21- ترك العمل:",
        lines: [
          "يحق للطرف الثاني ترك العمل و إنهاء العقد دون إشعار الطرف الأول مع احتفاظه بحقه في الحصول على كافة مستحقاته، طبقاًُ للحالات الواردة في المادة ( 81 ) من نظام العمل.",
        ],
      },
    },
    {
      en: {
        label: "22/",
        lines: [
          "The first party shall pay the end of service award to the second party at the termination of the contractual relation by the first party, by mutual consent of the two parties, completion of contract term, force majeure or resignation of the second party in accordance with Saudi labour law. End of service award shall not include any amount paid by the second party during his employment whether are encouraging incentives, bonuses, commissions or else, whether in kind or cash.",
        ],
      },
      ar: {
        label: "22- مكافأة نهاية الخدمة:",
        lines: [
          "التزم الطرف الأول بدفع مكافأة نهاية الخدمة للطرف الثاني حال استحقاقها عند إنهاء العلاقة التعاقدية من قبل الطرف الأول أو باتفاق الطرفين أو بانتهاء مدة العقد أو نتيجة لقوة قاهرة أو  بسبب استقالة الطرف الثاني على التفصيل الوارد بذلك في نظام العمل السعودي وعلى ألا تدخل في احتساب الأجر الذي ستحتسب على أساسه مكافأة نهاية الخدمة أي مبالغ يدفعها الطرف الأول للطرف الثاني خلال عمله سواء كانت حوافز تشجيعية أو مكافآت أو عمولات أو ما شابه أيا كانت قيمتها وسواء كانت نقدية أو عينية.",
        ],
      },
    },
    {
      en: {
        label: "23/ Return Cost:",
        lines: [
          `The first party shall pay the travel cost of the second party from Riyadh to ${v.tickets.destinationEn}${familyEn(v.tickets, true)} at the economy class after the end of his contract when he decides to return back to place of origin. The second party shall not claim the travel cost in the following cases:-`,
        ],
      },
      ar: {
        label: "23- نفقات العودة:",
        lines: [
          `التزم الطرف الأول بتكاليف انتقال الطرف الثاني من الرياض إلى ${v.tickets.destinationAr} له ${familyAr(v.tickets)} بالدرجة السياحية المخفضة بعد انتهاء عقده وعند عودته إلى المكان الذي استقدم منه ولا يجوز الطرف الثاني المطالبة بنفقات الانتقال في أي من الحالات التالية:`,
        ],
      },
    },
    {
      en: {
        lines: [
          "A) If the second party, after the approval of the first party, decides not to leave Saudi Arabia.",
        ],
      },
      ar: {
        lines: [
          "أ- إذا قرر الطرف الثاني وبموافقة الطرف الأول عدم مغادرة المملكة العربية السعودية .",
        ],
      },
    },
    {
      en: {
        lines: [
          "B) If the first party terminated this contract at any time based on violations committed by the second party as set forth in Article (15/a) and (15/c).",
        ],
      },
      ar: {
        lines: [
          "ب- إذا قام الطرف الأول بإنهاء هذا العقد في أي وقت من الأوقات بسبب مخالفات الطرف الثاني وفقا لما هو موضح بالبند (15– أ) و (15- ج).",
        ],
      },
    },
    {
      en: {
        label: "24/ Trade Secrets:",
        lines: [
          "The Second Party undertakes not to disclose the technical, commercial and industrial secrets related to the products, materials and works which contributed by him to production or marketing, whether directly or indirectly, or that he received during his work in the company. He undertakes to refrain completely from disclosing all secrets related to work, production or disclosing any other information whether during the period of his employment or after termination of his service, whether that information is from within the company or from third parties dealing with by the company. The Second Party undertakes to comply fully with the laws and regulations in force in the Saudi Arabia in respect thereof. Should the Second Party violate the above, the first party shall have the right to have indemnity from the Second Party for all damages sustained as a result of his breach and the right to demand a punitive penalty in accordance with the relevant laws. The second party has agreed to sign a written undertaking to keep confidentiality of the information in Annex (5), which is considered part of this contract.",
        ],
      },
      ar: {
        label: "24- أسرار العمل:",
        lines: [
          "تعهد الطرف الثاني بالمحافظة على الأسرار الفنية والتجارية والصناعية للمنتجات والمواد والأعمال التي ساهم في إنتاجها أو تسويقها بطريقة مباشرة أو غير مباشرة أو اطلع عليها خلال وجوده لدى الطرف الثاني. وتعهد بأن يمتنع امتناعا تاما عاما عن إفشاء كافة الأسرار المتعلقة بالعمل والإنتاج أو أي معلومات سرية أخرى إطلع عليها خلال أدائه لعمله سواء كان ذلك خلال مدة عمله أو بعد تركه للخدمة. سواء كانت من داخل الشركة أو من أ طرف ثالثة تعاملت معها الشركة، كما تعهد الطرف الثاني بالالتزام التام بالأنظمة واللوائح السارية في المملكة العربية السعودية بخصوص ذلك. و إذا أخل الطرف الثاني بهذه التعهدات فإنه يحق للطرف الأول وفقا لاختياره أن ينهي هذا العقد فورا بدون إنذار أو تعويض. ويحق له بالإضافة إلى ذلك مطالبة الطرف الثاني بالتعويض عن كافة الأضرار التي لحقت به من جراء هذا الإخلال وفى المطالبة بالمجازاة العقابية وفقا للأنظمة الخاصة بذلك ووفقا للشرع، وقد وافق الطرف الثاني على تحرير تعهد بالمحافظة على السرية في الملحق رقم (5) والذي يعتبر جزء لا يتجزأ من هذا العقد.",
        ],
      },
    },
    {
      en: {
        label: "25/ Competition:",
        lines: [
          "The Second Party, in the event of termination of his employment with the First Party for any reason, shall not work for any competing company to the first party for two years from the date of termination of its work with the First Party whether in Saudi Arabia, the GCC, Jordan, Lebanon or Amman. The second party undertakes to do so in writing as set forth in Annex 6, which is considered part of this contract. Anything that is not provided for in this contract, in this regard, shall be governed by the Manpower Movement Regulations issued by the Council of Ministers Decree No. 826 dated 15/7/1395. If the employee violated the regulations banning that in Saudi or the other countries, he shall pay an indemnity to the second party at the rate of eight months’ salary calculated on the basis of the actual remuneration he was paid in addition to any rights stipulated in the law for the first party.",
        ],
      },
      ar: {
        label: "25- المنافسـة:",
        lines: [
          "التزم الطرف الثاني في حال انتهاءه من العمل لدى الطرف الأول لأي سبب كان بأن لا يعمل لدى أي من المنافسين المباشرين للطرف الأول لمدة عامين من تاريخ انتهاء عمله سواء كان في المملكة العربية السعودية و دول مجلس التعاون الخليجي و الاردن و لبنان و عمان، و قد التزم الطرف الثاني بذلك خطياً في الملحق رقم   ( 6 ) و الذي يعتبر جزءً لا يتجزأ من هذا العقد، ويطبق في هذا الخصوص في كل مالم يرد به نص في هذا العقد نظام تنفيذ حركة انتقال الأيدي العاملة الصادر بقرار من مجلس الوزراء رقم 826 تاريخ 15/7/1395هـ الساري المفعول، وإذا خالف العامل الحظر المذكور في المملكة وباقي الدول الأخرى التزم بدفع تعويضا اتفاقياً إلى الطرف الثاني مقداره ثمانية ( 8 )  رواتب تحتسب على أساس الأجر الفعلي الذي كان يتقاضاه  بالإضافة إلى أي حقوق قد يرتبها النظام أو القانون للطرف الأول.",
        ],
      },
    },
    {
      en: {
        label: "26/ The accounts and Restrictions of the work:",
        lines: [
          "It is understood and agreed between the parties that the restrictions of the First Party and its accounts in respect of the second party's entitlements, his holidays and all other dues are considered irrefutable evidence binding to the second party and he has no right to challenge its validity or object to it in any form.",
        ],
      },
      ar: {
        label: "26- حسابات و قيود العمل:",
        lines: [
          "من المعلوم و المتفق عليه بين الطرفين أنَ قيود الطرف الأول و حساباته فيما يتعلق بأجور الطرف الثاني و إجازاته و كافة استحقاقاته الأخرى تعتبر بينة قاطعة و ملزمة و مقيدة للطرف الثاني و لا يحق له الطعن في صحتها أو الاعتراض عليها بأي شكل من الأشكال.",
        ],
      },
    },
    {
      en: {
        label: "27/",
        lines: [
          "The parties agreed that this contract supersedes all prior agreements, contracts and commitments before this date. After the signing of this contract, no party shall claim any right, privilege or benefit other than what is stated in the contract, except that the second party is entitled to receive the end of service benefits and annual leave due to him which are not used until the date of signing this contract.",
        ],
      },
      ar: {
        label: "27- إلزامية هذا العقد:",
        lines: [
          "أقر الطرف الأول و الطرف الثاني بأن هذا العقد يحل محل كافة الاتفاقيات والعقود والارتباطات السابقة لتاريخ هذا العقد (إن وجدت) ولا يجوز لأي طرف من الطرفين بعد توقيع هذا العقد المطالبة بأي حق أو امتياز أو منفعة بخلاف ما ذكر في هذا العقد ويستثنى من ذلك أحقية الطرف الثاني في الحصول على مكافأة نهاية الخدمة والأجازات السنوية المستحقة والتي لم يتم استغلالها حتى تاريخ توقيع هذا العقد.",
        ],
      },
    },
    {
      en: {
        label: "28/ Liability:",
        lines: [
          "The First Party shall not be committed or liable to the Second Party, for obligations contained in this contract, if such liability arises out of the will of the First Party such as the Force Majeure, the act of third parties and the Second Party's fault and the first party cannot perform this contractual obligation.",
        ],
      },
      ar: {
        label: "28- المسؤولية:",
        lines: [
          "لا يلتزم الطرف الأول بأية مسئولية أو التزام تجاه الطرف الثاني والواردة في هذا العقد إذا نشأت هذه المسئولية أو نشأ هذا الالتزام بسبب خارج عن إرادة الطرف الأول كالقوة القاهرة وفعل الغير وخطأ الطرف الثاني نفسه مما لا يٌمكن الطرف الأول القيام بهذا الالتزام التعاقدي.",
        ],
      },
    },
    {
      en: {
        label: "29/ Innovations and inventions at work:",
        lines: [
          "The second party agreed that all studies, researches, innovations and technical inventions made by him during the term of the contract shall be considered as a property of the first party. The second party has signed an undertaking to this effect as Annex No (4) which shall be an integral part of this contract.",
        ],
      },
      ar: {
        label: "29-الابتكارات و الاختراعات في العمل:",
        lines: [
          "وافقَ الطرف الثاني على أنّ جميع الدراسات و الأبحاث و الاختراعات و الابتكارات الفنية التي يقوم بها أو يتوصل إليها خلال مدة هذا العقد تعتبر ملكاً للطرف الأول، و التزم بذلك خطياً في الملحق رقم (4) والذي هو جزء لا يتجزأ من هذا العقد.",
        ],
      },
    },
    {
      en: {
        label: "30/ Conflict of Interests:",
        lines: [
          "The second party shall not, during the term of this contract, work with or without consideration, or any other work for third party i.e. company, establishment or an individual without the consent of the first party in writing whatever the work may be.",
        ],
      },
      ar: {
        label: "30- تنازع المصالح:",
        lines: [
          "لا يحق للطرف الثاني خلال مدة سريان هذا العقد أن يعمل بأجر أو بدون أجر أو أن يؤدي أي عمل لدى أي طرف ثالث سواء كان مؤسسة أو شركة أو شخص طبيعي دون موافقة خطية مسبقة من صاحب العمل مهما كانت طبيعة هذا العمل.",
        ],
      },
    },
    {
      en: {
        label: "31/ Calendar:",
        lines: ["All dates and terms in this contract shall be in Gregorian calendar."],
      },
      ar: {
        label: "31- التقويم:",
        lines: ["إن التواريخ والمدد المذكورة في هذا العقد تكون طبقا للتقويم الميلادي."],
      },
    },
    {
      en: {
        label: "32/ Notices:",
        lines: [
          "All notices from the first party to the second party shall be in writing to be delivered by hand with an acknowledgment receipt on the notice copy or by mail to his address in the country of origin, to his Saudi address as set forth in the preamble of this contract or by announcement on the signboard of the first party at the head office. The email messaging can be used also for notice. The above methods shall be deemed correct as if delivered to the employee by hand.",
        ],
      },
      ar: {
        label: "32- الإخطارات:",
        lines: [
          "تكون الإخطارات أو التبليغات الصادرة عن الطرف الأول إلى الطرف الثاني كتابة وتسلم إلى المذكور عن طريق التسليم المباشر باليد بعد أخذ التوقيع على صورة الإخطار أو التبليغ بالاستلام أو بإرسالها له على عنوانه في بلده الأصلي أو على عنوانه في المملكة طبقا لما هو موضح في مقدمة هذا العقد أو  عن طريق الإعلان عنه في لوحة إعلانات الطرف الأول الموجودة في مقر عمله، كما يمكن الإخطار عن طريق البريد الإلكتروني و ذلك لغرض الإخطار المبكر، وتعتبر إخطاراته وتبليغاته بالطرق المذكورة صحيحة كما لو أنها سلمت للعامل شخصيا.",
        ],
      },
    },
    {
      en: {
        label: "33/ Applicable Law and Jurisdiction:",
        lines: [
          "All matters not stated in this contract shall be governed by the labour law issued by the Royal Decree No M/51 dated 23/08/1426. As amended, its implementing regulations, the implementing decrees, directives of immediate supervisor and company internal rules.",
        ],
      },
      ar: {
        label: "33- القانون الواجب التطبيق:",
        lines: [
          "يطبق في كل ما لم يرد به نص في هذا العقد نظام العمل الساري المفعول في المملكة العربية السعودية والصادر بالمرسوم الملكي رقم ( م /51 ) تاريخ 23/08/1426هـ و تعديلاته واللوائح التنظيمية و التنفيذية الداخلية في الشركة وتعليمات إدارة الطرف الأول.",
        ],
      },
    },
    {
      en: {
        label: "34/ Jurisdiction:",
        lines: [
          "Disputes that may arise between the two parties in relation to this contract and interpretation shall be settled amicably. Failing that, the dispute shall be brought to the competent labour office, labour courts and appeal court in Kingdom of Saudi Arabia. Judgments issued by such bodies shall be binding to all parties per labour law.",
        ],
      },
      ar: {
        label: "34- المحاكم المختصة:",
        lines: [
          "إن كافة المنازعات والخلافات التي قد تنشأ بين طرفي هذا العقد بخصوصه أو بخصوص تفسيره أو تنفيذه يصار الى حلها وديا بين الطرفين فإذا تعذر ذلك تكون مكاتب العمل والهيئات الابتدائية و الإستئنافية العليا لتسوية الخلافات العمالية بوزارة العمل والشئون الاجتماعية هي الجهة المختصة بنظر هذه المنازعات وتكون قراراتها ملزمة للطرفين وفقا لنظام العمل.",
        ],
      },
    },
    {
      en: {
        label: "35/ Copies of the Contract:",
        lines: [
          "This contract is made in Arabic language which shall prevail in any dispute. The English copy is merely a translation thereof.",
        ],
      },
      ar: {
        label: "35- النص المعتمد:",
        lines: [
          "النص العربي لهذا العقد هو النص الرسمي والقانوني المعتمد, ويعتبر النص الانجليزي ترجمة له فقط .",
        ],
      },
    },
    {
      en: {
        label: "36/",
        lines: [
          "Subtitles are placed to help in reaching the intended article and are not part of the contract and have nothing to do with its interpretation of it.",
        ],
      },
      ar: {
        label: "36- عناوين البنود:",
        lines: [
          "تمّ وضع عناوين لبنود هذا العقد للمساعدة في الوصول إلى البند المعني وهي لا تمثل جزءاً من البند و ليسَ لها علاقة بتفسيره.",
        ],
      },
    },
    {
      en: {
        label: "37/",
        lines: [
          "This contract is drawn up in three (3) originals. Each party received one copy to comply with it and the third copy is to be kept in the file of employee. All copies have been signed by the two parties.",
        ],
      },
      ar: {
        label: "37- نسخ العقد:",
        lines: [
          "حرر هذا العقد من 3 (ثلاث نسخ) استلم كل طرف نسخة منه وتحفظ النسخة الثالثة في ملف الطرف الثاني لدى الطرف الأول, و قد تم توقيع جميع النسخ من قبل الطرفين المعنيين وقد وافقا على كامل ما ورد بها.",
        ],
      },
    },
    {
      en: {
        label: "38/ Effective date:",
        lines: ["This contract shall come in effect as of Joining Date."],
      },
      ar: {
        label: "38-تاريخ سريان العقد:",
        lines: ["بدأ سريان هذا العقد اعتبارا من تاريخ المباشرة."],
      },
    },
    {
      en: {
        label: "39/",
        lines: [
          "This contract consists of a preamble, thirty nine (39) Articles including this article, (12) pages and (8) Annex which are considered as an integral part of this contract.",
        ],
      },
      ar: {
        label: "39- ضبط العقد:",
        lines: [
          "حرر هذا العقد من مقدمة و تسعة و ثلاثون بنداً بما فيها هذا البند ومن ثلاثة عشر (12) صفحة و (8) ملاحق تعتبر جزء لا يتجزأ من هذا العقد.",
        ],
      },
    },
  ];
}

/** Article 2 — laid out as a small table on the page, so kept apart. */
export const SALARY_TEXT = {
  en: {
    label: "2/ Salary:",
    intro:
      "The second party shall be entitled to a monthly salary payable at the end of each calendar month, according to the details below:-",
    rows: [
      ["Basic salary of SR", "basic"],
      ["Transportation allowance", "transport"],
      ["Housing allowance", "housing"],
      ["Phone Allowance:", "phone"],
      ["Food allowance", "food"],
      ["Other allowance", "other"],
      ["Actual salary :  SR", "total"],
    ] as const,
    unit: "SR",
  },
  ar: {
    label: "2-الأجـر:",
    intro:
      "يستحق الطرف الثاني لقاء قيامه بموجبات عمله راتبا شهرياً في نهاية كل شهر ميلادي وفقا للتفصيل التالي:",
    rows: [
      ["راتب أساسـي", "basic"],
      ["بدل مواصلات", "transport"],
      ["بـدل سكــن", "housing"],
      ["بدل اتصالات", "phone"],
      ["بدل طعام", "food"],
      ["بدلات أخرى", "other"],
      ["الأجر الفعلي", "total"],
    ] as const,
    unit: "ريـال",
  },
} as const;

/** The signature page after article 39. */
export function signaturePage(v: ContractValues) {
  return {
    firstParty: {
      en: ["FIRST PARTY:", `${v.company.nameEn},`, v.company.signatoryTitleEn],
      // "الرئيس" + "الشركة" reads "رئيس الشركة": the title loses its article.
      ar: ["الطرف الأول:", v.company.nameAr, `${v.company.signatoryTitleAr.replace(/^ال/, "")} الشركة`],
    },
    secondParty: {
      en: [
        "SECOND PARTY:",
        `I, the undersigned; agree to all terms and conditions stipulated in this Contract and I hereby declare that I have become fully aware of the regulations, policies and procedures of ${v.company.nameEn}. Hence I will comply with the contents thereof, and I vow to abide by all the clauses appearing thereunder, and to fully adhere to all the regulations which are or may be issued by the management in the future.`,
      ],
      ar: [
        "الطرف الثاني:",
        `أنا الموقع أدناه أوافق على جميع الشروط والأحكام المدرجة في هذا العقد، وبهذا أقر بأنني على علم تام بالأنظمة واللوائح الداخلية والسياسات والإجراءات الخاصة ب${v.company.nameAr} وأنني سألتزم بما جاء فيها، وأتعهد بجميع بنودها وألتزم بالتقيد التام بالأنظمة واللوائح السارية حاليا أو التي يمكن أن تصدر مستقبلا عن الإدارة.`,
      ],
    },
  };
}

export type Annexure = {
  number: number;
  /** Two columns, or English only across the page (annexures 7 and 8). */
  en: { title: string; subtitle?: string; lines: string[]; list?: string[]; listTitle?: string };
  ar?: { title: string; subtitle?: string; lines: string[] };
};

/** Annexures 1–8, each printed on its own page with the employee's signature block. */
export function annexures(v: ContractValues): Annexure[] {
  const e = v.employee;
  const c = v.company;
  const s = salutation(e);
  return [
    {
      number: 1,
      en: {
        title: "Annexure # (1)",
        subtitle: "This Annexure shall be an integral part of this contract",
        lines: [
          "Duties & Obligations of the second party:",
          "",
          "The Second Party shall, diligently and faithfully, implement all decisions issued by the General Manager.",
          "The second party shall perform the work by himself, according to the direction and supervision of the company and its immediate manager, and to perform the work with full care and attention, which leads to completion of the work in good manner. The second party shall implements orders and directives of the company and the internal rules which are considered as an integral part of this contract. He shall take care of all production and work tools which are under his custody.",
          "The second party shall give his time to company work with or without consideration, for third party during the term of contract.",
          "The second party shall work with the company for the duration of the contract and shall not absent himself from work in accordance with the Labor Law and the terms and conditions of this contract.",
          `Job title of the second party is: ${v.position}`,
        ],
      },
      ar: {
        title: "عقـد الملحق رقم ( 1 )",
        subtitle: "يعتبر هذا الملحق جزء لا يتجزأ من العقد",
        lines: [
          "الواجبات و الإلتزامات الوظيفية على الطرف الثاني:",
          "",
          "أن ينفذ الطرف الثاني جميع القرارات الصادرة عن المدير العام بكل عمانة و إخلاص.",
          "أن يؤدي الطرف الثاني العمل بنفسه تبعاً لتوجيه و إشراف الشركة و مديره المباشر، و أن يبذل في تأديته لعمله من العناية و الاهتمام بما يؤدي الى إتمام العمل على أكمل وجهه، و أن يتقيد بالتعليمات الخاصة بتنفيذ العمل و يتقيد بأوامر و توجيهات الشركة و الأنظمة الداخلية الخاصة بها و التي تشكل جزءاً من هذا العقد، و أن يحرص على المحافظة على جميع وسائل الإنتاج و أدوات العمل تحت تصرفه.",
          "أن يتفرغ الطرف الثاني للعمل في الشركة و عدم العمل بأجر أو بدون أجر لدى أي جهة أخرى خلال مدة العقد.",
          "أن يعمل الموظف لدى الشركة طوال مدة سريان هذا العقد و لا يجوز له الانقطاع عن العمل طبقاً لنظام العمل و ما نصت عليه بنود هذا العقد.",
          `الوصف الوظيفي لعمل الطرف الثاني في الشركة: ${v.position}`,
        ],
      },
    },
    {
      number: 2,
      en: {
        title: "Annexure # (2)",
        subtitle: "Declaration on Company (First Party) Rules & Regulations",
        lines: [
          `I, the undersigned  ${s.en} ${e.nameEn} defined in this contract as the second party, of  ${e.nationalityEn} Nationality holding ${idEn(e)}`,
          "",
          "Declare that I have fully read all rules and regulations regulating the work of the company.",
          "",
          "In witness, whereof I signed this declaration.",
        ],
      },
      ar: {
        title: "الملحق رقم ( 2 )",
        subtitle: "إقرار بالاطلاع على لوائح الشركة ( الطرف الأول )",
        lines: [
          `أقرُ أنا  ${e.nameAr}  المعرف في العقــد بالطرف الثــانـي، ${e.nationalityAr} الجنسية و${idAr(e).replace(/^يحمل/, "أحمل")}.`,
          "",
          "بأني قد اطلعت على كل اللوائح التنظيمية و التنفيذية للطرف الأول إطلاعاً نافياً أي ادعاء بجهلها، وعلى ذلك جرى التوقيع.",
        ],
      },
    },
    {
      number: 3,
      en: {
        title: "Annexure # (3)",
        subtitle: "Particulars of the second party (Employee)",
        lines: [
          `Name: ${s.en} ${e.nameEn}`,
          `Sex: ${e.female ? "Female" : "Male"}`,
          `Nationality: ${e.nationalityEn}`,
          `Passport No. :  ${e.passportNo}`,
          `Date of Birth: ${e.dateOfBirth}`,
          `Iqama No;  ${e.iqamaNo}`,
          `Address in Home country : ${e.homeAddressEn}`,
          `Address in Saudi Arabia: ${e.saudiAddressEn}`,
          `No Tel / Mob in Home country: ${e.homePhone}`,
        ],
      },
      ar: {
        title: "هذا الملحق رقم ( 3 )",
        subtitle: "بيانات الطرف الثاني ( الموظف )",
        lines: [
          `الإسم:  ${e.nameAr}`,
          `الجنس:   ${e.female ? "أنثى" : "ذكر"}`,
          `الجنسية:  ${e.nationalityAr}`,
          `رقم جواز السفر: ${e.passportNo}`,
          `تاريخ الميلاد : ${e.dateOfBirth}`,
          `رقم الاقامة : ${e.iqamaNo}`,
          `العنوان في البلد الأصلي: ${e.homeAddressAr}`,
          `العنوان في المملكة العربية السعودية: ${e.saudiAddressAr}`,
          `رقم التلفون / موبايل في البلد الأصلي: ${e.homePhone}`,
        ],
      },
    },
    {
      number: 4,
      en: {
        title: "Annexure # (4)",
        subtitle: "Undertaking of correct Information",
        lines: [
          `I, the undersigned   ${s.en} ${e.nameEn}  of ${e.nationalityEn} nationality holding passport No  ${e.passportNo}${e.iqamaNo ? ` and Iqama No ${e.iqamaNo}` : ""} declare that the information, documents and certificate provided are correct and this declaration shall be an integral part of the contract.`,
        ],
      },
      ar: {
        title: "الملحق رقم ( 4 )",
        subtitle: "تعهد بصحة البيانات",
        lines: [
          `تعهد أنا ${e.nameAr} الجنسية ${e.nationalityAr},  جواز سفر رقم  ${e.passportNo}${e.iqamaNo ? `، اقامه رقم ${e.iqamaNo}` : ""}.بأن كل البيانات والمعلومات والوثائق والشهادات التي قدمتها صحيحة، ويعتبر هذا التعهد جزء لا يتجزأ من العقد.`,
        ],
      },
    },
    {
      number: 5,
      en: {
        title: "Annexure # (5)",
        subtitle: "Confidentiality Undertaking",
        lines: [
          `I, the undersigned ${s.en} ${e.nameEn} of ${e.nationalityEn} nationality holding passport No – ${e.passportNo}${e.iqamaNo ? ` Iqama No ${e.iqamaNo}` : ""} declare that I am working at ${c.nameEn}, CR No ${c.crNumber} with address at head office in the city of ${c.headOfficeCityEn} and address at :`,
          c.addressEn,
          "By virtue of my job, I will have access to many confidential, organizational, technical and contractual information, whether it be financial, technical, technological, commercial, industrial, drawings or other information of the Company or other entities dealing with by the Company whether orally or in writing or any other information relating to the Company's employees or research, programs, plans, strategies, procedures, suppliers and customers,",
          "I shall be, definitively and categorically, liable under the law to maintain the confidentiality of all information relating to the first party and in case of violation of this I pledge to maintain confidentiality and not to disclose any of such information to the company without the prior written consent of the Company,",
          "I shall be responsible for all damages and losses incurred by the First Party as a result of disclosing the above, including compensation, profits, court expenses, attorney's fees, expenses and expenses",
        ],
      },
      ar: {
        title: "الملحق رقم ( 5 )",
        subtitle: "التعهد بالمحافظة على السرية",
        lines: [
          `أتعهد انا ${s.ar} / ${e.nameAr}، ${e.nationalityAr} الجنسية، ${e.iqamaNo ? `إقامة نظامية رقم ${e.iqamaNo}، ` : ""}وجواز سفر رقم ${e.passportNo}.حيثُ أنني أعمل لدي ${c.nameAr} سجل تجاري رقم (${c.crNumber}) و مقرها ${c.headOfficeCityAr} وبحكم وظيفتي سأطلع على العديد من المعلومات السرية و التنظيمية و الفنية و التعاقدية و سواء كانت تلك المعلومات معلومات مالية أو تقنية أ فنية أو تجارية أو صناعية أو رسومات  و غيرها سواء الخاصة بالشركة  أو بأطراف أخرى تتعامل معها الشركة سواء كانت شفهية أو كتابةً، أو أي معلومات أخرى على اختلافها تتعلق بموظفي الشركة أو أجهزتها أو أبحاثها أو برامجها و خططها و استراتيجيتها و اجراءاتها و موردينها و عملائها  فإنني أتعهد بشكل نهائي و قطعي و تحت طائلة المسؤولية بالمحافظة على سرية كل المعلومات التي تخص الطرف الأول، وفي حال مخالفتي للتعهد بالمحافظة على السرية بإفشاء أي من المعلومات الخاصة بالشركة بدون الحصول على موافقة الشركة المسبقة كتابةً فإني أكون مسؤولاً تجاه الشركة عن كافة الأضرار و الخسائر التي تكبدها الطرف الأول نتيجة ذلك، بما في ذلك كافة التعويضات و الأرباح الضائعة و مصاريف المحاكم و أتعاب المحامين من النفقات و المصاريف.`,
        ],
      },
    },
    {
      number: 6,
      en: {
        title: "Annexure # (6)",
        subtitle: "Undertaking not to work with competitors",
        lines: [
          "The Second Party undertakes that, in the event of termination of his employment with the First Party for any reason, shall not work for any competing company direct or no direct to the first party for two years from the date of termination of its work with the First Party whether in Saudi Arabia, the GCC, Jordan, Lebanon or Syria.",
          "This Annex shall be an integral part of the contract. Anything that is not provided for in this contract, in this regard, shall be governed by the Manpower Movement Regulations issued by the Council of Ministers Decree No. 826 dated 15/07/1395.",
          "If the employee violated the regulations banning that in Saudi or the other countries, he shall pay an indemnity to the second party at the rate of eight months’ salary calculated on the basis of the actual remuneration he was paid in addition to any rights stipulated in the law for the first party.",
        ],
      },
      ar: {
        title: "ملحق رقم ( 6 )",
        subtitle: "التعهد بعدم العمل لدى المنافسين",
        lines: [
          "التزم الطرف الثاني في حال انتهاءه من العمل لدى الطرف الأول لأي سبب كان بأن لا يعمل لدى أي من المنافسين المباشرين للطرف الأول بشكل مباشر أو غير مباشر لمدة عامين من تاريخ انتهاء عمله سواء كان في السعودية، دول مجلس التعاون الخليجي، الاردن ، لبنان، أو سوريا، و يعتبر هذا الملحق جزء لا يتجزأ من هذا العقد، ويطبق في هذا الخصوص في كل مالم يرد به نص في هذا العقد نظام تنفيذ حركة انتقال الأيدي العاملة الصادر بقرار من مجلس الوزراء رقم 826 تاريخ 15/7/1395هـ الساري المفعول، وإذا خالف العامل الحظر المذكور في المملكة وباقي الدول الأخرى المذكورة في هذا الملحق يلتزم مجبراً بدفع تعويضا اتفاقياً إلى الطرف الثاني مقداره 8 (ثمانية) رواتب تحتسب على أساس الراتب الأساسي الذي كان يتقاضاه بالإضافة إلى أي حقوق قد يرتبها النظام أو القانون للطرف الأول.",
        ],
      },
    },
    {
      number: 7,
      en: {
        title: "Annexure # (7)",
        subtitle: "Undertaking",
        lines: [],
        listTitle: v.annex7.title,
        list: v.annex7.items,
      },
    },
    {
      number: 8,
      en: {
        title: "Annexure # (8)",
        subtitle: "Undertaking",
        lines: [],
        list: [
          `This contract should be for a duration of ${annex8Term(v.termYears)}. During this period, the employee is not permitted to transfer his iqama or leave the company.`,
          "There will be a 6 month’s probation period. During this probationary period, the employee will be responsible for all expenses, including salaries, sponsorship transfers, iqama renewals, printing business cards, medical insurance and must reimburse to the company for these expenses if the employee leaves the company.",
        ],
      },
    },
  ];
}

/** Nationality as the contract writes it, from the employee's two-letter code. */
export const NATIONALITIES: Record<string, { en: string; ar: string }> = {
  SA: { en: "Saudi", ar: "السعودية" },
  JO: { en: "Jordanian", ar: "الاردن" },
  EG: { en: "Egyptian", ar: "مصر" },
  SY: { en: "Syrian", ar: "سوريا" },
  LB: { en: "Lebanese", ar: "لبنان" },
  PS: { en: "Palestinian", ar: "فلسطين" },
  YE: { en: "Yemeni", ar: "اليمن" },
  SD: { en: "Sudanese", ar: "السودان" },
  IN: { en: "Indian", ar: "الهند" },
  PK: { en: "Pakistani", ar: "باكستان" },
  BD: { en: "Bangladeshi", ar: "بنغلاديش" },
  NP: { en: "Nepalese", ar: "نيبال" },
  LK: { en: "Sri Lankan", ar: "سريلانكا" },
  PH: { en: "Filipino", ar: "الفلبين" },
  TR: { en: "Turkish", ar: "تركيا" },
  MA: { en: "Moroccan", ar: "المغرب" },
  TN: { en: "Tunisian", ar: "تونس" },
  IQ: { en: "Iraqi", ar: "العراق" },
};
