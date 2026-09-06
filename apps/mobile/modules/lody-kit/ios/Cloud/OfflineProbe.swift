#if DEBUG
import Foundation

/// Cold-launch network failure injection; never registered in release builds.
final class OfflineProbe: URLProtocol {
  override class func canInit(with request: URLRequest) -> Bool {
    request.url?.host == "backend.lody.ai"
  }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
  override func startLoading() {
    NSLog("LodyOffline blocked request")
    client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet))
  }
  override func stopLoading() {}
}
#endif
