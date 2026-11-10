import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Button } from "./Button";
import { Field, Input } from "./Field";
import { cn } from "@/lib/utils";

afterEach(cleanup);

describe("Field", () => {
  it("shows helper text, and the error replaces it in the same slot", () => {
    const { rerender } = render(
      <Field label="Phone" helper="10 digits">
        {(p) => <Input {...p} />}
      </Field>,
    );
    expect(screen.getByText("10 digits")).toBeTruthy();
    expect(screen.getByLabelText("Phone").getAttribute("aria-invalid")).toBeNull();

    rerender(
      <Field label="Phone" helper="10 digits" error="Enter a 10-digit mobile number">
        {(p) => <Input {...p} />}
      </Field>,
    );
    expect(screen.queryByText("10 digits")).toBeNull();
    const input = screen.getByLabelText("Phone");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Enter a 10-digit mobile number",
    );
  });
});

describe("Button", () => {
  it("is disabled and busy while loading, showing the loading text", () => {
    render(
      <Button loading loadingText="Saving…">
        Save
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.textContent).toBe("Saving…");
  });
});

describe("cn", () => {
  it("lets overrides win over base classes, and keeps size and colour separate", () => {
    expect(cn("w-full text-body text-ink", "w-52")).toBe("text-body text-ink w-52");
    expect(cn("text-body", "text-helper")).toBe("text-helper");
  });
});
