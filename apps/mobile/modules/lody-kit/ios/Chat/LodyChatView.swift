import ExpoModulesCore
import UIKit

private final class ChatCell: UICollectionViewCell, UIContextMenuInteractionDelegate {
  let label = ChatTextView()
  let bubble = UIView()
  let icon = UIImageView()
  let spinner = UIActivityIndicatorView(style: .medium)
  var row: ChatRow?
  var onInteraction: (() -> Void)?
  private var menuRange: NSRange?
  private var pendingSelection: (() -> Void)?
  override init(frame: CGRect) {
    super.init(frame: frame)
    bubble.backgroundColor = .secondarySystemBackground
    bubble.layer.cornerRadius = 19
    bubble.layer.cornerCurve = .continuous
    contentView.addSubview(bubble)
    contentView.addSubview(label)
    contentView.addSubview(icon)
    contentView.addSubview(spinner)
    icon.contentMode = .center
    isAccessibilityElement = true
    contentView.addInteraction(UIContextMenuInteraction(delegate: self))
    label.onSelectionChange = { [weak self] active in self?.isAccessibilityElement = !active }
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
  func configure(_ row: ChatRow, text: NSAttributedString) {
    label.setText(text, animate: row.streaming, reset: self.row?.id != row.id)
    self.row = row
    bubble.isHidden = row.kind != "user"
    icon.image = row.symbol.isEmpty ? nil : UIImage(systemName: row.symbol, withConfiguration: UIImage.SymbolConfiguration(pointSize: 13))
    icon.tintColor = row.attention ? .systemOrange : row.kind == "summary" && row.running ? .systemBlue : .secondaryLabel
    row.running && row.kind != "summary" ? spinner.startAnimating() : spinner.stopAnimating()
    accessibilityIdentifier = row.id
    accessibilityLabel = text.string
    accessibilityTraits = row.actionable ? .button : .staticText
    accessibilityHint = row.kind == "summary" ? "打开执行过程" : nil
    label.setShine(row.kind == "summary" && row.running && !row.attention)
    setNeedsLayout()
  }
  override func prepareForReuse() {
    super.prepareForReuse()
    label.setShine(false)
    label.endSelection()
    pendingSelection = nil
  }
  func contextMenuInteraction(_ interaction: UIContextMenuInteraction, configurationForMenuAtLocation location: CGPoint) -> UIContextMenuConfiguration? {
    guard let row, !label.isUserInteractionEnabled else { return nil }
    menuRange = nil
    if row.kind == "user" {
      guard bubble.frame.contains(location) else { return nil }
      onInteraction?()
      return UIContextMenuConfiguration(identifier: nil, previewProvider: nil) { _ in
        UIMenu(children: [UIAction(title: "复制", image: UIImage(systemName: "doc.on.doc")) { _ in
          UIPasteboard.general.string = row.text
        }])
      }
    }
    guard row.kind == "text" || row.kind == "thought",
      let block = label.block(at: contentView.convert(location, to: label)) else { return nil }
    onInteraction?()
    menuRange = block.range
    return UIContextMenuConfiguration(identifier: nil, previewProvider: nil) { [weak self] _ in
      UIMenu(children: [
        UIAction(title: "选择此块", image: UIImage(systemName: "selection.pin.in.out")) { [weak self] _ in
          self?.pendingSelection = { [weak self] in
            guard let self, self.row?.id == row.id else { return }
            self.label.selectBlock(block.range, text: block.text)
          }
        },
        UIAction(title: "复制此块", image: UIImage(systemName: "doc.on.doc")) { _ in
          UIPasteboard.general.string = block.text
        },
      ])
    }
  }

  func contextMenuInteraction(_ interaction: UIContextMenuInteraction,
                             previewForHighlightingMenuWithConfiguration configuration: UIContextMenuConfiguration) -> UITargetedPreview? {
    contextPreview()
  }

  func contextMenuInteraction(_ interaction: UIContextMenuInteraction,
                             previewForDismissingMenuWithConfiguration configuration: UIContextMenuConfiguration) -> UITargetedPreview? {
    contextPreview()
  }

  private func contextPreview() -> UITargetedPreview? {
    let parameters = UIPreviewParameters()
    parameters.backgroundColor = .systemBackground
    let rect = menuRange.map { label.convert(label.blockRect($0), to: contentView) } ?? bubble.frame
    guard let preview = contentView.resizableSnapshotView(from: rect, afterScreenUpdates: false, withCapInsets: .zero) else { return nil }
    parameters.visiblePath = UIBezierPath(roundedRect: CGRect(origin: .zero, size: rect.size), cornerRadius: row?.kind == "user" ? 19 : 4)
    return UITargetedPreview(view: preview, parameters: parameters,
      target: UIPreviewTarget(container: contentView, center: CGPoint(x: rect.midX, y: rect.midY)))
  }

  func contextMenuInteraction(_ interaction: UIContextMenuInteraction, willEndFor configuration: UIContextMenuConfiguration,
                             animator: (any UIContextMenuInteractionAnimating)?) {
    let select = pendingSelection
    pendingSelection = nil
    if let animator { animator.addCompletion { DispatchQueue.main.async { select?() } } }
    else { select?() }
  }

  static func leading(_ row: ChatRow) -> CGFloat {
    row.kind == "text" || row.kind == "user" ? 0 : 24
  }
  static func textWidth(_ row: ChatRow, width: CGFloat) -> CGFloat {
    // Reserve the status slot even after completion: status cannot rewrap text.
    max(1, row.kind == "user" ? width * 0.84 - 26 : width - leading(row) - (row.kind == "text" || row.kind == "thought" || row.kind == "summary" ? 0 : 28))
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    guard let row else { return }
    let width = contentView.bounds.width
    if row.kind == "user" {
      let size = label.sizeThatFits(CGSize(width: width * 0.84 - 26, height: .greatestFiniteMagnitude))
      bubble.frame = CGRect(x: width - size.width - 26, y: 12, width: size.width + 26, height: size.height + 20)
      label.frame = bubble.frame.insetBy(dx: 13, dy: 10)
    } else {
      let inset = Self.leading(row)
      let textWidth = Self.textWidth(row, width: width)
      let height = label.sizeThatFits(CGSize(width: textWidth, height: .greatestFiniteMagnitude)).height
      let y = row.kind == "text" || row.kind == "thought" ? 6 : max(6, (bounds.height - height) / 2)
      label.frame = CGRect(x: inset, y: y, width: textWidth, height: height)
      icon.frame = CGRect(x: 0, y: y, width: 16, height: min(height, 20))
    }
    spinner.frame = CGRect(x: width - 24, y: (bounds.height - 20) / 2, width: 20, height: 20)
  }
}

private final class ChatCollectionView: UICollectionView {
  var contentDidLayout: (() -> Void)?
  var lockedOffset: CGFloat?
  private var lastSize = CGSize.zero
  override func layoutSubviews() {
    super.layoutSubviews()
    if let lockedOffset, abs(contentOffset.y - lockedOffset) > 0.5 {
      setContentOffset(CGPoint(x: 0, y: lockedOffset), animated: false)
    }
    guard contentSize != lastSize else { return }
    lastSize = contentSize
    contentDidLayout?()
  }
}

private final class ChatNavigationController: UIViewController {
  var updateTitle: (() -> Void)?
  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    updateTitle?()
  }
  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    updateTitle?()
  }
}

private struct ChatComposerState: Decodable {
  var editable = true
  var canSend = false
  var sending = false
  var notice = ""
  var reconnect = false
  var placeholder = "给 Lody 发消息…"
}

final class LodyChatView: ExpoView, UICollectionViewDelegateFlowLayout, UITextViewDelegate {
  let onSend = EventDispatcher()
  let onActivityPress = EventDispatcher()
  let onReconnect = EventDispatcher()
  let onTitlePress = EventDispatcher()
  private let titleButton = UIButton(type: .system)
  private let navigation = ChatNavigationController()
  private let collection: ChatCollectionView
  private let measuringText = ChatTextView()
  private var measurements: [String: (width: CGFloat, text: NSAttributedString, height: CGFloat, lines: [CGFloat])] = [:]
  private let composer = UIVisualEffectView(effect: nil)
  private let inputSurface = UIVisualEffectView(effect: nil)
  private let input = UITextView()
  private let hint = UILabel()
  private let notice = UIButton(type: .system)
  private let bottomButton = UIButton(type: .system)
  private let send = UIButton(type: .system)
  private let sendSpinner = UIActivityIndicatorView(style: .medium)
  private let attach = UIButton(type: .system)
  private let attachSurface = UIVisualEffectView(effect: nil)
  private let attachmentBar = ChatAttachmentBar()
  private var attachments: [ChatAttachment] = []
  private var imageWorkspace = ""
  private var imageSession = ""
  private let filePicker = ChatAttachmentPicker()
  private let libraryPicker = ChatPhotoLibraryPicker()
  private let empty = UILabel()
  private var inputHeight: NSLayoutConstraint!
  private var noticeHeight: NSLayoutConstraint!
  private var attachmentHeight: NSLayoutConstraint!
  private weak var scrollOwner: UIViewController?
  private var dataSource: UICollectionViewDiffableDataSource<String, String>!
  private var transcript = ChatTranscript()
  private var processEntryID = ""
  private var processStartID = ""
  private var stream = ChatStream()
  private var frameTimer: Timer?
  private var rendering = false
  private var framePending = false
  private var rows: [String: ChatRow] = [:]
  private let markdown = ChatMarkdown()
  private var state = ChatComposerState()
  private var update: DispatchWorkItem?
  private var pendingEntries: String?
  private let preparation = DispatchQueue(label: "app.innei.lody.chat", qos: .userInitiated)
  private var decoding = false
  private var displayError: String?
  private var applying = false
  private var needsApply = false
  private var followsBottom = true
  private var trackingPausedByGesture = false
  private var scroll = ChatScroll()
  private var scrollTimer: Timer?
  private var lastScrollTick: CFTimeInterval = 0
  private var lastUserID: String?
  private var anchoredUserID: String?
  private var awaitingUserAnchor = false
  private var pendingAnchorAnimation = false
  private var anchorScrollInFlight = false
  private var laidOutHeight: CGFloat = 0
  private var pendingDraft: (text: String, attachments: [ChatAttachment])?
  private var lastRestoreToken = 0
  private var hasInitialDraft = false
  private var lastClearToken = 0

  required init(appContext: AppContext? = nil) {
    let layout = UICollectionViewFlowLayout()
    layout.minimumLineSpacing = 0
    layout.minimumInteritemSpacing = 0
    layout.sectionInset = UIEdgeInsets(top: 4, left: 20, bottom: 4, right: 20)
    collection = ChatCollectionView(frame: .zero, collectionViewLayout: layout)
    super.init(appContext: appContext)
    titleButton.titleLabel?.font = .preferredFont(forTextStyle: .headline)
    titleButton.titleLabel?.lineBreakMode = .byTruncatingTail
    titleButton.setTitleColor(.label, for: .normal)
    titleButton.accessibilityIdentifier = "chat-navigation-title"
    titleButton.accessibilityHint = "查看会话详情"
    titleButton.addAction(UIAction { [weak self] _ in self?.onTitlePress() }, for: .touchUpInside)
    navigation.view = UIView(frame: .zero)
    navigation.view.isUserInteractionEnabled = false
    navigation.updateTitle = { [weak self] in self?.attachTitle() }
    backgroundColor = .systemBackground
    collection.backgroundColor = .clear
    collection.alwaysBounceVertical = true
    collection.keyboardDismissMode = .interactive
    collection.contentInsetAdjustmentBehavior = .automatic
    collection.delegate = self
    collection.contentDidLayout = { [weak self] in
      guard let self, !self.applying else { return }
      self.updateBottomInset()
      if self.followsBottom { self.scrollToBottom() }
    }
    collection.register(ChatImageCell.self, forCellWithReuseIdentifier: "image")
    collection.register(ChatCell.self, forCellWithReuseIdentifier: "message")
    dataSource = UICollectionViewDiffableDataSource<String, String>(collectionView: collection) { [weak self] collection, index, id in
      guard let self, let row = self.rows[id] else { return nil }
      if row.image != nil {
        let cell = collection.dequeueReusableCell(withReuseIdentifier: "image", for: index) as! ChatImageCell
        cell.configure(row, workspace: self.imageWorkspace, session: self.imageSession)
        return cell
      }
      let cell = collection.dequeueReusableCell(withReuseIdentifier: "message", for: index) as! ChatCell
      cell.onInteraction = { [weak self] in self?.pauseTracking() }
      cell.configure(row, text: self.text(for: row))
      return cell
    }
    if #available(iOS 26.0, *) {
      collection.topEdgeEffect.style = .soft
      collection.bottomEdgeEffect.style = .soft
    }
    composer.backgroundColor = .clear
    if #available(iOS 26.0, *) {
      composer.effect = UIGlassContainerEffect()
      let glass = UIGlassEffect(style: .regular)
      glass.isInteractive = true
      inputSurface.effect = glass
      let attachGlass = UIGlassEffect(style: .regular)
      attachGlass.isInteractive = true
      attachSurface.effect = attachGlass
      let edge = UIScrollEdgeElementContainerInteraction()
      edge.scrollView = collection
      edge.edge = .bottom
      composer.addInteraction(edge)
    }
    input.backgroundColor = .clear
    inputSurface.layer.cornerRadius = 24
    inputSurface.layer.cornerCurve = .continuous
    inputSurface.clipsToBounds = true
    attachSurface.layer.cornerRadius = 22
    attachSurface.layer.cornerCurve = .continuous
    attachSurface.clipsToBounds = true
    if #unavailable(iOS 26.0) {
      inputSurface.backgroundColor = .secondarySystemBackground
      attachSurface.backgroundColor = .secondarySystemBackground
    }
    input.font = .systemFont(ofSize: 17)
    input.textColor = .label
    input.textContainerInset = UIEdgeInsets(top: 13, left: 16, bottom: 13, right: 46)
    input.delegate = self
    input.accessibilityIdentifier = "session-input"
    input.accessibilityLabel = "消息"
    hint.text = state.placeholder
    hint.font = input.font
    hint.textColor = .placeholderText
    hint.isUserInteractionEnabled = false
    hint.isAccessibilityElement = false
    send.setImage(UIImage(systemName: "arrow.up.circle.fill", withConfiguration: UIImage.SymbolConfiguration(pointSize: 26, weight: .medium)), for: .normal)
    send.tintColor = .systemBlue
    sendSpinner.color = .systemBlue
    sendSpinner.isUserInteractionEnabled = false
    sendSpinner.translatesAutoresizingMaskIntoConstraints = false
    send.addSubview(sendSpinner)
    NSLayoutConstraint.activate([
      sendSpinner.centerXAnchor.constraint(equalTo: send.centerXAnchor),
      sendSpinner.centerYAnchor.constraint(equalTo: send.centerYAnchor),
    ])
    send.accessibilityLabel = "发送"
    send.accessibilityIdentifier = "session-send"
    send.addTarget(self, action: #selector(submit), for: .touchUpInside)
    attach.setImage(UIImage(systemName: "plus", withConfiguration: UIImage.SymbolConfiguration(pointSize: 17, weight: .medium)), for: .normal)
    attach.tintColor = .secondaryLabel
    attach.accessibilityLabel = "添加附件"
    attach.accessibilityIdentifier = "session-attach"
    attach.showsMenuAsPrimaryAction = true
    attach.menu = UIMenu(children: [
      UIAction(title: "最近照片", image: UIImage(systemName: "photo")) { [weak self] _ in self?.presentRecentPhotos() },
      UIAction(title: "照片图库", image: UIImage(systemName: "photo.on.rectangle.angled")) { [weak self] _ in
        guard let self, let controller = self.presenter() else { return }
        self.libraryPicker.present(from: controller)
      },
      UIAction(title: "文件", image: UIImage(systemName: "folder")) { [weak self] _ in
        guard let self, let controller = self.presenter() else { return }
        self.filePicker.files(from: controller)
      },
    ])
    filePicker.onPick = { [weak self] picked in self?.addAttachments(picked) }
    libraryPicker.onPick = { [weak self] picked in self?.addAttachments(picked) }
    attachmentBar.onPreview = { [weak self] id in
      guard let self, let index = self.attachments.firstIndex(where: { $0.id == id }), let controller = self.presenter() else { return }
      controller.present(ChatAttachmentPreview(self.attachments, index: index), animated: true)
    }
    attachmentBar.onRemove = { [weak self] id in
      guard let self else { return }
      self.attachments.removeAll { $0.id == id }
      UIImpactFeedbackGenerator(style: .light).impactOccurred()
      self.updateComposer()
    }
    notice.titleLabel?.font = .systemFont(ofSize: 13)
    notice.titleLabel?.numberOfLines = 0
    notice.addTarget(self, action: #selector(reconnect), for: .touchUpInside)
    empty.numberOfLines = 0
    empty.textAlignment = .center
    empty.font = .systemFont(ofSize: 16)
    empty.textColor = .secondaryLabel
    empty.text = "正在取回对话…"
    collection.backgroundView = empty
    addSubview(collection)
    addSubview(composer)
    bottomButton.setImage(UIImage(systemName: "arrow.down"), for: .normal)
    bottomButton.accessibilityLabel = "回到底部"
    bottomButton.accessibilityIdentifier = "chat-scroll-to-bottom"
    if #available(iOS 26.0, *) { bottomButton.configuration = .glass() }
    else { bottomButton.configuration = .gray() }
    bottomButton.configuration?.cornerStyle = .capsule
    bottomButton.alpha = 0
    bottomButton.isUserInteractionEnabled = false
    bottomButton.addAction(UIAction { [weak self] _ in
      guard let self else { return }
      self.collection.setContentOffset(self.collection.contentOffset, animated: false)
      self.trackingPausedByGesture = false
      self.followsBottom = self.scroll.target != nil
      self.pendingAnchorAnimation = true
      self.scrollToBottom()
    }, for: .touchUpInside)
    addSubview(bottomButton)
    bottomButton.translatesAutoresizingMaskIntoConstraints = false
    composer.contentView.addSubview(notice)
    composer.contentView.addSubview(attachmentBar)
    composer.contentView.addSubview(attachSurface)
    composer.contentView.addSubview(inputSurface)
    attachSurface.contentView.addSubview(attach)
    for view in [input, hint, send] { inputSurface.contentView.addSubview(view) }
    for view in [collection, composer, inputSurface, attachSurface, notice, attachmentBar, input, hint, send, attach] { view.translatesAutoresizingMaskIntoConstraints = false }
    inputHeight = input.heightAnchor.constraint(equalToConstant: 48)
    noticeHeight = notice.heightAnchor.constraint(equalToConstant: 0)
    attachmentHeight = attachmentBar.heightAnchor.constraint(equalToConstant: 0)
    NSLayoutConstraint.activate([
      bottomButton.centerXAnchor.constraint(equalTo: composer.centerXAnchor),
      bottomButton.bottomAnchor.constraint(equalTo: composer.topAnchor, constant: -8),
      bottomButton.widthAnchor.constraint(equalToConstant: 44), bottomButton.heightAnchor.constraint(equalToConstant: 44),
      collection.topAnchor.constraint(equalTo: topAnchor),
      collection.leadingAnchor.constraint(equalTo: leadingAnchor), collection.trailingAnchor.constraint(equalTo: trailingAnchor),
      collection.bottomAnchor.constraint(equalTo: bottomAnchor),
      composer.leadingAnchor.constraint(equalTo: leadingAnchor), composer.trailingAnchor.constraint(equalTo: trailingAnchor),
      composer.bottomAnchor.constraint(equalTo: keyboardLayoutGuide.topAnchor),
      notice.topAnchor.constraint(equalTo: composer.topAnchor), notice.leadingAnchor.constraint(equalTo: composer.leadingAnchor, constant: 20),
      notice.trailingAnchor.constraint(equalTo: composer.trailingAnchor, constant: -20), noticeHeight,
      inputSurface.topAnchor.constraint(equalTo: input.topAnchor), inputSurface.bottomAnchor.constraint(equalTo: input.bottomAnchor),
      inputSurface.leadingAnchor.constraint(equalTo: input.leadingAnchor), inputSurface.trailingAnchor.constraint(equalTo: input.trailingAnchor),
      attachmentBar.topAnchor.constraint(equalTo: notice.bottomAnchor),
      attachmentBar.leadingAnchor.constraint(equalTo: composer.leadingAnchor, constant: 16),
      attachmentBar.trailingAnchor.constraint(equalTo: composer.trailingAnchor, constant: -16), attachmentHeight,
      input.topAnchor.constraint(equalTo: attachmentBar.bottomAnchor, constant: 8),
      input.leadingAnchor.constraint(equalTo: attachSurface.trailingAnchor, constant: 8), input.trailingAnchor.constraint(equalTo: composer.trailingAnchor, constant: -16),
      input.bottomAnchor.constraint(equalTo: composer.bottomAnchor, constant: -8), inputHeight,
      hint.leadingAnchor.constraint(equalTo: input.leadingAnchor, constant: 21), hint.topAnchor.constraint(equalTo: input.topAnchor, constant: 13),
      hint.trailingAnchor.constraint(lessThanOrEqualTo: send.leadingAnchor),
      send.trailingAnchor.constraint(equalTo: input.trailingAnchor, constant: -2), send.bottomAnchor.constraint(equalTo: input.bottomAnchor, constant: -2),
      send.widthAnchor.constraint(equalToConstant: 44), send.heightAnchor.constraint(equalToConstant: 44),
      attachSurface.leadingAnchor.constraint(equalTo: composer.leadingAnchor, constant: 16),
      attachSurface.bottomAnchor.constraint(equalTo: input.bottomAnchor),
      attachSurface.widthAnchor.constraint(equalToConstant: 44), attachSurface.heightAnchor.constraint(equalToConstant: 44),
      attach.topAnchor.constraint(equalTo: attachSurface.contentView.topAnchor), attach.bottomAnchor.constraint(equalTo: attachSurface.contentView.bottomAnchor),
      attach.leadingAnchor.constraint(equalTo: attachSurface.contentView.leadingAnchor), attach.trailingAnchor.constraint(equalTo: attachSurface.contentView.trailingAnchor),
    ])
    updateComposer()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    if window != nil && scrollOwner == nil {
      var responder = next
      while let current = responder {
        if let controller = current as? UIViewController {
          controller.setContentScrollView(collection, for: .top)
          controller.setContentScrollView(collection, for: .bottom)
          scrollOwner = controller
          if navigation.parent == nil {
            controller.addChild(navigation)
            addSubview(navigation.view)
            navigation.didMove(toParent: controller)
          }
          break
        }
        responder = current.next
      }
    }
    attachTitle()
    updateBottomButton()
    if updateBottomInset(), followsBottom { scrollToBottom() }
    if abs(laidOutHeight - collection.bounds.height) > 0.5 {
      laidOutHeight = collection.bounds.height
      if followsBottom { scrollToBottom() }
    }
  }

  func setNavigationTitle(_ title: String) {
    guard titleButton.currentTitle != title else { return }
    titleButton.setTitle(title, for: .normal)
    titleButton.sizeToFit()
    titleButton.bounds.size.height = 44
    setNeedsLayout()
  }

  private func attachTitle() {
    guard window != nil, let owner = scrollOwner, let title = titleButton.currentTitle, !title.isEmpty else { return }
    // Own the UIKit title view directly; no RN header subview wrapper.
    if owner.navigationItem.titleView !== titleButton {
      owner.navigationItem.titleView = titleButton
    }
  }

  override func willMove(toSuperview newSuperview: UIView?) {
    if newSuperview == nil, navigation.parent != nil {
      navigation.willMove(toParent: nil)
      navigation.view.removeFromSuperview()
      navigation.removeFromParent()
    }
    super.willMove(toSuperview: newSuperview)
  }

  private var composerInset: CGFloat {
    processEntryID.isEmpty ? max(0, bounds.maxY - composer.frame.minY - collection.safeAreaInsets.bottom) + 8 : 0
  }

  @discardableResult
  private func updateBottomInset() -> Bool {
    let base = composerInset
    var space: CGFloat = 0
    if let id = anchoredUserID, let index = dataSource.indexPath(for: id),
       let frame = collection.layoutAttributesForItem(at: index)?.frame {
      let naturalBottom = collection.contentSize.height - collection.bounds.height + collection.safeAreaInsets.bottom + base
      space = max(0, frame.minY - collection.adjustedContentInset.top - naturalBottom)
    }
    if let target = scroll.target {
      space = max(space, CGFloat(target) + collection.bounds.height - collection.contentSize.height - collection.safeAreaInsets.bottom - base)
    }
    let bottom = base + space
    guard abs(collection.contentInset.bottom - bottom) > 0.5 else { return false }
    collection.contentInset.bottom = bottom
    collection.verticalScrollIndicatorInsets.bottom = base
    return true
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      anchorScrollInFlight = false
      scrollTimer?.invalidate(); scrollTimer = nil
      collection.lockedOffset = nil
      scroll = ChatScroll()
      update?.cancel(); update = nil
      frameTimer?.invalidate(); frameTimer = nil
      stream.finish()
      if scrollOwner?.navigationItem.titleView === titleButton {
        scrollOwner?.navigationItem.titleView = nil
      }
      if scrollOwner?.contentScrollView(for: .top) === collection {
        scrollOwner?.setContentScrollView(nil, for: .top)
        scrollOwner?.setContentScrollView(nil, for: .bottom)
      }
      scrollOwner = nil
    } else {
      if pendingEntries != nil { scheduleUpdate() }
      renderFrame()
    }
  }

  func setProcessStartID(_ id: String) {
    guard processStartID != id else { return }
    processStartID = id
    applyRows()
  }

  func setProcessEntryID(_ id: String) {
    guard processEntryID != id else { return }
    processEntryID = id
    composer.isHidden = !id.isEmpty
    setNeedsLayout()
    applyRows()
  }

  func setEntries(_ json: String) {
    pendingEntries = json
    scheduleUpdate()
  }
  private func scheduleUpdate() {
    guard update == nil, !decoding else { return }
    let work = DispatchWorkItem { [weak self] in
      guard let self else { return }
      self.update = nil
      guard let json = self.pendingEntries else { return }
      self.pendingEntries = nil
      self.decoding = true
      self.preparation.async { [weak self] in
        let decoded = Result { () -> [ChatEntry] in
          let entries = try JSONDecoder().decode([ChatEntry].self, from: Data(json.utf8))
          guard Set(entries.map(\.id)).count == entries.count,
                entries.allSatisfy({ Set($0.items.map(\.itemId)).count == $0.items.count }) else {
            throw NSError(domain: "LodyChat", code: 1)
          }
          return entries
        }
        DispatchQueue.main.async { [weak self] in
          guard let self else { return }
          self.decoding = false
          switch decoded {
          case .success(let entries):
            self.displayError = nil
            let userID = entries.last { $0.role == "user" }?.id
            if self.processEntryID.isEmpty, let userID, userID != self.lastUserID,
               self.lastUserID != nil || self.awaitingUserAnchor {
              self.scroll = ChatScroll()
              self.scrollTimer?.invalidate(); self.scrollTimer = nil
              self.collection.lockedOffset = nil
              self.anchoredUserID = userID + ":user"
              self.pendingAnchorAnimation = true
              self.anchorScrollInFlight = false
              self.awaitingUserAnchor = false
              self.trackingPausedByGesture = false
              self.followsBottom = true
            }
            self.lastUserID = userID
            self.stream.receive(entries, animate: self.window != nil && !UIAccessibility.isReduceMotionEnabled)
            self.renderFrame()
            self.startFrameTimer()
          case .failure:
            self.displayError = "对话暂时无法显示 · 点此重新同步"
          }
          self.updateComposer()
          if self.pendingEntries != nil { self.scheduleUpdate() }
        }
      }
    }
    update = work
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05, execute: work)
  }

  private func startFrameTimer() {
    guard frameTimer == nil, stream.hasPending, window != nil else { return }
    let timer = Timer(timeInterval: 1.0 / 30, repeats: true) { [weak self] timer in
      guard let self, self.window != nil else { timer.invalidate(); return }
      if UIAccessibility.isReduceMotionEnabled { self.stream.finish() }
      self.renderFrame()
      if !self.stream.hasPending { timer.invalidate(); self.frameTimer = nil }
    }
    frameTimer = timer
    RunLoop.main.add(timer, forMode: .common)
  }

  private func renderFrame() {
    guard !rendering else { framePending = true; return }
    rendering = true
    stream.advance()
    let entries = stream.presentation
    let markdown = self.markdown
    preparation.async { [weak self] in
      for entry in entries.suffix(2) {
        for item in entry.items where item.type == "text" || item.type == "thought" {
          markdown.prepare(item.text ?? "")
        }
      }
      DispatchQueue.main.async { [weak self] in
        guard let self else { return }
        self.transcript.entries = entries
        self.applyRows()
        self.rendering = false
        if self.framePending { self.framePending = false; self.renderFrame() }
      }
    }
  }

  private func text(for row: ChatRow) -> NSAttributedString {
    if row.kind == "text" || row.kind == "thought" { return markdown.text(row.text, secondary: row.kind == "thought") }
    let paragraph = NSMutableParagraphStyle()
    paragraph.lineSpacing = 3
    return NSAttributedString(string: row.text, attributes: [
      .font: UIFont.systemFont(ofSize: row.kind == "user" ? 16 : 13),
      .foregroundColor: row.attention ? UIColor.systemOrange : row.kind == "summary" && row.running ? UIColor.systemBlue : row.kind == "user" ? UIColor.label : UIColor.secondaryLabel,
      .paragraphStyle: paragraph,
    ])
  }

  private func applyRows() {
    guard !applying else { needsApply = true; return }
    applying = true
    let previousOffset = collection.contentOffset.y
    let projected = transcript.rows(processEntryID: processEntryID, processStartID: processStartID)
    let liveEntryID = transcript.entries.last { !$0.finished && $0.role != "user" && (processEntryID.isEmpty || $0.id == processEntryID) }?.id
    let starting = scroll.entryID == nil && liveEntryID != nil
    let nearTail = collection.contentSize.height - collection.bounds.height + collection.adjustedContentInset.bottom - previousOffset < CGFloat(ChatScroll.resumeDistance)
    let following = followsBottom || (starting && nearTail && !trackingPausedByGesture)
    followsBottom = following
    let completing = scroll.entryID != nil && liveEntryID == nil
    let anchorID = completing && following
      ? projected.last(where: { $0.entryID == scroll.entryID && $0.kind == "text" })?.id
      : collection.indexPathsForVisibleItems.sorted().compactMap { dataSource.itemIdentifier(for: $0) }.first(where: { id in projected.contains { $0.id == id } })
    let anchor = anchorID.flatMap { id -> (String, CGFloat)? in
      guard let index = dataSource.indexPath(for: id), let frame = collection.layoutAttributesForItem(at: index)?.frame else { return nil }
      return (id, frame.minY - previousOffset)
    }
    // Snapshot/layout is not allowed to drive scrolling while we own tracking.
    if following && (scroll.target != nil || liveEntryID != nil) { collection.lockedOffset = previousOffset }
    guard Set(projected.map(\.id)).count == projected.count else {
      applying = false
      displayError = "对话暂时无法显示 · 点此重新同步"
      updateComposer()
      return
    }
    let folding = completing && processEntryID.isEmpty && window != nil
    let previous = rows
    rows = Dictionary(projected.map { ($0.id, $0) }, uniquingKeysWith: { _, last in last })
    measurements = measurements.filter { rows[$0.key] != nil }
    var snapshot = NSDiffableDataSourceSnapshot<String, String>()
    let grouped = Dictionary(grouping: projected, by: \.entryID)
    for entry in transcript.entries {
      guard let entryRows = grouped[entry.id], !entryRows.isEmpty else { continue }
      snapshot.appendSections([entry.id])
      snapshot.appendItems(entryRows.map(\.id), toSection: entry.id)
    }
    snapshot.reconfigureItems(projected.filter { previous[$0.id] != nil && previous[$0.id] != $0 }.map(\.id))
    empty.isHidden = !projected.isEmpty
    let updateLayout = { [self] in
      self.collection.collectionViewLayout.invalidateLayout()
      self.collection.layoutIfNeeded()
      if let liveEntryID {
        let steps = projected.filter { $0.entryID == liveEntryID }.map { row -> (String, [Double]) in
          let measured = self.measure(row, width: max(1, self.collection.bounds.width - 40))
          var lines = measured.lines
          if lines.isEmpty { lines = [measured.height] }
          else { lines[0] += row.kind == "user" ? 44 : 12 }
          if row.kind == "summary" || (row.actionable && lines.count == 1) { lines = [max(44, measured.height + 12)] }
          return (row.id, lines.map(Double.init))
        }
        let base = self.composerInset
        var minimum = -self.collection.adjustedContentInset.top
        if let id = self.anchoredUserID, let index = self.dataSource.indexPath(for: id), let frame = self.collection.layoutAttributesForItem(at: index)?.frame {
          minimum = max(minimum, frame.minY - self.collection.adjustedContentInset.top)
        }
        let lastRow = projected.last { $0.entryID == liveEntryID }
        let lastLineBottom = lastRow.flatMap { row -> CGFloat? in
          guard let index = self.dataSource.indexPath(for: row.id), let frame = self.collection.layoutAttributesForItem(at: index)?.frame else { return nil }
          let measured = self.measure(row, width: max(1, self.collection.bounds.width - 40))
          return frame.minY + (row.kind == "summary" ? frame.height : measured.height + 6) + 8
        } ?? minimum
        self.scroll.update(entryID: liveEntryID, rows: steps, initialEnd: Double(lastLineBottom),
          viewport: Double(self.collection.bounds.height - self.collection.safeAreaInsets.bottom - base), minimum: Double(minimum))
      } else if completing {
        self.scroll.finish()
        self.scrollTimer?.invalidate(); self.scrollTimer = nil
        self.collection.lockedOffset = nil
        self.followsBottom = false
      }
      self.updateBottomInset()
      if completing && following {
        // One final placement after folding, then UIKit/user owns scrolling.
        self.collection.contentOffset.y = max(-self.collection.adjustedContentInset.top,
          self.collection.contentSize.height - self.collection.bounds.height + self.collection.adjustedContentInset.bottom)
      } else if following { self.scrollToBottom() }
      else if let (id, offset) = anchor, let index = self.dataSource.indexPath(for: id), let frame = self.collection.layoutAttributesForItem(at: index)?.frame {
        self.collection.contentOffset.y = max(-self.collection.adjustedContentInset.top, frame.minY - offset)
      }
      self.updateBottomButton()
    }
    let finish = { [weak self] in
      guard let self else { return }
      self.applying = false
      if self.needsApply { self.needsApply = false; self.applyRows() }
    }
    if folding && !UIAccessibility.isReduceMotionEnabled {
      collection.lockedOffset = nil
      scrollTimer?.invalidate(); scrollTimer = nil
      UIView.animate(withDuration: 0.22, delay: 0, options: [.curveEaseInOut]) {
        self.dataSource.apply(snapshot, animatingDifferences: true, completion: finish)
        updateLayout()
      }
    } else if folding {
      UIView.transition(with: collection, duration: 0.12, options: [.transitionCrossDissolve]) {
        self.dataSource.apply(snapshot, animatingDifferences: false)
        updateLayout()
      } completion: { _ in finish() }
    } else {
      dataSource.apply(snapshot, animatingDifferences: false) {
        updateLayout()
        finish()
      }
    }
  }

  func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
    collectionView.deselectItem(at: indexPath, animated: false)
    guard let id = dataSource.itemIdentifier(for: indexPath), let row = rows[id], row.actionable else { return }
    onActivityPress(["entryId": row.entryID, "itemId": row.itemID, "processStartId": row.processStartID])
  }

  func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
    guard scrollView === collection else { return }
    pauseTracking()
  }
  private func pauseTracking() {
    followsBottom = false
    trackingPausedByGesture = true
    anchorScrollInFlight = false
    pendingAnchorAnimation = false
    scrollTimer?.invalidate(); scrollTimer = nil
    collection.lockedOffset = nil
  }
  func scrollViewDidScroll(_ scrollView: UIScrollView) {
    guard scrollView === collection else { return }
    updateBottomButton()
  }
  func scrollViewDidEndDragging(_ scrollView: UIScrollView, willDecelerate decelerate: Bool) {
    guard scrollView === collection, !decelerate else { return }
    resumeTrackingAtBottom()
  }
  func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) {
    guard scrollView === collection else { return }
    resumeTrackingAtBottom()
  }
  private func resumeTrackingAtBottom() {
    guard scroll.isWithinReach(of: Double(collection.contentOffset.y)) else { return }
    trackingPausedByGesture = false
    followsBottom = true
    scrollToBottom()
  }
  func scrollViewDidEndScrollingAnimation(_ scrollView: UIScrollView) {
    guard scrollView === collection else { return }
    anchorScrollInFlight = false
    if followsBottom { scrollToBottom() }
  }
  private func updateBottomButton() {
    let bottom = max(-collection.adjustedContentInset.top,
      collection.contentSize.height - collection.bounds.height + collection.adjustedContentInset.bottom)
    let visible = processEntryID.isEmpty && bottom - collection.contentOffset.y > CGFloat(ChatScroll.resumeDistance)
    guard visible != bottomButton.isUserInteractionEnabled else { return }
    bottomButton.isUserInteractionEnabled = visible
    bottomButton.accessibilityElementsHidden = !visible
    UIView.animate(withDuration: 0.15, delay: 0, options: [.beginFromCurrentState, .allowUserInteraction]) {
      self.bottomButton.alpha = visible ? 1 : 0
    }
  }

  private func scrollToBottom() {
    guard !anchorScrollInFlight, !collection.isDragging, !collection.isDecelerating else { return }
    if scroll.target != nil {
      pendingAnchorAnimation = false
      collection.lockedOffset = collection.contentOffset.y
      startScrollTimer()
      return
    }
    if pendingAnchorAnimation, let id = anchoredUserID, dataSource.indexPath(for: id) == nil { return }
    let bottom = max(-collection.adjustedContentInset.top,
      collection.contentSize.height - collection.bounds.height + collection.adjustedContentInset.bottom)
    let animate = pendingAnchorAnimation && !UIAccessibility.isReduceMotionEnabled && abs(collection.contentOffset.y - bottom) > 1
    pendingAnchorAnimation = false
    anchorScrollInFlight = animate
    if abs(collection.contentOffset.y - bottom) > 0.5 {
      collection.setContentOffset(CGPoint(x: 0, y: bottom), animated: animate)
    }
  }

  private func startScrollTimer() {
    guard scrollTimer == nil, window != nil else { return }
    lastScrollTick = CACurrentMediaTime()
    let timer = Timer(timeInterval: 1.0 / 60, repeats: true) { [weak self] timer in
      guard let self, self.window != nil, self.followsBottom, !self.collection.isDragging, !self.collection.isDecelerating else {
        timer.invalidate(); self?.scrollTimer = nil; return
      }
      let now = CACurrentMediaTime()
      let next = CGFloat(self.scroll.nextOffset(from: Double(self.collection.contentOffset.y), elapsed: now - self.lastScrollTick,
        reducedMotion: UIAccessibility.isReduceMotionEnabled))
      self.lastScrollTick = now
      self.collection.lockedOffset = next
      self.collection.setContentOffset(CGPoint(x: 0, y: next), animated: false)
      if let target = self.scroll.target, abs(Double(next) - target) < 0.25 {
        timer.invalidate(); self.scrollTimer = nil
      }
    }
    scrollTimer = timer
    RunLoop.main.add(timer, forMode: .common)
  }

  private func measure(_ row: ChatRow, width: CGFloat) -> (height: CGFloat, lines: [CGFloat]) {
    if let image = row.image {
      let height = ChatImageCell.size(image, width: width).height
      return (height, [height])
    }
    let text = text(for: row)
    let textWidth = ChatCell.textWidth(row, width: width)
    if let cached = measurements[row.id], cached.width == textWidth, cached.text.isEqual(to: text) {
      return (cached.height, cached.lines)
    }
    measuringText.setText(text)
    let height = measuringText.sizeThatFits(CGSize(width: textWidth, height: .greatestFiniteMagnitude)).height
    let lines = measuringText.lineAdvances(width: textWidth)
    measurements[row.id] = (textWidth, text, height, lines)
    return (height, lines)
  }

  func collectionView(_ collectionView: UICollectionView, layout: UICollectionViewLayout, sizeForItemAt indexPath: IndexPath) -> CGSize {
    let width = max(1, collectionView.bounds.width - 40)
    guard let id = dataSource.itemIdentifier(for: indexPath), let row = rows[id] else { return CGSize(width: width, height: 0) }
    let measured = measure(row, width: width)
    return CGSize(width: width, height: max(row.actionable || row.kind == "summary" ? 44 : 0, measured.height + (row.kind == "user" ? 44 : 12)))
  }

  func setAttachmentContext(_ json: String) {
    guard let data = json.data(using: .utf8), let value = try? JSONSerialization.jsonObject(with: data) as? [String: String] else { return }
    let workspace = value["workspaceId"] ?? "", session = value["sessionId"] ?? ""
    guard workspace != imageWorkspace || session != imageSession else { return }
    imageWorkspace = workspace; imageSession = session
    collection.reloadData()
  }
  func setInitialDraft(_ text: String) {
    guard !hasInitialDraft else { return }
    hasInitialDraft = true
    input.text = text
    awaitingUserAnchor = !text.isEmpty
    updateComposer()
  }
  func clearDraft(token: Int) {
    guard token > lastClearToken else { return }
    lastClearToken = token
    pendingDraft = nil
    input.text = ""
    attachments = []
    updateComposer()
  }
  func restoreDraft(token: Int) {
    guard token > lastRestoreToken else { return }
    lastRestoreToken = token
    if let draft = pendingDraft {
      input.text = draft.text
      attachments = draft.attachments
      pendingDraft = nil
    }
    updateComposer()
  }
  private func takeDraft() {
    guard pendingDraft == nil else { return }
    pendingDraft = (input.text ?? "", attachments)
    input.text = ""
    attachments = []
  }
  private func presentRecentPhotos() {
    guard let controller = presenter() else { return }
    let sheet = ChatAttachmentSheet()
    sheet.onPick = { [weak self] picked in self?.addAttachments(picked) }
    controller.present(sheet, animated: true)
  }
  private func addAttachments(_ picked: [ChatAttachment]) {
    attachments += picked.filter { new in !attachments.contains { $0.id == new.id } }
    UIImpactFeedbackGenerator(style: .light).impactOccurred()
    updateComposer()
  }
  private func presenter() -> UIViewController? {
    var responder: UIResponder? = next
    while let current = responder {
      if let controller = current as? UIViewController { return controller.presentedViewController ?? controller }
      responder = current.next
    }
    return window?.rootViewController
  }
  func setComposerState(_ json: String) {
    guard let value = try? JSONDecoder().decode(ChatComposerState.self, from: Data(json.utf8)) else { return }
    if value.sending && !state.sending { takeDraft() }
    state = value
    updateComposer()
  }
  func setEmptyText(_ text: String) { empty.text = text }
  private func updateComposer() {
    let sending = state.sending || pendingDraft != nil
    input.isEditable = state.editable && !sending
    attach.isEnabled = state.editable && !sending
    attachSurface.alpha = attach.isEnabled ? 1 : 0.5
    attachmentBar.isUserInteractionEnabled = state.editable && !sending
    attachmentBar.render(attachments)
    attachmentHeight.constant = attachments.isEmpty ? 0 : 42
    hint.text = state.placeholder
    hint.isHidden = !input.text.isEmpty
    send.isEnabled = displayError == nil && state.editable && state.canSend && !sending && (!input.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !attachments.isEmpty)
    send.accessibilityLabel = sending ? "正在发送" : "发送"
    send.setImage(sending ? nil : UIImage(systemName: "arrow.up.circle.fill", withConfiguration: UIImage.SymbolConfiguration(pointSize: 26, weight: .medium)), for: .normal)
    if sending { sendSpinner.startAnimating() } else { sendSpinner.stopAnimating() }
    let noticeText = displayError ?? state.notice
    let canReconnect = displayError != nil || state.reconnect
    notice.setTitle(noticeText, for: .normal)
    notice.setTitleColor(canReconnect ? .systemBlue : .secondaryLabel, for: .normal)
    notice.isUserInteractionEnabled = canReconnect
    notice.accessibilityTraits = canReconnect ? .button : .staticText
    let noticeSize = notice.sizeThatFits(CGSize(width: max(1, bounds.width - 40), height: .greatestFiniteMagnitude))
    noticeHeight.constant = noticeText.isEmpty ? 0 : max(44, noticeSize.height + 12)
    let height = input.sizeThatFits(CGSize(width: max(1, bounds.width - 32), height: .greatestFiniteMagnitude)).height
    inputHeight.constant = min(140, max(48, height))
    input.isScrollEnabled = height > 140
    setNeedsLayout()
  }
  func textViewDidChange(_ textView: UITextView) { updateComposer() }
  func textView(_ textView: UITextView, shouldChangeTextIn range: NSRange, replacementText text: String) -> Bool {
    (textView.text as NSString).length - range.length + (text as NSString).length <= 32000
  }
  @objc private func submit() {
    guard send.isEnabled else { return }
    takeDraft()
    guard let draft = pendingDraft else { return }
    awaitingUserAnchor = true
    trackingPausedByGesture = false
    followsBottom = true
    updateComposer()
    onSend([
      "text": draft.text,
      "attachments": draft.attachments.map {
        ["id": $0.id, "name": $0.name, "uri": $0.url.absoluteString, "kind": $0.isImage ? "image" : "file"]
      },
    ])
  }
  @objc private func reconnect() { onReconnect([:]) }
}
