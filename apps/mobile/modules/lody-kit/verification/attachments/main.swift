import Foundation
import UIKit

enum AuthKeychain { static func read() throws -> String? { "synthetic-test-token" } }

final class UploadProtocol: URLProtocol {
  static var requests: [URLRequest] = []
  static var failPart = false
  override class func canInit(with request: URLRequest) -> Bool { request.url?.host == "api.lody.ai" }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
  override func startLoading() {
    Self.requests.append(request)
    assert(request.value(forHTTPHeaderField: "Authorization") == "Bearer synthetic-test-token")
    var uploaded = request.httpBody ?? Data()
    if let stream = request.httpBodyStream {
      stream.open(); defer { stream.close() }
      var buffer = [UInt8](repeating: 0, count: 65536)
      while true {
        let count = stream.read(&buffer, maxLength: buffer.count)
        if count <= 0 { break }
        uploaded.append(contentsOf: buffer.prefix(count))
      }
    }
    let path = request.url!.path
    var body: [String: Any] = [:]
    var status = 200
    if path.contains("session-images") {
      assert(request.value(forHTTPHeaderField: "Content-Type")!.contains("multipart/form-data"))
      assert(uploaded.range(of: Data("name=\"sessionId\"\r\n\r\ns1\r\n".utf8)) != nil)
      assert(uploaded.range(of: Data("name=\"file\"".utf8)) != nil)
      assert(uploaded.count > 100)
      body = ["image": ["type": "image", "imageId": "image1", "mimeType": "image/png", "fileName": "photo.png", "sizeBytes": 100]]
    } else if path.hasSuffix("/create") {
      assert(request.value(forHTTPHeaderField: "x-file-sha256")!.count == 64)
      body = ["uploadId": "upload1", "fileId": "file1"]
    } else if path.contains("/part/") {
      assert(request.httpMethod == "PUT")
      assert(request.value(forHTTPHeaderField: "x-file-id") == "file1")
      assert(uploaded.count == Int(request.value(forHTTPHeaderField: "x-file-part-size-bytes")!))
      assert(uploaded.allSatisfy { $0 == 65 })
      status = Self.failPart ? 503 : 200
      body = ["etag": "etag-" + path.components(separatedBy: "/").last!]
    } else if path.hasSuffix("/abort") {
      assert(request.httpMethod == "DELETE")
    } else {
      if path.hasSuffix("/complete") {
        let value = try! JSONSerialization.jsonObject(with: uploaded) as! [String: Any]
        let parts = value["parts"] as! [[String: Any]]
        assert(parts.count == 2 && parts[1]["partNumber"] as? Int == 2 && parts[1]["etag"] as? String == "etag-2")
      } else { assert(uploaded == Data("hi!".utf8)) }
      body = ["file": ["type": "file", "fileId": "file1", "fileName": "test.txt", "mimeType": "text/plain", "sizeBytes": 3, "sha256": "abc", "textPreview": true, "transport": "r2", "uploadedAt": 1]]
    }
    client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!, cacheStoragePolicy: .notAllowed)
    client?.urlProtocol(self, didLoad: try! JSONSerialization.data(withJSONObject: body))
    client?.urlProtocolDidFinishLoading(self)
  }
  override func stopLoading() {}
}

@main struct Check {
  static func main() async throws {
    URLProtocol.registerClass(UploadProtocol.self)
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let file = root.appendingPathComponent("test.txt")
    try Data("hi!".utf8).write(to: file)
    func attachment(_ url: URL, _ kind: String = "file") -> [String: Any] {
      ["uri": url.absoluteString, "name": url.lastPathComponent, "kind": kind]
    }
    let small = try await SessionAttachments.upload([attachment(file)], workspace: "w1", session: "s1")
    assert(small[0]["fileId"] as? String == "file1")
    assert(UploadProtocol.requests.last!.value(forHTTPHeaderField: "x-file-sha256") == "c0ddd62c7717180e7ffb8a15bb9674d3ec92592e0b7ac7d1d5289836b4553be2")
    let image = root.appendingPathComponent("photo.png")
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: 10, height: 10))
    try renderer.pngData { context in UIColor.blue.setFill(); context.fill(CGRect(x: 0, y: 0, width: 10, height: 10)) }.write(to: image)
    let images = try await SessionAttachments.upload([attachment(image, "image")], workspace: "w1", session: "s1")
    assert(images[0]["imageId"] as? String == "image1")
    try Data(repeating: 65, count: 16 * 1024 * 1024 + 1).write(to: file)
    UploadProtocol.requests = []
    _ = try await SessionAttachments.upload([attachment(file)], workspace: "w1", session: "s1")
    assert(UploadProtocol.requests.map { $0.url!.lastPathComponent } == ["create", "1", "2", "complete"])
    assert(UploadProtocol.requests[2].value(forHTTPHeaderField: "x-file-part-size-bytes") == "1")
    UploadProtocol.failPart = true
    do {
      _ = try await SessionAttachments.upload([attachment(file)], workspace: "w1", session: "s1")
      fatalError("Failed upload must not produce an attachment")
    } catch { assert(UploadProtocol.requests.last!.url!.lastPathComponent == "abort") }
    let before = UploadProtocol.requests.count
    do {
      _ = try await SessionAttachments.upload([attachment(URL(fileURLWithPath: "/etc/passwd"))], workspace: "w1", session: "s1")
      fatalError("Must reject files outside picker storage")
    } catch { assert(UploadProtocol.requests.count == before) }
    print("PASS: native image/file upload, SHA256, multipart boundaries, abort and local-file guard")
  }
}
