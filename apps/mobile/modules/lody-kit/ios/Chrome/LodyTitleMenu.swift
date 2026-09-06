import ExpoModulesCore
import UIKit

struct LodyTitleMenuItem: Record {
  @Field var id: String = ""
  @Field var title: String = ""
  @Field var selected: Bool = false
}

final class LodyTitleMenu: ExpoView {
  let onSelect = EventDispatcher()
  private let button = UIButton(type: .system)
  private var title = ""
  private var items: [LodyTitleMenuItem] = []

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    button.changesSelectionAsPrimaryAction = false
    button.contentHorizontalAlignment = .leading
    addSubview(button)
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    apply()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let pad = leadingInset()
    button.sizeToFit()
    button.layoutIfNeeded()
    let titleShift = button.titleLabel?.frame.minX ?? 0
    let width = min(
      max(button.intrinsicContentSize.width, 44),
      max(44, bounds.width - pad + titleShift)
    )
    button.frame = CGRect(x: pad - titleShift, y: 0, width: width, height: bounds.height)
  }

  override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
    button.frame.contains(point)
  }

  private func leadingInset() -> CGFloat {
    let target: CGFloat = 20
    guard let window else { return target }
    return max(0, target - convert(.zero, to: window).x)
  }

  func setLabel(_ value: String) {
    title = value
    apply()
  }

  func setAccessibilityName(_ value: String) {
    button.accessibilityLabel = value
  }

  func setItems(_ value: [LodyTitleMenuItem]) {
    items = value
    apply()
  }

  private func apply() {
    let font = UIFont.preferredFont(forTextStyle: .headline)
    let color = UIColor.label
    let labeled = NSMutableAttributedString(
      string: title,
      attributes: [.font: font, .foregroundColor: color]
    )
    let symbol = UIImage.SymbolConfiguration(pointSize: 10, weight: .semibold)
    if let image = UIImage(systemName: "chevron.down", withConfiguration: symbol)?
      .withTintColor(color, renderingMode: .alwaysOriginal)
    {
      labeled.append(NSAttributedString(string: "\u{00A0}", attributes: [.font: font]))
      let attachment = NSTextAttachment()
      attachment.image = image
      let size = image.size
      attachment.bounds = CGRect(
        x: 0,
        y: (font.capHeight - size.height) / 2,
        width: size.width,
        height: size.height
      )
      labeled.append(NSAttributedString(attachment: attachment))
    }
    button.configuration = nil
    button.setAttributedTitle(labeled, for: .normal)
    button.tintColor = color
    button.titleLabel?.numberOfLines = 1
    button.titleLabel?.lineBreakMode = .byTruncatingTail
    if items.isEmpty {
      button.menu = nil
      button.showsMenuAsPrimaryAction = false
    } else {
      button.menu = UIMenu(
        options: .singleSelection,
        children: items.map { item in
          UIAction(title: item.title, state: item.selected ? .on : .off) { [weak self] _ in
            self?.onSelect(["id": item.id])
          }
        }
      )
      button.showsMenuAsPrimaryAction = true
    }
    let width = window?.bounds.width ?? UIScreen.main.bounds.width
    setViewSize(CGSize(width: width, height: 44))
  }
}
