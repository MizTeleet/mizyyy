from __future__ import annotations

import json
import time
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox

import pygame

AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".flac", ".m4a"}
REPEAT_OFF = "off"
REPEAT_ONE = "one"
REPEAT_ALL = "all"


class LeetMusicDesktop:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("LeetMusic EXE")
        self.root.geometry("980x620")
        self.root.configure(bg="#131722")

        self.base_dir = Path(__file__).resolve().parent
        self.music_dir = self.base_dir / "Music"
        self.music_dir.mkdir(parents=True, exist_ok=True)
        self.state_file = self.base_dir / "leetmusic_state.json"

        self.tracks: list[Path] = []
        self.current_index = -1
        self.repeat_mode = REPEAT_OFF
        self.is_paused = False

        pygame.init()
        pygame.mixer.init()

        self.state = self._load_state()

        self._build_ui()
        self._refresh_tracks()
        self._render_track_list()
        self._restore_repeat_mode()
        self._tick_progress()

        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    def _build_ui(self) -> None:
        title = tk.Label(
            self.root,
            text="LeetMusic",
            font=("Segoe Script", 30, "bold"),
            bg="#131722",
            fg="#f0f3ff",
        )
        title.pack(anchor="w", padx=16, pady=(10, 4))

        subtitle = tk.Label(
            self.root,
            text="EXE-версия. Музыка загружается из папки desktop_exe/Music",
            bg="#131722",
            fg="#95a1c0",
            font=("Segoe UI", 10),
        )
        subtitle.pack(anchor="w", padx=18, pady=(0, 8))

        layout = tk.Frame(self.root, bg="#131722")
        layout.pack(fill="both", expand=True, padx=12, pady=(0, 10))

        # Library panel
        library = tk.Frame(layout, bg="#1b2130", highlightthickness=1, highlightbackground="#313a52")
        library.pack(side="left", fill="both", expand=True)

        lib_header = tk.Frame(library, bg="#1b2130")
        lib_header.pack(fill="x", padx=10, pady=8)

        tk.Button(
            lib_header,
            text="Обновить",
            command=self._refresh_and_render,
            bg="#2b3348",
            fg="#e9eeff",
            relief="flat",
            padx=10,
        ).pack(side="left", padx=(0, 8))

        tk.Button(
            lib_header,
            text="Добавить файлы в Music",
            command=self._import_files,
            bg="#2b3348",
            fg="#e9eeff",
            relief="flat",
            padx=10,
        ).pack(side="left")

        self.library_status = tk.Label(lib_header, text="", bg="#1b2130", fg="#95a1c0")
        self.library_status.pack(side="right")

        self.track_listbox = tk.Listbox(
            library,
            bg="#141a28",
            fg="#eaf0ff",
            selectbackground="#f4d125",
            selectforeground="#1a1a1a",
            borderwidth=0,
            activestyle="none",
            font=("Segoe UI", 11),
        )
        self.track_listbox.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        self.track_listbox.bind("<<ListboxSelect>>", self._on_select_track)

        # Player panel
        player = tk.Frame(layout, bg="#1b2130", width=300, highlightthickness=1, highlightbackground="#313a52")
        player.pack(side="right", fill="y", padx=(12, 0))
        player.pack_propagate(False)

        self.now_title = tk.Label(player, text="Выберите трек", bg="#1b2130", fg="#f0f3ff", font=("Segoe UI", 13, "bold"), wraplength=260, justify="left")
        self.now_title.pack(anchor="w", padx=14, pady=(14, 2))

        self.now_artist = tk.Label(player, text="LeetMusic Desktop", bg="#1b2130", fg="#95a1c0", font=("Segoe UI", 10))
        self.now_artist.pack(anchor="w", padx=14, pady=(0, 10))

        control_row = tk.Frame(player, bg="#1b2130")
        control_row.pack(fill="x", padx=12, pady=6)

        self.prev_btn = tk.Button(control_row, text="⏮", command=self._play_prev, width=4, bg="#2a3248", fg="#fff", relief="flat")
        self.prev_btn.pack(side="left", padx=4)

        self.play_btn = tk.Button(control_row, text="▶", command=self._toggle_play_pause, width=5, bg="#f4d125", fg="#181818", relief="flat")
        self.play_btn.pack(side="left", padx=4)

        self.next_btn = tk.Button(control_row, text="⏭", command=self._play_next, width=4, bg="#2a3248", fg="#fff", relief="flat")
        self.next_btn.pack(side="left", padx=4)

        self.like_btn = tk.Button(control_row, text="♡", command=self._toggle_like_current, width=4, bg="#2a3248", fg="#fff", relief="flat")
        self.like_btn.pack(side="left", padx=4)

        self.repeat_btn = tk.Button(control_row, text="➡", command=self._switch_repeat_mode, width=4, bg="#2a3248", fg="#fff", relief="flat")
        self.repeat_btn.pack(side="left", padx=4)

        self.progress_var = tk.DoubleVar(value=0)
        self.progress = tk.Scale(
            player,
            variable=self.progress_var,
            from_=0,
            to=100,
            orient="horizontal",
            showvalue=False,
            command=self._seek,
            bg="#1b2130",
            fg="#95a1c0",
            troughcolor="#2f394f",
            highlightthickness=0,
        )
        self.progress.pack(fill="x", padx=12, pady=(10, 2))

        self.time_label = tk.Label(player, text="0:00 / 0:00", bg="#1b2130", fg="#95a1c0")
        self.time_label.pack(anchor="w", padx=14)

        volume_row = tk.Frame(player, bg="#1b2130")
        volume_row.pack(fill="x", padx=12, pady=(10, 6))

        tk.Label(volume_row, text="Громкость", bg="#1b2130", fg="#95a1c0").pack(side="left")
        self.volume = tk.Scale(
            volume_row,
            from_=0,
            to=100,
            orient="horizontal",
            showvalue=False,
            command=self._set_volume,
            bg="#1b2130",
            fg="#95a1c0",
            troughcolor="#2f394f",
            highlightthickness=0,
            length=160,
        )
        self.volume.set(85)
        self.volume.pack(side="right")
        pygame.mixer.music.set_volume(0.85)

        help_text = (
            "Режимы повтора:\n"
            "➡ — следующий трек\n"
            "🔂 — повтор одного\n"
            "🔁 — повтор всего списка"
        )
        tk.Label(player, text=help_text, justify="left", bg="#1b2130", fg="#95a1c0").pack(anchor="w", padx=14, pady=(8, 0))

    def _refresh_tracks(self) -> None:
        self.tracks = sorted(
            [p for p in self.music_dir.iterdir() if p.is_file() and p.suffix.lower() in AUDIO_EXTENSIONS],
            key=lambda p: p.name.lower(),
        )
        self.library_status.config(text=f"Треков: {len(self.tracks)}")

    def _render_track_list(self) -> None:
        self.track_listbox.delete(0, tk.END)
        liked = set(self.state.get("liked", []))

        if not self.tracks:
            self.track_listbox.insert(tk.END, "Нет треков в папке Music")
            return

        for idx, track in enumerate(self.tracks):
            mark = "♥ " if track.name in liked else ""
            self.track_listbox.insert(tk.END, f"{mark}{idx + 1}. {track.name}")

    def _refresh_and_render(self) -> None:
        self._refresh_tracks()
        self._render_track_list()

    def _import_files(self) -> None:
        files = filedialog.askopenfilenames(title="Выберите музыкальные файлы")
        if not files:
            return
        copied = 0
        for src in files:
            src_path = Path(src)
            if src_path.suffix.lower() not in AUDIO_EXTENSIONS:
                continue
            dst = self.music_dir / src_path.name
            dst.write_bytes(src_path.read_bytes())
            copied += 1
        self._refresh_and_render()
        messagebox.showinfo("LeetMusic", f"Добавлено файлов: {copied}")

    def _on_select_track(self, _event=None) -> None:
        sel = self.track_listbox.curselection()
        if not sel:
            return
        if not self.tracks:
            return
        idx = sel[0]
        if idx >= len(self.tracks):
            return
        self._play_track(idx)

    def _play_track(self, idx: int) -> None:
        if idx < 0 or idx >= len(self.tracks):
            return
        self.current_index = idx
        track = self.tracks[idx]
        pygame.mixer.music.load(track.as_posix())
        pygame.mixer.music.play()
        self.is_paused = False
        self.now_title.config(text=track.stem)
        self.play_btn.config(text="❚❚")
        self._update_like_button()

    def _toggle_play_pause(self) -> None:
        if self.current_index == -1 and self.tracks:
            self._play_track(0)
            return
        if self.current_index == -1:
            return

        if self.is_paused:
            pygame.mixer.music.unpause()
            self.is_paused = False
            self.play_btn.config(text="❚❚")
        else:
            if pygame.mixer.music.get_busy():
                pygame.mixer.music.pause()
                self.is_paused = True
                self.play_btn.config(text="▶")
            else:
                self._play_track(self.current_index)

    def _play_prev(self) -> None:
        if not self.tracks:
            return
        if self.current_index <= 0:
            self._play_track(len(self.tracks) - 1 if self.repeat_mode == REPEAT_ALL else 0)
            return
        self._play_track(self.current_index - 1)

    def _play_next(self) -> None:
        if not self.tracks:
            return
        if self.current_index >= len(self.tracks) - 1:
            if self.repeat_mode == REPEAT_ALL:
                self._play_track(0)
            else:
                pygame.mixer.music.stop()
                self.play_btn.config(text="▶")
            return
        self._play_track(self.current_index + 1)

    def _seek(self, _value: str) -> None:
        if self.current_index == -1:
            return
        try:
            pos = float(self.progress_var.get())
            pygame.mixer.music.set_pos(pos)
        except pygame.error:
            pass

    def _set_volume(self, value: str) -> None:
        pygame.mixer.music.set_volume(float(value) / 100)

    def _switch_repeat_mode(self) -> None:
        if self.repeat_mode == REPEAT_OFF:
            self.repeat_mode = REPEAT_ONE
            self.repeat_btn.config(text="🔂")
        elif self.repeat_mode == REPEAT_ONE:
            self.repeat_mode = REPEAT_ALL
            self.repeat_btn.config(text="🔁")
        else:
            self.repeat_mode = REPEAT_OFF
            self.repeat_btn.config(text="➡")
        self.state["repeat"] = self.repeat_mode
        self._save_state()

    def _restore_repeat_mode(self) -> None:
        repeat = self.state.get("repeat", REPEAT_OFF)
        if repeat not in {REPEAT_OFF, REPEAT_ONE, REPEAT_ALL}:
            repeat = REPEAT_OFF
        self.repeat_mode = repeat
        if repeat == REPEAT_ONE:
            self.repeat_btn.config(text="🔂")
        elif repeat == REPEAT_ALL:
            self.repeat_btn.config(text="🔁")
        else:
            self.repeat_btn.config(text="➡")

    def _toggle_like_current(self) -> None:
        if self.current_index == -1:
            return
        liked = set(self.state.get("liked", []))
        current_name = self.tracks[self.current_index].name
        if current_name in liked:
            liked.remove(current_name)
        else:
            liked.add(current_name)
        self.state["liked"] = sorted(liked)
        self._save_state()
        self._update_like_button()
        self._render_track_list()

    def _update_like_button(self) -> None:
        if self.current_index == -1:
            self.like_btn.config(text="♡")
            return
        liked = set(self.state.get("liked", []))
        current_name = self.tracks[self.current_index].name
        self.like_btn.config(text="♥" if current_name in liked else "♡")

    def _tick_progress(self) -> None:
        if self.current_index != -1:
            elapsed = max(0.0, pygame.mixer.music.get_pos() / 1000)
            self.progress_var.set(elapsed)

            total_sec = 0
            try:
                total_sec = pygame.mixer.Sound(self.tracks[self.current_index].as_posix()).get_length()
            except pygame.error:
                total_sec = 0

            self.progress.config(to=max(1, int(total_sec) if total_sec else 100))
            self.time_label.config(text=f"{self._fmt(elapsed)} / {self._fmt(total_sec)}")

            if not pygame.mixer.music.get_busy() and not self.is_paused:
                if self.repeat_mode == REPEAT_ONE:
                    self._play_track(self.current_index)
                elif self.current_index < len(self.tracks) - 1:
                    self._play_track(self.current_index + 1)
                elif self.repeat_mode == REPEAT_ALL and self.tracks:
                    self._play_track(0)

        self.root.after(500, self._tick_progress)

    @staticmethod
    def _fmt(seconds: float) -> str:
        sec = int(seconds)
        return f"{sec // 60}:{sec % 60:02d}"

    def _load_state(self) -> dict:
        if self.state_file.exists():
            try:
                return json.loads(self.state_file.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                return {}
        return {}

    def _save_state(self) -> None:
        self.state_file.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")

    def _on_close(self) -> None:
        try:
            pygame.mixer.music.stop()
            pygame.mixer.quit()
        except pygame.error:
            pass
        self.root.destroy()


def main() -> None:
    root = tk.Tk()
    LeetMusicDesktop(root)
    root.mainloop()


if __name__ == "__main__":
    main()
