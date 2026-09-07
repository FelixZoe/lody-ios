import QuickLook
import UIKit

final class ContentPreview: NSObject, QLPreviewControllerDataSource, QLPreviewControllerDelegate {
  private static var current: ContentPreview?
  private static var root: URL { FileManager.default.temporaryDirectory.appendingPathComponent("preview", isDirectory: true) }
  private let url: URL

  private init(url: URL) { self.url = url }

  static func clearAll() {
    try? FileManager.default.removeItem(at: root)
  }

  static func present(handle: String, from controller: UIViewController) throws {
    guard let content = ContentStore.shared.get(handle) else {
      throw NSError(domain: "LodyKit.ContentPreview", code: 1, userInfo: [NSLocalizedDescriptionKey: "content_expired"])
    }
    let directory = root.appendingPathComponent(handle, isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let name = (content.path as NSString).lastPathComponent
    let url = directory.appendingPathComponent(name.isEmpty ? "file" : name)
    try content.data.write(to: url, options: .atomic)
    let preview = ContentPreview(url: url)
    let viewer = QLPreviewController()
    viewer.dataSource = preview
    viewer.delegate = preview
    current = preview
    controller.present(viewer, animated: true)
  }

  func numberOfPreviewItems(in controller: QLPreviewController) -> Int { 1 }

  func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
    url as NSURL
  }

  func previewControllerDidDismiss(_ controller: QLPreviewController) {
    try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
    if Self.current === self { Self.current = nil }
  }
}
