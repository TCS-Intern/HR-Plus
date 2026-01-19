/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import CandidateCard from "@/components/screening/CandidateCard";
import type { ScreenedCandidate } from "@/types";

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  User: () => <span data-testid="user-icon">User</span>,
  Mail: () => <span data-testid="mail-icon">Mail</span>,
  Phone: () => <span data-testid="phone-icon">Phone</span>,
  Linkedin: () => <span data-testid="linkedin-icon">LinkedIn</span>,
  CheckCircle: () => <span data-testid="check-icon">Check</span>,
  XCircle: () => <span data-testid="x-icon">X</span>,
  Star: () => <span data-testid="star-icon">Star</span>,
  AlertTriangle: () => <span data-testid="alert-icon">Alert</span>,
  ChevronDown: () => <span data-testid="chevron-down">Down</span>,
  ChevronUp: () => <span data-testid="chevron-up">Up</span>,
  ExternalLink: () => <span data-testid="external-link">External</span>,
}));

// Mock candidate data
const mockCandidate: ScreenedCandidate = {
  application_id: "app-123",
  candidate_id: "cand-123",
  candidate: {
    id: "cand-123",
    email: "john.doe@example.com",
    first_name: "John",
    last_name: "Doe",
    phone: "+1-555-123-4567",
    linkedin_url: "https://linkedin.com/in/johndoe",
    linkedin_data: null,
    resume_url: "https://example.com/resume.pdf",
    resume_parsed: null,
    source: "direct",
    source_details: null,
    tags: [],
    notes: null,
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
  },
  screening_score: 85,
  screening_recommendation: "strong_match",
  match_breakdown: {
    skills_match: 90,
    experience_match: 80,
    education_match: 85,
    culture_fit: 75,
  },
  strengths: ["Strong Python skills", "Good communication", "Team leadership"],
  gaps: ["Limited AWS experience"],
  red_flags: [],
  status: "screening",
  screened_at: "2024-01-15T10:00:00Z",
};

describe("CandidateCard", () => {
  const mockOnSelect = jest.fn();
  const mockOnReject = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders candidate name correctly", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("renders screening score", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText("85%")).toBeInTheDocument();
    });

    it("renders candidate email", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText("john.doe@example.com")).toBeInTheDocument();
    });

    it("renders candidate phone", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText("+1-555-123-4567")).toBeInTheDocument();
    });

    it("renders recommendation label for strong match", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText("Strong Match")).toBeInTheDocument();
    });

    it("renders strengths preview", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText("Strong Python skills")).toBeInTheDocument();
      expect(screen.getByText("Good communication")).toBeInTheDocument();
    });

    it("shows more indicator when more than 3 strengths", () => {
      const candidateWithManyStrengths = {
        ...mockCandidate,
        strengths: ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5"],
      };

      render(
        <CandidateCard
          candidate={candidateWithManyStrengths}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText("+2 more")).toBeInTheDocument();
    });
  });

  describe("Selection", () => {
    it("shows checkbox when status is screening", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });

    it("calls onSelect when checkbox is clicked", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);

      expect(mockOnSelect).toHaveBeenCalledWith(true);
    });

    it("does not show checkbox when status is shortlisted", () => {
      const shortlistedCandidate = { ...mockCandidate, status: "shortlisted" as const };

      render(
        <CandidateCard
          candidate={shortlistedCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("does not show checkbox when status is rejected", () => {
      const rejectedCandidate = { ...mockCandidate, status: "rejected" as const };

      render(
        <CandidateCard
          candidate={rejectedCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("shows Shortlisted badge when shortlisted", () => {
      const shortlistedCandidate = { ...mockCandidate, status: "shortlisted" as const };

      render(
        <CandidateCard
          candidate={shortlistedCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText("Shortlisted")).toBeInTheDocument();
    });

    it("shows Rejected badge when rejected", () => {
      const rejectedCandidate = { ...mockCandidate, status: "rejected" as const };

      render(
        <CandidateCard
          candidate={rejectedCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText("Rejected")).toBeInTheDocument();
    });
  });

  describe("Expansion", () => {
    it("shows View Details button", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText("View Details")).toBeInTheDocument();
    });

    it("expands to show details when clicked", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      const viewDetailsButton = screen.getByText("View Details");
      fireEvent.click(viewDetailsButton);

      // Should now show "Hide Details"
      expect(screen.getByText("Hide Details")).toBeInTheDocument();
    });

    it("shows match breakdown when expanded", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      fireEvent.click(screen.getByText("View Details"));

      expect(screen.getByText("Match Breakdown")).toBeInTheDocument();
    });

    it("shows strengths list when expanded", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      fireEvent.click(screen.getByText("View Details"));

      // All strengths should be visible in expanded view
      expect(screen.getByText("Strengths")).toBeInTheDocument();
    });

    it("shows gaps when expanded", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      fireEvent.click(screen.getByText("View Details"));

      expect(screen.getByText("Gaps")).toBeInTheDocument();
      expect(screen.getByText("Limited AWS experience")).toBeInTheDocument();
    });

    it("shows red flags when expanded and present", () => {
      const candidateWithRedFlags = {
        ...mockCandidate,
        red_flags: ["Short tenure at previous company"],
      };

      render(
        <CandidateCard
          candidate={candidateWithRedFlags}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      fireEvent.click(screen.getByText("View Details"));

      expect(screen.getByText("Red Flags")).toBeInTheDocument();
      expect(screen.getByText("Short tenure at previous company")).toBeInTheDocument();
    });
  });

  describe("Actions", () => {
    it("shows View Resume link when expanded and resume exists", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      fireEvent.click(screen.getByText("View Details"));

      expect(screen.getByText("View Resume")).toBeInTheDocument();
    });

    it("shows LinkedIn link when expanded and linkedin_url exists", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      fireEvent.click(screen.getByText("View Details"));

      expect(screen.getByText("LinkedIn")).toBeInTheDocument();
    });

    it("shows Reject button when expanded and status is screening", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      fireEvent.click(screen.getByText("View Details"));

      expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    });
  });

  describe("Reject Modal", () => {
    it("opens reject modal when Reject button is clicked", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      fireEvent.click(screen.getByText("View Details"));
      fireEvent.click(screen.getByRole("button", { name: "Reject" }));

      expect(screen.getByText("Reject Candidate")).toBeInTheDocument();
    });

    it("closes modal when Cancel is clicked", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      fireEvent.click(screen.getByText("View Details"));
      fireEvent.click(screen.getByRole("button", { name: "Reject" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByText("Reject Candidate")).not.toBeInTheDocument();
    });

    it("calls onReject with reason when confirmed", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      fireEvent.click(screen.getByText("View Details"));
      fireEvent.click(screen.getByRole("button", { name: "Reject" }));

      const textarea = screen.getByPlaceholderText("Rejection reason (optional)");
      fireEvent.change(textarea, { target: { value: "Not enough experience" } });

      // Find the Reject button in the modal (there are now two Reject buttons)
      const rejectButtons = screen.getAllByRole("button", { name: "Reject" });
      fireEvent.click(rejectButtons[1]); // The second one is in the modal

      expect(mockOnReject).toHaveBeenCalledWith("Not enough experience");
    });

    it("calls onReject with undefined when no reason provided", () => {
      render(
        <CandidateCard
          candidate={mockCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      fireEvent.click(screen.getByText("View Details"));
      fireEvent.click(screen.getByRole("button", { name: "Reject" }));

      const rejectButtons = screen.getAllByRole("button", { name: "Reject" });
      fireEvent.click(rejectButtons[1]);

      expect(mockOnReject).toHaveBeenCalledWith(undefined);
    });
  });

  describe("Recommendation Styling", () => {
    it("renders with potential match styling", () => {
      const potentialMatchCandidate = {
        ...mockCandidate,
        screening_recommendation: "potential_match" as const,
      };

      render(
        <CandidateCard
          candidate={potentialMatchCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText("Potential Match")).toBeInTheDocument();
    });

    it("renders with weak match styling", () => {
      const weakMatchCandidate = {
        ...mockCandidate,
        screening_recommendation: "weak_match" as const,
      };

      render(
        <CandidateCard
          candidate={weakMatchCandidate}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText("Weak Match")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles missing candidate info gracefully", () => {
      const candidateWithMissingInfo: ScreenedCandidate = {
        ...mockCandidate,
        candidate: {
          id: "cand-123",
          email: "",
          first_name: null,
          last_name: null,
          phone: null,
          linkedin_url: null,
          linkedin_data: null,
          resume_url: null,
          resume_parsed: null,
          source: "direct",
          source_details: null,
          tags: [],
          notes: null,
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
      };

      render(
        <CandidateCard
          candidate={candidateWithMissingInfo}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      // Should render "Unknown" or similar for missing name
      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });

    it("handles null screening score", () => {
      const candidateWithNullScore = {
        ...mockCandidate,
        screening_score: null,
      };

      render(
        <CandidateCard
          candidate={candidateWithNullScore}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("handles empty strengths array", () => {
      const candidateNoStrengths = {
        ...mockCandidate,
        strengths: [],
      };

      render(
        <CandidateCard
          candidate={candidateNoStrengths}
          selected={false}
          onSelect={mockOnSelect}
          onReject={mockOnReject}
        />
      );

      // Should render without errors
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
  });
});
