"""
Structured logging utility for TalentAI backend.

Provides JSON-formatted logging with correlation ID support for request tracing
across distributed services. All logs include timestamp, level, message,
correlation_id, and optional extra data.

Usage:
    from app.utils.logging import get_logger, setup_logging

    # Initialize logging at application startup
    setup_logging(level="INFO", json_format=True)

    # Get a logger for your module
    logger = get_logger(__name__)

    # Log with extra context
    logger.info("Processing job", extra={"job_id": "123", "action": "screen"})

    # Correlation IDs are automatically included from context
    logger.error("Failed to process", extra={"error_code": "E001"})
"""

import json
import logging
import sys
import uuid
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

# Context variable for request-scoped correlation ID
_correlation_id: ContextVar[str | None] = ContextVar("correlation_id", default=None)


def get_correlation_id() -> str | None:
    """Get the current correlation ID from context.

    Returns:
        The current correlation ID or None if not set.
    """
    return _correlation_id.get()


def set_correlation_id(correlation_id: str | None = None) -> str:
    """Set the correlation ID for the current context.

    Args:
        correlation_id: Optional ID to set. If None, generates a new UUID.

    Returns:
        The correlation ID that was set.
    """
    if correlation_id is None:
        correlation_id = str(uuid.uuid4())
    _correlation_id.set(correlation_id)
    return correlation_id


def generate_correlation_id() -> str:
    """Generate a new correlation ID.

    Returns:
        A new UUID4 string.
    """
    return str(uuid.uuid4())


class JSONFormatter(logging.Formatter):
    """Custom formatter that outputs logs as JSON objects.

    Each log entry includes:
    - timestamp: ISO 8601 format with timezone
    - level: Log level name (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    - logger: Logger name (usually module path)
    - message: The log message
    - correlation_id: Request correlation ID for tracing
    - extra: Additional context data passed to the logger

    Exception information is included when available.
    """

    def format(self, record: logging.LogRecord) -> str:
        """Format a log record as JSON.

        Args:
            record: The log record to format.

        Returns:
            JSON string representation of the log entry.
        """
        # Base log structure
        log_entry: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": get_correlation_id(),
        }

        # Add location information for debugging
        if record.levelno >= logging.WARNING:
            log_entry["location"] = {
                "file": record.pathname,
                "line": record.lineno,
                "function": record.funcName,
            }

        # Extract extra fields (exclude standard LogRecord attributes)
        standard_attrs = {
            "name",
            "msg",
            "args",
            "created",
            "filename",
            "funcName",
            "levelname",
            "levelno",
            "lineno",
            "module",
            "msecs",
            "pathname",
            "process",
            "processName",
            "relativeCreated",
            "stack_info",
            "exc_info",
            "exc_text",
            "thread",
            "threadName",
            "taskName",
            "message",
        }

        extra_data = {
            key: value
            for key, value in record.__dict__.items()
            if key not in standard_attrs and not key.startswith("_")
        }

        if extra_data:
            log_entry["extra"] = extra_data

        # Include exception information if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry, default=str)


class StandardFormatter(logging.Formatter):
    """Human-readable formatter for development.

    Format: [TIMESTAMP] LEVEL LOGGER [CORRELATION_ID] - MESSAGE
    """

    def format(self, record: logging.LogRecord) -> str:
        """Format a log record as human-readable string.

        Args:
            record: The log record to format.

        Returns:
            Formatted string representation of the log entry.
        """
        timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")
        correlation_id = get_correlation_id() or "-"

        # Build the base message
        base = f"[{timestamp}] {record.levelname:8} {record.name} [{correlation_id[:8]}] - {record.getMessage()}"

        # Add exception info if present
        if record.exc_info:
            base += f"\n{self.formatException(record.exc_info)}"

        return base


def setup_logging(
    level: str = "INFO",
    json_format: bool = True,
    include_uvicorn: bool = True,
) -> None:
    """Initialize the logging configuration.

    Should be called once at application startup, typically in main.py.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL).
        json_format: If True, use JSON formatting. If False, use human-readable format.
        include_uvicorn: If True, also configure uvicorn loggers.
    """
    log_level = getattr(logging, level.upper(), logging.INFO)

    # Create handler with appropriate formatter
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(log_level)

    if json_format:
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(StandardFormatter())

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Remove existing handlers to avoid duplicates
    root_logger.handlers.clear()
    root_logger.addHandler(handler)

    # Configure uvicorn loggers if requested
    if include_uvicorn:
        for logger_name in ["uvicorn", "uvicorn.access", "uvicorn.error"]:
            uvicorn_logger = logging.getLogger(logger_name)
            uvicorn_logger.handlers.clear()
            uvicorn_logger.addHandler(handler)
            uvicorn_logger.setLevel(log_level)


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance for the given name.

    This is the primary way to obtain a logger in application code.
    The logger will automatically include correlation IDs in its output.

    Args:
        name: Logger name, typically __name__ of the calling module.

    Returns:
        Configured Logger instance.

    Example:
        logger = get_logger(__name__)
        logger.info("Processing request", extra={"user_id": "123"})
    """
    return logging.getLogger(name)


class LoggerAdapter(logging.LoggerAdapter):
    """Logger adapter that automatically includes extra context.

    Useful when you want to add consistent extra fields to all logs
    from a particular component.

    Example:
        base_logger = get_logger(__name__)
        logger = LoggerAdapter(base_logger, {"component": "screener"})
        logger.info("Starting screening")  # Will include component="screener"
    """

    def process(self, msg: str, kwargs: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        """Process log message to include adapter's extra context.

        Args:
            msg: Log message.
            kwargs: Keyword arguments passed to the log call.

        Returns:
            Tuple of (message, updated kwargs).
        """
        extra = kwargs.get("extra", {})
        extra.update(self.extra)
        kwargs["extra"] = extra
        return msg, kwargs


# Convenience function for creating agent-specific loggers
def get_agent_logger(agent_name: str) -> LoggerAdapter:
    """Get a logger pre-configured for a specific agent.

    Args:
        agent_name: Name of the agent (e.g., "jd_assist", "screener").

    Returns:
        LoggerAdapter with agent context automatically included.

    Example:
        logger = get_agent_logger("talent_screener")
        logger.info("Screening candidate", extra={"candidate_id": "abc"})
        # Output will include agent="talent_screener"
    """
    base_logger = get_logger(f"app.agents.{agent_name}")
    return LoggerAdapter(base_logger, {"agent": agent_name})
