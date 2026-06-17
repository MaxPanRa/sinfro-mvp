from app.db.session import SessionLocal
from app.seed import seed_demo_data


def main() -> None:
    with SessionLocal() as db:
        result = seed_demo_data(db)
    print(
        "Seed demo complete: "
        f"user={result.user_email}, "
        f"profiles={result.profiles}, "
        f"jobs={result.jobs}, "
        f"credentials={result.credentials}, "
        f"runs={result.runs}, "
        f"evaluations={result.evaluations}"
    )


if __name__ == "__main__":
    main()
