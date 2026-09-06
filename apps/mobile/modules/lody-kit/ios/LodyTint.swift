import UIKit

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

extension UIColor {
  /// Glass sheets resolve grouped semantics to vibrant fills. Rows that still
  /// need to read as cards use these opaque system card values instead.
  static let lodyOpaqueCard = UIColor { traits in
    traits.userInterfaceStyle == .dark
      ? UIColor(red: 0x1C / 255, green: 0x1C / 255, blue: 0x1E / 255, alpha: 1)
      : .white
  }
}
