# Native chat verification

From the repository root:

```sh
swiftc apps/mobile/modules/lody-kit/ios/Chat/ChatTranscript.swift \
  apps/mobile/modules/lody-kit/ios/Chat/ChatStream.swift \
  apps/mobile/modules/lody-kit/ios/Chat/ChatTextFade.swift \
  apps/mobile/modules/lody-kit/verification/chat/main.swift \
  -o /tmp/lody-chat-test && /tmp/lody-chat-test
```

Settings → Debug → 原生聊天预览 uses the production native view with 80 history
entries and a simulated burst stream. Replay sends 48 characters every 700 ms;
Swift spreads each burst over presentation frames; new graphemes fade in over
220 ms. Fade ticks redraw glyphs without updating list layout. The preview sends no network
writes. Sending preview input appends a local user message and starts a simulated
reply. Tapping a tool in the process sheet simulates a failure.

Verify: scroll history; replay at the bottom; open the process entry while text
arrives inside the process sheet; completion folds intermediate rows into the process entry with a 220 ms transition;
check multiline input and interactive keyboard dismissal; repeat in dark mode.

The RN page owns navigation and cloud actions; LodyKit owns collection cells,
Markdown, text pacing, expansion, measured row heights, keyboard and input state.
MarkdownView parses Markdown, including unfinished input; the active tail is parsed
on a serial background queue and parse results are cached by source text. Row heights
come from an offscreen `MarkdownTextView` per row that keeps its document across width
changes. Presentation pacing is inspired by FlowDown's `BalancedEmitter`; MarkdownView
and Litext are SPM dependencies pulled in through `cocoapods-spm`.

Assistant `text` and `thought` rows render through MarkdownView (Litext + cmark-gfm):
headings, lists, task lists, blockquotes, tables, highlighted code blocks with a copy
button, links and math. User bubbles have a native copy menu; assistant text uses
Litext's own double-tap (word) and triple-tap (line) selection with the system edit menu. Per-glyph fade-in is
drawn by `ChatFadeLabelView`, a `TextLabelView` subclass injected into
`MarkdownTextView`.

Scroll drawing regression (with a booted iOS Simulator):

```sh
xcrun --sdk iphonesimulator swiftc -target arm64-apple-ios18.0-simulator \
  -sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" \
  apps/mobile/modules/lody-kit/ios/Chat/ChatTextFade.swift \
  apps/mobile/modules/lody-kit/ios/Chat/ChatTextView.swift \
  apps/mobile/modules/lody-kit/ios/Chat/ChatMarkdown.swift \
  apps/mobile/modules/lody-kit/ios/UIFont+Dynamic.swift \
  apps/mobile/modules/lody-kit/verification/chat-render/main.swift \
  -o /tmp/lody-chat-render-test
xcrun simctl spawn booted /tmp/lody-chat-render-test
```

The same long text must draw identically when partially offscreen and after
scrolling into view. Clipping drawing to the current window fails this check:
UIKit retains that incomplete backing store as the cell scrolls.

Stream/completion geometry regression (open the preview at the bottom first):

```sh
python3 apps/mobile/modules/lody-kit/verification/chat/layout.py SIMULATOR_UDID
```

AXe samples the actual collection cells across replay and completion. The conclusion must remain complete and the process row must stay 44 pt high.
Flow layout uses cached TextKit heights, so updates and bottom positioning
use final geometry instead of successive estimates. Tool status slots
stay reserved when their spinner disappears, preserving line wrapping.

While streaming, text separates process segments. Completion folds all but the
last nonempty text into one process entry. Tapping
an entry uses `present` to show a form sheet with that segment’s items (or the complete process after completion), always flat. The sheet observes the parent's existing projection using
`useSyncExternalStore`; it does not call `watchSession` or `unwatchSession`.
Dismiss and reopen during a replay to verify subscriptions and live updates.

Add `--send` to the geometry check to verify the preview's send-to-top behavior.
New user messages use the native smooth scroll animation. Bottom inset reserves
space for the current turn, shrinks as the reply grows, and remains after short
replies finish. Any upward manual scroll releases following. This follows
Kansoku's active-turn spacer behavior; Reduce Motion uses immediate positioning.

The preview geometry check also taps the native navigation title and verifies its
detail action, then checks live segment boundaries and conclusion-only completion.
The title is installed directly as `UINavigationItem.titleView`, with UIKit owning
its layout and scroll edge; no React Native header title wrapper is involved.

Automatic tracking scrolls directly to the actual collection bottom after each
content update and layout, including Markdown reflow and contraction. There is
no line-count target, scrolling ticker or locked offset.

Dragging immediately pauses tracking, even inside the old 80 pt range. Tracking
resumes only after a gesture ends at the tail or the down arrow is tapped.
The floating down arrow appears beyond 80 pt from the bottom. `tracking.py` checks
returning during streaming and after completion, button dismissal at the tail,
and unchanged history position while tracking is released. Reduce Motion uses
a short crossfade for completion instead of moving rows.

Composer acceptance (sends a real turn; use a disposable test session): prepare
text plus a synthetic attachment, then run
`python3 apps/mobile/modules/lody-kit/verification/chat/composer.py SIMULATOR_UDID --expect success --output /tmp/lody-composer-success`.
It checks immediate draft clearing, disabled loading button, no sending notice,
and one message after a double tap. For failure restoration, select a dedicated
test attachment and make only that temporary picker copy empty before running
with `--expect failure`. It checks the exact text and attachment are restored and
retry is enabled. Do not modify user-owned attachments to inject this failure.
