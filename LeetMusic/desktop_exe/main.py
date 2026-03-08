from __future__ import annotations

import json
import math
import random
import time
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox

import pygame

AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".flac", ".m4a"}
REPEAT_OFF = "off"
REPEAT_ONE = "one"
REPEAT_ALL = "all"


class SplashScreen(tk.Toplevel):
    def __init__(self, master: tk.Tk) -> None:
        super().__init__(master)
        self.overrideredirect(True)
        self.configure(bg="#07090f")
        self.geometry("680x380+220+180")
        self.attributes("-topmost", True)

        self.canvas = tk.Canvas(self, bg="#07090f", highlightthickness=0)
        self.canvas.pack(fill="both", expand=True)

        self.blobs = [
            self.canvas.create_oval(70, 60, 360, 290, fill="#f4d125", outline=""),
            self.canvas.create_oval(250, 50, 560, 300, fill="#ff8a00", outline=""),
            self.canvas.create_oval(200, 120, 500, 340, fill="#ff3cac", outline=""),
        ]
        self.title_txt = self.canvas.create_text(
            340,
            185,
            text="LeetMusic",
            fill="#fff7d6",
            font=("Segoe UI", 42, "bold"),
        )

        self.start = time.time()
        self._animate()

    def _animate(self) -> None:
        t = time.time() - self.start
        for idx, blob in enumerate(self.blobs):
            phase = t * (0.9 + idx * 0.2)
            dx = math.sin(phase) * 1.5
            dy = math.cos(phase * 1.2) * 1.2
            self.canvas.move(blob, dx, dy)
        pulse = 36 + int(math.sin(t * 2.4) * 3)
        self.canvas.itemconfig(self.title_txt, font=("Segoe UI", pulse, "bold"))
        if t < 1.8:
            self.after(16, self._animate)
        else:
            self.destroy()


class LeetMusicDesktop:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("LeetMusic EXE")
        self.root.geometry("1220x760")
        self.root.configure(bg="#0b0d13")

        self.base_dir = Path(__file__).resolve().parent
        self.music_dir = self.base_dir / "Music"
        self.music_dir.mkdir(parents=True, exist_ok=True)
        self.state_file = self.base_dir / "leetmusic_state.json"

        self.tracks: list[Path] = []
        self.track_lengths: dict[str, float] = {}
        self.current_index = -1
        self.repeat_mode = REPEAT_OFF
        self.is_paused = False

        self.play_started_at = 0.0
        self.paused_at = 0.0
        self.seek_position = 0.0
        self.seeking = False

        pygame.init()
        pygame.mixer.init(buffer=1024)

        self.state = self._load_state()

        self._build_ui()
        self._refresh_tracks()
        self._render_track_list()
        self._restore_repeat_mode()
        self._tick_progress()

        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    def _build_ui(self) -> None:
        root_wrap = tk.Frame(self.root, bg="#0b0d13")
        root_wrap.pack(fill="both", expand=True)

        sidebar = tk.Frame(root_wrap, bg="#080b11", width=70)
        sidebar.pack(side="left", fill="y")
        sidebar.pack_propagate(False)

        tk.Label(sidebar, text="✶", bg="#080b11", fg="#f4d125", font=("Segoe UI", 32)).pack(pady=(14, 18))
        self.sidebar_play = tk.Label(sidebar, text="▶", bg="#080b11", fg="#f4d125", font=("Segoe UI", 24, "bold"), cursor="hand2")
        self.sidebar_play.pack(pady=(4, 18))
        self.sidebar_play.bind("<Button-1>", self._play_from_vibe)

        for icon in ("⌕", "♫", "♡", "☰"):
            tk.Label(sidebar, text=icon, bg="#080b11", fg="#d0d7eb", font=("Segoe UI", 20)).pack(pady=14)

        content = tk.Frame(root_wrap, bg="#0b0d13")
        content.pack(side="left", fill="both", expand=True)

        top = tk.Frame(content, bg="#0b0d13")
        top.pack(fill="both", expand=True, padx=10, pady=10)

        # hero area
        hero = tk.Canvas(top, bg="#0b0d13", highlightthickness=0)
        hero.pack(fill="both", expand=True)
        self.hero = hero
        self.fog_layers = []
        self.fog_level = 0.0
        self.fog_visibility = 0.0
        random.seed(42)
        layer_presets = [
            {"y": 500, "thickness": 140, "speed": 0.085, "amp": 12, "tone": "#5a6478", "rise": 0.62},
            {"y": 545, "thickness": 170, "speed": 0.074, "amp": 15, "tone": "#6a7589", "rise": 0.78},
            {"y": 590, "thickness": 205, "speed": 0.062, "amp": 18, "tone": "#7b879b", "rise": 0.94},
            {"y": 640, "thickness": 245, "speed": 0.051, "amp": 21, "tone": "#8b97ab", "rise": 1.1},
        ]
        for lp in layer_presets:
            seed_layer = {
                "base_y": lp["y"],
                "thickness": lp["thickness"],
                "speed": lp["speed"],
                "amp": lp["amp"],
                "rise_offset": 0.0,
                "phase": random.uniform(0, 6.28),
            }
            seed_points = self._fog_polygon_points(seed_layer, t=0.0, intensity=self.fog_level)
            fog_id = hero.create_polygon(
                *seed_points,
                smooth=True,
                splinesteps=42,
                fill="#0b0d13",
                outline="",
            )
            self.fog_layers.append(
                {
                    "id": fog_id,
                    "base_y": lp["y"],
                    "thickness": lp["thickness"],
                    "speed": lp["speed"],
                    "amp": lp["amp"],
                    "phase": seed_layer["phase"],
                    "tone": lp["tone"],
                    "rise": lp["rise"],
                    "rise_offset": 0.0,
                }
            )

        self.fog_wisps = []
        wisp_presets = [
            {"x": 420, "width": 22, "tone": "#97a3b8", "speed": 0.15, "rise": 0.95},
            {"x": 510, "width": 18, "tone": "#a9b5c8", "speed": 0.13, "rise": 1.05},
            {"x": 610, "width": 26, "tone": "#8f9cb2", "speed": 0.11, "rise": 0.88},
            {"x": 705, "width": 16, "tone": "#b1bdd0", "speed": 0.12, "rise": 1.12},
        ]
        for wp in wisp_presets:
            seed_points = self._wisp_line_points(wp, t=0.0, visibility=0.0)
            wisp_id = hero.create_line(
                *seed_points,
                smooth=True,
                splinesteps=26,
                width=wp["width"],
                fill="#0b0d13",
                capstyle=tk.ROUND,
                joinstyle=tk.ROUND,
            )
            self.fog_wisps.append({"id": wisp_id, **wp})

        self.hero_overlay = hero.create_rectangle(0, 0, 2000, 2000, fill="#03050a", outline="")
        hero.tag_lower(self.hero_overlay)
        for layer in self.fog_layers:
            hero.tag_raise(layer["id"])
        for wisp in self.fog_wisps:
            hero.tag_raise(wisp["id"])

        self.hero_vibe_text = hero.create_text(470, 290, text="▶ Твой вайб", font=("Segoe UI", 42, "bold"), fill="#fff7d5")
        hero.tag_bind(self.hero_vibe_text, "<Button-1>", self._play_from_vibe)

        self.info_chip = tk.Label(
            top,
            text="Скинь сюда треки и будем слушать брат",
            bg="#2d2f36",
            fg="#fff4cc",
            font=("Segoe UI", 11, "bold"),
            padx=14,
            pady=6,
        )
        self.info_chip.place(x=420, y=335)

        library_panel = tk.Frame(top, bg="#171b27", highlightthickness=1, highlightbackground="#313a52")
        library_panel.place(x=24, y=430, width=420, height=230)

        lib_head = tk.Frame(library_panel, bg="#171b27")
        lib_head.pack(fill="x", padx=10, pady=8)

        tk.Button(lib_head, text="Обновить", command=self._refresh_and_render, bg="#283149", fg="#eaf0ff", relief="flat").pack(side="left", padx=(0, 6))
        tk.Button(lib_head, text="Импорт", command=self._import_files, bg="#283149", fg="#eaf0ff", relief="flat").pack(side="left")
        self.library_status = tk.Label(lib_head, text="", bg="#171b27", fg="#95a1c0")
        self.library_status.pack(side="right")

        self.track_listbox = tk.Listbox(
            library_panel,
            bg="#111724",
            fg="#edf2ff",
            selectbackground="#f4d125",
            selectforeground="#1a1a1a",
            borderwidth=0,
            activestyle="none",
            font=("Segoe UI", 11),
        )
        self.track_listbox.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        self.track_listbox.bind("<<ListboxSelect>>", self._on_select_track)

        # now panel
        self.now_card = tk.Frame(top, bg="#171b27", highlightthickness=1, highlightbackground="#313a52")
        self.now_card.place(x=470, y=430, width=420, height=230)
        self.now_title = tk.Label(self.now_card, text="Выберите трек", bg="#171b27", fg="#ffffff", font=("Segoe UI", 16, "bold"), wraplength=390)
        self.now_title.pack(anchor="w", padx=14, pady=(14, 2))
        self.now_artist = tk.Label(self.now_card, text="LeetMusic Desktop", bg="#171b27", fg="#95a1c0", font=("Segoe UI", 10))
        self.now_artist.pack(anchor="w", padx=14)

        # dock
        dock = tk.Frame(content, bg="#3a2942", height=84)
        dock.pack(fill="x", padx=10, pady=(0, 10))
        dock.pack_propagate(False)

        left_meta = tk.Frame(dock, bg="#3a2942")
        left_meta.pack(side="left", fill="y", padx=12)
        self.mini_title = tk.Label(left_meta, text="LeetMusic", bg="#3a2942", fg="#fff", font=("Segoe UI", 12, "bold"))
        self.mini_title.pack(anchor="w", pady=(14, 0))
        self.mini_sub = tk.Label(left_meta, text="Оффлайн плеер", bg="#3a2942", fg="#c8cde0", font=("Segoe UI", 10))
        self.mini_sub.pack(anchor="w")

        controls = tk.Frame(dock, bg="#3a2942")
        controls.pack(side="left", padx=14)

        self.like_btn = tk.Button(controls, text="♡", command=self._toggle_like_current, width=3, bg="#4a3953", fg="#fff", relief="flat")
        self.like_btn.grid(row=0, column=0, padx=4)
        self.prev_btn = tk.Button(controls, text="⏮", command=self._play_prev, width=3, bg="#4a3953", fg="#fff", relief="flat")
        self.prev_btn.grid(row=0, column=1, padx=4)
        self.play_btn = tk.Button(controls, text="▶", command=self._toggle_play_pause, width=3, bg="#f4d125", fg="#171717", relief="flat")
        self.play_btn.grid(row=0, column=2, padx=4)
        self.next_btn = tk.Button(controls, text="⏭", command=self._play_next, width=3, bg="#4a3953", fg="#fff", relief="flat")
        self.next_btn.grid(row=0, column=3, padx=4)
        self.repeat_btn = tk.Button(controls, text="➡", command=self._switch_repeat_mode, width=3, bg="#4a3953", fg="#fff", relief="flat")
        self.repeat_btn.grid(row=0, column=4, padx=4)

        progress_wrap = tk.Frame(dock, bg="#3a2942")
        progress_wrap.pack(side="left", fill="x", expand=True, padx=8)

        self.progress_var = tk.DoubleVar(value=0)
        self.progress = tk.Scale(
            progress_wrap,
            variable=self.progress_var,
            from_=0,
            to=100,
            orient="horizontal",
            showvalue=False,
            bg="#3a2942",
            fg="#fff",
            troughcolor="#5f4b68",
            highlightthickness=0,
            relief="flat",
            length=420,
        )
        self.progress.pack(fill="x", pady=(12, 2))
        self.progress.bind("<ButtonPress-1>", self._begin_seek)
        self.progress.bind("<B1-Motion>", self._preview_seek)
        self.progress.bind("<ButtonRelease-1>", self._commit_seek)

        info_row = tk.Frame(progress_wrap, bg="#3a2942")
        info_row.pack(fill="x")
        self.time_label = tk.Label(info_row, text="0:00 / 0:00", bg="#3a2942", fg="#d5dbef")
        self.time_label.pack(side="left")

        right = tk.Frame(dock, bg="#3a2942")
        right.pack(side="right", padx=12)
        tk.Label(right, text="Громк.", bg="#3a2942", fg="#d5dbef").pack(side="left", padx=(0, 4))
        self.volume = tk.Scale(
            right,
            from_=0,
            to=100,
            orient="horizontal",
            showvalue=False,
            command=self._set_volume,
            bg="#3a2942",
            fg="#d5dbef",
            troughcolor="#5f4b68",
            highlightthickness=0,
            relief="flat",
            length=120,
        )
        self.volume.set(85)
        self.volume.pack(side="left")
        pygame.mixer.music.set_volume(0.85)

        self._animate_hero(0)

    @staticmethod
    def _mix_color(c1: str, c2: str, t: float) -> str:
        t = max(0.0, min(1.0, t))
        a = [int(c1[i:i+2], 16) for i in (1, 3, 5)]
        b = [int(c2[i:i+2], 16) for i in (1, 3, 5)]
        m = [round(a[i] + (b[i] - a[i]) * t) for i in range(3)]
        return f"#{m[0]:02x}{m[1]:02x}{m[2]:02x}"

    def _is_music_active(self) -> bool:
        return self.current_index != -1 and (not self.is_paused) and pygame.mixer.music.get_busy()

    def _play_from_vibe(self, _event=None) -> None:
        if self.current_index == -1 and self.tracks:
            self._play_track(0)
            return
        self._toggle_play_pause()

    def _fog_polygon_points(self, layer: dict, t: float, intensity: float) -> list[float]:
        left = 80
        right = 1130
        step = 44
        rise = layer.get("rise_offset", 0.0)

        top_points = []
        x = left
        while x <= right:
            wave = math.sin((x * 0.008) + t * layer["speed"] + layer["phase"]) * layer["amp"]
            wave += math.cos((x * 0.0044) - t * layer["speed"] * 0.82 + layer["phase"] * 0.7) * (layer["amp"] * 0.5)
            y = layer["base_y"] - rise + wave * (0.35 + intensity * 0.72)
            top_points.extend([x, y])
            x += step

        bottom_points = []
        x = right
        while x >= left:
            wave = math.sin((x * 0.007) + t * layer["speed"] + layer["phase"] * 1.2) * layer["amp"]
            wave += math.cos((x * 0.0038) - t * layer["speed"] * 0.9 + layer["phase"] * 0.48) * (layer["amp"] * 0.4)
            y = layer["base_y"] + layer["thickness"] - rise + wave * (0.3 + intensity * 0.45)
            bottom_points.extend([x, y])
            x -= step

        return top_points + bottom_points

    def _wisp_line_points(self, wisp: dict, t: float, visibility: float) -> list[float]:
        points = []
        segments = 10
        start_y = 760 - (visibility * 40)
        max_rise = 340 * wisp["rise"] * visibility
        for i in range(segments + 1):
            p = i / segments
            y = start_y - (max_rise * p)
            sway = math.sin((t * wisp["speed"] * 9) + p * 6.2 + wisp["x"] * 0.01) * (14 + visibility * 22)
            twist = math.cos((t * wisp["speed"] * 7.5) + p * 3.8) * (6 + visibility * 12)
            x = wisp["x"] + sway + twist
            points.extend([x, y])
        return points

    def _animate_hero(self, step: int) -> None:
        t = step / 30
        active = self._is_music_active()

        target_visibility = 1.0 if active else 0.0
        self.fog_visibility += (target_visibility - self.fog_visibility) * (0.052 if active else 0.02)

        target_level = 1.0 if active else 0.0
        self.fog_level += (target_level - self.fog_level) * 0.05

        for layer in self.fog_layers:
            drift = math.sin((t * layer["speed"] * 1.9) + layer["phase"]) * 24
            layer["rise_offset"] = (self.fog_visibility * (270 * layer["rise"])) + drift * self.fog_visibility
            pts = self._fog_polygon_points(layer, t, self.fog_level)
            self.hero.coords(layer["id"], *pts)

            alpha = self.fog_visibility * (0.58 + layer["rise"] * 0.34)
            smoke_tone = self._mix_color("#080a10", layer["tone"], alpha)
            self.hero.itemconfig(layer["id"], fill=smoke_tone)

        for wisp in self.fog_wisps:
            wisp_points = self._wisp_line_points(wisp, t, self.fog_visibility)
            self.hero.coords(wisp["id"], *wisp_points)
            wisp_color = self._mix_color("#0b0d13", wisp["tone"], self.fog_visibility * 0.62)
            self.hero.itemconfig(wisp["id"], fill=wisp_color)

        overlay = self._mix_color("#05070d", "#0a111c", self.fog_visibility * 0.2)
        self.hero.itemconfig(self.hero_overlay, fill=overlay)

        text_color = self._mix_color("#9a9385", "#fff8dc", 0.3 + self.fog_visibility * 0.7)
        self.hero.itemconfig(self.hero_vibe_text, fill=text_color)

        self.root.after(40, lambda: self._animate_hero(step + 1))

    def _refresh_tracks(self) -> None:
        self.tracks = sorted(
            [p for p in self.music_dir.iterdir() if p.is_file() and p.suffix.lower() in AUDIO_EXTENSIONS],
            key=lambda p: p.name.lower(),
        )
        self.track_lengths.clear()
        for track in self.tracks:
            try:
                self.track_lengths[track.as_posix()] = float(pygame.mixer.Sound(track.as_posix()).get_length())
            except pygame.error:
                self.track_lengths[track.as_posix()] = 0.0
        self.library_status.config(text=f"Треков: {len(self.tracks)}")

    def _render_track_list(self) -> None:
        self.track_listbox.delete(0, tk.END)
        liked = set(self.state.get("liked", []))
        if not self.tracks:
            self.track_listbox.insert(tk.END, "Нет треков в папке Music")
            return
        for idx, track in enumerate(self.tracks):
            heart = "♥ " if track.name in liked else ""
            self.track_listbox.insert(tk.END, f"{heart}{idx + 1}. {track.stem}")

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
        if not sel or not self.tracks:
            return
        idx = sel[0]
        if idx < len(self.tracks):
            self._play_track(idx, 0.0)

    def _play_track(self, idx: int, start_pos: float = 0.0) -> None:
        if idx < 0 or idx >= len(self.tracks):
            return
        self.current_index = idx
        track = self.tracks[idx]

        try:
            pygame.mixer.music.load(track.as_posix())
            pygame.mixer.music.play(start=max(0.0, start_pos))
        except pygame.error:
            pygame.mixer.music.play()

        self.is_paused = False
        self.seek_position = max(0.0, start_pos)
        self.play_started_at = time.time() - self.seek_position
        self.paused_at = self.seek_position

        self.now_title.config(text=track.stem)
        self.mini_title.config(text=track.stem)
        self.mini_sub.config(text=track.name)
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
            self.play_started_at = time.time() - self.paused_at
            self.play_btn.config(text="❚❚")
        else:
            pygame.mixer.music.pause()
            self.is_paused = True
            self.paused_at = self._current_elapsed()
            self.play_btn.config(text="▶")

    def _play_prev(self) -> None:
        if not self.tracks:
            return
        if self.current_index == -1:
            self._play_track(0)
            return
        if self._current_elapsed() > 3:
            self._play_track(self.current_index, 0.0)
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
                self.is_paused = False
                self.play_btn.config(text="▶")
            return
        self._play_track(self.current_index + 1)

    def _begin_seek(self, _event=None) -> None:
        self.seeking = True

    def _preview_seek(self, _event=None) -> None:
        if self.current_index == -1:
            return
        target = float(self.progress_var.get())
        total = self._current_total()
        self.time_label.config(text=f"{self._fmt(target)} / {self._fmt(total)}")

    def _commit_seek(self, _event=None) -> None:
        if self.current_index == -1:
            self.seeking = False
            return

        target = max(0.0, float(self.progress_var.get()))
        was_paused = self.is_paused
        self._play_track(self.current_index, target)
        if was_paused:
            pygame.mixer.music.pause()
            self.is_paused = True
            self.paused_at = target
            self.play_btn.config(text="▶")
        self.seeking = False

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
        self.repeat_btn.config(text="🔂" if repeat == REPEAT_ONE else "🔁" if repeat == REPEAT_ALL else "➡")

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

    def _current_total(self) -> float:
        if self.current_index == -1:
            return 0.0
        return self.track_lengths.get(self.tracks[self.current_index].as_posix(), 0.0)

    def _current_elapsed(self) -> float:
        if self.current_index == -1:
            return 0.0
        if self.is_paused:
            return self.paused_at
        return max(0.0, time.time() - self.play_started_at)

    def _tick_progress(self) -> None:
        if self.current_index != -1:
            total = self._current_total()
            elapsed = self._current_elapsed()

            if total > 0 and elapsed >= total - 0.15 and not self.is_paused:
                if self.repeat_mode == REPEAT_ONE:
                    self._play_track(self.current_index, 0.0)
                elif self.current_index < len(self.tracks) - 1:
                    self._play_track(self.current_index + 1, 0.0)
                elif self.repeat_mode == REPEAT_ALL and self.tracks:
                    self._play_track(0, 0.0)
                else:
                    pygame.mixer.music.stop()
                    self.play_btn.config(text="▶")

            if not self.seeking:
                self.progress.config(to=max(1, int(total) if total else 100))
                self.progress_var.set(min(elapsed, total if total else elapsed))
            self.time_label.config(text=f"{self._fmt(elapsed)} / {self._fmt(total)}")

        self.root.after(180, self._tick_progress)

    @staticmethod
    def _fmt(seconds: float) -> str:
        sec = max(0, int(seconds))
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
    root.withdraw()
    splash = SplashScreen(root)
    root.after(1850, root.deiconify)
    root.after(1900, lambda: splash.destroy() if splash.winfo_exists() else None)
    LeetMusicDesktop(root)
    root.mainloop()


if __name__ == "__main__":
    main()
