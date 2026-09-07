import UIKit

extension UIFont {
  static func dynamicScale(compatibleWith traits: UITraitCollection? = nil) -> CGFloat {
    let body = preferredFont(forTextStyle: .body, compatibleWith: traits ?? .current).pointSize
    return min(23 / 17, max(14 / 17, body / 17))
  }

  static func dynamic(
    of size: CGFloat,
    weight: UIFont.Weight = .regular,
    compatibleWith traits: UITraitCollection? = nil
  ) -> UIFont {
    systemFont(ofSize: size * dynamicScale(compatibleWith: traits), weight: weight)
  }
}
