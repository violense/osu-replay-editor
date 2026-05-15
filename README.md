# Replay Editor

A compact browser-based editor and visualizer for osu! `.osr` replay files.

It can decode a replay, show cursor movement, display key presses, load the matching `.osu` beatmap difficulty, render osu!standard hit objects, adjust basic replay metadata, and export the edited replay back to `.osr`.

## Features

- Decode and encode osu! `.osr` replay files.
- Load a matching `.osu` difficulty to render hit circles, sliders, and spinners.
- Canvas playfield with cursor trail, hit objects, timeline, and transport controls.
- Basic replay metadata editing: score, combo, hit counts, mods, hashes, timestamp, score id.
- Map/replay offset sync for aligning replay cursor timing with beatmap objects.
- Hard Rock: circles/sliders are reflected vertically (512×384) to match stable replay cursor data.
- Pink compact UI optimized for quick replay inspection and editing.

## Limitations

- The hit object renderer currently targets osu!standard only.
- `.osr` files do not contain beatmap geometry, so a matching `.osu` file is required for hit objects.
- Exported files are intended for local editing/inspection. Online score validation and checksum integrity are not guaranteed after manual edits.
- Slider and timing support is best-effort and may still differ from osu! on unusual maps.

## Usage

1. Open a `.osr` replay.
2. Load the matching `.osu` difficulty from the same beatmap.
3. If objects and cursor are not aligned, use `sync` or adjust `Map offset`.
4. Edit metadata or frames if needed.
5. Export the edited replay.

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Type check:

```bash
npm run typecheck
```

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- `lzma1` for replay frame compression/decompression

## Notes

This project is not affiliated with osu!, ppy, or the osu! team.

---

# Replay Editor

Компактный браузерный редактор и визуализатор `.osr` реплеев для osu!.

Он умеет декодировать реплей, показывать движение курсора, отображать нажатия клавиш, загружать подходящий `.osu` файл сложности, рисовать объекты osu!standard, редактировать базовые метаданные реплея и экспортировать результат обратно в `.osr`.

## Возможности

- Декодирование и кодирование `.osr` replay-файлов.
- Загрузка подходящей `.osu` сложности для отображения кругов, слайдеров и спиннеров.
- Canvas-поле с трейлом курсора, объектами карты, таймлайном и управлением воспроизведением.
- Редактирование базовых данных реплея: score, combo, hit counts, mods, hashes, timestamp, score id.
- Синхронизация времени карты и реплея через `Map offset`.
- Hard Rock: вертикальное отражение кругов/слайдеров (512×384) под данные курсора в stable.
- Компактный розовый UI для быстрого просмотра и правки реплеев.

## Ограничения

- Рендер объектов сейчас рассчитан только на osu!standard.
- В `.osr` нет геометрии карты, поэтому для объектов нужен подходящий `.osu` файл той же сложности.
- Экспорт предназначен для локальной правки и анализа. Онлайн-валидация score и корректность checksum после ручных изменений не гарантируются.
- Поддержка слайдеров и timing points максимально приближена, но на необычных картах может отличаться от osu!.

## Использование

1. Открой `.osr` replay.
2. Загрузи подходящий `.osu` файл той же сложности.
3. Если курсор и объекты не совпадают, нажми `sync` или вручную поправь `Map offset`.
4. При необходимости измени метаданные или кадры.
5. Экспортируй отредактированный replay.

## Разработка

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Проверка TypeScript:

```bash
npm run typecheck
```

## Стек

- React
- TypeScript
- Vite
- Tailwind CSS
- `lzma1` для сжатия и распаковки replay frames

## Примечание

Проект не связан с osu!, ppy или командой osu!.
