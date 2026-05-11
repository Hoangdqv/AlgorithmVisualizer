from pathlib import Path

def get_project_root() -> Path:
    current = Path(__file__).resolve()

    for parent in current.parents:
        if (parent / ".project-root").exists():
            return parent

    raise RuntimeError("Project root not found")