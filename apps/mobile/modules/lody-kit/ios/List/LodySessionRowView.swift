import UIKit

struct LodySessionRowContent: UIContentConfiguration {
  var row: LodyListRow
  var dot: UIColor?
  var live: Bool

  func makeContentView() -> UIView & UIContentView { LodySessionRowView(self) }
  func updated(for state: UIConfigurationState) -> LodySessionRowContent { self }
}

private final class PillLabel: UILabel {
  let insets = UIEdgeInsets(top: 2, left: 7, bottom: 2, right: 7)
  override func drawText(in rect: CGRect) { super.drawText(in: rect.inset(by: insets)) }
  override var intrinsicContentSize: CGSize {
    guard let text, !text.isEmpty else { return .zero }
    let size = super.intrinsicContentSize
    return CGSize(width: size.width + insets.left + insets.right, height: size.height + insets.top + insets.bottom)
  }
}

final class LodySessionRowView: UIView, UIContentView {
  private let halo = UIView()
  private let dot = UIView()
  private let title = UILabel()
  private let subtitle = UILabel()
  private let time = UILabel()
  private let pill = PillLabel()

  var configuration: UIContentConfiguration {
    didSet { apply() }
  }

  init(_ configuration: LodySessionRowContent) {
    self.configuration = configuration
    super.init(frame: .zero)
    directionalLayoutMargins = .init(top: 12, leading: 0, bottom: 12, trailing: 14)
    title.adjustsFontForContentSizeCategory = true
    subtitle.adjustsFontForContentSizeCategory = true
    subtitle.font = .preferredFont(forTextStyle: .footnote)
    time.font = .preferredFont(forTextStyle: .subheadline)
    time.adjustsFontForContentSizeCategory = true
    time.textColor = .secondaryLabel
    pill.font = .preferredFont(forTextStyle: .caption1).withWeight(.medium)
    pill.adjustsFontForContentSizeCategory = true
    pill.layer.cornerRadius = 10
    pill.layer.cornerCurve = .continuous
    pill.clipsToBounds = true
    halo.layer.cornerRadius = 7
    dot.layer.cornerRadius = 4
    for label in [title, subtitle, time] {
      label.lineBreakMode = .byTruncatingTail
    }
    title.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
    subtitle.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
    time.setContentCompressionResistancePriority(.required, for: .horizontal)
    pill.setContentCompressionResistancePriority(.required, for: .horizontal)
    for view in [halo, dot, title, subtitle, time, pill] {
      view.translatesAutoresizingMaskIntoConstraints = false
    }
    addSubview(halo)
    addSubview(dot)
    addSubview(title)
    addSubview(subtitle)
    addSubview(time)
    addSubview(pill)
    let margin = layoutMarginsGuide
    NSLayoutConstraint.activate([
      halo.widthAnchor.constraint(equalToConstant: 14),
      halo.heightAnchor.constraint(equalToConstant: 14),
      halo.centerXAnchor.constraint(equalTo: margin.leadingAnchor, constant: 11),
      halo.centerYAnchor.constraint(equalTo: title.centerYAnchor),
      dot.widthAnchor.constraint(equalToConstant: 8),
      dot.heightAnchor.constraint(equalToConstant: 8),
      dot.centerXAnchor.constraint(equalTo: halo.centerXAnchor),
      dot.centerYAnchor.constraint(equalTo: halo.centerYAnchor),
      title.topAnchor.constraint(equalTo: margin.topAnchor),
      title.leadingAnchor.constraint(equalTo: margin.leadingAnchor, constant: 22),
      title.trailingAnchor.constraint(lessThanOrEqualTo: time.leadingAnchor, constant: -8),
      subtitle.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 2),
      subtitle.leadingAnchor.constraint(equalTo: title.leadingAnchor),
      subtitle.trailingAnchor.constraint(lessThanOrEqualTo: pill.leadingAnchor, constant: -8),
      subtitle.bottomAnchor.constraint(equalTo: margin.bottomAnchor),
      time.firstBaselineAnchor.constraint(equalTo: title.firstBaselineAnchor),
      time.trailingAnchor.constraint(equalTo: margin.trailingAnchor),
      pill.topAnchor.constraint(equalTo: time.bottomAnchor, constant: 2),
      pill.trailingAnchor.constraint(equalTo: margin.trailingAnchor),
      pill.bottomAnchor.constraint(lessThanOrEqualTo: margin.bottomAnchor),
    ])
    apply()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { nil }

  private func apply() {
    guard let content = configuration as? LodySessionRowContent else { return }
    let row = content.row
    title.text = row.title
    title.font = .preferredFont(forTextStyle: row.unread ? .headline : .body)
    title.textColor = row.destructive ? .systemRed : .label
    subtitle.attributedText = Self.subtitle(for: row)
    subtitle.isHidden = subtitle.attributedText?.length == 0
    time.text = row.value
    pill.text = row.badge
    pill.isHidden = row.badge.isEmpty
    let tint = content.dot ?? .secondaryLabel
    pill.textColor = tint
    pill.backgroundColor = tint.withAlphaComponent(0.16)
    dot.backgroundColor = content.dot
    dot.isHidden = content.dot == nil
    halo.backgroundColor = content.dot?.withAlphaComponent(0.22)
    halo.isHidden = !content.live
    isAccessibilityElement = true
    accessibilityLabel = [row.title, row.badge, subtitle.attributedText?.string ?? "", row.value]
      .filter { !$0.isEmpty }
      .joined(separator: ", ")
  }

  private static func subtitle(for row: LodyListRow) -> NSAttributedString {
    let footnote = UIFont.preferredFont(forTextStyle: .footnote)
    let base: UIFont = row.subtitleMono
      ? .monospacedSystemFont(ofSize: footnote.pointSize, weight: .regular)
      : footnote
    let text = NSMutableAttributedString()
    if !row.subtitle.isEmpty {
      text.append(NSAttributedString(string: row.subtitle, attributes: [.font: base, .foregroundColor: UIColor.secondaryLabel]))
    }
    let add = row.diff["add"] ?? 0, del = row.diff["del"] ?? 0
    if add > 0 || del > 0 {
      let mono = UIFont.monospacedDigitSystemFont(ofSize: footnote.pointSize, weight: .regular)
      if text.length > 0 {
        text.append(NSAttributedString(string: " · ", attributes: [.font: footnote, .foregroundColor: UIColor.tertiaryLabel]))
      }
      text.append(NSAttributedString(string: "+\(add)", attributes: [.font: mono, .foregroundColor: UIColor.systemGreen]))
      text.append(NSAttributedString(string: " −\(del)", attributes: [.font: mono, .foregroundColor: UIColor.systemRed]))
    }
    return text
  }
}

private extension UIFont {
  func withWeight(_ weight: UIFont.Weight) -> UIFont {
    let traits = fontDescriptor.addingAttributes([.traits: [UIFontDescriptor.TraitKey.weight: weight]])
    return UIFont(descriptor: traits, size: pointSize)
  }
}
