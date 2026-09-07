# Lody iOS acceptance

## 1. Project summary

Expo Router iOS app in apps/mobile; UIKit capabilities live in LodyKit.

## 2. Environment

Use `pnpm start` for Metro, `pnpm ios` for the signed simulator app. Check listening Node processes before starting a server; do not stop servers owned by another task. Metro currently uses 8081. Generate assets with `pnpm --filter @lody-ios/mobile native:assets` before direct xcodebuild.

## 3. Auth

UI regression baselines use `pnpm verify:ui --udid <disposable-simulator> --app <Debug.app>`.
The runner owns an isolated Metro with `EXPO_PUBLIC_UI_VERIFY=1`; account restoration
and login are disabled, and Debug scenes use production components with local fixtures.
No account, cloud credentials or connected machine is needed. See
`apps/mobile/verification/ui/README.md` for cases, evidence and CI setup.

Official Lody Device Flow and simulator Keychain only. Inspect the simulator UI for existing login; never copy desktop credentials. No seeded account is provided. Unauthenticated checks must be reported separately from authenticated flows.

## 4. Surfaces

Use AXe with explicit simulator UDID and simctl screenshots. Build workspace apps/mobile/ios/Lody.xcworkspace, scheme Lody, with normal signing. Bundle identifier app.innei.lody. Run pnpm check, pnpm test and pnpm bundle as supporting gates.

## 5. Project probes & quick navigation

`xcrun simctl list devices booted`; `axe describe-ui --udid <id>`. Product tabs are sessions, settings and search. Development-only Debug lives under Settings.

## 6. Known constraints

Cloud data requires app-authorized login and a connected computer. Do not send real turns merely to verify layout. Preserve all pre-existing working-tree edits. Simulator cannot prove physical haptics.
