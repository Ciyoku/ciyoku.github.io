import argparse
import json
import sys
from pathlib import Path


def _configure_output():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except Exception:
            pass


def _normalize_id(value):
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _find_list_path(cli_path=None):
    if cli_path:
        return Path(cli_path).expanduser().resolve()

    root = Path(__file__).resolve().parents[1]
    list_path = root / "books" / "list.json"
    if list_path.exists():
        return list_path

    raise FileNotFoundError(f"Missing file: {list_path}")


def _load_list(list_path):
    if not list_path.exists():
        raise FileNotFoundError(f"Missing list.json at {list_path}")
    try:
        data = json.loads(list_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError(f"Failed to read list.json: {exc}") from exc
    if not isinstance(data, list):
        raise ValueError("list.json must contain a JSON list.")
    return data


def _write_list(list_path, data):
    list_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=4),
        encoding="utf-8",
    )


def _collect_existing_ids(entries):
    ids = set()
    for entry in entries:
        if isinstance(entry, dict):
            entry_id = _normalize_id(entry.get("id"))
            if entry_id:
                ids.add(entry_id)
    return ids


def _normalize_categories(categories_arg, category_list):
    values = []
    if categories_arg:
        values.extend([c.strip() for c in categories_arg.split(",")])
    if category_list:
        values.extend([c.strip() for c in category_list])
    seen = set()
    output = []
    for value in values:
        if value and value not in seen:
            output.append(value)
            seen.add(value)
    return output


def _build_entry(book_id, title, author, parts, categories):
    if not book_id or not title or not author:
        raise ValueError("ID, Title, and Author are required.")
    try:
        parts_value = int(parts)
        if parts_value < 1:
            raise ValueError
    except Exception as exc:
        raise ValueError("Parts must be a positive integer.") from exc
    categories_value = _normalize_categories(categories, [])
    if not categories_value:
        raise ValueError("At least one category is required.")
    return {
        "id": book_id,
        "title": title,
        "parts": parts_value,
        "categories": categories_value,
        "author": author,
    }


def _add_single(args, list_path):
    existing = _load_list(list_path)
    existing_ids = _collect_existing_ids(existing)

    book_id = _normalize_id(args.id)
    title = (args.title or "").strip()
    author = (args.author or "").strip()
    categories = _normalize_categories(args.categories, args.category)

    if book_id in existing_ids:
        raise ValueError("This ID already exists in list.json.")

    entry = _build_entry(book_id, title, author, args.parts, ",".join(categories))
    existing.append(entry)
    _write_list(list_path, existing)
    print(f"Added 1 book to {list_path}")


def _import_from_file(args, list_path):
    existing = _load_list(list_path)
    existing_ids = _collect_existing_ids(existing)

    import_path = Path(args.file).expanduser().resolve()
    try:
        books = json.loads(import_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError(f"Failed to load import file: {exc}") from exc

    if not isinstance(books, list):
        raise ValueError("Import file must contain a JSON list.")

    added_entries = []
    seen_new_ids = set()
    skipped = 0
    invalid = 0

    for book in books:
        if not isinstance(book, dict):
            invalid += 1
            continue
        book_id = _normalize_id(book.get("id"))
        title = (book.get("title") or "").strip()
        author = (book.get("author") or "").strip()

        if not book_id or not title or not author:
            invalid += 1
            continue
        if book_id in existing_ids or book_id in seen_new_ids:
            skipped += 1
            continue
        seen_new_ids.add(book_id)

        entry = dict(book)
        entry["id"] = book_id
        added_entries.append(entry)

    if args.dry_run:
        print(
            f"Dry run: {len(added_entries)} would be added, "
            f"{skipped} skipped (duplicates), {invalid} invalid."
        )
        return

    if not added_entries:
        print(
            f"No new books added. {skipped} skipped (duplicates), {invalid} invalid."
        )
        return

    existing.extend(added_entries)
    _write_list(list_path, existing)
    print(
        f"Added {len(added_entries)} books to {list_path}. "
        f"{skipped} skipped (duplicates), {invalid} invalid."
    )


def _print_queue(pending):
    if not pending:
        print("Queue is empty.")
        return
    for entry in pending:
        line = (
            f"{entry.get('id','')} | {entry.get('title','')} | "
            f"{entry.get('author','')} | {entry.get('parts','')} | "
            f"{', '.join(entry.get('categories', []))}"
        )
        print(line)
    print(f"Queue: {len(pending)}")


def _interactive(list_path):
    existing = _load_list(list_path)
    existing_ids = _collect_existing_ids(existing)
    pending = []

    print("Interactive mode.")
    print(f"List path: {list_path}")

    while True:
        print("")
        book_id = _normalize_id(input("ID (blank for menu): ").strip())
        if book_id:
            try:
                title = input("Title: ").strip()
                author = input("Author: ").strip()
                parts_value = input("Parts [1]: ").strip() or "1"
                categories_raw = input("Categories (comma separated): ").strip()

                if book_id in existing_ids:
                    print("This ID already exists in list.json.")
                    continue
                if any(_normalize_id(b.get("id")) == book_id for b in pending):
                    print("This ID already exists in the queue.")
                    continue

                entry = _build_entry(
                    book_id, title, author, parts_value, categories_raw
                )
                pending.append(entry)
                print(f"Added to queue. Queue: {len(pending)}")
            except ValueError as exc:
                print(exc)
            continue

        print("Menu:")
        print("1) Remove from queue")
        print("2) Clear queue")
        print("3) Import from JSON file")
        print("4) Save to list.json")
        print("5) Show queue")
        print("6) Quit")
        choice = input("Choose: ").strip().lower()

        if choice in {"6", "quit", "exit", "q"}:
            break
        if choice in {"5", "list", "show"}:
            _print_queue(pending)
            continue
        if choice in {"2", "clear"}:
            pending = []
            print("Queue cleared.")
            continue
        if choice in {"1", "remove", "delete"}:
            target_id = _normalize_id(input("ID to remove: ").strip())
            if not target_id:
                print("ID is required.")
                continue
            before = len(pending)
            pending = [b for b in pending if _normalize_id(b.get("id")) != target_id]
            if len(pending) == before:
                print("ID not found in queue.")
            else:
                print("Removed from queue.")
            continue
        if choice in {"3", "import", "i"}:
            path_raw = input("Path to JSON file: ").strip()
            if not path_raw:
                print("Path is required.")
                continue
            try:
                import_path = Path(path_raw).expanduser().resolve()
                books = json.loads(import_path.read_text(encoding="utf-8"))
                if not isinstance(books, list):
                    raise ValueError("Import file must contain a JSON list.")
                added = 0
                skipped = 0
                invalid = 0
                for book in books:
                    if not isinstance(book, dict):
                        invalid += 1
                        continue
                    book_id = _normalize_id(book.get("id"))
                    title = (book.get("title") or "").strip()
                    author = (book.get("author") or "").strip()
                    if not book_id or not title or not author:
                        invalid += 1
                        continue
                    if book_id in existing_ids or any(
                        _normalize_id(b.get("id")) == book_id for b in pending
                    ):
                        skipped += 1
                        continue
                    entry = dict(book)
                    entry["id"] = book_id
                    pending.append(entry)
                    added += 1
                print(
                    f"Added {added} to queue. {skipped} skipped, {invalid} invalid."
                )
            except Exception as exc:
                print(f"Failed to import: {exc}")
            continue
        if choice in {"4", "save", "s"}:
            if not pending:
                print("Queue is empty.")
                continue
            try:
                latest = _load_list(list_path)
                latest_ids = _collect_existing_ids(latest)
                collisions = [
                    b.get("id")
                    for b in pending
                    if _normalize_id(b.get("id")) in latest_ids
                ]
                if collisions:
                    print("Duplicate IDs in list.json:")
                    for cid in collisions:
                        print(cid)
                    continue
                latest.extend(pending)
                _write_list(list_path, latest)
                existing_ids.update(_collect_existing_ids(pending))
                pending = []
                print("Saved. Queue cleared.")
            except Exception as exc:
                print(f"Save failed: {exc}")
            continue

        print("Unknown option.")


def _build_parser():
    parser = argparse.ArgumentParser(
        description="CLI tool to add books to books/list.json."
    )
    parser.add_argument(
        "--list-path",
        help="Path to list.json (optional).",
    )
    sub = parser.add_subparsers(dest="command")

    add_cmd = sub.add_parser("add", help="Add a single book and save.")
    add_cmd.add_argument("--id", required=True, help="Book ID.")
    add_cmd.add_argument("--title", required=True, help="Book title.")
    add_cmd.add_argument("--author", required=True, help="Author name.")
    add_cmd.add_argument("--parts", default="1", help="Number of parts.")
    add_cmd.add_argument(
        "--categories",
        help="Comma separated categories.",
    )
    add_cmd.add_argument(
        "-c",
        "--category",
        action="append",
        default=[],
        help="Single category (repeatable).",
    )

    import_cmd = sub.add_parser("import", help="Import books from a JSON file.")
    import_cmd.add_argument("file", help="Path to JSON file.")
    import_cmd.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be added without writing.",
    )

    sub.add_parser("interactive", help="Start interactive mode.")

    return parser


def main():
    _configure_output()
    parser = _build_parser()
    args = parser.parse_args()

    try:
        list_path = _find_list_path(args.list_path)
    except Exception as exc:
        print(exc)
        sys.exit(1)

    try:
        if args.command == "add":
            _add_single(args, list_path)
        elif args.command == "import":
            _import_from_file(args, list_path)
        else:
            _interactive(list_path)
    except Exception as exc:
        print(exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
