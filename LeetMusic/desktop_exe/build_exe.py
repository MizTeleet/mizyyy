from __future__ import annotations

import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PYTHON = sys.executable


def run(cmd: list[str]) -> None:
    print("$", " ".join(cmd))
    subprocess.run(cmd, check=True, cwd=BASE_DIR)


def main() -> None:
    run([PYTHON, "-m", "pip", "install", "-r", "requirements.txt"])
    run(
        [
            PYTHON,
            "-m",
            "PyInstaller",
            "--noconfirm",
            "--clean",
            "--windowed",
            "--onefile",
            "--name",
            "LeetMusicEXE",
            "main.py",
        ]
    )
    exe_path = BASE_DIR / "dist" / "LeetMusicEXE.exe"
    print(f"\nГотово! EXE: {exe_path}")


if __name__ == "__main__":
    main()
