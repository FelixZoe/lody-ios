import UIKit

func assertNear(_ value: CGFloat, _ expected: CGFloat, _ message: String) {
  precondition(abs(value - expected) < 0.001, "\(message) (\(value) != \(expected))")
}

do {
  let large = UITraitCollection(preferredContentSizeCategory: .large)
  let extraSmall = UITraitCollection(preferredContentSizeCategory: .extraSmall)
  let extraExtraExtraLarge = UITraitCollection(preferredContentSizeCategory: .extraExtraExtraLarge)
  let accessibility = UITraitCollection(preferredContentSizeCategory: .accessibilityExtraExtraExtraLarge)
  assertNear(UIFont.dynamicScale(compatibleWith: large), 1, "Large scale is 1")
  assertNear(UIFont.dynamic(of: 17, compatibleWith: large).pointSize, 17, "Large body is 17")
  assertNear(UIFont.dynamic(of: 17, compatibleWith: extraSmall).pointSize, 14, "Extra Small body is 14")
  assertNear(UIFont.dynamic(of: 17, compatibleWith: extraExtraExtraLarge).pointSize, 23, "XXXL body is 23")
  assertNear(UIFont.dynamic(of: 17, compatibleWith: accessibility).pointSize, 23, "AX sizes clamp to 23")
  let markdown = ChatMarkdown()
  markdown.dynamicTraits = large
  let body = markdown.text("hello")
  let font = body.attribute(.font, at: 0, effectiveRange: nil) as! UIFont
  assertNear(font.pointSize, 17, "Chat body uses dynamic 17")
  let style = body.attribute(.paragraphStyle, at: 0, effectiveRange: nil) as! NSParagraphStyle
  assertNear(style.minimumLineHeight, 25, "Chat body lineHeight is 25")
  markdown.dynamicTraits = extraSmall
  let scaled = markdown.text("hello").attribute(.font, at: 0, effectiveRange: nil) as! UIFont
  assertNear(scaled.pointSize, 14, "Chat body follows clamped scale")
  print("Type scale: UIFont.dynamic matches RN clamp")
}

// A partially offscreen text view must retain every line when scrolling exposes it.
let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 400))
let view = ChatTextView(frame: CGRect(x: 0, y: 350, width: 350, height: 600))
window.addSubview(view)
view.setText(NSAttributedString(string: (1...20).map { "Line \($0): scrolling keeps this content" }.joined(separator: "\n"), attributes: [.font: UIFont.systemFont(ofSize: 17), .foregroundColor: UIColor.black]))
func draw() -> Data {
  UIGraphicsImageRenderer(size: view.bounds.size).image { context in
    UIColor.white.setFill()
    context.fill(view.bounds)
    view.draw(view.bounds)
  }.pngData()!
}
let initiallyClipped = draw()
view.frame.origin.y = 0
let exposedByScrolling = draw()
precondition(initiallyClipped == exposedByScrolling, "Text drawing must not depend on the current scroll position")
print("Chat render: offscreen lines remain drawn across scrolling")

// Unstyled paragraph separators make TextKit use its default 12 pt metrics,
// clipping larger CJK headings at the top even though the view is tall enough.
for source in ["## 原生聊天布局\n\n下一段正文。", "## 标题带 `code`\n\n下一段正文。", "正文以 `code` 结束\n\n下一段正文。"] {
  let text = ChatMarkdown().text(source)
  let native = ChatTextView()
  native.setText(text)
  let measured = native.sizeThatFits(CGSize(width: 350, height: 10000))
  let reference = UILabel()
  reference.numberOfLines = 0
  reference.attributedText = text
  let expected = reference.sizeThatFits(CGSize(width: 350, height: 10000))
  precondition(measured.height + 1 >= expected.height, "Paragraph metrics lost text height: \(measured.height) < \(expected.height)")
}
print("Chat render: heading and inline-code paragraph metrics remain intact")

let shineView = ChatTextView(frame: CGRect(x: 0, y: 0, width: 200, height: 20))
window.addSubview(shineView)
shineView.setText(NSAttributedString(string: "正在处理", attributes: [
  .font: UIFont.systemFont(ofSize: 13),
  .foregroundColor: UIColor.systemBlue,
]))
func shineSnapshot() -> Data {
  UIGraphicsImageRenderer(size: shineView.bounds.size).image { context in
    UIColor.white.setFill()
    context.fill(shineView.bounds)
    shineView.draw(shineView.bounds)
  }.pngData()!
}
shineView.setShine(false)
let rest = shineSnapshot()
shineView.setShine(true)
// Sample a full cycle: its offscreen phase can legitimately match resting text.
let frames = (0..<10).map { _ in
  Thread.sleep(forTimeInterval: 0.16)
  return shineSnapshot()
}
if !UIAccessibility.isReduceMotionEnabled {
  precondition(frames.contains { $0 != rest }, "Shine must change glyph brightness")
  precondition(Set(frames).count > 1, "Shine must travel across glyphs")
}
shineView.setShine(false)
let still = shineSnapshot()
Thread.sleep(forTimeInterval: 0.4)
precondition(still == shineSnapshot(), "Completed process text must stay still")
print("Chat render: process shine travels across running glyphs")

// A hit anywhere inside a rendered block must copy that block, not its neighbors.
let selectable = ChatTextView(frame: CGRect(x: 0, y: 0, width: 350, height: 1000))
selectable.setText(ChatMarkdown().text("第一段 👩🏽‍💻。\n\n- 第一项\n- 第二项\n\n```swift\nlet a = 1\n  print(a)\n```\n\n结尾。"))
let blockHeight = selectable.sizeThatFits(CGSize(width: 350, height: 1000)).height
let blocks = Set(stride(from: 0.0, to: Double(blockHeight), by: 1).compactMap {
  selectable.block(at: CGPoint(x: 30, y: $0))?.text
})
precondition(blocks.contains("第一段 👩🏽‍💻。"), "Paragraph selection must preserve graphemes")
precondition(blocks.contains("• 第一项\n• 第二项"), "List selection must cover the complete list")
precondition(blocks.contains("let a = 1\n  print(a)"), "Code selection must preserve newlines and indentation")
precondition(blocks.contains("结尾。") && blocks.count == 4, "Block selection must not include adjacent paragraphs")
print("Chat selection: paragraph, list, code, Unicode and block boundaries passed")
