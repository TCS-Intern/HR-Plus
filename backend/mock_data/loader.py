"""Mock data loader for seeding the database with test data."""

import json
import asyncio
import logging
from pathlib import Path
from typing import Any
from uuid import uuid4

logger = logging.getLogger(__name__)

MOCK_DATA_DIR = Path(__file__).parent


def load_mock_file(filename: str) -> list[dict[str, Any]]:
    """Load a mock data JSON file."""
    file_path = MOCK_DATA_DIR / filename
    if not file_path.exists():
        raise FileNotFoundError(f"Mock data file not found: {file_path}")

    with open(file_path, "r") as f:
        return json.load(f)


def load_all_mock_data() -> dict[str, list[dict[str, Any]]]:
    """Load all mock data files."""
    return {
        "jobs": load_mock_file("jobs.json"),
        "candidates": load_mock_file("candidates.json"),
        "applications": load_mock_file("applications.json"),
        "assessments": load_mock_file("assessments.json"),
        "offers": load_mock_file("offers.json"),
        "companies": load_mock_file("companies.json"),
        "sourced_candidates": load_mock_file("sourced_candidates.json"),
        "campaigns": load_mock_file("campaigns.json"),
        "phone_screens": load_mock_file("phone_screens.json"),
    }


class MockDataSeeder:
    """Seeds the database with mock data for testing."""

    def __init__(self, supabase_client):
        self.client = supabase_client
        self.id_mapping = {}  # Maps mock IDs to real UUIDs

    def _generate_uuid(self, mock_id: str) -> str:
        """Generate or retrieve a UUID for a mock ID."""
        if mock_id not in self.id_mapping:
            self.id_mapping[mock_id] = str(uuid4())
        return self.id_mapping[mock_id]

    def _replace_ids(self, data: dict, id_fields: list[str]) -> dict:
        """Replace mock IDs with real UUIDs."""
        result = data.copy()

        # Replace the main id
        if "id" in result:
            mock_id = result["id"]
            result["id"] = self._generate_uuid(mock_id)

        # Replace foreign key references
        for field in id_fields:
            if field in result and result[field]:
                mock_ref = result[field]
                if mock_ref in self.id_mapping:
                    result[field] = self.id_mapping[mock_ref]
                elif isinstance(mock_ref, str) and mock_ref.startswith(("job-", "cand-", "app-", "assess-", "offer-", "comp-", "src-", "camp-")):
                    result[field] = self._generate_uuid(mock_ref)

        return result

    async def seed_jobs(self, jobs: list[dict]) -> list[dict]:
        """Seed jobs table."""
        logger.info(f"Seeding {len(jobs)} jobs...")
        seeded = []

        for job in jobs:
            job_data = self._replace_ids(job, [])
            # Remove mock-specific fields
            job_data.pop("id", None)  # Let Supabase generate the ID

            result = self.client.table("jobs").insert(job_data).execute()
            if result.data:
                real_id = result.data[0]["id"]
                self.id_mapping[job["id"]] = real_id
                seeded.append(result.data[0])
                logger.info(f"  Created job: {job['title']} (ID: {real_id})")

        return seeded

    async def seed_candidates(self, candidates: list[dict]) -> list[dict]:
        """Seed candidates table."""
        logger.info(f"Seeding {len(candidates)} candidates...")
        seeded = []

        for candidate in candidates:
            candidate_data = self._replace_ids(candidate, [])
            candidate_data.pop("id", None)

            result = self.client.table("candidates").insert(candidate_data).execute()
            if result.data:
                real_id = result.data[0]["id"]
                self.id_mapping[candidate["id"]] = real_id
                seeded.append(result.data[0])
                logger.info(f"  Created candidate: {candidate['first_name']} {candidate['last_name']} (ID: {real_id})")

        return seeded

    async def seed_applications(self, applications: list[dict]) -> list[dict]:
        """Seed applications table."""
        logger.info(f"Seeding {len(applications)} applications...")
        seeded = []

        for app in applications:
            app_data = self._replace_ids(app, ["job_id", "candidate_id"])
            app_data.pop("id", None)

            result = self.client.table("applications").insert(app_data).execute()
            if result.data:
                real_id = result.data[0]["id"]
                self.id_mapping[app["id"]] = real_id
                seeded.append(result.data[0])
                logger.info(f"  Created application: {app['id']} -> {real_id} (status: {app['status']})")

        return seeded

    async def seed_assessments(self, assessments: list[dict]) -> list[dict]:
        """Seed assessments table."""
        logger.info(f"Seeding {len(assessments)} assessments...")
        seeded = []

        for assessment in assessments:
            assessment_data = self._replace_ids(assessment, ["application_id"])
            assessment_data.pop("id", None)

            result = self.client.table("assessments").insert(assessment_data).execute()
            if result.data:
                real_id = result.data[0]["id"]
                self.id_mapping[assessment["id"]] = real_id
                seeded.append(result.data[0])
                logger.info(f"  Created assessment: {assessment['id']} -> {real_id} (status: {assessment['status']})")

        return seeded

    async def seed_offers(self, offers: list[dict]) -> list[dict]:
        """Seed offers table."""
        logger.info(f"Seeding {len(offers)} offers...")
        seeded = []

        for offer in offers:
            offer_data = self._replace_ids(offer, ["application_id", "approved_by"])
            offer_data.pop("id", None)

            result = self.client.table("offers").insert(offer_data).execute()
            if result.data:
                real_id = result.data[0]["id"]
                self.id_mapping[offer["id"]] = real_id
                seeded.append(result.data[0])
                logger.info(f"  Created offer: {offer['id']} -> {real_id} (status: {offer['status']})")

        return seeded

    async def seed_companies(self, companies: list[dict]) -> list[dict]:
        """Seed companies table."""
        logger.info(f"Seeding {len(companies)} companies...")
        seeded = []

        for company in companies:
            company_data = self._replace_ids(company, [])
            company_data.pop("id", None)

            result = self.client.table("companies").insert(company_data).execute()
            if result.data:
                real_id = result.data[0]["id"]
                self.id_mapping[company["id"]] = real_id
                seeded.append(result.data[0])
                logger.info(f"  Created company: {company['name']} (ID: {real_id})")

        return seeded

    async def seed_sourced_candidates(self, sourced_candidates: list[dict]) -> list[dict]:
        """Seed sourced_candidates table."""
        logger.info(f"Seeding {len(sourced_candidates)} sourced candidates...")
        seeded = []

        for src in sourced_candidates:
            src_data = self._replace_ids(src, ["company_id", "job_id"])
            src_data.pop("id", None)

            result = self.client.table("sourced_candidates").insert(src_data).execute()
            if result.data:
                real_id = result.data[0]["id"]
                self.id_mapping[src["id"]] = real_id
                seeded.append(result.data[0])
                logger.info(f"  Created sourced candidate: {src['first_name']} {src['last_name']} (ID: {real_id})")

        return seeded

    async def seed_campaigns(self, campaigns: list[dict]) -> list[dict]:
        """Seed campaigns table."""
        logger.info(f"Seeding {len(campaigns)} campaigns...")
        seeded = []

        for campaign in campaigns:
            campaign_data = self._replace_ids(campaign, ["company_id", "job_id", "created_by"])
            campaign_data.pop("id", None)

            result = self.client.table("campaigns").insert(campaign_data).execute()
            if result.data:
                real_id = result.data[0]["id"]
                self.id_mapping[campaign["id"]] = real_id
                seeded.append(result.data[0])
                logger.info(f"  Created campaign: {campaign['name']} (ID: {real_id})")

        return seeded

    async def seed_phone_screens(self, phone_screens: list[dict]) -> list[dict]:
        """Seed phone_screens table."""
        logger.info(f"Seeding {len(phone_screens)} phone screens...")
        seeded = []

        for ps in phone_screens:
            ps_data = self._replace_ids(ps, ["application_id", "scheduled_by"])
            ps_data.pop("id", None)

            result = self.client.table("phone_screens").insert(ps_data).execute()
            if result.data:
                real_id = result.data[0]["id"]
                self.id_mapping[ps["id"]] = real_id
                seeded.append(result.data[0])
                logger.info(f"  Created phone screen: {ps['id']} -> {real_id} (status: {ps['status']})")

        return seeded

    async def seed_all(self, clear_existing: bool = False) -> dict[str, list[dict]]:
        """
        Seed all mock data into the database.

        Args:
            clear_existing: If True, delete existing data before seeding.

        Returns:
            Dict of table names to seeded records.
        """
        if clear_existing:
            logger.warning("Clearing existing data...")
            # Delete in reverse order of dependencies
            tables_to_clear = [
                "offers",
                "phone_screens",
                "assessments",
                "applications",
                "outreach_messages",
                "campaigns",
                "sourced_candidates",
                "candidates",
                "jobs",
                "companies",
            ]
            for table in tables_to_clear:
                try:
                    self.client.table(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
                    logger.info(f"  Cleared {table}")
                except Exception as e:
                    logger.warning(f"  Could not clear {table}: {e}")

        # Load all mock data
        data = load_all_mock_data()

        # Seed in order of dependencies
        results = {}

        # V2 tables first (companies)
        results["companies"] = await self.seed_companies(data["companies"])

        # Core tables
        results["jobs"] = await self.seed_jobs(data["jobs"])
        results["candidates"] = await self.seed_candidates(data["candidates"])
        results["applications"] = await self.seed_applications(data["applications"])
        results["assessments"] = await self.seed_assessments(data["assessments"])
        results["offers"] = await self.seed_offers(data["offers"])

        # V2 tables
        results["sourced_candidates"] = await self.seed_sourced_candidates(data["sourced_candidates"])
        results["campaigns"] = await self.seed_campaigns(data["campaigns"])
        results["phone_screens"] = await self.seed_phone_screens(data["phone_screens"])

        logger.info("Mock data seeding complete!")
        logger.info(f"  Total records: {sum(len(v) for v in results.values())}")

        return results


async def seed_database(clear_existing: bool = False):
    """
    Main function to seed the database with mock data.

    Usage:
        python -m mock_data.loader
    """
    from app.services.supabase import db

    seeder = MockDataSeeder(db.client)
    results = await seeder.seed_all(clear_existing=clear_existing)

    print("\n=== Seeding Summary ===")
    for table, records in results.items():
        print(f"  {table}: {len(records)} records")

    return results


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    clear = "--clear" in sys.argv or "-c" in sys.argv

    if clear:
        print("WARNING: This will delete existing data!")
        confirm = input("Type 'yes' to confirm: ")
        if confirm.lower() != "yes":
            print("Aborted.")
            sys.exit(0)

    asyncio.run(seed_database(clear_existing=clear))
