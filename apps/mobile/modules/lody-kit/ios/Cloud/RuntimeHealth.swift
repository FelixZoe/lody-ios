import Foundation

struct RuntimeHealth {
  private(set) var lastAck: TimeInterval = 0
  private(set) var ready = false
  private var restarts: [TimeInterval] = []
  mutating func started(at now: TimeInterval) { lastAck = now; ready = false }
  mutating func acknowledged(at now: TimeInterval) { lastAck = now; ready = true }
  func timedOut(at now: TimeInterval) -> Bool { now - lastAck >= (ready ? 8 : 20) }
  mutating func allowRestart(at now: TimeInterval) -> Bool {
    restarts.removeAll { now - $0 >= 60 }
    guard restarts.count < 3 else { return false }
    restarts.append(now)
    return true
  }
}
