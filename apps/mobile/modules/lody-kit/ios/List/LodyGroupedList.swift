import ExpoModulesCore
import UIKit

struct LodyListRow: Record {
  @Field var id: String = ""
  @Field var title: String = ""
  @Field var subtitle: String = ""
  @Field var value: String = ""
  @Field var image: String = ""
  @Field var imageTint: String = ""
  @Field var subtitleMono: Bool = false
  @Field var action: Bool = false
  @Field var navigates: Bool = false
  @Field var disclosure: Bool = false
  @Field var destructive: Bool = false
}

struct LodyListSection: Record {
  @Field var id: String = ""
  @Field var header: String = ""
  @Field var footer: String = ""
  @Field var rows: [LodyListRow] = []
}

private final class ListAppearanceController: UIViewController {
  var onWillAppear: ((Bool, UIViewControllerTransitionCoordinator?) -> Void)?
  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    onWillAppear?(animated, transitionCoordinator ?? parent?.transitionCoordinator)
  }
}

final class LodyGroupedList: ExpoView, UICollectionViewDataSource, UICollectionViewDelegate {
  let onRowPress = EventDispatcher()
  let onRefresh = EventDispatcher()
  private let appearance = ListAppearanceController()
  private weak var scrollOwner: UIViewController?
  private var sections: [LodyListSection] = []
  private let collection: UICollectionView
  private let refreshControl = UIRefreshControl()
  private let placeholder = UILabel()
  private var placeholderText = ""

  private static var accent: UIColor = .systemBlue
  private var transparent = false

  private let registration = UICollectionView.CellRegistration<UICollectionViewListCell, LodyListRow> { cell, _, row in
    let accent = LodyGroupedList.accent
    var content = UIListContentConfiguration.subtitleCell()
    content.text = row.title
    content.secondaryText = row.subtitle.isEmpty ? nil : row.subtitle
    content.textProperties.numberOfLines = 0
    content.secondaryTextProperties.numberOfLines = 1
    if row.subtitleMono {
      content.secondaryTextProperties.font = .monospacedSystemFont(
        ofSize: UIFont.preferredFont(forTextStyle: .footnote).pointSize,
        weight: .regular
      )
    }
    content.textProperties.color = row.destructive ? .systemRed : .label
    if !row.image.isEmpty {
      content.image = UIImage(systemName: row.image)
      content.imageProperties.tintColor =
        lodyTint(row.imageTint) ?? (row.destructive ? .systemRed : accent)
      content.imageProperties.preferredSymbolConfiguration = .init(textStyle: .title3)
    }
    cell.contentConfiguration = content
    var accessories: [UICellAccessory] = []
    if !row.value.isEmpty {
      var options = UICellAccessory.LabelOptions()
      options.tintColor = .secondaryLabel
      accessories.append(.label(text: row.value, options: options))
    }
    if row.disclosure { accessories.append(.disclosureIndicator()) }
    cell.accessories = accessories
    cell.accessibilityIdentifier = row.id
    cell.accessibilityTraits = row.action ? .button : .staticText
  }

  private let headerRegistration = UICollectionView.SupplementaryRegistration<UICollectionViewListCell>(
    elementKind: UICollectionView.elementKindSectionHeader
  ) { _, _, _ in }

  private let footerRegistration = UICollectionView.SupplementaryRegistration<UICollectionViewListCell>(
    elementKind: UICollectionView.elementKindSectionFooter
  ) { _, _, _ in }

  required init(appContext: AppContext? = nil) {
    var configuration = UICollectionLayoutListConfiguration(appearance: .insetGrouped)
    configuration.headerMode = .supplementary
    configuration.footerMode = .supplementary
    collection = UICollectionView(frame: .zero, collectionViewLayout: UICollectionViewCompositionalLayout.list(using: configuration))
    super.init(appContext: appContext)
    collection.backgroundColor = .systemGroupedBackground
    collection.contentInsetAdjustmentBehavior = .automatic
    collection.alwaysBounceVertical = true
    collection.keyboardDismissMode = .onDrag
    collection.dataSource = self
    collection.delegate = self
    if #available(iOS 26.0, *) {
      collection.topEdgeEffect.style = .soft
      collection.bottomEdgeEffect.style = .soft
    }
    refreshControl.addTarget(self, action: #selector(refreshPulled), for: .valueChanged)
    collection.refreshControl = refreshControl
    placeholder.textAlignment = .center
    placeholder.numberOfLines = 0
    placeholder.textColor = .secondaryLabel
    placeholder.font = .preferredFont(forTextStyle: .subheadline)
    placeholder.adjustsFontForContentSizeCategory = true
    placeholder.isHidden = true
    addSubview(collection)
    addSubview(placeholder)
    appearance.view = UIView(frame: .zero)
    appearance.view.isUserInteractionEnabled = false
    appearance.onWillAppear = { [weak self] animated, coordinator in
      self?.deselectOnReturn(animated: animated, coordinator: coordinator)
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    collection.frame = bounds
    let insets = collection.adjustedContentInset
    placeholder.frame = bounds.inset(by: UIEdgeInsets(top: insets.top + 24, left: 32, bottom: insets.bottom + 24, right: 32))
    attachScrollOwner()
  }

  override func willMove(toSuperview newSuperview: UIView?) {
    if newSuperview == nil, appearance.parent != nil {
      appearance.willMove(toParent: nil)
      appearance.view.removeFromSuperview()
      appearance.removeFromParent()
    }
    super.willMove(toSuperview: newSuperview)
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      if scrollOwner?.contentScrollView(for: .top) === collection {
        scrollOwner?.setContentScrollView(nil, for: .top)
        scrollOwner?.setContentScrollView(nil, for: .bottom)
      }
      scrollOwner = nil
    } else {
      attachScrollOwner()
    }
  }

  private func attachScrollOwner() {
    guard window != nil, scrollOwner == nil else { return }
    var responder: UIResponder? = next
    while let current = responder {
      if let controller = current as? UIViewController {
        controller.setContentScrollView(collection, for: .top)
        controller.setContentScrollView(collection, for: .bottom)
        scrollOwner = controller
        if appearance.parent == nil {
          controller.addChild(appearance)
          addSubview(appearance.view)
          appearance.didMove(toParent: controller)
        }
        return
      }
      responder = current.next
    }
  }

  func setSections(_ value: [LodyListSection]) {
    let selectedID = collection.indexPathsForSelectedItems?.first.map { sections[$0.section].rows[$0.item].id }
    sections = value
    collection.reloadData()
    if let selectedID, let index = indexPath(for: selectedID) {
      collection.selectItem(at: index, animated: false, scrollPosition: [])
    }
    updatePlaceholder()
  }

  /// A sheet paints its own material. Dropping the list's ground lets that
  /// material show between groups; the cells keep their grouped background so
  /// rows still read as cards.
  func setTransparent(_ value: Bool) {
    guard value != transparent else { return }
    transparent = value
    collection.backgroundColor = value ? .clear : .systemGroupedBackground
  }

  func setAccent(_ value: String) {
    guard let color = lodyTint(value), color != LodyGroupedList.accent else { return }
    LodyGroupedList.accent = color
    collection.reloadData()
  }

  func setRefreshing(_ value: Bool) {
    if value, !refreshControl.isRefreshing {
      refreshControl.beginRefreshing()
    } else if !value, refreshControl.isRefreshing {
      refreshControl.endRefreshing()
    }
  }

  func setPlaceholder(_ value: String) {
    placeholderText = value
    updatePlaceholder()
  }

  private func updatePlaceholder() {
    let empty = sections.allSatisfy { $0.rows.isEmpty }
    placeholder.text = placeholderText
    placeholder.isHidden = !empty || placeholderText.isEmpty
  }

  @objc private func refreshPulled() {
    onRefresh([:])
  }

  func numberOfSections(in collectionView: UICollectionView) -> Int { sections.count }
  func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int { sections[section].rows.count }
  func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
    let cell = collectionView.dequeueConfiguredReusableCell(
      using: registration,
      for: indexPath,
      item: sections[indexPath.section].rows[indexPath.item]
    )
    if transparent {
      // On a glass sheet UIKit renders the default grouped fill as a vibrant
      // wash, so content behind the sheet bleeds through the row. Rows have to
      // opt back into an opaque card.
      var background = UIBackgroundConfiguration.listGroupedCell()
      background.backgroundColor = .secondarySystemGroupedBackground
      cell.backgroundConfiguration = background
    }
    return cell
  }
  func collectionView(_ collectionView: UICollectionView, viewForSupplementaryElementOfKind kind: String, at indexPath: IndexPath) -> UICollectionReusableView {
    let section = sections[indexPath.section]
    let header = kind == UICollectionView.elementKindSectionHeader
    let view = collectionView.dequeueConfiguredReusableSupplementary(
      using: header ? headerRegistration : footerRegistration,
      for: indexPath
    )
    let text = header ? section.header : section.footer
    guard !text.isEmpty else {
      view.contentConfiguration = nil
      return view
    }
    var content = header ? UIListContentConfiguration.groupedHeader() : UIListContentConfiguration.groupedFooter()
    content.text = text
    content.textProperties.numberOfLines = 0
    view.contentConfiguration = content
    return view
  }
  func collectionView(_ collectionView: UICollectionView, shouldSelectItemAt indexPath: IndexPath) -> Bool {
    sections[indexPath.section].rows[indexPath.item].action
  }
  func collectionView(_ collectionView: UICollectionView, shouldHighlightItemAt indexPath: IndexPath) -> Bool {
    sections[indexPath.section].rows[indexPath.item].action
  }
  func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
    let row = sections[indexPath.section].rows[indexPath.item]
    if row.navigates {
      collectionView.selectItem(at: indexPath, animated: false, scrollPosition: [])
    } else {
      collectionView.deselectItem(at: indexPath, animated: true)
    }
    onRowPress(["id": row.id])
  }

  private func indexPath(for id: String) -> IndexPath? {
    for (section, entry) in sections.enumerated() {
      if let item = entry.rows.firstIndex(where: { $0.id == id }) {
        return IndexPath(item: item, section: section)
      }
    }
    return nil
  }

  private func deselectOnReturn(animated: Bool, coordinator: UIViewControllerTransitionCoordinator?) {
    guard let index = collection.indexPathsForSelectedItems?.first else { return }
    let id = sections[index.section].rows[index.item].id
    guard let coordinator else {
      collection.deselectItem(at: index, animated: animated)
      return
    }
    let started = coordinator.animate(alongsideTransition: { [weak self] _ in
      guard let self, let current = self.indexPath(for: id) else { return }
      self.collection.deselectItem(at: current, animated: animated)
    }, completion: { [weak self] context in
      guard context.isCancelled, let self, let current = self.indexPath(for: id) else { return }
      self.collection.selectItem(at: current, animated: false, scrollPosition: [])
    })
    if !started { collection.deselectItem(at: index, animated: animated) }
  }

}
