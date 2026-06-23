import json
import time

from redis import Redis
from redis.exceptions import RedisError

from worker.config import settings
from worker.db import process_sync_job, reap_stale_runs
from worker.digest import start_scheduler


def _process(raw: str) -> None:
    payload = json.loads(raw)
    process_sync_job(
        run_id=int(payload["run_id"]),
        user_id=int(payload["user_id"]),
        target_user_id=int(payload["target_user_id"]) if payload.get("target_user_id") else None,
        profile_id=int(payload["profile_id"]) if payload.get("profile_id") else None,
        keywords=payload.get("keywords") or [],
        job_family=payload.get("job_family", "software"),
        summary_minutes=int(payload.get("summary_minutes", 60)),
    )


def main() -> None:
    start_scheduler()
    # Cierra corridas que quedaron 'running' si un arranque previo murió a mitad.
    reap_stale_runs()
    print("SinFro worker listening on sync_jobs")
    while True:
        try:
            redis = Redis.from_url(settings.redis_url, decode_responses=True)
            while True:
                item = redis.brpop("sync_jobs", timeout=settings.sync_poll_timeout)
                if not item:
                    continue
                _, raw = item
                try:
                    _process(raw)
                except Exception as exc:
                    print(f"worker error: {exc}")
                    time.sleep(1)
        except RedisError as exc:
            # P.ej. Redis reiniciado o forzado a réplica (master->replica): reconectar
            # en vez de dejar morir el proceso (y con él el scheduler periódico).
            print(f"redis connection error: {exc}; reconnecting in 3s")
            time.sleep(3)


if __name__ == "__main__":
    main()
