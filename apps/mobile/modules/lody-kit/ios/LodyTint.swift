import UIKit

/// Semantic state names resolve to system colors; the accent arrives as a hex
/// value because it is the one color the app owns rather than UIKit.
func lodyTint(_ value: String) -> UIColor? {
  switch value {
  case "": return nil
  case "warning": return .systemOrange
  case "danger": return .systemRed
  case "secondary": return .secondaryLabel
  case "tertiary": return .tertiaryLabel
  default: break
  }
  var hex = value
  if hex.hasPrefix("#") { hex.removeFirst() }
  guard hex.count == 6, let rgb = UInt32(hex, radix: 16) else { return nil }
  return UIColor(
    red: CGFloat((rgb >> 16) & 0xFF) / 255,
    green: CGFloat((rgb >> 8) & 0xFF) / 255,
    blue: CGFloat(rgb & 0xFF) / 255,
    alpha: 1
  )
}
