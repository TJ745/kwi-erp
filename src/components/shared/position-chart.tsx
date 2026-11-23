import { companyColour, TITLE_COLOUR, VACANT_COLOUR, type ChartNode } from "@/lib/position-chart";

/**
 * Draws the organization chart as nested boxes joined by lines: the green box
 * is the position, the coloured boxes under it its people (by company), or
 * "Vacant". Pure markup, so it renders on the server and prints as it shows.
 */
export function PositionChart({
  tree,
  codes,
}: {
  tree: ChartNode[];
  /** Every company code on the chart, for stable colours. */
  codes: string[];
}) {
  return (
    <div className="pchart">
      {tree.map((root) => (
        <ul key={root.id}>
          <Node node={root} codes={codes} />
        </ul>
      ))}
    </div>
  );
}

function Node({ node, codes }: { node: ChartNode; codes: string[] }) {
  return (
    <li>
      <div className="pchart-box">
        <div className="pchart-title" style={{ background: TITLE_COLOUR }}>
          {node.title}
        </div>
        {node.counts
          ? node.counts.map((c) => (
              <div
                key={c.label}
                className="pchart-person"
                style={{ background: companyColour(c.companyCode, codes) }}
              >
                {c.count} {c.label}
              </div>
            ))
          : node.people.map((p, i) => (
              <div
                key={`${p.name}-${String(i)}`}
                className="pchart-person"
                style={{ background: companyColour(p.companyCode, codes) }}
              >
                {p.name} ({p.companyCode})
              </div>
            ))}
        {node.vacant ? (
          <div className="pchart-person" style={{ background: VACANT_COLOUR }}>
            Vacant
          </div>
        ) : null}
      </div>
      {node.children.length > 0 ? (
        // Four or more end-of-line positions stack in a column, as on the
        // paper chart, rather than stretching the chart sideways.
        <ul
          className={
            node.children.length >= 4 && node.children.every((c) => c.children.length === 0)
              ? "pchart-stack"
              : undefined
          }
        >
          {node.children.map((c) => (
            <Node key={c.id} node={c} codes={codes} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** The KWI / ICC / Total box in the corner of the paper chart. */
export function ChartTotals({
  totals,
  total,
  codes,
}: {
  totals: { code: string; count: number }[];
  total: number;
  codes: string[];
}) {
  return (
    <table className="border-collapse text-[11px]">
      <tbody>
        {totals.map((t) => (
          <tr key={t.code}>
            <td
              className="w-28 border border-black px-1.5 py-0.5"
              style={{ background: companyColour(t.code, codes) }}
            >
              {t.code}
            </td>
            <td
              className="w-12 border border-black px-1.5 py-0.5 text-right"
              style={{ background: companyColour(t.code, codes) }}
            >
              {t.count}
            </td>
          </tr>
        ))}
        <tr>
          <td className="border border-black px-1.5 py-0.5">Total Employees</td>
          <td className="border border-black px-1.5 py-0.5 text-right">{total}</td>
        </tr>
      </tbody>
    </table>
  );
}
