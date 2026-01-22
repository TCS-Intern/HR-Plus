"""Mock documents for testing parsing and document processing."""

from collections.abc import Iterator
from pathlib import Path

DOCUMENTS_DIR = Path(__file__).parent


def get_resumes() -> list[Path]:
    """Get all resume files (MD and PDF)."""
    resumes_dir = DOCUMENTS_DIR / "resumes"
    return list(resumes_dir.glob("*_resume.*"))


def get_resume(name: str, format: str = "md") -> Path:
    """Get a specific resume by candidate name.

    Args:
        name: Candidate name (e.g., "sarah_chen", "david_kim")
        format: File format ("md" or "pdf")

    Returns:
        Path to the resume file
    """
    return DOCUMENTS_DIR / "resumes" / f"{name}_resume.{format}"


def get_cover_letters() -> list[Path]:
    """Get all cover letter files."""
    cover_letters_dir = DOCUMENTS_DIR / "cover_letters"
    return list(cover_letters_dir.glob("*_cover_letter.*"))


def get_job_descriptions() -> list[Path]:
    """Get all job description files."""
    jd_dir = DOCUMENTS_DIR / "job_descriptions"
    return list(jd_dir.glob("*_jd.*"))


def get_offer_letters() -> list[Path]:
    """Get all offer letter files."""
    offer_dir = DOCUMENTS_DIR / "offer_letters"
    return list(offer_dir.glob("*.md")) + list(offer_dir.glob("*.pdf"))


def iter_all_documents() -> Iterator[tuple[str, Path]]:
    """Iterate over all documents with their type.

    Yields:
        Tuple of (document_type, path)
    """
    for resume in get_resumes():
        yield ("resume", resume)

    for cover_letter in get_cover_letters():
        yield ("cover_letter", cover_letter)

    for jd in get_job_descriptions():
        yield ("job_description", jd)

    for offer in get_offer_letters():
        yield ("offer_letter", offer)


def read_document(path: Path) -> str:
    """Read a document's text content.

    For PDFs, this requires additional libraries.
    For MD files, returns raw text.
    """
    if path.suffix == ".md":
        return path.read_text(encoding="utf-8")
    elif path.suffix == ".pdf":
        try:
            import pypdf

            reader = pypdf.PdfReader(path)
            return "\n".join(page.extract_text() for page in reader.pages)
        except ImportError:
            raise ImportError("Install pypdf to read PDF files: pip install pypdf")
    else:
        raise ValueError(f"Unsupported file format: {path.suffix}")


# Document metadata for testing
DOCUMENT_METADATA = {
    "sarah_chen_resume": {
        "candidate_name": "Sarah Chen",
        "experience_years": 7,
        "current_company": "Stripe",
        "skills": ["Python", "Go", "PostgreSQL", "Redis", "Kubernetes", "AWS"],
        "education": ["Stanford MS CS", "UC Berkeley BS CS"],
    },
    "david_kim_resume": {
        "candidate_name": "David Kim",
        "experience_years": 5,
        "current_company": "OpenAI",
        "skills": ["Python", "PyTorch", "NLP", "Transformers", "MLOps"],
        "education": ["CMU PhD ML", "Seoul National University BS CS"],
    },
    "jessica_patel_resume": {
        "candidate_name": "Jessica Patel",
        "experience_years": 6,
        "current_company": "Greenhouse",
        "skills": ["Product Strategy", "User Research", "SQL", "Agile"],
        "education": ["Harvard MBA", "Northwestern BA Economics"],
    },
    "alex_thompson_resume": {
        "candidate_name": "Alex Thompson",
        "experience_years": 5,
        "current_company": "Figma",
        "skills": ["Figma", "User Research", "Prototyping", "Design Systems"],
        "education": ["RISD BFA Graphic Design"],
    },
    "ryan_oshea_resume": {
        "candidate_name": "Ryan O'Shea",
        "experience_years": 2,
        "current_company": "Plaid",
        "skills": ["Python", "PostgreSQL", "Django", "Docker", "AWS"],
        "education": ["App Academy", "U of Michigan BS Finance"],
    },
}
