import MarkdownParser
import MarkdownView
import UIKit

final class ChatParseCache {
  private final class Box {
    let result: MarkdownParser.ParseResult
    init(_ result: MarkdownParser.ParseResult) { self.result = result }
  }
  private let cache = NSCache<NSString, Box>()
  init() { cache.countLimit = 256 }

  func parse(_ text: String) -> MarkdownParser.ParseResult {
    if let cached = cache.object(forKey: text as NSString) { return cached.result }
    let result = MarkdownParser().parse(text)
    cache.setObject(Box(result), forKey: text as NSString)
    return result
  }
}

/// Parsed content and offscreen sizing views per row. The sizing view keeps its
/// document across width changes; only new text or a new theme rebuilds it.
@MainActor
final class ChatMarkdownStore {
  private struct Entry {
    let text: String
    let secondary: Bool
    let content: MarkdownContent
  }
  private struct Sizing {
    let view: MarkdownTextView
    let text: String
    let secondary: Bool
  }
  private struct Height {
    let text: String
    let secondary: Bool
    let width: CGFloat
    let height: CGFloat
  }
  private static let sizingLimit = 24

  let parser = ChatParseCache()
  private var entries: [String: Entry] = [:]
  private var sizing: [String: Sizing] = [:]
  private var heights: [String: Height] = [:]
  private var recent: [String] = []
  private(set) var theme: MarkdownTheme
  private(set) var secondaryTheme: MarkdownTheme

  init(traits: UITraitCollection) {
    theme = ChatMarkdownTheme.make(traits: traits, secondary: false)
    secondaryTheme = ChatMarkdownTheme.make(traits: traits, secondary: true)
  }

  func theme(secondary: Bool) -> MarkdownTheme { secondary ? secondaryTheme : theme }

  func apply(traits: UITraitCollection) {
    theme = ChatMarkdownTheme.make(traits: traits, secondary: false)
    secondaryTheme = ChatMarkdownTheme.make(traits: traits, secondary: true)
    entries.removeAll()
    heights.removeAll()
    for value in sizing.values { value.view.reset() }
    sizing.removeAll()
    recent.removeAll()
  }

  func content(id: String, text: String, secondary: Bool) -> MarkdownContent {
    if let entry = entries[id], entry.text == text, entry.secondary == secondary { return entry.content }
    let content = MarkdownContent(parserResult: parser.parse(text), theme: theme(secondary: secondary))
    entries[id] = Entry(text: text, secondary: secondary, content: content)
    return content
  }

  // Flow layout asks every row for its size on each invalidation; only a
  // changed row may touch the bounded sizing pool.
  func height(id: String, text: String, secondary: Bool, width: CGFloat) -> CGFloat {
    let width = max(1, width)
    if let cached = heights[id], cached.text == text, cached.secondary == secondary, cached.width == width {
      return cached.height
    }
    let view: MarkdownTextView
    if let cached = sizing[id], cached.text == text, cached.secondary == secondary {
      view = cached.view
    } else {
      view = sizing[id]?.view ?? MarkdownTextView()
      view.setContentImmediately(content(id: id, text: text, secondary: secondary), theme: theme(secondary: secondary))
      sizing[id] = Sizing(view: view, text: text, secondary: secondary)
    }
    recent.removeAll { $0 == id }
    recent.append(id)
    while recent.count > Self.sizingLimit {
      let evicted = recent.removeFirst()
      sizing.removeValue(forKey: evicted)?.view.reset()
    }
    let height = ceil(view.boundingSize(for: width).height)
    heights[id] = Height(text: text, secondary: secondary, width: width, height: height)
    return height
  }

  func retain(_ ids: Set<String>) {
    entries = entries.filter { ids.contains($0.key) }
    heights = heights.filter { ids.contains($0.key) }
    for (id, value) in sizing where !ids.contains(id) {
      value.view.reset()
      sizing[id] = nil
    }
    recent.removeAll { !ids.contains($0) }
  }
}
