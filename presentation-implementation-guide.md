# Presentation Implementation Guide

How interactive course presentations work in this starter kit: PDF slides, video chapters, and LiveKit data messages between the client and the agent.

## Overview

A presentation agent can teach one or more lessons. Each lesson is either:

| Lesson type  | Media | Progress unit        |
|--------------|-------|----------------------|
| `attachment` | PDF   | Slide (`pageNumber`) |
| `multimedia` | Video | Chapter (`timeFrame`) |

The agent drives narration and timing. The client shows the correct page or video position, and reports user actions (page change, chapter end, pause, lesson select) back over LiveKit.

---

## Slide (PDF) presentation

1. The agent announces the active lesson and course outline.
2. For each slide, the agent sends a page cue and narrates that slide.
3. The client shows that page in the PDF viewer.
4. If the user taps prev/next, the client tells the agent which page to present next.

**Client → agent**

```json
{ "event": "page_change", "pageNumber": 3 }
```

**Agent → client**

- Topic `presentation-page-number` with `{ "pageNumber": 3 }`

---

## Video presentation

1. The agent announces a video lesson and its chapters.
2. For each chapter, the agent:
   - Seeks the client to the chapter start (`time-frame`, usually with `play: false`)
   - Starts narration
   - Authorizes playback (`play-video`)
3. The client plays until the chapter end (`nextTimeFrame`), then reports `chapter_change`.
4. The agent moves to the next chapter (or finishes the lesson).

**Playback rule:** do not pause the video on chapter handoffs. Pause only when the user asks, or when the agent reports `paused: true` in progress.

| Agent cue | Client action |
|-----------|----------------|
| `time-frame` | Seek to `timeFrame`; store `nextTimeFrame`. If `play` is `false`, seek only. If `play` is omitted, treat as play authorized (legacy). |
| `play-video` | Allow play. If `force: true`, play even if the agent is not currently speaking. |
| `pause-video` | Clear play authorization. |

**Client → agent**

```json
{ "event": "chapter_change" }
```

```json
{ "event": "jump_to_chapter", "slideOrder": 42.5 }
```

(`slideOrder` is the chapter start time in seconds.)

```json
{ "event": "pause_presentation" }
```

```json
{ "event": "resume_presentation" }
```

---

## LiveKit messages

Use reliable data packets.

### Agent → client (by topic)

| Topic | Role | Payload (typical) |
|-------|------|-------------------|
| `course-outline` | Lesson list for the lessons panel | `{ lessons: [...] }` |
| `active-lesson` | Switch the visible lesson / media | `{ contentId, contentType\|type, url?, storagePath?, title?, ... }` |
| `presentation-progress` | Progress UI and pause state | See below |
| `presentation-page-number` | PDF page | `{ pageNumber }` |
| `time-frame` | Video seek | `{ timeFrame, nextTimeFrame, play? }` |
| `play-video` | Allow video play | `{ force?: boolean }` |
| `pause-video` | Stop authorizing play | `{}` |
| `message` | Status or chat text | e.g. `"Starting presentation..."` |

**Progress fields** (on `presentation-progress`, and sometimes on `active-lesson`):

```ts
{
  contentId: number | null;
  title?: string;
  contentType?: string;
  index: number;           // 0-based
  total: number;
  displayIndex: number;    // 1-based
  percent: number;
  paused: boolean;
  active: boolean;
  mode: "presenting" | "qa" | "idle" | string;
  unitTopic?: string;      // slide/chapter title — not the data-channel topic
  label?: string;
  spokenCharOffset: number;
}
```

Use `unitTopic` for the slide/chapter title. Do not put that value in a field named `topic` — `topic` is reserved for routing (`time-frame`, `message`, etc.).

**Status text** such as `"Loading course..."` or `"Presentation paused"` should update a loading indicator, not be appended to chat history.

### Client → agent (events)

JSON body:

```json
{ "event": "<name>", ... }
```

| Event | When | Payload |
|-------|------|---------|
| `page_change` | PDF prev/next | `{ pageNumber }` |
| `chapter_change` | Video reached chapter end | `{}` |
| `jump_to_chapter` | User picked a chapter | `{ slideOrder }` |
| `select_lesson` | User picked a lesson | `{ contentId }` |
| `pause_presentation` | User paused / opened lessons or quiz | `{}` |
| `resume_presentation` | User resumed | `{}` |

---

## Client state (this repo)

| Store / module | Responsibility |
|----------------|----------------|
| `useCourseOutlineStore` | Lessons, active lesson, widget URL, progress |
| `usePresentationStore` | PDF current / total pages |
| `usePresentationVideoStore` | Video timeframe, play flag, force-play |
| `useVideoChaptersStore` | Chapter list UI |
| `useAgentSpeakingStore` | Gate video `play()` until the agent is speaking |
| `lib/presentation-data.ts` | Apply inbound presentation topics |
| `components/presentation/*` | PDF viewer, video player, stage, lessons panel, quiz |

Media for a lesson is usually loaded from:

`/api/aivah-media/agents/{agentId}/content/{contentId}`

---

## Example sequences

### PDF lesson

```
Agent → course-outline
Agent → active-lesson
Agent → presentation-page-number { pageNumber: 1 }
Agent narrates slide 1
Agent → presentation-page-number { pageNumber: 2 }
…
User taps next → { event: "page_change", pageNumber: 3 }
```

### Video lesson

```
Agent → active-lesson (multimedia)
Agent → time-frame { timeFrame, nextTimeFrame, play: false }
Agent narrates
Agent → play-video
Client plays until nextTimeFrame
Client → { event: "chapter_change" }
Agent starts next chapter
```

### Pause

```
Client → { event: "pause_presentation" }
Agent → presentation-progress { paused: true }
Agent → pause-video   (video lessons)
```

---

## Checklist

- [ ] Hydrate lessons (PDF/video, chapters, quiz questions when present)
- [ ] Handle inbound topics in the table above
- [ ] Keep transient `message` statuses out of chat history
- [ ] PDF: sync page from agent; publish `page_change` on manual nav
- [ ] Video: seek, speech-gated play, `chapter_change` at boundary; no auto-pause on handoffs
- [ ] Lessons panel: `select_lesson`; pause before quiz
