import ExpoModulesCore
import UIKit

struct LodyListRow: Record {
  @Field var id: String = ""
  @Field var title: String = ""
  @Field var subtitle: String = ""
  @Field var action: Bool = false
  @Field var navigates: Bool = false
  @Field var disclosure: Bool = false
  @Field var destructive: Bool = false
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
  private let appearance = ListAppearanceController()
  private weak var scrollOwner: UIViewController?
  private var sections: [[LodyListRow]] = []
  private let collection: UICollectionView
  private let registration = UICollectionView.CellRegistration<UICollectionViewListCell, LodyListRow> { cell, _, row in
    var content = UIListContentConfiguration.subtitleCell()
    content.text = row.title
    content.secondaryText = row.subtitle.isEmpty ? nil : row.subtitle
    content.textProperties.numberOfLines = 0
    content.secondaryTextProperties.numberOfLines = 0
    content.textProperties.color = row.destructive ? .systemRed : (row.action && !row.disclosure ? .systemBlue : .label)
    cell.contentConfiguration = content
    cell.accessories = row.disclosure ? [.disclosureIndicator()] : []
    cell.accessibilityIdentifier = row.id
    cell.accessibilityTraits = row.action ? .button : .staticText
  }

  required init(appContext: AppContext? = nil) {
    let configuration = UICollectionLayoutListConfiguration(appearance: .insetGrouped)
    collection = UICollectionView(frame: .zero, collectionViewLayout: UICollectionViewCompositionalLayout.list(using: configuration))
    super.init(appContext: appContext)
    collection.backgroundColor = .systemGroupedBackground
    collection.contentInsetAdjustmentBehavior = .automatic
    collection.alwaysBounceVertical = true
    collection.dataSource = self
    collection.delegate = self
    if #available(iOS 26.0, *) {
      collection.topEdgeEffect.style = .soft
      collection.bottomEdgeEffect.style = .soft
    }
    addSubview(collection)
    appearance.view = UIView(frame: .zero)
    appearance.view.isUserInteractionEnabled = false
    appearance.onWillAppear = { [weak self] animated, coordinator in
      self?.deselectOnReturn(animated: animated, coordinator: coordinator)
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    collection.frame = bounds
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

  func setSections(_ value: [[LodyListRow]]) {
    let selectedID = collection.indexPathsForSelectedItems?.first.map { sections[$0.section][$0.item].id }
    sections = value
    collection.reloadData()
    if let selectedID, let index = indexPath(for: selectedID) {
      collection.selectItem(at: index, animated: false, scrollPosition: [])
    }
  }

  func numberOfSections(in collectionView: UICollectionView) -> Int { sections.count }
  func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int { sections[section].count }
  func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
    collectionView.dequeueConfiguredReusableCell(using: registration, for: indexPath, item: sections[indexPath.section][indexPath.item])
  }
  func collectionView(_ collectionView: UICollectionView, shouldSelectItemAt indexPath: IndexPath) -> Bool {
    sections[indexPath.section][indexPath.item].action
  }
  func collectionView(_ collectionView: UICollectionView, shouldHighlightItemAt indexPath: IndexPath) -> Bool {
    sections[indexPath.section][indexPath.item].action
  }
  func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
    let row = sections[indexPath.section][indexPath.item]
    if row.navigates {
      collectionView.selectItem(at: indexPath, animated: false, scrollPosition: [])
    } else {
      collectionView.deselectItem(at: indexPath, animated: true)
    }
    onRowPress(["id": row.id])
  }

  private func indexPath(for id: String) -> IndexPath? {
    for (section, rows) in sections.enumerated() {
      if let item = rows.firstIndex(where: { $0.id == id }) {
        return IndexPath(item: item, section: section)
      }
    }
    return nil
  }

  private func deselectOnReturn(animated: Bool, coordinator: UIViewControllerTransitionCoordinator?) {
    guard let index = collection.indexPathsForSelectedItems?.first else { return }
    let id = sections[index.section][index.item].id
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
