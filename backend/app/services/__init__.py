"""Services layer for external integrations."""

from app.services.apollo import ApolloService, apollo
from app.services.document import DocumentParser, document_parser
from app.services.github_search import GitHubSearchService, github_search
from app.services.proxycurl import ProxycurlService, proxycurl
from app.services.resume_parser import ResumeParser, resume_parser
from app.services.storage import StorageService, storage
from app.services.supabase import SupabaseService, db, get_supabase_client, supabase

__all__ = [
    "get_supabase_client",
    "supabase",
    "SupabaseService",
    "db",
    "StorageService",
    "storage",
    "DocumentParser",
    "document_parser",
    "ResumeParser",
    "resume_parser",
    "ApolloService",
    "apollo",
    "GitHubSearchService",
    "github_search",
    "ProxycurlService",
    "proxycurl",
]
