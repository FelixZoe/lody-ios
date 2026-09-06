import UIKit

/// A separate row keeps image geometry out of text measurement and message bubbles.
final class ChatImageCell: UICollectionViewCell {
  private let photo = UIImageView()
  private let spinner = UIActivityIndicatorView(style: .medium)
  private let failure = UILabel()
  private var image: ChatImage?
  private var requestURL: URL?
  private var requestID = UUID()
  private var task: URLSessionDataTask?

  override init(frame: CGRect) {
    super.init(frame: frame)
    photo.contentMode = .scaleAspectFit
    photo.backgroundColor = .secondarySystemBackground
    photo.layer.cornerRadius = 16
    photo.layer.cornerCurve = .continuous
    photo.clipsToBounds = true
    photo.layer.borderWidth = 0.5
    if #available(iOS 17.0, *) {
      registerForTraitChanges([UITraitUserInterfaceStyle.self, UITraitAccessibilityContrast.self]) { (cell: ChatImageCell, _) in cell.setNeedsLayout() }
    }
    failure.text = "图片暂时无法显示"
    failure.font = .preferredFont(forTextStyle: .caption1)
    failure.textColor = .secondaryLabel
    failure.textAlignment = .center
    failure.isHidden = true
    contentView.addSubview(photo)
    photo.addSubview(spinner)
    photo.addSubview(failure)
    isAccessibilityElement = true
    accessibilityTraits = .image
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

  static func size(_ image: ChatImage, width: CGFloat) -> CGSize {
    let ratio = max(0.1, min(10, (image.width ?? 4) / (image.height ?? 3)))
    let maximum = min(240, width * 0.84)
    return ratio >= 1 ? CGSize(width: maximum, height: maximum / ratio) : CGSize(width: maximum * ratio, height: maximum)
  }
  func configure(_ row: ChatRow, workspace: String, session: String) {
    guard let image = row.image else { return }
    self.image = image
    accessibilityIdentifier = row.id
    accessibilityLabel = "图片，\(image.fileName)"
    setNeedsLayout()
    guard !workspace.isEmpty, !session.isEmpty, !image.id.isEmpty else { return }
    let components = [workspace, image.storageSessionId ?? session, image.id].map(SessionAttachments.segment)
    let url = URL(string: "https://api.lody.ai/api/workspaces/\(components[0])/session-images/\(components[1])/\(components[2])/thumbnail?width=768&fit=scale-down&quality=85")!
    if requestURL == url && (task != nil || photo.image != nil) { return }
    let requestID = UUID(); self.requestID = requestID
    task?.cancel(); requestURL = url; photo.image = nil; failure.isHidden = true
    guard let token = try? AuthKeychain.read() else { failure.isHidden = false; return }
    var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    spinner.startAnimating()
    task = URLSession.shared.dataTask(with: request) { [weak self] data, response, _ in
      let valid = (response as? HTTPURLResponse).map { (200..<300).contains($0.statusCode) } ?? false
      let decoded = valid ? data.flatMap(UIImage.init(data:)) : nil
      DispatchQueue.main.async {
        guard let self, self.requestID == requestID else { return }
        self.task = nil
        self.spinner.stopAnimating()
        self.photo.image = decoded
        self.failure.isHidden = decoded != nil
      }
    }
    task?.resume()
  }
  override func prepareForReuse() {
    super.prepareForReuse()
    task?.cancel(); task = nil; requestURL = nil; requestID = UUID()
    photo.image = nil; spinner.stopAnimating(); failure.isHidden = true
  }
  override func layoutSubviews() {
    super.layoutSubviews()
    guard let image else { return }
    photo.layer.borderColor = UIColor.separator.resolvedColor(with: traitCollection).cgColor
    let size = Self.size(image, width: contentView.bounds.width)
    photo.frame = CGRect(x: contentView.bounds.width - size.width, y: 6, width: size.width, height: size.height)
    spinner.center = CGPoint(x: size.width / 2, y: size.height / 2)
    failure.frame = photo.bounds.insetBy(dx: 4, dy: 4)
  }
}
