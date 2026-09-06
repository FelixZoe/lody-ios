import UIKit

extension NSAttributedString.Key {
  static let chatBlock = NSAttributedString.Key("LodyChatBlock")
}

/// Foundation parses Markdown; UIKit displays it without a WebView or a RN text tree.
/// Cache is bounded and independent of width, so a resize only measures again.
final class ChatMarkdown {
  private final class Parsed: NSObject {
    let value: AttributedString
    init(_ value: AttributedString) { self.value = value }
  }
  private let parsedCache = NSCache<NSString, Parsed>()
  private let cache = NSCache<NSString, NSAttributedString>()
  init() {
    cache.totalCostLimit = 4 * 1024 * 1024; cache.countLimit = 256
    parsedCache.totalCostLimit = 4 * 1024 * 1024; parsedCache.countLimit = 256
  }

  // Called by the serial preparation queue for the active tail before UI updates.
  func prepare(_ source: String) {
    _ = parsed(source)
  }

  private func parsed(_ source: String) -> AttributedString? {
    if let cached = parsedCache.object(forKey: source as NSString) { return cached.value }
    guard let value = try? AttributedString(markdown: source, options: .init(
      interpretedSyntax: .full, failurePolicy: .returnPartiallyParsedIfPossible)) else { return nil }
    parsedCache.setObject(Parsed(value), forKey: source as NSString, cost: source.utf8.count * 8)
    return value
  }

  func text(_ source: String, secondary: Bool = false) -> NSAttributedString {
    let key = (secondary ? "secondary:" : "body:") + source
    if let cached = cache.object(forKey: key as NSString) { return cached }
    let base = UIFont.systemFont(ofSize: secondary ? 14 : 16)
    let color: UIColor = secondary ? .secondaryLabel : .label
    let result = NSMutableAttributedString(string: "")
    if let parsed = parsed(source) {
      var blockID: Int?
      var blockAttributes: [NSAttributedString.Key: Any] = [:]
      for run in parsed.runs {
        var attributes: [NSAttributedString.Key: Any] = [.font: base, .foregroundColor: color]
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineSpacing = secondary ? 3 : 4
        paragraph.paragraphSpacing = 7
        var prefix = ""
        var font = base
        if let intent = run.presentationIntent {
          let block = intent.components.first
          let selectionBlock = intent.components.first(where: {
            if case .codeBlock = $0.kind { return true }; return false
          }) ?? intent.components.last(where: {
            switch $0.kind { case .orderedList, .unorderedList, .blockQuote: return true; default: return false }
          }) ?? block
          if let selectionBlock { attributes[.chatBlock] = selectionBlock.identity }
          if let block, block.identity != blockID {
            if blockID != nil { result.append(NSAttributedString(string: "\n", attributes: blockAttributes)) }
            blockID = block.identity
            for component in intent.components {
              if case .listItem(let ordinal) = component.kind {
                let ordered = intent.components.contains { if case .orderedList = $0.kind { return true }; return false }
                prefix = ordered ? "\(ordinal). " : "• "
                paragraph.headIndent = 18
              }
            }
          }
          for component in intent.components {
            switch component.kind {
            case .listItem: paragraph.headIndent = 18
            case .header(let level): font = .systemFont(ofSize: level == 1 ? 23 : level == 2 ? 20 : 17, weight: .semibold)
            case .codeBlock:
              paragraph.paragraphSpacing = 0
              paragraph.lineSpacing = 3
              font = .monospacedSystemFont(ofSize: 13, weight: .regular)
              paragraph.firstLineHeadIndent = 12
              paragraph.headIndent = 12
            case .blockQuote: attributes[.foregroundColor] = UIColor.secondaryLabel; paragraph.headIndent = 12
            default: break
            }
          }
        }
        let paragraphFont = font
        if let inline = run.inlinePresentationIntent {
          var traits = font.fontDescriptor.symbolicTraits
          if inline.contains(.stronglyEmphasized) { traits.insert(.traitBold) }
          if inline.contains(.emphasized) { traits.insert(.traitItalic) }
          if let descriptor = font.fontDescriptor.withSymbolicTraits(traits) { font = UIFont(descriptor: descriptor, size: font.pointSize) }
          if inline.contains(.code) {
            font = .monospacedSystemFont(ofSize: 13, weight: .regular)
            attributes[.backgroundColor] = UIColor.secondarySystemBackground
          }
          if inline.contains(.strikethrough) { attributes[.strikethroughStyle] = NSUnderlineStyle.single.rawValue }
        }
        if run.link != nil { attributes[.foregroundColor] = UIColor.systemBlue }
        attributes[.font] = font
        attributes[.paragraphStyle] = paragraph
        // A paragraph delimiter participates in TextKit's line metrics. Keep
        // the block font even when its last run is smaller inline code.
        blockAttributes = attributes
        blockAttributes[.font] = paragraphFont
        result.append(NSAttributedString(string: prefix + String(parsed[run.range].characters), attributes: attributes))
      }
    } else { result.append(NSAttributedString(string: source, attributes: [.font: base, .foregroundColor: color])) }
    cache.setObject(result, forKey: key as NSString, cost: result.length * 8)
    return result
  }
}
