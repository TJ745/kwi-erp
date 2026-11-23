/**
 * The bilingual warning letter: the fixed wording of the company's standard
 * letter in English and Arabic, and the ready-made reasons that fill its one
 * variable sentence.
 *
 * Only the incident sentence changes between letters. Everything else is
 * fixed text here, so it never needs translating.
 */

export type WarningReason = {
  key: string;
  /** Short English label: the reason shown in lists and reports. */
  label: string;
  en: string;
  ar: string;
};

/** "Other" is not in this list: its sentence is typed by hand in both languages. */
export const WARNING_REASONS: readonly WarningReason[] = [
  {
    key: "ABSENT_FROM_SITE",
    label: "Absent from job site without informing manager",
    en: "It has come to our attention that you are absent from job site without informing your direct manager, which affects the work and gives a bad impression to our client.",
    ar: "لقد علمنا أنك غائب عن موقع العمل دون إبلاغ مديرك المباشر، مما يؤثر على العمل ويعطي انطباعًا سيئًا لعميلنا.",
  },
  {
    key: "ABSENT_WITHOUT_LEAVE",
    label: "Absent from work without approved leave",
    en: "It has come to our attention that you were absent from work without approved leave or prior notice to your direct manager.",
    ar: "لقد علمنا أنك تغيبت عن العمل دون إجازة معتمدة أو إشعار مسبق لمديرك المباشر.",
  },
  {
    key: "LATE_ARRIVAL",
    label: "Repeated late arrival",
    en: "It has come to our attention that you have repeatedly arrived late to work without an acceptable reason, which affects the work of your team.",
    ar: "لقد علمنا أنك تتأخر بشكل متكرر عن الحضور إلى العمل دون عذر مقبول، مما يؤثر على عمل فريقك.",
  },
  {
    key: "LEAVING_EARLY",
    label: "Leaving work early without permission",
    en: "It has come to our attention that you left work before the end of working hours without permission from your direct manager.",
    ar: "لقد علمنا أنك غادرت العمل قبل نهاية ساعات العمل دون إذن من مديرك المباشر.",
  },
  {
    key: "INSUBORDINATION",
    label: "Refusing manager's instructions",
    en: "It has come to our attention that you refused to follow the instructions of your direct manager.",
    ar: "لقد علمنا أنك رفضت اتباع تعليمات مديرك المباشر.",
  },
  {
    key: "MISCONDUCT",
    label: "Inappropriate behaviour at work",
    en: "It has come to our attention that you behaved inappropriately towards your colleagues at the workplace, which is against company rules.",
    ar: "لقد علمنا أنك تصرفت بشكل غير لائق تجاه زملائك في مكان العمل، وهو ما يخالف أنظمة الشركة.",
  },
  {
    key: "SAFETY",
    label: "Not following safety rules",
    en: "It has come to our attention that you did not follow the safety rules at the work site, including the use of the required personal protective equipment.",
    ar: "لقد علمنا أنك لم تلتزم بقواعد السلامة في موقع العمل، بما في ذلك استخدام معدات الحماية الشخصية المطلوبة.",
  },
  {
    key: "NEGLIGENCE",
    label: "Negligence in duties",
    en: "It has come to our attention that you are not performing your assigned duties with the required care and attention, which affects the quality of the work.",
    ar: "لقد علمنا أنك لا تؤدي المهام الموكلة إليك بالعناية والاهتمام المطلوبين، مما يؤثر على جودة العمل.",
  },
];

export const OTHER_REASON = "OTHER";

/** The preset whose wording a saved letter still matches, if any. */
export function matchReason(reason: string, en: string): WarningReason | undefined {
  return WARNING_REASONS.find((r) => r.label === reason && r.en === en);
}

/** The fixed text of the letter, in both languages. */
export const LETTER_TEXT = {
  en: {
    date: "Date:",
    to: "To,",
    position: "Position:",
    subjectLabel: "Subject:",
    subject: "Warning letter.",
    dear: (name: string, female: boolean) => `Dear ${female ? "Ms." : "Mr."} ${name},`,
    opener:
      "This is to address a serious concern regarding your recent behavior during working hours.",
    formal:
      "Effective immediately, this serves as a formal warning to improve your behavior. We expect all employees to fulfill their duties diligently and maintain an appropriate level of alertness and productivity during working hours. Failure to comply with these expectations may result in further disciplinary action, up to and including termination of employment.",
    encourage:
      "I encourage you to take this warning seriously and to use it as an opportunity to reflect on your conduct.",
    regards: "Regards,",
    hr: "HR",
    signature: "Employee Signature:",
  },
  ar: {
    date: "التاريخ:",
    to: "الى،",
    position: "الوظيفة:",
    subjectLabel: "الموضوع:",
    subject: "خطاب إنذار",
    dear: (name: string, female: boolean) =>
      female ? `عزيزتي السيدة / ${name} ،` : `عزيزي السيد / ${name} ،`,
    opener: "هذا لمعالجة مخاوف جدية بشأن سلوكك الأخير أثناء ساعات العمل.",
    formal:
      "يسري هذا الإجراء على الفور، ويكون بمثابة تحذير رسمي لتحسين سلوكك. نتوقع من جميع الموظفين أداء واجباتهم بجد والحفاظ على مستوى مناسب من اليقظة والإنتاجية خلال ساعات العمل. قد يؤدي عدم الامتثال لهذه التوقعات إلى اتخاذ المزيد من الإجراءات التأديبية، بما في ذلك إنهاء التوظيف.",
    encourage: "أنا أشجعك على أخذ هذا التحذير على محمل الجد واستخدامه كفرصة للتفكير في سلوكك.",
    regards: "تحية،",
    hr: "الموارد البشرية",
    signature: "توقيع الموظف:",
  },
} as const;
