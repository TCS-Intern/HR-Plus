/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MatchScoreDisplay from "@/components/screening/MatchScoreDisplay";

describe("MatchScoreDisplay", () => {
  describe("Rendering", () => {
    it("renders all breakdown categories with correct labels", () => {
      const breakdown = {
        skills_match: 90,
        experience_match: 85,
        education_match: 80,
        culture_fit: 75,
      };

      render(<MatchScoreDisplay breakdown={breakdown} />);

      expect(screen.getByText("Skills Match")).toBeInTheDocument();
      expect(screen.getByText("Experience")).toBeInTheDocument();
      expect(screen.getByText("Education")).toBeInTheDocument();
      expect(screen.getByText("Culture Fit")).toBeInTheDocument();
    });

    it("displays correct percentage values", () => {
      const breakdown = {
        skills_match: 90,
        experience_match: 85,
        education_match: 80,
        culture_fit: 75,
      };

      render(<MatchScoreDisplay breakdown={breakdown} />);

      expect(screen.getByText("90%")).toBeInTheDocument();
      expect(screen.getByText("85%")).toBeInTheDocument();
      expect(screen.getByText("80%")).toBeInTheDocument();
      expect(screen.getByText("75%")).toBeInTheDocument();
    });

    it("shows overall match score", () => {
      const breakdown = {
        skills_match: 90,
        experience_match: 80,
      };

      render(<MatchScoreDisplay breakdown={breakdown} />);

      expect(screen.getByText("Overall Match")).toBeInTheDocument();
      // Overall should be (90 + 80) / 2 = 85
      expect(screen.getByText("85%")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles zero values", () => {
      const breakdown = {
        skills_match: 0,
        experience_match: 0,
      };

      render(<MatchScoreDisplay breakdown={breakdown} />);

      const zeroPercentages = screen.getAllByText("0%");
      expect(zeroPercentages.length).toBeGreaterThanOrEqual(2);
    });

    it("handles 100% values", () => {
      const breakdown = {
        skills_match: 100,
        experience_match: 100,
      };

      render(<MatchScoreDisplay breakdown={breakdown} />);

      const fullPercentages = screen.getAllByText("100%");
      expect(fullPercentages.length).toBeGreaterThanOrEqual(2);
    });

    it("handles single category breakdown", () => {
      const breakdown = {
        skills_match: 90,
      };

      render(<MatchScoreDisplay breakdown={breakdown} />);

      expect(screen.getByText("Skills Match")).toBeInTheDocument();
      // Both the category and overall should show 90%
      const ninetyPercents = screen.getAllByText("90%");
      expect(ninetyPercents.length).toBe(2);
    });

    it("filters out undefined values", () => {
      const breakdown = {
        skills_match: undefined as unknown as number,
        experience_match: 85,
      };

      render(<MatchScoreDisplay breakdown={breakdown} />);

      // Should render without the undefined value
      expect(screen.queryByText("Skills Match")).not.toBeInTheDocument();
      expect(screen.getByText("Experience")).toBeInTheDocument();
    });

    it("shows empty message when no valid breakdown data", () => {
      const breakdown = {};

      render(<MatchScoreDisplay breakdown={breakdown} />);

      expect(screen.getByText("No breakdown available")).toBeInTheDocument();
    });

    it("ignores unknown category keys", () => {
      const breakdown = {
        skills_match: 90,
        unknown_category: 50,
      } as any;

      render(<MatchScoreDisplay breakdown={breakdown} />);

      // Should render skills_match but not unknown_category
      expect(screen.getByText("Skills Match")).toBeInTheDocument();
    });
  });

  describe("Visual Representation", () => {
    it("renders progress bars for each category", () => {
      const breakdown = {
        skills_match: 90,
        experience_match: 85,
      };

      const { container } = render(<MatchScoreDisplay breakdown={breakdown} />);

      // Look for progress bar elements (inner divs with percentage width)
      const progressBars = container.querySelectorAll('[style*="width"]');
      expect(progressBars.length).toBe(2);
    });

    it("applies green color for high scores (>= 80)", () => {
      const breakdown = {
        skills_match: 85,
      };

      const { container } = render(<MatchScoreDisplay breakdown={breakdown} />);

      // Check for green class
      const greenBar = container.querySelector('[class*="bg-green"]');
      expect(greenBar).toBeInTheDocument();
    });

    it("applies amber color for medium scores (60-79)", () => {
      const breakdown = {
        skills_match: 65,
      };

      const { container } = render(<MatchScoreDisplay breakdown={breakdown} />);

      // Check for amber class
      const amberBar = container.querySelector('[class*="bg-amber"]');
      expect(amberBar).toBeInTheDocument();
    });

    it("applies red color for low scores (< 60)", () => {
      const breakdown = {
        skills_match: 45,
      };

      const { container } = render(<MatchScoreDisplay breakdown={breakdown} />);

      // Check for red class
      const redBar = container.querySelector('[class*="bg-red"]');
      expect(redBar).toBeInTheDocument();
    });
  });

  describe("Overall Score Calculation", () => {
    it("calculates correct average for multiple categories", () => {
      const breakdown = {
        skills_match: 100,
        experience_match: 80,
        education_match: 60,
        culture_fit: 40,
      };

      render(<MatchScoreDisplay breakdown={breakdown} />);

      // Overall should be (100 + 80 + 60 + 40) / 4 = 70
      expect(screen.getByText("Overall Match")).toBeInTheDocument();
      expect(screen.getByText("70%")).toBeInTheDocument();
    });

    it("rounds overall score to nearest integer", () => {
      const breakdown = {
        skills_match: 90,
        experience_match: 85,
        education_match: 82,
      };

      render(<MatchScoreDisplay breakdown={breakdown} />);

      // Overall should be (90 + 85 + 82) / 3 = 85.67 ~ 86
      expect(screen.getByText("86%")).toBeInTheDocument();
    });
  });
});
