import ExpoModulesCore
import UIKit
import SafariServices

public final class LodyKitModule: Module {
  private var authBrowser: SFSafariViewController?

  private lazy var dataRuntime = DataRuntime { [weak self] event in self?.sendEvent("onDataRuntime", event) }

  public func definition() -> ModuleDefinition {
    Name("LodyKit")

    Events("onAppActive", "onDataRuntime")

    AsyncFunction("watchCatalog") { (workspace: String, owner: String) in
      guard !workspace.isEmpty, !owner.isEmpty else { throw NSError(domain: "InvalidSubscription", code: 1) }
      self.dataRuntime.start(workspace: workspace, owner: owner)
    }.runOnQueue(.main)
    AsyncFunction("unwatchCatalog") { (owner: String) in self.dataRuntime.stop(owner: owner) }.runOnQueue(.main)
    AsyncFunction("watchSession") { (id: String) in self.dataRuntime.openSession(id) }.runOnQueue(.main)
    AsyncFunction("unwatchSession") { (id: String) in self.dataRuntime.closeSession(id) }.runOnQueue(.main)
    AsyncFunction("sessionCreationOptions") { (payload: String, promise: Promise) in self.dataRuntime.command("creationOptions", payload: payload, promise: promise) }.runOnQueue(.main)
    AsyncFunction("createSession") { (payload: String, promise: Promise) in self.dataRuntime.command("createSession", payload: payload, promise: promise) }.runOnQueue(.main)
    AsyncFunction("sendSessionTurn") { (payload: String, promise: Promise) in self.dataRuntime.sendTurn(payload, promise: promise) }.runOnQueue(.main)
    AsyncFunction("dataRuntimeStatus") { self.dataRuntime.status() }.runOnQueue(.main)
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

    AsyncFunction("selectionFeedback") {
      UISelectionFeedbackGenerator().selectionChanged()
    }.runOnQueue(.main)

    Constants {
      ["runtimeInfo": [
        "moduleName": "LodyKit",
        "systemVersion": UIDevice.current.systemVersion,
      ]]
    }

    View(LodyGroupedList.self) {
      Events("onRowPress", "onRefresh")
      Prop("sections") { (view: LodyGroupedList, sections: [LodyListSection]) in
        view.setSections(sections)
      }
      Prop("refreshing") { (view: LodyGroupedList, refreshing: Bool) in
        view.setRefreshing(refreshing)
      }
      Prop("placeholder") { (view: LodyGroupedList, placeholder: String) in
        view.setPlaceholder(placeholder)
      }
    }

    View(LodyMenuButton.self) {
      Events("onSelect")
      Prop("label") { (view: LodyMenuButton, label: String) in
        view.setLabel(label)
      }
      Prop("accessibilityName") { (view: LodyMenuButton, name: String) in
        view.setAccessibilityName(name)
      }
      Prop("items") { (view: LodyMenuButton, items: [LodyMenuItem]) in
        view.setItems(items)
      }
    }

    View(LodyCloseButton.self) {
      Events("onClose")
      Prop("label") { (view: LodyCloseButton, label: String) in
        view.setAccessibilityName(label)
      }
    }
  }
}
