import UIKit

private final class ChatSelectionView: UITextView {
  var onDismiss: (() -> Void)?
  override func resignFirstResponder() -> Bool {
    let resigned = super.resignFirstResponder()
    if resigned { onDismiss?() }
    return resigned
  }
}

/// TextKit lays out once per content/width change. Fade ticks only draw glyphs;
/// they never rebuild attributed strings, remeasure cells or refresh the list.
final class ChatTextView: UIView {
  private let storage = NSTextStorage()
  private let manager = NSLayoutManager()
  private let container = NSTextContainer(size: .zero)
  private var fade = ChatTextFade()
  private var timer: Timer?
  private var shineEnabled = false
  private var selectionView: ChatSelectionView?
  private var selectionRange: NSRange?
  var onSelectionChange: ((Bool) -> Void)?

  override init(frame: CGRect) {
    super.init(frame: frame)
    isOpaque = false
    isUserInteractionEnabled = false
    contentMode = .redraw
    container.lineFragmentPadding = 0
    container.lineBreakMode = .byWordWrapping
    manager.addTextContainer(container)
    storage.addLayoutManager(manager)
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

  func setText(_ text: NSAttributedString, animate: Bool = false, reset: Bool = false) {
    if reset { endSelection() }
    if let range = selectionRange {
      let end = NSMaxRange(range)
      if text.length < end || (storage.string as NSString).substring(to: end) != (text.string as NSString).substring(to: end) {
        endSelection()
      }
    }
    fade.update(text.string, animate: animate && window != nil && !UIAccessibility.isReduceMotionEnabled,
      at: CACurrentMediaTime(), reset: reset)
    if !storage.isEqual(to: text) { storage.setAttributedString(text) }
    setNeedsDisplay()
    pokeDisplayTimer()
  }

  func block(at point: CGPoint) -> (range: NSRange, text: String)? {
    guard storage.length > 0, bounds.contains(point) else { return nil }
    layout(width: bounds.width)
    let glyph = manager.glyphIndex(for: point, in: container)
    guard glyph < manager.numberOfGlyphs else { return nil }
    let character = manager.characterIndexForGlyph(at: glyph)
    var range = NSRange(location: 0, length: 0)
    if storage.attribute(.chatBlock, at: character, longestEffectiveRange: &range,
                         in: NSRange(location: 0, length: storage.length)) == nil {
      range = (storage.string as NSString).paragraphRange(for: NSRange(location: character, length: 0))
    }
    while range.length > 0 && (storage.string as NSString).substring(with: NSRange(location: NSMaxRange(range) - 1, length: 1)) == "\n" {
      range.length -= 1
    }
    guard range.length > 0 else { return nil }
    return (range, (storage.string as NSString).substring(with: range))
  }

  func blockRect(_ range: NSRange) -> CGRect {
    layout(width: bounds.width)
    let glyphs = manager.glyphRange(forCharacterRange: range, actualCharacterRange: nil)
    let rect = manager.boundingRect(forGlyphRange: glyphs, in: container)
    return CGRect(x: 0, y: rect.minY, width: bounds.width, height: rect.height)
  }

  func selectBlock(_ range: NSRange, text: String) {
    guard NSMaxRange(range) <= storage.length, (storage.string as NSString).substring(with: range) == text else { return }
    endSelection()
    let view = ChatSelectionView()
    view.isEditable = false
    view.isSelectable = true
    view.isScrollEnabled = false
    view.backgroundColor = .clear
    view.textContainerInset = .zero
    view.textContainer.lineFragmentPadding = 0
    view.contentInsetAdjustmentBehavior = .never
    view.attributedText = storage.attributedSubstring(from: range)
    view.accessibilityIdentifier = "chat-block-selection"
    view.onDismiss = { [weak self] in self?.endSelection() }
    selectionRange = range
    selectionView = view
    onSelectionChange?(true)
    isUserInteractionEnabled = true
    addSubview(view)
    setNeedsLayout()
    layoutIfNeeded()
    view.becomeFirstResponder()
    view.selectedRange = NSRange(location: 0, length: view.attributedText.length)
    let menu = UIEditMenuInteraction(delegate: nil)
    view.addInteraction(menu)
    menu.presentEditMenu(with: UIEditMenuConfiguration(identifier: nil, sourcePoint: CGPoint(x: view.bounds.midX, y: 0)))
    setNeedsDisplay()
  }

  func endSelection() {
    let view = selectionView
    selectionView = nil
    selectionRange = nil
    view?.onDismiss = nil
    _ = view?.resignFirstResponder()
    view?.removeFromSuperview()
    if view != nil { onSelectionChange?(false) }
    isUserInteractionEnabled = false
    setNeedsDisplay()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    guard let view = selectionView, let range = selectionRange else { return }
    layout(width: bounds.width)
    let glyphs = manager.glyphRange(forCharacterRange: range, actualCharacterRange: nil)
    let line = manager.lineFragmentRect(forGlyphAt: glyphs.location, effectiveRange: nil)
    let size = view.sizeThatFits(CGSize(width: bounds.width, height: .greatestFiniteMagnitude))
    view.frame = CGRect(x: 0, y: line.minY, width: bounds.width, height: size.height)
  }

  func setShine(_ on: Bool) {
    shineEnabled = on
    setNeedsDisplay()
    pokeDisplayTimer()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      endSelection()
      timer?.invalidate(); timer = nil
      fade.update(storage.string, animate: false, at: CACurrentMediaTime(), reset: true)
    }
    pokeDisplayTimer()
  }

  override func sizeThatFits(_ size: CGSize) -> CGSize {
    layout(width: size.width)
    let used = manager.usedRect(for: container)
    return CGSize(width: ceil(used.maxX), height: ceil(used.maxY))
  }

  func lineAdvances(width: CGFloat) -> [CGFloat] {
    layout(width: width)
    var previous: CGFloat = 0
    var advances: [CGFloat] = []
    manager.enumerateLineFragments(forGlyphRange: manager.glyphRange(for: container)) { rect, _, _, _, _ in
      advances.append(max(0, rect.maxY - previous))
      previous = rect.maxY
    }
    return advances
  }

  private var shining: Bool { shineEnabled && !UIAccessibility.isReduceMotionEnabled }

  private func pokeDisplayTimer() {
    let keep = window != nil && !UIAccessibility.isReduceMotionEnabled
      && (shineEnabled || fade.isAnimating(at: CACurrentMediaTime()))
    if keep {
      guard timer == nil else { return }
      let ticker = Timer(timeInterval: 1.0 / 60, repeats: true) { [weak self] timer in
        guard let self else { timer.invalidate(); return }
        self.setNeedsDisplay()
        if self.window == nil || UIAccessibility.isReduceMotionEnabled
          || !(self.shineEnabled || self.fade.isAnimating(at: CACurrentMediaTime())) {
          timer.invalidate()
          self.timer = nil
        }
      }
      timer = ticker
      RunLoop.main.add(ticker, forMode: .common)
    } else if timer != nil {
      timer?.invalidate()
      timer = nil
    }
  }

  private func layout(width: CGFloat) {
    let size = CGSize(width: max(1, width), height: .greatestFiniteMagnitude)
    if container.size != size { container.size = size }
    manager.ensureLayout(for: container)
  }

  private func shineMask(overlay: CGRect) -> CGImage? {
    let size = bounds.size
    guard size.width >= 1, size.height >= 1 else { return nil }
    let scale = max(1, traitCollection.displayScale)
    let pixels = CGSize(width: ceil(size.width * scale), height: ceil(size.height * scale))
    guard let bitmap = CGContext(
      data: nil,
      width: Int(pixels.width),
      height: Int(pixels.height),
      bitsPerComponent: 8,
      bytesPerRow: Int(pixels.width),
      space: CGColorSpaceCreateDeviceGray(),
      bitmapInfo: CGImageAlphaInfo.none.rawValue
    ) else { return nil }
    bitmap.translateBy(x: 0, y: pixels.height)
    bitmap.scaleBy(x: scale, y: -scale)
    bitmap.setFillColor(gray: 0, alpha: 1)
    bitmap.fill(CGRect(origin: .zero, size: size))
    let gray = CGColorSpaceCreateDeviceGray()
    let colors = [
      CGColor(gray: 0, alpha: 1),
      CGColor(gray: 0, alpha: 1),
      CGColor(gray: 1, alpha: 1),
      CGColor(gray: 0, alpha: 1),
      CGColor(gray: 0, alpha: 1),
    ] as CFArray
    let locations: [CGFloat] = [0, 0.25, 0.5, 0.75, 1]
    guard let gradient = CGGradient(colorsSpace: gray, colors: colors, locations: locations) else { return nil }
    let angle = 120 * CGFloat.pi / 180
    let direction = CGPoint(x: sin(angle), y: -cos(angle))
    let extent = hypot(overlay.width, overlay.height)
    let center = CGPoint(x: overlay.midX, y: overlay.midY)
    bitmap.saveGState()
    bitmap.clip(to: overlay)
    bitmap.drawLinearGradient(
      gradient,
      start: CGPoint(x: center.x - direction.x * extent / 2, y: center.y - direction.y * extent / 2),
      end: CGPoint(x: center.x + direction.x * extent / 2, y: center.y + direction.y * extent / 2),
      options: []
    )
    bitmap.restoreGState()
    return bitmap.makeImage()
  }

  private func drawShine(_ context: CGContext, range: NSRange) {
    let used = manager.usedRect(for: container)
    let textWidth = max(1, used.width)
    let period = 1.5
    let progress = CGFloat(CACurrentMediaTime().truncatingRemainder(dividingBy: period) / period)
    let overlay = CGRect(
      x: used.minX + (-1 + 2 * progress) * textWidth,
      y: 0,
      width: textWidth,
      height: max(1, bounds.height)
    )
    manager.drawBackground(forGlyphRange: range, at: .zero)
    manager.drawGlyphs(forGlyphRange: range, at: .zero)
    guard let mask = shineMask(overlay: overlay) else { return }
    context.saveGState()
    context.clip(to: bounds, mask: mask)
    context.setBlendMode(.copy)
    context.setAlpha(0.32)
    manager.drawBackground(forGlyphRange: range, at: .zero)
    manager.drawGlyphs(forGlyphRange: range, at: .zero)
    context.restoreGState()
  }

  override func draw(_ rect: CGRect) {
    guard let context = UIGraphicsGetCurrentContext() else { return }
    layout(width: bounds.width)
    if let view = selectionView {
      let clip = UIBezierPath(rect: bounds)
      clip.append(UIBezierPath(rect: view.frame))
      clip.usesEvenOddFillRule = true
      clip.addClip()
    }
    // UIView retains this drawing while its parent scrolls. Draw the whole text
    // layer so newly exposed lines are already present in its backing store.
    let visible = manager.glyphRange(forBoundingRect: bounds, in: container)
    guard visible.length > 0 else { return }
    if shining {
      drawShine(context, range: visible)
      return
    }
    let time = CACurrentMediaTime()
    var groups: [(range: NSRange, opacity: CGFloat)] = []
    if !UIAccessibility.isReduceMotionEnabled {
      for character in fade.active where character.opacity(at: time) < 1 {
        let glyphs = NSIntersectionRange(manager.glyphRange(forCharacterRange: character.range, actualCharacterRange: nil), visible)
        guard glyphs.length > 0 else { continue }
        let opacity = CGFloat(character.opacity(at: time))
        // Text shaping can join characters into one glyph (e.g. ligatures).
        if let last = groups.last, NSIntersectionRange(last.range, glyphs).length > 0 {
          groups[groups.count - 1] = (NSUnionRange(last.range, glyphs), min(last.opacity, opacity))
        } else { groups.append((glyphs, opacity)) }
      }
    }
    func drawRange(_ range: NSRange, opacity: CGFloat) {
      guard range.length > 0 else { return }
      context.saveGState()
      context.setAlpha(opacity)
      manager.drawBackground(forGlyphRange: range, at: .zero)
      manager.drawGlyphs(forGlyphRange: range, at: .zero)
      context.restoreGState()
    }
    var cursor = visible.location
    for group in groups {
      drawRange(NSRange(location: cursor, length: max(0, group.range.location - cursor)), opacity: 1)
      drawRange(group.range, opacity: group.opacity)
      cursor = NSMaxRange(group.range)
    }
    drawRange(NSRange(location: cursor, length: max(0, NSMaxRange(visible) - cursor)), opacity: 1)
  }
}
