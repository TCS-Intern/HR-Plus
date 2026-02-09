import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Stat } from "@/components/ui/stat";

describe("Stat", () => {
  const defaultProps = {
    label: "Active Jobs",
    value: 12,
    icon: <span data-testid="icon">icon</span>,
  };

  it("renders label and value", () => {
    render(<Stat {...defaultProps} />);
    expect(screen.getByText("Active Jobs")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders the icon", () => {
    render(<Stat {...defaultProps} />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders a string value", () => {
    render(<Stat {...defaultProps} value="$120K" />);
    expect(screen.getByText("$120K")).toBeInTheDocument();
  });

  it("applies custom bgColor", () => {
    const { container } = render(<Stat {...defaultProps} bgColor="bg-blue-50" />);
    const stat = container.firstChild as HTMLElement;
    expect(stat).toHaveClass("bg-blue-50");
  });

  it("wraps in a Link when href is provided", () => {
    const { container } = render(<Stat {...defaultProps} href="/jobs" />);
    const link = container.querySelector("a");
    expect(link).toHaveAttribute("href", "/jobs");
  });

  it("does not render a Link when no href", () => {
    const { container } = render(<Stat {...defaultProps} />);
    const link = container.querySelector("a");
    expect(link).toBeNull();
  });
});
