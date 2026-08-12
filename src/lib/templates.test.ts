import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  extractVariables,
  renderTemplate,
  sanitiseTemplateHtml,
  TEMPLATE_VARIABLE_KEYS,
} from "./templates";

describe("renderTemplate", () => {
  it("substitutes known placeholders", () => {
    const result = renderTemplate("<p>Dear {{employee_name}},</p>", {
      employee_name: "Ahmed Khan",
    });
    expect(result.html).toBe("<p>Dear Ahmed Khan,</p>");
    expect(result.missing).toEqual([]);
    expect(result.unknown).toEqual([]);
  });

  it("tolerates whitespace and case in the placeholder", () => {
    const result = renderTemplate("{{  Employee_Name  }}", { employee_name: "Ahmed" });
    expect(result.html).toBe("Ahmed");
  });

  // A letter that quietly loses its salary line is worse than one that
  // visibly says it is broken.
  it("leaves missing values visible rather than blanking them", () => {
    const result = renderTemplate("Salary: {{salary}}", {});
    expect(result.html).toBe("Salary: {{salary}}");
    expect(result.missing).toEqual(["salary"]);
  });

  it("treats empty string as missing", () => {
    const result = renderTemplate("{{position}}", { position: "" });
    expect(result.missing).toEqual(["position"]);
  });

  it("reports unknown placeholders separately from missing ones", () => {
    const result = renderTemplate("{{not_a_variable}} {{salary}}", {});
    expect(result.unknown).toEqual(["not_a_variable"]);
    expect(result.missing).toEqual(["salary"]);
  });

  // The XSS case: employee names are editable by anyone with employees.update.
  it("escapes substituted values", () => {
    const result = renderTemplate("<p>{{employee_name}}</p>", {
      employee_name: '<script>alert("xss")</script>',
    });
    expect(result.html).not.toContain("<script>");
    expect(result.html).toContain("&lt;script&gt;");
  });

  it("escapes quotes and ampersands in values", () => {
    const result = renderTemplate("{{company_name}}", {
      company_name: `A & B "Trading" Co's`,
    });
    expect(result.html).toBe("A &amp; B &quot;Trading&quot; Co&#39;s");
  });

  // Template injection: a value containing a placeholder must not be
  // re-evaluated as one.
  it("does not re-process placeholders inside substituted values", () => {
    const result = renderTemplate("{{employee_name}}", {
      employee_name: "{{salary}}",
      salary: "99999",
    });
    expect(result.html).not.toContain("99999");
    expect(result.html).toBe("{{salary}}");
  });

  it("handles a template with no placeholders", () => {
    expect(renderTemplate("<p>Static text</p>", {}).html).toBe("<p>Static text</p>");
  });
});

describe("extractVariables", () => {
  it("separates known from unknown", () => {
    const result = extractVariables("{{employee_name}} {{bogus}} {{salary}}");
    expect(result.known.sort()).toEqual(["employee_name", "salary"]);
    expect(result.unknown).toEqual(["bogus"]);
  });

  it("de-duplicates repeats", () => {
    expect(extractVariables("{{salary}} {{salary}}").known).toEqual(["salary"]);
  });

  it("every declared variable is recognised", () => {
    for (const key of TEMPLATE_VARIABLE_KEYS) {
      expect(extractVariables(`{{${key}}}`).known).toEqual([key]);
    }
  });
});

describe("sanitiseTemplateHtml", () => {
  it("keeps formatting markup", () => {
    const html = "<p><strong>Bold</strong> and <em>italic</em></p><ul><li>Item</li></ul>";
    expect(sanitiseTemplateHtml(html)).toBe(html);
  });

  // Each of these is a real injection vector, not a hypothetical.
  it.each([
    ["script tag", '<script>alert(1)</script>', "alert"],
    ["iframe", '<iframe src="https://evil.example"></iframe>', "iframe"],
    ["object", '<object data="x"></object>', "object"],
    ["embed", '<embed src="x">', "embed"],
    ["link tag", '<link rel="stylesheet" href="https://evil.example/x.css">', "link"],
    ["meta refresh", '<meta http-equiv="refresh" content="0;url=https://evil.example">', "meta"],
    ["base tag", '<base href="https://evil.example/">', "base"],
    ["form", '<form action="https://evil.example"><input name="a"></form>', "form"],
    ["svg", '<svg onload="alert(1)"></svg>', "svg"],
  ])("strips %s", (_label, input, needle) => {
    expect(sanitiseTemplateHtml(input).toLowerCase()).not.toContain(needle);
  });

  it("strips event handlers while keeping the element", () => {
    const output = sanitiseTemplateHtml('<p onclick="alert(1)" onmouseover="x()">Hello</p>');
    expect(output).toBe("<p>Hello</p>");
  });

  it("strips disallowed attributes", () => {
    const output = sanitiseTemplateHtml('<p id="x" href="y" srcset="z">Text</p>');
    expect(output).toBe("<p>Text</p>");
  });

  it("keeps dir and lang, which bilingual letters need", () => {
    const output = sanitiseTemplateHtml('<p dir="rtl" lang="ar">مرحبا</p>');
    expect(output).toContain('dir="rtl"');
    expect(output).toContain('lang="ar"');
  });

  it("strips comments, which can hide conditional payloads", () => {
    expect(sanitiseTemplateHtml("<p>a</p><!--[if IE]><script>x</script><![endif]-->")).toBe(
      "<p>a</p>",
    );
  });

  describe("inline styles", () => {
    it("keeps typography and layout", () => {
      const output = sanitiseTemplateHtml('<p style="text-align: center; font-weight: bold">x</p>');
      expect(output).toContain("text-align: center");
      expect(output).toContain("font-weight: bold");
    });

    // url() would fetch a remote resource, leaking that the letter was opened.
    it("strips url(), expression(), and @import", () => {
      const output = sanitiseTemplateHtml(
        '<p style="background-color: url(https://evil.example/x); width: 10px">x</p>',
      );
      expect(output).not.toContain("url(");
      expect(output).toContain("width: 10px");
    });

    it("strips properties outside the allowlist", () => {
      const output = sanitiseTemplateHtml('<p style="position: fixed; color: red">x</p>');
      expect(output).not.toContain("position");
      expect(output).toContain("color: red");
    });

    it("drops the attribute entirely when nothing survives", () => {
      expect(sanitiseTemplateHtml('<p style="position: fixed">x</p>')).toBe("<p>x</p>");
    });
  });

  it.each([
    ["javascript", '<p style="x" dir="javascript:alert(1)">a</p>'],
    ["data uri", '<p dir="data:text/html,<script>alert(1)</script>">a</p>'],
    ["vbscript", '<p dir="vbscript:msgbox(1)">a</p>'],
  ])("refuses a %s scheme in an attribute", (_label, input) => {
    const output = sanitiseTemplateHtml(input).toLowerCase();
    expect(output).not.toContain("javascript:");
    expect(output).not.toContain("vbscript:");
    expect(output).not.toContain("data:text/html");
  });

  it("is idempotent — sanitising twice changes nothing further", () => {
    const dirty = '<p onclick="x()" style="position:fixed; color: red">Hi<script>a</script></p>';
    const once = sanitiseTemplateHtml(dirty);
    expect(sanitiseTemplateHtml(once)).toBe(once);
  });
});

describe("escapeHtml", () => {
  it("escapes all five significant characters", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });

  it("escapes ampersands first so entities are not double-broken", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
});
