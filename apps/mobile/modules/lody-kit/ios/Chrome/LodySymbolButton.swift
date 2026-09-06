import ExpoModulesCore
import UIKit

final class LodySymbolButton: ExpoView {
  let onSymbolPress = EventDispatcher()
  private let button = UIButton(type: .system)
  private var symbol = "circle"
  private var prominent = false

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    button.addTarget(self, action: #selector(pressed), for: .primaryActionTriggered)
    addSubview(button)
    apply()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    button.frame = bounds
  }

  func setSymbol(_ value: String) {
    symbol = value
    apply()
  }

  func setAccessibilityName(_ value: String) {
    button.accessibilityLabel = value
  }

  /// Filled circular treatment for the send action; plain glyph for bar buttons.
  func setProminent(_ value: Bool) {
    prominent = value
    apply()
  }

  func setDisabled(_ value: Bool) {
    button.isEnabled = !value
  }

  func setTint(_ value: String) {
    button.tintColor = lodyTint(value)
  }

  private func apply() {
    var configuration = prominent
      ? UIButton.Configuration.filled()
      : UIButton.Configuration.plain()
    configuration.image = UIImage(systemName: symbol)
    configuration.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(
      textStyle: prominent ? .body : .title3,
      scale: .medium
    )
    configuration.contentInsets = .zero
    if prominent { configuration.cornerStyle = .capsule }
    button.configuration = configuration
  }

  @objc private func pressed() {
    onSymbolPress([:])
  }
}
