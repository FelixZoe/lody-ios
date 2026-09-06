# Attachment transport check

With a booted iOS Simulator, from the repository root:

```sh
xcrun --sdk iphonesimulator swiftc -parse-as-library \
  -target arm64-apple-ios18.0-simulator \
  -sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" \
  apps/mobile/modules/lody-kit/ios/Cloud/SessionAttachments.swift \
  apps/mobile/modules/lody-kit/verification/attachments/main.swift \
  -o /tmp/lody-attachments-test
xcrun simctl spawn booted /tmp/lody-attachments-test
```

Runs the production uploader against URLProtocol responses with synthetic auth.
Checks image multipart encoding, file hashing, the 16 MiB part boundary, failed
part cleanup, and rejection of files outside picker storage. `pnpm test` checks
that attachment references reach both persisted history and Machine RPC and
survive a lost append acknowledgement. These checks do not send a live cloud turn.

Cloud limits: eight images (5 MiB each after conversion) and eight files
(100 MiB each) per message. HEIC and oversized photos convert to JPEG at up to
2048 pixels. Upload failure retains the draft; no message dispatch is retried
automatically. History displays image thumbnails above their text bubbles; files retain their names.

Attachment routes are hosted on `https://api.lody.ai`, separately from the
`backend.lody.ai` auth/Streams token service. An unauthenticated POST to
`/api/workspaces/test/session-images/upload`, `session-files/upload`, and
`session-files/multipart/create` on that host returns 401; an unknown route
returns 404. Verify this routing against the live host when changing endpoints;
URLProtocol checks alone cannot establish deployment routing.
