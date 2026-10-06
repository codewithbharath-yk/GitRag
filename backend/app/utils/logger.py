"""
Centralized logging configuration for CodeRAG.

Provides formatted and structured log outputs for local development and debugging.
"""

import logging
import sys


def setup_logging(log_level: str = "INFO") -> None:
    """
    Configure root logging format and level.
    """
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)

    log_format = "%(asctime)s | %(levelname)-7s | %(name)s:%(funcName)s:%(lineno)d - %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"

    # Configure root logger
    logging.basicConfig(
        level=numeric_level,
        format=log_format,
        datefmt=date_format,
        handlers=[logging.StreamHandler(sys.stdout)],
        force=True,
    )

    # Silence overly verbose third-party loggers if needed
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance with the given module name.
    """
    return logging.getLogger(name)
