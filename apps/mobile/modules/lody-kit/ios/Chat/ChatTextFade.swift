import Foundation

/// Tracks rendered graphemes rather than Markdown offsets: closing an emphasis
/// delimiter must not restart the fade of words that were already on screen.
struct ChatTextFade {
  struct RangeFade {
    let range: NSRange
    let start: Double
    func opacity(at time: Double) -> Double { min(1, max(0, (time - start) / 0.22)) }
  }
  private var characters: [Character] = []
  private var births: [Double?] = []
  private(set) var active: [RangeFade] = []

  mutating func update(_ text: String, animate: Bool, at time: Double, reset: Bool = false) {
    let next = Array(text)
    if reset {
      characters = next
      births = Array(repeating: nil, count: next.count)
      active = []
      return
    }
    guard next != characters else { return }
    let changes = next.difference(from: characters)
    var removed: Set<Int> = []
    var inserted: Set<Int> = []
    for change in changes {
      switch change {
      case .remove(let index, _, _): removed.insert(index)
      case .insert(let index, _, _): inserted.insert(index)
      }
    }
    var remaining = births.enumerated().filter { !removed.contains($0.offset) }.map(\.element).makeIterator()
    var ordinal = 0
    let stagger = min(0.012, 0.08 / Double(max(1, inserted.count - 1)))
    births = next.indices.map { index in
      if inserted.contains(index) {
        defer { ordinal += 1 }
        return animate ? time + Double(ordinal) * stagger : nil
      }
      return remaining.next() ?? nil
    }
    characters = next
    active = []
    var offset = 0
    for (index, character) in next.enumerated() {
      let length = String(character).utf16.count
      if let birth = births[index], time < birth + 0.22 {
        active.append(RangeFade(range: NSRange(location: offset, length: length), start: birth))
      } else { births[index] = nil }
      offset += length
    }
  }

  func isAnimating(at time: Double) -> Bool { active.contains { $0.opacity(at: time) < 1 } }
}
