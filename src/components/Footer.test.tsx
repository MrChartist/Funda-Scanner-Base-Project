import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./Footer";

describe("Footer", () => {
  it("shows the investment disclaimer and a safe external link", () => {
    render(<Footer />);
    expect(screen.getByText(/nothing here is investment advice/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /source on github/i });
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });
});
