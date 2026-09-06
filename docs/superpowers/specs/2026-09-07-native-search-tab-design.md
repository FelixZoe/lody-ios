# Native UISearchTab tab bar

## Problem

Expo Router NativeTabs maps `role="search"` to the legacy `UITabBarItem(.search)` because react-native-screens 4.26 builds the tab bar with `setViewControllers:`. On iOS 26 the tab gets the detached pill look but never morphs into a search field or activates search. Upstream (react-native-screens #3999) closed the request as not planned. The app currently fakes it with a disabled action tab that pushes a full-screen `/search` route backed by `LodySearchBar`.

## Decision

LodyKit owns the tab bar: a `UITabBarController` built with the iOS 18 `tabs` API, where the search tab is a `UISearchTab` with `automaticallyActivatesSearch`. Expo Router keeps routing through a custom `Navigator` with `TabRouter`. Deployment target rises to iOS 18.0.

## Native layer (`apps/mobile/modules/lody-kit/ios/Tabs/`)

### `LodyTabs` (ExpoView)

- Hosts one `UITabBarController` as a child of the closest RN view controller found through the responder chain; its view fills the ExpoView.
- Collects children through `mountChildComponentView` / `unmountChildComponentView`; every child must be a `LodyTabScreen`. Rebuilds `tabBarController.tabs` when the child list changes.
- Props: `selectedIndex: Int`, `tintColor: UIColor`.
- Events: `onSelect { index }` from `tabBarController(_:didSelectTab:previousTab:)`; `onSearchChange { text }` from the search controller's `UISearchResultsUpdating`.
- Setting `selectedIndex` from JS assigns `selectedTab` without emitting `onSelect`; a guard flag prevents the echo.
- Repeated selection of the current tab with `popToTopOnReselect` pops the tab's child `UINavigationController` (the Expo Router Stack) to root. No scroll-to-top behavior.

### `LodyTabScreen` (ExpoView)

- Props: `title: String`, `sfSymbol: String?`, `role: String?` (`"search"` or absent), `popToTopOnReselect: Bool`.
- Owns a `UIViewController` whose `view` is this ExpoView. Because the ExpoView sits in that controller's responder chain, an Expo Router Stack rendered inside attaches itself as a child controller automatically; `sessions` and `settings` layouts stay unchanged.
- Regular role: `UITab(title:image:identifier:viewControllerProvider:)`.
- Search role: `UISearchTab(viewControllerProvider:)` with `automaticallyActivatesSearch = true`. The provided controller is a `UINavigationController` wrapping the screen controller, whose `navigationItem.searchController` is a `UISearchController(searchResultsController: nil)` with `hidesNavigationBarDuringPresentation = false` and `obscuresBackgroundDuringPresentation = false`. The navigation bar is hidden; the list under it is the search results.

### Deployment target

`app.config.ts` adds `['expo-build-properties', { ios: { deploymentTarget: '18.0' } }]`. Swift code uses iOS 18 APIs without availability branches.

## JS layer

### `@lody-ios/kit` (`src/tabs/`)

- `NativeTabs` and `NativeTabScreen` view wrappers via `requireNativeView('LodyKit', ...)`, typed props matching the native ones. Exported from `src/index.ts`.

### `apps/mobile/src/navigation/Tabs.tsx`

- Uses expo-router `Navigator` with `router={TabRouter}` and `routerOptions={{ backBehavior: 'history' }}`; the content component reads `state`, `descriptors`, `navigation` from `Navigator.useContext()`.
- Renders one `NativeTabScreen` per route in state order, with `title`, `sfSymbol`, `role`, `popToTopOnReselect` from the route's `options`.
- Lazy mount: a tab renders `descriptor.render()` only once `state.index` has reached it; untouched tabs render an empty `NativeTabScreen`.
- Freeze: each mounted tab's content is wrapped in `<Freeze freeze={i !== state.index}>` from `react-freeze`, added as a direct dependency of `apps/mobile` at `^1.0.0` to match react-native-screens.
- `selectedIndex={state.index}`; `onSelect` dispatches `JUMP_TO` for the route at that index and emits `tabPress`.
- Search text lives in `TabSearchContext`; `onSearchChange` updates it; `useTabSearchQuery()` reads it.
- `Tabs.Screen` is `Navigator.Screen` re-exported so the layout declares options per route.

### Routes

- `src/app/(tabs)/_layout.tsx` renders `Tabs` with three screens: `sessions` (title 会话, symbol `bubble.left.and.text.bubble.right`, `popToTopOnReselect: false`), `settings` (title 设置, symbol `gearshape`), `search` (`role: 'search'`).
- New `src/app/(tabs)/search.tsx` exports `SearchScreen` as the route component.

## Search screen

`src/features/sessions/SearchScreen.tsx` renders only `NativeGroupedList` with `searchSections(catalog, query, colors.accent)`, `query` from `useTabSearchQuery()`; placeholders and `openCatalogRow` unchanged. `definePage`, focus state, `KeyboardAvoidingView`, and the close handler go away.

## Deletions

- `src/app/search.tsx` and the `search` entry in the root Stack of `src/app/_layout.tsx`
- `src/app/(tabs)/search-action.tsx`
- `modules/lody-kit/ios/Chrome/LodySearchBar.swift`, its `View(...)` registration in `LodyKitModule.swift`
- `modules/lody-kit/src/chrome/NativeSearchBar.tsx` and its export
- `modules/lody-kit/verification/search-bar`

## Verification

- `pnpm check` and `pnpm test` (the `searchSections` cases in `tests/inbox.test.mjs` are unchanged).
- iOS 26 simulator, manual:
  1. Tap the search tab: the tab bar morphs into a search field and the keyboard opens.
  2. Type a keyword: results appear; tapping a row opens the session or project.
  3. Cancel search: the tab bar returns to the previous tab, and that tab's content resumes updating (unfreeze via `onSelect`).
  4. From settings → account, tap the settings tab again: the stack pops to root.
  5. Switching tabs while the sessions list is receiving catalog events does not re-render the hidden tabs (verify with React DevTools or a render counter in Debug).

## Order of work

1. Native layer plus deployment target, verified on the iOS 26 simulator with a temporary layout so the UISearchTab morph is confirmed before JS work.
2. Navigator, kit wrappers, routes, search screen.
3. Deletions and verification.

## Risks

- The iOS 26 morph with an RN-hosted content controller under `UISearchTab` is unverified; step 1 exists to find out early. If it fails, the fallback within this design is a native `UISearchController` presented over the search tab, which still keeps `UISearchTab` activation.
- Expo Router's `Navigator` is marked `@hidden` but is the documented custom-navigator path and is used by `Slot`.
