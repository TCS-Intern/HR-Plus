"""Document parsing service for extracting text from PDFs and DOCX files."""

import io
import re
from typing import Any

from docx import Document
from pypdf import PdfReader


class DocumentParser:
    """Service for parsing resume documents (PDF, DOCX)."""

    @staticmethod
    def extract_text_from_pdf(file_content: bytes) -> str:
        """Extract text from a PDF file.

        Args:
            file_content: PDF file content as bytes

        Returns:
            Extracted text from the PDF
        """
        reader = PdfReader(io.BytesIO(file_content))
        text_parts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
        return "\n".join(text_parts)

    @staticmethod
    def extract_text_from_docx(file_content: bytes) -> str:
        """Extract text from a DOCX file.

        Args:
            file_content: DOCX file content as bytes

        Returns:
            Extracted text from the document
        """
        doc = Document(io.BytesIO(file_content))
        text_parts = []
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                text_parts.append(paragraph.text)
        return "\n".join(text_parts)

    @staticmethod
    def detect_file_type(filename: str) -> str:
        """Detect file type from filename.

        Args:
            filename: Name of the file

        Returns:
            File type: 'pdf', 'docx', or 'unknown'
        """
        filename_lower = filename.lower()
        if filename_lower.endswith(".pdf"):
            return "pdf"
        elif filename_lower.endswith(".docx"):
            return "docx"
        elif filename_lower.endswith(".doc"):
            return "doc"
        return "unknown"

    def extract_text(self, file_content: bytes, filename: str) -> str:
        """Extract text from a document based on file type.

        Args:
            file_content: File content as bytes
            filename: Original filename to detect type

        Returns:
            Extracted text

        Raises:
            ValueError: If file type is not supported
        """
        file_type = self.detect_file_type(filename)
        if file_type == "pdf":
            return self.extract_text_from_pdf(file_content)
        elif file_type == "docx":
            return self.extract_text_from_docx(file_content)
        else:
            raise ValueError(f"Unsupported file type: {filename}")

    def parse_resume(self, file_content: bytes, filename: str) -> dict[str, Any]:
        """Parse a resume and extract structured information.

        Args:
            file_content: Resume file content as bytes
            filename: Original filename

        Returns:
            Dictionary with parsed resume data
        """
        raw_text = self.extract_text(file_content, filename)

        # Basic parsing - extract common sections
        parsed_data = {
            "raw_text": raw_text,
            "email": self._extract_email(raw_text),
            "phone": self._extract_phone(raw_text),
            "linkedin": self._extract_linkedin(raw_text),
            "sections": self._extract_sections(raw_text),
        }

        return parsed_data

    @staticmethod
    def _extract_email(text: str) -> str | None:
        """Extract email address from text."""
        email_pattern = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
        match = re.search(email_pattern, text)
        return match.group(0) if match else None

    @staticmethod
    def _extract_phone(text: str) -> str | None:
        """Extract phone number from text."""
        # Common phone patterns
        phone_patterns = [
            r"\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}",
            r"\+?[0-9]{1,3}[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4}",
        ]
        for pattern in phone_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(0)
        return None

    @staticmethod
    def _extract_linkedin(text: str) -> str | None:
        """Extract LinkedIn URL from text."""
        linkedin_pattern = r"(?:https?://)?(?:www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+"
        match = re.search(linkedin_pattern, text, re.IGNORECASE)
        return match.group(0) if match else None

    @staticmethod
    def _extract_sections(text: str) -> dict[str, str]:
        """Extract common resume sections."""
        sections = {}

        # Common section headers
        section_patterns = {
            "experience": r"(?:experience|work\s*history|employment)",
            "education": r"(?:education|academic|qualifications)",
            "skills": r"(?:skills|technical\s*skills|competencies)",
            "summary": r"(?:summary|profile|objective|about)",
            "projects": r"(?:projects|portfolio)",
            "certifications": r"(?:certifications?|licenses?)",
        }

        text.lower()
        lines = text.split("\n")

        current_section = None
        current_content = []

        for line in lines:
            line_lower = line.lower().strip()

            # Check if line is a section header
            found_section = None
            for section_name, pattern in section_patterns.items():
                if re.search(pattern, line_lower) and len(line_lower) < 50:
                    found_section = section_name
                    break

            if found_section:
                # Save previous section
                if current_section and current_content:
                    sections[current_section] = "\n".join(current_content).strip()
                current_section = found_section
                current_content = []
            elif current_section:
                current_content.append(line)

        # Save last section
        if current_section and current_content:
            sections[current_section] = "\n".join(current_content).strip()

        return sections


# Singleton instance
document_parser = DocumentParser()
