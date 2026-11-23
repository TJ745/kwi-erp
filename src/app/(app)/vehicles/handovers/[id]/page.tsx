import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormSheet } from "@/components/shared/form-sheet";
import { AppError } from "@/lib/result";
import { ordinalParts } from "@/lib/recruitment-forms";
import { vehicleKind } from "@/lib/vehicle-maintenance";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getHandoverForPrint } from "@/server/services/fleet";

export const metadata: Metadata = { title: "Vehicle handover" };

/** The fixed first note of every handover letter. */
const VIOLATION_NOTE =
  "If there is any violation on this vehicle after the handover date, it will go on the person who is taken responsibility for this vehicle.";

const dmy = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCFullYear())}`;

/** Lines typed into a Json `{ items }` text field, one note each. */
function lines(value: unknown): string[] {
  const items = value && typeof value === "object" && "items" in value ? value.items : null;
  const text = typeof items === "string" ? items : "";
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

type Person = {
  fullName: string;
  gender: string;
  iqama: { iqamaNumber: string } | null;
} | null;

/** Vehicle handover letter, as the company writes it. */
export default async function HandoverPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission("vehicles.view");
  const { id } = await params;
  const h = await getHandoverForPrint(ctx, id).catch((error: unknown) => {
    if (error instanceof AppError) notFound();
    throw error;
  });
  const { vehicle } = h;
  const kind = (h.vehicleLabel ?? vehicleKind(vehicle.model)).trim() || "vehicle";
  const Kind = kind.charAt(0).toUpperCase() + kind.slice(1);
  // A vehicle from or back to the pool is handed over by, or to, the company.
  const named = (p: Person) =>
    p ? `${p.gender === "FEMALE" ? "Ms." : "Mr."} ${p.fullName}` : vehicle.company.name;
  const from = named(h.fromEmployee);
  const to = named(h.toEmployee);
  const day = ordinalParts(h.handoverDate);
  const notes = [
    VIOLATION_NOTE,
    ...lines(h.damages),
    ...(h.remarks
      ? h.remarks
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
      : []),
    ...lines(h.accessories).map((a) => `Accessories handed over: ${a}`),
  ];

  return (
    <FormSheet
      backHref={`/vehicles/${vehicle.id}`}
      backLabel="Back to vehicle"
      title={`Handover — ${vehicle.plateNumber}`}
      subtitle={`${from} → ${to}`}
      company={vehicle.company}
      className="handover-letter text-[14.5px] leading-snug"
    >
      <div className="space-y-5 px-[8%] pt-8 font-bold underline">
        <p>From: {from}</p>
        <p>To: {to}</p>
        <p>Date: {dmy(h.handoverDate)}</p>
        <p>Subject: Hand Over of Company {Kind}</p>
      </div>

      <p className="mt-12 px-[8%]">
        I, <strong>{from}</strong> have handed over the company {kind} to <strong>{to}</strong> on{" "}
        {day.day}
        <sup>{day.suffix}</sup> {day.rest} with the following details below:
      </p>

      <table className="mx-[10%] mt-7 w-[80%] border-collapse text-[13.5px]">
        <tbody>
          {(
            [
              ["Make:", vehicle.make],
              ["Model:", vehicle.model],
              ["Year:", String(vehicle.year)],
              ["Plate Number:", vehicle.plateNumber],
              ["ODO Reading:", h.mileage !== null ? String(h.mileage) : ""],
            ] as const
          ).map(([label, value]) => (
            <tr key={label}>
              <td className="w-[25%] border border-black px-1.5 py-0.5">{label}</td>
              <td className="border border-black px-1.5 py-0.5">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-7 px-[10%] text-[13.5px]">
        <p className="font-bold underline">Notes:</p>
        <ol className="mt-4 list-decimal space-y-0.5 pl-6">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ol>
      </div>

      <div className="mt-20 grid grid-cols-2 gap-8 px-[8%] text-center text-[16px]">
        <Signatory
          title="Hand Over From,"
          person={h.fromEmployee}
          fallback={vehicle.company.name}
        />
        <Signatory title="Hand Over To," person={h.toEmployee} fallback={vehicle.company.name} />
      </div>
    </FormSheet>
  );
}

function Signatory({
  title,
  person,
  fallback,
}: {
  title: string;
  person: Person;
  fallback: string;
}) {
  return (
    <div>
      <p className="font-bold">{title}</p>
      <p>{person?.fullName ?? fallback}</p>
      {person?.iqama ? <p className="mt-6">Iqama: {person.iqama.iqamaNumber}</p> : null}
    </div>
  );
}
