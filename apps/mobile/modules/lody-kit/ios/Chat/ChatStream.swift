import Foundation

/// Presentation-only pacing: network history remains authoritative. Like
/// FlowDown's BalancedEmitter, bursts drain in ~30 steps with larger batches
/// for a larger backlog. Character boundaries preserve emoji and composed text.
struct ChatStream {
  private struct Reveal {
    var source = ""
    var shown = ""
    var pending: [Character] = []
    var offset = 0
    var batch = 1
    var hasPending: Bool { offset < pending.count }

    mutating func receive(_ text: String, animate: Bool) {
      guard text != source else {
        if !animate { finish() }
        return
      }
      guard animate, text.hasPrefix(source) else {
        source = text
        finish()
        return
      }
      pending = Array(pending.dropFirst(offset)) + Array(text.dropFirst(source.count))
      offset = 0
      source = text
      batch = max(1, Int(ceil(Double(pending.count) / 30)))
    }
    mutating func advance() {
      guard hasPending else { return }
      let end = min(pending.count, offset + batch)
      shown += String(pending[offset..<end])
      offset = end
      if !hasPending { finish() }
    }
    mutating func finish() {
      shown = source
      pending.removeAll(keepingCapacity: false)
      offset = 0
    }
  }

  private struct ID: Hashable { let entry: String; let item: String }
  private var reveals: [ID: Reveal] = [:]
  private var targets: [ChatEntry] = []
  private var initialized = false
  var hasPending: Bool { reveals.values.contains { $0.hasPending } }

  mutating func receive(_ entries: [ChatEntry], animate: Bool) {
    let wasRunning = Set(targets.filter { !$0.finished }.map(\.id))
    var retained: Set<ID> = []
    for entry in entries where entry.role != "user" {
      for item in entry.items where item.type == "text" || item.type == "thought" {
        let id = ID(entry: entry.id, item: item.itemId)
        retained.insert(id)
        var reveal = reveals[id] ?? Reveal()
        let shouldAnimate = initialized && animate && (!entry.finished || wasRunning.contains(entry.id) || reveal.hasPending)
        reveal.receive(item.text ?? "", animate: shouldAnimate)
        reveals[id] = reveal
      }
    }
    reveals = reveals.filter { retained.contains($0.key) }
    targets = entries
    initialized = true
  }

  mutating func advance() {
    for id in reveals.keys { reveals[id]?.advance() }
  }

  mutating func finish() {
    for id in reveals.keys { reveals[id]?.finish() }
  }

  var presentation: [ChatEntry] {
    targets.map { target in
      var entry = target
      for index in entry.items.indices {
        guard let reveal = reveals[ID(entry: entry.id, item: entry.items[index].itemId)] else { continue }
        entry.items[index].text = reveal.shown
        // Completion folding waits for the visible tail, never the network ACK.
        if reveal.hasPending { entry.finished = false }
      }
      return entry
    }
  }
}

/// The scrolling timeline advances only when new laid-out lines arrive.
/// Reformatting existing Markdown lines cannot move this timeline backwards.
struct ChatScroll {
  private(set) var entryID: String?
  private(set) var target: Double?
  private var end: Double = 0
  private var lines: [String: Int] = [:]
  static let resumeDistance: Double = 80

  mutating func update(entryID: String, rows: [(String, [Double])], initialEnd: Double,
                       viewport: Double, minimum: Double) {
    if self.entryID != entryID {
      self.entryID = entryID
      end = initialEnd
      lines = Dictionary(uniqueKeysWithValues: rows.map { ($0.0, $0.1.count) })
    } else {
      var addedLines = false
      for (id, advances) in rows {
        let count = lines[id, default: 0]
        addedLines = addedLines || advances.count > count
        lines[id] = max(count, advances.count)
      }
      // New lines trigger a calibrated position, never an accumulated estimate.
      if addedLines { end = max(end, initialEnd) }
    }
    target = max(minimum, end - viewport)
  }

  mutating func finish() { self = ChatScroll() }

  func isWithinReach(of offset: Double) -> Bool {
    guard let target else { return false }
    return target - offset <= 1
  }

  func nextOffset(from offset: Double, elapsed: Double, reducedMotion: Bool) -> Double {
    guard let target else { return offset }
    if reducedMotion || abs(target - offset) < 0.25 { return target }
    let distance = abs(target - offset)
    let response = max(0.025, 0.08 * min(1, 48 / distance))
    return offset + (target - offset) * (1 - exp(-min(elapsed, 0.05) / response))
  }
}
