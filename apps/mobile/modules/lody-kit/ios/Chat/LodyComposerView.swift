import ExpoModulesCore
import UIKit

/// Standalone host for the same input used by LodyChatView. RN owns the sheet's keyboard inset.
final class LodyComposerView: ExpoView {
  let onSend = EventDispatcher()
  let onHeightChange = EventDispatcher()
  let onComposerOptionChange = EventDispatcher()
  let composer = ChatComposerView(frame: .zero)

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    // New-session creation currently hands off text only; never accept files it cannot send.
    composer.setAttachmentsEnabled(false)
    composer.setInputIdentifier("create-session-input")
    composer.onSend = { [weak self] in self?.onSend($0) }
    composer.onHeightChange = { [weak self] in self?.onHeightChange(["height": $0]) }
    composer.onComposerOptionChange = { [weak self] in self?.onComposerOptionChange($0) }
    addSubview(composer)
    composer.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      composer.topAnchor.constraint(equalTo: topAnchor),
      composer.leadingAnchor.constraint(equalTo: leadingAnchor),
      composer.trailingAnchor.constraint(equalTo: trailingAnchor),
    ])
  }
}
