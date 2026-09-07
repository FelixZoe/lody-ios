import MarkdownView
import UIKit

final class ChatMarkdownCell: UICollectionViewCell {
  let markdown: MarkdownTextView
  private let label = ChatFadeLabelView()
  private let icon = UIImageView()
  private let spinner = UIActivityIndicatorView(style: .medium)
  private(set) var row: ChatRow?
  var onLink: ((URL) -> Void)?

  override init(frame: CGRect) {
    markdown = MarkdownTextView(textLabelView: label)
    super.init(frame: frame)
    markdown.throttleInterval = 1.0 / 60
    markdown.linkHandler = { [weak self] payload, _, _ in
      let url: URL? = switch payload {
      case .url(let url): url
      case .string(let string): URL(string: string)
      }
      if let url { self?.onLink?(url) }
    }
    icon.contentMode = .center
    contentView.addSubview(markdown)
    contentView.addSubview(icon)
    contentView.addSubview(spinner)
    isAccessibilityElement = true
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

  func configure(_ row: ChatRow, content: MarkdownContent, theme: MarkdownTheme) {
    let sameRow = self.row?.id == row.id
    self.row = row
    label.prepare(animate: row.streaming, reset: !sameRow)
    if sameRow && markdown.theme == theme { markdown.setContent(content) }
    else { markdown.setContentImmediately(content, theme: theme) }
    icon.image = row.symbol.isEmpty ? nil : UIImage(systemName: row.symbol, withConfiguration: UIImage.SymbolConfiguration(pointSize: 13))
    icon.tintColor = row.attention ? .systemOrange : .secondaryLabel
    row.running ? spinner.startAnimating() : spinner.stopAnimating()
    accessibilityIdentifier = row.id
    accessibilityLabel = row.text
    accessibilityTraits = row.actionable ? .button : .staticText
    setNeedsLayout()
  }

  override func prepareForReuse() {
    super.prepareForReuse()
    row = nil
    label.prepare(animate: false, reset: true)
    markdown.reset()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    guard let row else { return }
    let width = contentView.bounds.width
    let inset = ChatCell.leading(row)
    let textWidth = ChatCell.textWidth(row, width: width)
    let height = markdown.boundingSize(for: textWidth).height
    markdown.frame = CGRect(x: inset, y: 6, width: textWidth, height: height)
    icon.frame = CGRect(x: 0, y: 6, width: 16, height: min(height, 20))
    spinner.frame = CGRect(x: width - 24, y: (bounds.height - 20) / 2, width: 20, height: 20)
    var view: UIView? = superview
    while let current = view, !(current is UIScrollView) { view = current.superview }
    markdown.trackedScrollView = view as? UIScrollView
  }
}
