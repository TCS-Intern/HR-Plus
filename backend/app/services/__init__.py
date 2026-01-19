"""Services layer for external integrations."""

from app.services.supabase import get_supabase_client, supabase, SupabaseService, db
from app.services.storage import StorageService, storage
from app.services.document import DocumentParser, document_parser
from app.services.apollo import ApolloService, apollo
from app.services.github_search import GitHubSearchService, github_search
from app.services.proxycurl import ProxycurlService, proxycurl

__all__ = [
    "get_supabase_client",
    "supabase",
    "SupabaseService",
    "db",
    "StorageService",
    "storage",
    "DocumentParser",
    "document_parser",
    "ApolloService",
    "apollo",
    "GitHubSearchService",
    "github_search",
    "ProxycurlService",
    "proxycurl",
]
