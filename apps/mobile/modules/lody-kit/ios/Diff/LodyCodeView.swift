import ExpoModulesCore
import MarkdownView
import UIKit

private let languages: [String: String] = [
  "ts": "typescript", "tsx": "typescript", "mts": "typescript", "cts": "typescript",
  "js": "javascript", "jsx": "javascript", "mjs": "javascript", "cjs": "javascript",
  "swift": "swift", "m": "objectivec", "h": "objectivec", "mm": "objectivec",
  "py": "python", "rb": "ruby", "go": "go", "rs": "rust", "java": "java", "kt": "kotlin",
  "c": "c", "cc": "cpp", "cpp": "cpp", "hpp": "cpp", "cs": "csharp", "php": "php",
  "sh": "bash", "bash": "bash", "zsh": "bash", "fish": "bash",
  "json": "json", "yml": "yaml", "yaml": "yaml", "toml": "ini", "ini": "ini",
  "md": "markdown", "mdx": "markdown", "html": "xml", "xml": "xml", "svg": "xml",
  "css": "css", "scss": "scss", "less": "less", "sql": "sql", "graphql": "graphql",
  "dockerfile": "dockerfile", "makefile": "makefile", "lua": "lua", "dart": "dart",
  "rb.erb": "erb", "vue": "xml", "podspec": "ruby", "gemfile": "ruby",
]

final class LodyCodeView: ExpoView, UITextViewDelegate {
  let onFail = EventDispatcher()
  private let textView = UITextView()
  private let gutter = GutterView()
  private weak var scrollOwner: UIViewController?
  private var handle = ""
  private var path = ""
  private var lineStarts: [Int] = []
  private var renderScheduled = false

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .systemBackground
    textView.isEditable = false
    textView.isSelectable = true
    textView.alwaysBounceVertical = true
    textView.showsHorizontalScrollIndicator = false
    textView.backgroundColor = .clear
    textView.contentInsetAdjustmentBehavior = .automatic
    textView.textContainer.lineFragmentPadding = 0
    textView.delegate = self
    addSubview(textView)
    gutter.textView = textView
    gutter.isUserInteractionEnabled = false
    addSubview(gutter)
  }

  func setHandle(_ value: String) { handle = value; scheduleRender() }
  func setPath(_ value: String) { path = value; scheduleRender() }

  private func scheduleRender() {
    guard !renderScheduled else { return }
    renderScheduled = true
    DispatchQueue.main.async { [weak self] in
      self?.renderScheduled = false
      self?.render()
    }
  }

  private func language() -> String? {
    let name = (path as NSString).lastPathComponent.lowercased()
    let ext = (name as NSString).pathExtension
    return languages[ext.isEmpty ? name : ext]
  }

  private func render() {
    guard !handle.isEmpty else { return }
    guard let content = ContentStore.shared.get(handle), let text = String(data: content.data, encoding: .utf8) else {
      onFail(["message": "content_expired"])
      return
    }
    var theme = ChatMarkdownTheme.make(traits: traitCollection, secondary: false)
    theme.colors.code = .label
    // ponytail: highlightr runs on the main thread; above 256 KB the file shows plain text.
    let attributed: NSAttributedString
    if text.utf8.count <= 256 * 1024 {
      let map = CodeHighlighter.current.highlight(key: nil, content: text, language: language(), theme: theme)
      attributed = map.apply(to: text, with: theme)
    } else {
      attributed = CodeHighlighter.HighlightMap().apply(to: text, with: theme)
    }
    textView.attributedText = attributed
    lineStarts = [0]
    var index = 0
    for scalar in text.utf16 {
      index += 1
      if scalar == 0x0A { lineStarts.append(index) }
    }
    gutter.lineStarts = lineStarts
    gutter.font = theme.fonts.code
    gutter.width = Self.gutterWidth(lines: lineStarts.count, font: theme.fonts.code)
    textView.textContainerInset = UIEdgeInsets(top: 12, left: gutter.width + 8, bottom: 24, right: 16)
    textView.contentOffset = CGPoint(x: 0, y: -textView.adjustedContentInset.top)
    setNeedsLayout()
    gutter.setNeedsDisplay()
  }

  private static func gutterWidth(lines: Int, font: UIFont) -> CGFloat {
    let digits = max(2, String(lines).count)
    let sample = String(repeating: "8", count: digits) as NSString
    return ceil(sample.size(withAttributes: [.font: font]).width) + 20
  }

  func scrollViewDidScroll(_ scrollView: UIScrollView) {
    gutter.setNeedsDisplay()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    textView.frame = bounds
    gutter.frame = CGRect(x: 0, y: 0, width: gutter.width, height: bounds.height)
    attachScrollOwner()
    gutter.setNeedsDisplay()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    attachScrollOwner()
  }

  private func attachScrollOwner() {
    guard window != nil, scrollOwner == nil else { return }
    var responder = next
    while let current = responder {
      if let owner = current as? UIViewController {
        owner.setContentScrollView(textView, for: .top)
        owner.setContentScrollView(textView, for: .bottom)
        scrollOwner = owner
        return
      }
      responder = current.next
    }
  }

  override func willMove(toWindow newWindow: UIWindow?) {
    super.willMove(toWindow: newWindow)
    guard newWindow == nil, let owner = scrollOwner else { return }
    if owner.contentScrollView(for: .top) === textView {
      owner.setContentScrollView(nil, for: .top)
      owner.setContentScrollView(nil, for: .bottom)
    }
    scrollOwner = nil
  }

  override func traitCollectionDidChange(_ previous: UITraitCollection?) {
    super.traitCollectionDidChange(previous)
    if previous?.preferredContentSizeCategory != traitCollection.preferredContentSizeCategory { scheduleRender() }
  }
}

// Soft-wrapped continuation fragments carry no number; only paragraph starts do.
private final class GutterView: UIView {
  weak var textView: UITextView?
  var lineStarts: [Int] = []
  var font = UIFont.monospacedSystemFont(ofSize: 13, weight: .regular)
  var width: CGFloat = 40

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .systemBackground
    contentMode = .redraw
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

  override func draw(_ rect: CGRect) {
    guard let textView, !lineStarts.isEmpty else { return }
    let layout = textView.layoutManager
    let container = textView.textContainer
    let offset = textView.contentOffset.y - textView.textContainerInset.top
    let visible = CGRect(x: 0, y: offset, width: CGFloat.greatestFiniteMagnitude, height: bounds.height + textView.textContainerInset.top)
    let glyphs = layout.glyphRange(forBoundingRect: visible, in: container)
    let attributes: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: UIColor.tertiaryLabel,
    ]
    UIColor.separator.setFill()
    UIRectFill(CGRect(x: bounds.width - 0.5, y: 0, width: 0.5, height: bounds.height))
    layout.enumerateLineFragments(forGlyphRange: glyphs) { [self] fragment, _, _, glyphRange, _ in
      let characters = layout.characterRange(forGlyphRange: glyphRange, actualGlyphRange: nil)
      let line = lineIndex(startingAt: characters.location)
      guard let line else { return }
      let y = fragment.origin.y - offset
      let text = String(line + 1) as NSString
      let size = text.size(withAttributes: attributes)
      text.draw(at: CGPoint(x: width - 12 - size.width, y: y + (fragment.height - size.height) / 2), withAttributes: attributes)
    }
  }

  private func lineIndex(startingAt location: Int) -> Int? {
    var low = 0, high = lineStarts.count - 1
    while low <= high {
      let mid = (low + high) / 2
      if lineStarts[mid] == location { return mid }
      if lineStarts[mid] < location { low = mid + 1 } else { high = mid - 1 }
    }
    return nil
  }
}
