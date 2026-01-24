"""Background worker for Marathon Agent autonomous processing."""

import asyncio
import logging
from datetime import datetime

from app.agents.marathon_agent import marathon_agent
from app.services.supabase import db

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class MarathonWorker:
    """Background worker that processes Marathon Agent queues."""

    def __init__(self, check_interval: int = 60):
        """
        Initialize the worker.

        Args:
            check_interval: How often to check for pending marathons (in seconds)
        """
        self.check_interval = check_interval
        self.is_running = False

    async def start(self):
        """Start the worker loop."""
        self.is_running = True
        logger.info("Marathon Worker started")

        while self.is_running:
            try:
                await self.process_pending_marathons()
                await asyncio.sleep(self.check_interval)
            except Exception as e:
                logger.error(f"Error in marathon worker loop: {e}")
                await asyncio.sleep(self.check_interval)

    async def stop(self):
        """Stop the worker gracefully."""
        logger.info("Stopping Marathon Worker...")
        self.is_running = False

    async def process_pending_marathons(self):
        """Process all marathons that are ready for action."""
        # Find marathons ready for processing
        pending_marathons = await db.execute(
            """
            SELECT id, current_stage, next_scheduled_action
            FROM marathon_agent_state
            WHERE stage_status = 'pending'
              AND next_scheduled_action <= NOW()
              AND current_stage != 'offer'
            ORDER BY next_scheduled_action ASC
            LIMIT 10
            """
        )

        if not pending_marathons:
            return

        logger.info(f"Processing {len(pending_marathons)} pending marathons")

        # Process each marathon
        for state in pending_marathons:
            try:
                await self.process_single_marathon(state["id"])
            except Exception as e:
                logger.error(f"Error processing marathon {state['id']}: {e}")
                # Mark as blocked
                await db.execute(
                    """
                    UPDATE marathon_agent_state
                    SET stage_status = 'blocked',
                        blocked_reason = $1,
                        updated_at = NOW()
                    WHERE id = $2
                    """,
                    f"Worker error: {str(e)}",
                    state["id"],
                )

    async def process_single_marathon(self, marathon_state_id: str):
        """Process a single marathon state."""
        logger.info(f"Processing marathon {marathon_state_id}")

        try:
            # Process the stage
            result = await marathon_agent.process_stage(marathon_state_id)

            logger.info(
                f"Marathon {marathon_state_id} processed: {result['decision']} "
                f"(confidence: {result['confidence']:.2f})"
            )

            # Log any corrections
            if result.get("corrections"):
                logger.info(
                    f"Marathon {marathon_state_id} made {len(result['corrections'])} self-corrections"
                )

        except Exception as e:
            logger.error(f"Failed to process marathon {marathon_state_id}: {e}")
            raise

    async def process_escalations(self):
        """Send notifications for escalated marathons requiring human review."""
        escalations = await marathon_agent.get_marathons_requiring_review()

        if not escalations:
            return

        logger.info(f"Found {len(escalations)} marathons requiring human review")

        for marathon in escalations:
            # Here you could send notifications via email, Slack, etc.
            logger.info(
                f"Marathon {marathon['id']} escalated: {marathon.get('escalation_reason', 'Unknown')}"
            )

            # For now, just log it. In production, you'd send actual notifications
            # await send_escalation_notification(marathon)


async def run_marathon_worker():
    """Main function to run the marathon worker."""
    worker = MarathonWorker(check_interval=60)  # Check every minute

    try:
        await worker.start()
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
        await worker.stop()
    except Exception as e:
        logger.error(f"Fatal error in marathon worker: {e}")
        await worker.stop()
        raise


if __name__ == "__main__":
    """Run the worker as a standalone process."""
    asyncio.run(run_marathon_worker())
