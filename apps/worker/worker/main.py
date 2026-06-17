import json
import time

from redis import Redis

from worker.config import settings
from worker.db import process_sync_job


def main() -> None:
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    print("SinFro worker listening on sync_jobs")
    while True:
        item = redis.brpop("sync_jobs", timeout=settings.sync_poll_timeout)
        if not item:
            continue
        _, raw = item
        try:
            payload = json.loads(raw)
            process_sync_job(run_id=int(payload["run_id"]), user_id=int(payload["user_id"]))
        except Exception as exc:
            print(f"worker error: {exc}")
            time.sleep(1)


if __name__ == "__main__":
    main()
