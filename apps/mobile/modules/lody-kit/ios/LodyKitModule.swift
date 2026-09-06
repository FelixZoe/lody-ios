import ExpoModulesCore
import UIKit
import SafariServices

public final class LodyKitModule: Module {
  private let localStore = LocalStore()
  private var authBrowser: SFSafariViewController?

  private lazy var dataRuntime = DataRuntime { [weak self] event in self?.sendEvent("onDataRuntime", event) }

  public func definition() -> ModuleDefinition {
    Name("LodyKit")

    Events("onAppActive", "onDataRuntime")
    OnCreate {
      #if DEBUG
      if ProcessInfo.processInfo.arguments.contains("--lody-offline") {
        URLProtocol.registerClass(OfflineProbe.self)
      }
      #endif
    }

    AsyncFunction("watchCatalog") { (workspace: String, owner: String) in
      guard !workspace.isEmpty, !owner.isEmpty else { throw NSError(domain: "InvalidSubscription", code: 1) }
      self.dataRuntime.start(workspace: workspace, owner: owner)
    }.runOnQueue(.main)
    AsyncFunction("unwatchCatalog") { (owner: String) in self.dataRuntime.stop(owner: owner) }.runOnQueue(.main)
    AsyncFunction("watchSession") { (id: String) in self.dataRuntime.openSession(id) }.runOnQueue(.main)
    AsyncFunction("unwatchSession") { (id: String) in self.dataRuntime.closeSession(id) }.runOnQueue(.main)
    AsyncFunction("sessionCreationOptions") { (payload: String, promise: Promise) in self.dataRuntime.command("creationOptions", payload: payload, promise: promise) }.runOnQueue(.main)
    AsyncFunction("localProjects") { (payload: String, promise: Promise) in self.dataRuntime.command("localProjects", payload: payload, promise: promise) }.runOnQueue(.main)
    AsyncFunction("createSession") { (payload: String, promise: Promise) in self.dataRuntime.command("createSession", payload: payload, promise: promise) }.runOnQueue(.main)
    AsyncFunction("sendSessionTurn") { (payload: String, promise: Promise) in self.dataRuntime.sendTurn(payload, promise: promise) }.runOnQueue(.main)
    AsyncFunction("sessionItemDetail") { (payload: String, promise: Promise) in self.dataRuntime.command("itemDetail", payload: payload, promise: promise) }.runOnQueue(.main)
    AsyncFunction("respondSessionPermission") { (payload: String, promise: Promise) in self.dataRuntime.command("respondPermission", payload: payload, promise: promise) }.runOnQueue(.main)
    AsyncFunction("dataRuntimeStatus") { self.dataRuntime.status() }.runOnQueue(.main)
    AsyncFunction("debugProbeSchema") { (promise: Promise) in
      #if DEBUG
      self.dataRuntime.debugProbeSchema(promise: promise)
      #else
      promise.resolve("{}")
      #endif
    }.runOnQueue(.main)
    AsyncFunction("debugHangDataRuntime") {
      #if DEBUG
      self.dataRuntime.debugHang()
      #endif
    }.runOnQueue(.main)
    AsyncFunction("debugRestartDataRuntime") {
      #if DEBUG
      self.dataRuntime.debugRestart()
      #endif
    }.runOnQueue(.main)
    OnDestroy { DispatchQueue.main.async { self.dataRuntime.stop() } }

    AsyncFunction("readLocalStartup") { try self.localStore.startup() }.runOnQueue(LocalStore.queue)
    AsyncFunction("readLocalValue") { (key: String) in try self.localStore.read(key) }.runOnQueue(LocalStore.queue)
    AsyncFunction("writeLocalValue") { (key: String, value: String) in try self.localStore.write(key, value) }.runOnQueue(LocalStore.queue)
    AsyncFunction("clearLocalValues") { try self.localStore.clear() }.runOnQueue(LocalStore.queue)

    AsyncFunction("readAuthToken") { try AuthKeychain.read() }.runOnQueue(.main)
    AsyncFunction("saveAuthToken") { (token: String) in try AuthKeychain.save(token) }.runOnQueue(.main)
    AsyncFunction("clearAuthToken") { self.dataRuntime.stop(); try AuthKeychain.clear() }.runOnQueue(.main)
    AsyncFunction("openAuthBrowser") { (address: String) in
      guard let url = URL(string: address), url.scheme == "https", url.host == "lody.ai",
            url.user == nil, url.password == nil,
            let controller = self.appContext?.utilities?.currentViewController() else {
        throw NSError(domain: "LodyKit.AuthBrowser", code: 1)
      }
      let browser = SFSafariViewController(url: url)
      self.authBrowser = browser
      controller.present(browser, animated: true)
    }.runOnQueue(.main)
    AsyncFunction("closeAuthBrowser") {
      self.authBrowser?.dismiss(animated: true)
      self.authBrowser = nil
    }.runOnQueue(.main)
    AsyncFunction("decodeFlock") { (snapshot: String, updates: [String], mode: String, promise: Promise) in
      guard snapshot.utf8.count + updates.reduce(0, { $0 + $1.utf8.count }) <= 12 * 1024 * 1024 else {
        promise.reject("DECODE_LIMIT", "工作区快照超过 POC 的解码上限"); return
      }
      _ = FlockDecoder(snapshot: snapshot, updates: updates, mode: mode) { result in
        switch result {
        case .success(let value): promise.resolve(value)
        case .failure: promise.reject("DECODE_FAILED", "工作区快照解码失败")
        }
      }
    }.runOnQueue(.main)

    OnAppBecomesActive {
      self.sendEvent("onAppActive", [:])
    }

    Function("showToast") { (message: String, kind: String) in
      if Thread.isMainThread {
        LodyToastOverlay.shared.show(message: message, kind: kind)
      } else {
        DispatchQueue.main.async {
          LodyToastOverlay.shared.show(message: message, kind: kind)
        }
      }
    }

    AsyncFunction("selectionFeedback") {
      UISelectionFeedbackGenerator().selectionChanged()
    }.runOnQueue(.main)

    Function("saveInboxView") { (index: Int) in
      UserDefaults.standard.set(index == 1 ? 1 : 0, forKey: "inboxView")
    }

    Function("readInboxExpansion") {
      UserDefaults.standard.dictionary(forKey: "inboxExpansion") as? [String: Bool] ?? [:]
    }
    Function("saveInboxExpansion") { (projectID: String, expanded: Bool) in
      var values = UserDefaults.standard.dictionary(forKey: "inboxExpansion") as? [String: Bool] ?? [:]
      values[projectID] = expanded
      UserDefaults.standard.set(values, forKey: "inboxExpansion")
    }

    Constants {
      var offlineProbe = false
      #if DEBUG
      offlineProbe = ProcessInfo.processInfo.arguments.contains("--lody-offline")
      #endif
      return ["initialInboxView": UserDefaults.standard.integer(forKey: "inboxView"), "runtimeInfo": [
        "moduleName": "LodyKit",
        "offlineProbe": offlineProbe,
        "systemVersion": UIDevice.current.systemVersion,
      ]]
    }

    View(LodyChatView.self) {
      Events("onSend", "onActivityPress", "onReconnect", "onTitlePress")
      Prop("navigationTitle") { (view: LodyChatView, value: String) in view.setNavigationTitle(value) }
      Prop("attachmentContextJSON") { (view: LodyChatView, value: String) in view.setAttachmentContext(value) }
      Prop("entriesJSON") { (view: LodyChatView, value: String) in view.setEntries(value) }
      Prop("processStartId") { (view: LodyChatView, value: String) in view.setProcessStartID(value) }
      Prop("processEntryId") { (view: LodyChatView, value: String) in view.setProcessEntryID(value) }
      Prop("composerJSON") { (view: LodyChatView, value: String) in view.setComposerState(value) }
      Prop("initialDraft") { (view: LodyChatView, value: String) in view.setInitialDraft(value) }
      Prop("clearDraftToken") { (view: LodyChatView, value: Int) in
        view.clearDraft(token: value)
      }
      Prop("restoreDraftToken") { (view: LodyChatView, value: Int) in view.restoreDraft(token: value) }
      Prop("emptyText") { (view: LodyChatView, value: String) in view.setEmptyText(value) }
    }

    View(LodyGroupedList.self) {
      Prop("contentStyle") { (view: LodyGroupedList, value: Bool) in
        view.setContentStyle(value)
      }
      Events("onRowPress", "onRefresh", "onSegmentChange")
      Prop("segments") { (view: LodyGroupedList, labels: [String]) in view.setSegments(labels) }
      Prop("selectedSegment") { (view: LodyGroupedList, index: Int) in view.setSelectedSegment(index) }
      Prop("sections") { (view: LodyGroupedList, sections: [LodyListSection]) in
        view.setSections(sections)
      }
      Prop("segmentsUseSearchScope") { (view: LodyGroupedList, value: Bool) in
        view.setSegmentsUseSearchScope(value)
      }
      Prop("transparent") { (view: LodyGroupedList, transparent: Bool) in
        view.setTransparent(transparent)
      }
      Prop("accent") { (view: LodyGroupedList, accent: String) in
        view.setAccent(accent)
      }
      Prop("refreshing") { (view: LodyGroupedList, refreshing: Bool) in
        view.setRefreshing(refreshing)
      }
      Prop("placeholder") { (view: LodyGroupedList, placeholder: String) in
        view.setPlaceholder(placeholder)
      }
    }


    View(LodySearchBar.self) {
      Events("onQueryChange", "onClose")
      Prop("placeholder") { (view: LodySearchBar, text: String) in view.setPlaceholder(text) }
      Prop("focused") { (view: LodySearchBar, focused: Bool) in view.setFocused(focused) }
    }

    View(LodyTitleMenu.self) {
      Events("onSelect")
      Prop("label") { (view: LodyTitleMenu, label: String) in
        view.setLabel(label)
      }
      Prop("accessibilityName") { (view: LodyTitleMenu, name: String) in
        view.setAccessibilityName(name)
      }
      Prop("items") { (view: LodyTitleMenu, items: [LodyTitleMenuItem]) in
        view.setItems(items)
      }
    }

    View(LodyCloseButton.self) {
      Events("onClose")
      Prop("label") { (view: LodyCloseButton, label: String) in
        view.setAccessibilityName(label)
      }
    }

    View(LodySymbolButton.self) {
      Events("onSymbolPress")
      Prop("symbol") { (view: LodySymbolButton, symbol: String) in
        view.setSymbol(symbol)
      }
      Prop("accessibilityName") { (view: LodySymbolButton, name: String) in
        view.setAccessibilityName(name)
      }
      Prop("prominent") { (view: LodySymbolButton, prominent: Bool) in
        view.setProminent(prominent)
      }
      Prop("disabled") { (view: LodySymbolButton, disabled: Bool) in
        view.setDisabled(disabled)
      }
      Prop("tint") { (view: LodySymbolButton, tint: String) in
        view.setTint(tint)
      }
    }

    View(LodyContextMenu.self) {
      Events("onAction")
      Prop("actions") { (view: LodyContextMenu, actions: [LodyContextMenuAction]) in
        view.setActions(actions)
      }
    }

    View(LodyPressable.self) {
      Events("onNativePress")
      Prop("pressScale") { (view: LodyPressable, scale: Double) in
        view.setPressScale(scale)
      }
      Prop("haptic") { (view: LodyPressable, haptic: Bool) in
        view.setHaptic(haptic)
      }
      Prop("disabled") { (view: LodyPressable, disabled: Bool) in
        view.setDisabled(disabled)
      }
    }
  }
}
