# Mock Documents

This folder contains mock documents for testing document parsing and processing.

## Structure

```
documents/
├── resumes/                    # Candidate resumes
│   ├── sarah_chen_resume.md
│   ├── david_kim_resume.md
│   ├── jessica_patel_resume.md
│   ├── alex_thompson_resume.md
│   └── ryan_oshea_resume.md
├── cover_letters/              # Cover letters
│   ├── sarah_chen_cover_letter.md
│   └── david_kim_cover_letter.md
├── job_descriptions/           # Job descriptions
│   ├── senior_software_engineer_jd.md
│   ├── ml_engineer_jd.md
│   └── product_manager_jd.md
├── convert_to_pdf.py           # MD to PDF converter
└── README.md
```

## Converting to PDF

The documents are in Markdown format for easy editing. To convert to PDF:

```bash
# Install dependencies
pip install markdown weasyprint

# Convert all documents
cd backend/mock_data/documents
python convert_to_pdf.py

# Convert specific folder
python convert_to_pdf.py resumes/

# Convert single file
python convert_to_pdf.py resumes/sarah_chen_resume.md
```

## Document Profiles

### Resumes

| Candidate | Role | Experience | Key Skills |
|-----------|------|------------|------------|
| Sarah Chen | Senior SWE | 7 years | Python, Go, Distributed Systems |
| David Kim | ML Engineer | 5 years (PhD) | PyTorch, NLP, LLMs |
| Jessica Patel | Product Manager | 6 years | B2B SaaS, HR Tech |
| Alex Thompson | UX Designer | 5 years | Figma, Design Systems |
| Ryan O'Shea | Software Engineer | 2 years | Python, Django |

### Job Descriptions

| Position | Level | Location | Salary Range |
|----------|-------|----------|--------------|
| Senior Software Engineer | Senior | SF (Hybrid) | $180k-$220k |
| Machine Learning Engineer | Senior | Seattle (Remote) | $200k-$280k |
| Product Manager | Mid-Senior | NYC (Remote) | $150k-$190k |

## Usage in Tests

```python
from pathlib import Path

# Get document paths
DOCS_DIR = Path(__file__).parent / "mock_data" / "documents"

# Load a resume for parsing test
resume_path = DOCS_DIR / "resumes" / "sarah_chen_resume.md"
resume_text = resume_path.read_text()

# Or load PDF after conversion
resume_pdf = DOCS_DIR / "resumes" / "sarah_chen_resume.pdf"
```

## Adding New Documents

1. Create a new `.md` file in the appropriate folder
2. Follow the existing format (use `#` for name, `##` for sections)
3. Run `python convert_to_pdf.py` to generate PDF version
4. Update this README with the new document info
