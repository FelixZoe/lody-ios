import ExpoModulesCore
import UIKit

/// A stable search field: UISearchController's toolbar regrouping is intentionally
/// not involved, so focusing never changes the field or close button's geometry.
final class LodySearchBar: ExpoView {
  let onQueryChange = EventDispatcher()
  let onClose = EventDispatcher()
  private let field = UISearchTextField()
  private let closeButton = UIButton(type: .system)
  private let glass: UIVisualEffectView
  private var wantsFocus = false

  required init(appContext: AppContext? = nil) {
    if #available(iOS 26.0, *) {
      glass = UIVisualEffectView(effect: UIGlassEffect(style: .regular))
    } else {
      glass = UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterial))
    }
    super.init(appContext: appContext)
    glass.clipsToBounds = true
    addSubview(glass)
    field.borderStyle = .none
    field.backgroundColor = .clear
    field.font = .preferredFont(forTextStyle: .body)
    field.adjustsFontForContentSizeCategory = true
    field.tintColor = .systemBlue
    field.returnKeyType = .search
    field.autocapitalizationType = .none
    field.autocorrectionType = .no
    field.accessibilityIdentifier = "catalog-search-input"
    field.addTarget(self, action: #selector(changed), for: .editingChanged)
    field.addTarget(self, action: #selector(submitted), for: .editingDidEndOnExit)
    glass.contentView.addSubview(field)
    var configuration: UIButton.Configuration
    if #available(iOS 26.0, *) { configuration = .glass() }
    else { configuration = .gray() }
    configuration.image = UIImage(systemName: "xmark")
    configuration.preferredSymbolConfigurationForImage = .init(textStyle: .title2)
    configuration.cornerStyle = .capsule
    configuration.baseForegroundColor = .label
    closeButton.configuration = configuration
    closeButton.accessibilityLabel = "关闭搜索"
    closeButton.accessibilityIdentifier = "catalog-search-close"
    closeButton.addTarget(self, action: #selector(close), for: .primaryActionTriggered)
    addSubview(closeButton)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let height = bounds.height
    glass.frame = CGRect(x: 0, y: 0, width: max(0, bounds.width - height - 12), height: height)
    glass.layer.cornerRadius = height / 2
    field.frame = glass.bounds.insetBy(dx: 14, dy: 4)
    closeButton.frame = CGRect(x: bounds.width - height, y: 0, width: height, height: height)
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    updateFocus()
  }

  func setPlaceholder(_ text: String) {
    field.placeholder = text
    field.accessibilityLabel = text
  }
  func setFocused(_ value: Bool) { wantsFocus = value; updateFocus() }
  private func updateFocus() {
    if wantsFocus && window != nil { field.becomeFirstResponder() }
    else { field.resignFirstResponder() }
  }
  @objc private func changed() { onQueryChange(["text": field.text ?? ""]) }
  @objc private func submitted() { field.resignFirstResponder() }
  @objc private func close() { field.resignFirstResponder(); onClose([:]) }
}
