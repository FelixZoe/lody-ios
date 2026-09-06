import ExpoModulesCore
import UIKit

struct LodyMenuItem: Record {
  @Field var id: String = ""
  @Field var title: String = ""
  @Field var subtitle: String = ""
  @Field var image: String = ""
  @Field var selected: Bool = false
}

final class LodyMenuButton: ExpoView {
  let onSelect = EventDispatcher()
  private let button = UIButton(type: .system)
  private var items: [LodyMenuItem] = []

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    button.showsMenuAsPrimaryAction = true
    button.changesSelectionAsPrimaryAction = false
    var configuration = UIButton.Configuration.plain()
    configuration.contentInsets = .zero
    configuration.imagePlacement = .trailing
    configuration.imagePadding = 4
    configuration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
      var outgoing = incoming
      outgoing.font = .preferredFont(forTextStyle: .body)
      return outgoing
    }
    button.configuration = configuration
    addSubview(button)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    button.frame = bounds
  }

  override var intrinsicContentSize: CGSize {
    let size = button.intrinsicContentSize
    return CGSize(width: size.width, height: max(size.height, 44))
  }

  func setLabel(_ label: String) {
    button.configuration?.title = label
    button.configuration?.image = UIImage(
      systemName: "chevron.up.chevron.down",
      withConfiguration: UIImage.SymbolConfiguration(textStyle: .caption1, scale: .small)
    )
    invalidateIntrinsicContentSize()
  }

  func setAccessibilityName(_ label: String) {
    button.accessibilityLabel = label
  }

  func setItems(_ value: [LodyMenuItem]) {
    items = value
    button.menu = UIMenu(children: value.map { item in
      UIAction(
        title: item.title,
        subtitle: item.subtitle.isEmpty ? nil : item.subtitle,
        image: item.image.isEmpty ? nil : UIImage(systemName: item.image),
        state: item.selected ? .on : .off
      ) { [weak self] _ in
        self?.onSelect(["id": item.id])
      }
    })
  }
}
