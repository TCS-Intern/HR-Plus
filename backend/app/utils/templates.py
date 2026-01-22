"""Template rendering utility using Jinja2 for email templates."""

from datetime import datetime
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

# Template directory path
TEMPLATES_DIR = Path(__file__).parent.parent.parent / "templates"


def _get_jinja_env() -> Environment:
    """Create and configure Jinja2 environment."""
    return Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html", "xml"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )


# Common template helpers (Jinja2 filters)
def format_currency(amount: float | int, currency: str = "USD") -> str:
    """Format a number as currency."""
    symbols = {
        "USD": "$",
        "EUR": "\u20ac",
        "GBP": "\u00a3",
        "CAD": "C$",
        "AUD": "A$",
    }
    symbol = symbols.get(currency, currency)
    return f"{symbol}{amount:,.0f}"


def format_date(date_str: str, format_str: str = "%B %d, %Y") -> str:
    """Format a date string for display."""
    if not date_str:
        return ""

    # Handle various date formats
    for fmt in ["%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S.%fZ"]:
        try:
            # Truncate string to appropriate length for format
            dt = datetime.strptime(date_str[:26], fmt)
            return dt.strftime(format_str)
        except ValueError:
            continue

    # Fallback: return as-is
    return date_str


def _register_filters(env: Environment) -> None:
    """Register custom Jinja2 filters."""
    env.filters["currency"] = format_currency
    env.filters["format_date"] = format_date


# Singleton environment with filters
_env_with_filters: Environment | None = None


def get_jinja_env() -> Environment:
    """Get or create the Jinja2 environment singleton with custom filters."""
    global _env_with_filters
    if _env_with_filters is None:
        _env_with_filters = _get_jinja_env()
        _register_filters(_env_with_filters)
    return _env_with_filters


def get_template(template_name: str) -> str:
    """
    Load a template file and return its raw content.

    Args:
        template_name: Path to template relative to templates directory
                      (e.g., "emails/offer_letter.html")

    Returns:
        Raw template content as string
    """
    template_path = TEMPLATES_DIR / template_name
    return template_path.read_text(encoding="utf-8")


def render_template(template_name: str, context: dict[str, Any]) -> str:
    """
    Render a Jinja2 template with the provided context.

    Args:
        template_name: Path to template relative to templates directory
                      (e.g., "emails/offer_letter.html")
        context: Dictionary of variables to pass to the template

    Returns:
        Rendered HTML string

    Example:
        html = render_template(
            "emails/offer_letter.html",
            {
                "candidate_name": "John Doe",
                "job_title": "Senior Engineer",
                "salary": "$150,000",
            }
        )
    """
    env = get_jinja_env()
    template = env.get_template(template_name)
    return template.render(**context)


def render_string_template(template_str: str, context: dict[str, Any]) -> str:
    """
    Render a template string (not from file) with the provided context.

    Useful for rendering dynamic templates stored in database.

    Args:
        template_str: Jinja2 template as a string
        context: Dictionary of variables to pass to the template

    Returns:
        Rendered string
    """
    env = get_jinja_env()
    template = env.from_string(template_str)
    return template.render(**context)
