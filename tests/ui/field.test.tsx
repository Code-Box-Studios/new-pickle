// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Field, Input } from "@/components/ui/input";

describe("Field accessibility", () => {
  it("connects helper text to its labeled control", () => {
    render(
      <Field label="Mobile number" htmlFor="mobile" hint="The venue may contact you here.">
        <Input id="mobile" />
      </Field>,
    );
    expect(screen.getByLabelText("Mobile number")).toHaveAccessibleDescription(
      "The venue may contact you here.",
    );
  });

  it("marks an invalid control and preserves existing descriptions", () => {
    render(
      <>
        <p id="email-help">Use the email for your booking.</p>
        <Field label="Email" htmlFor="email" error="Enter a valid email address.">
          <Input id="email" aria-describedby="email-help" />
        </Field>
      </>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "Use the email for your booking. Enter a valid email address.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
  });
});
