import UIKit

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
