import ExpoModulesCore
import UIKit

/// UIKit press feedback for RN content: RN's Pressable has no native settle.
final class LodyPressable: ExpoView {
  let onNativePress = EventDispatcher()
  private var pressScale: CGFloat = 0.985
  private var haptic = true
  private var disabled = false
  private let feedback = UISelectionFeedbackGenerator()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    let recognizer = UILongPressGestureRecognizer(target: self, action: #selector(handle(_:)))
    recognizer.minimumPressDuration = 0
    recognizer.cancelsTouchesInView = false
    addGestureRecognizer(recognizer)
  }

  func setPressScale(_ value: Double) { pressScale = CGFloat(value) }
  func setHaptic(_ value: Bool) { haptic = value }
  func setDisabled(_ value: Bool) { disabled = value }

  @objc private func handle(_ recognizer: UILongPressGestureRecognizer) {
    guard !disabled else { return }
    switch recognizer.state {
    case .began:
      settle(to: pressScale)
      if haptic { feedback.prepare() }
    case .ended:
      settle(to: 1)
      guard bounds.contains(recognizer.location(in: self)) else { return }
      if haptic { feedback.selectionChanged() }
      onNativePress([:])
    case .cancelled, .failed:
      settle(to: 1)
    default:
      break
    }
  }

  private func settle(to scale: CGFloat) {
    UIView.animate(
      withDuration: 0.24,
      delay: 0,
      usingSpringWithDamping: 1,
      initialSpringVelocity: 0,
      options: [.allowUserInteraction, .beginFromCurrentState]
    ) {
      self.transform = CGAffineTransform(scaleX: scale, y: scale)
    }
  }
}
