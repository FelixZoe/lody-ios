import UIKit

func descendants(_ view: UIView) -> [UIView] {
  [view] + view.subviews.flatMap(descendants)
}

let composer = ChatComposerView(frame: CGRect(x: 0, y: 0, width: 390, height: 64))
composer.setInputIdentifier("create-session-input")
var height: CGFloat = 0
composer.onHeightChange = { height = $0 }
let ready = #"{"editable":true,"canSend":true,"sending":false,"notice":"","reconnect":false,"placeholder":"任务"}"#
composer.setComposerState(ready)
composer.layoutIfNeeded()
let input = descendants(composer).compactMap { $0 as? UITextView }.first!
let send = descendants(composer).compactMap { $0 as? UIButton }.first { $0.accessibilityIdentifier == "session-send" }!
// A standalone simulator executable has no UIApplication event loop. Invoke the
// real button's registered target action directly.
func tapSend() {
  for action in send.actions(forTarget: composer, forControlEvent: .touchUpInside) ?? [] {
    composer.perform(NSSelectorFromString(action))
  }
}
precondition(!send.isEnabled, "Empty draft must not send")
precondition(input.accessibilityIdentifier == "create-session-input")
composer.setInitialDraft("保留这个草稿 🐈")
var sent: [String] = []
composer.onSend = { sent.append($0["text"] as! String) }
tapSend()
tapSend()
precondition(sent == ["保留这个草稿 🐈"], "Double tap must send only once")
precondition(input.text.isEmpty && !send.isEnabled, "Pending draft must clear visibly and lock send")
composer.setComposerState(ready)
composer.restoreDraft(token: 1)
precondition(input.text == sent[0] && send.isEnabled, "Rejected creation must restore the exact draft")
tapSend()
composer.clearDraft(token: 1)
precondition(input.text.isEmpty && !send.isEnabled, "Accepted draft must stay cleared")
input.text = String(repeating: "多行输入\n", count: 50)
composer.textViewDidChange(input)
precondition(input.isScrollEnabled && height == 156, "Long drafts must stop growing and scroll")
composer.setComposerState(#"{"editable":false,"canSend":true,"sending":false,"notice":"结果待确认","reconnect":false,"placeholder":"任务"}"#)
precondition(!input.isEditable && !send.isEnabled, "Uncertain creation must prevent retry")
print("Composer: empty input, double send, restore, accept, multiline and uncertain state passed")

let attachmentComposer = ChatComposerView(frame: CGRect(x: 0, y: 0, width: 390, height: 106))
attachmentComposer.setComposerState(ready)
attachmentComposer.setInitialAttachments(#"[{"id":"synthetic-file","name":"test.txt","uri":"file:///tmp/lody-composer-test.txt","kind":"file"}]"#)
let attachButton = descendants(attachmentComposer).compactMap { $0 as? UIButton }.first { $0.accessibilityIdentifier == "session-attach" }!
precondition(attachButton.isEnabled && attachButton.menu?.children.count == 3, "Plus must offer the existing photo and file pickers")
let attachmentSend = descendants(attachmentComposer).compactMap { $0 as? UIButton }.first { $0.accessibilityIdentifier == "session-send" }!
precondition(attachmentSend.isEnabled, "Attachment-only drafts must be sendable")
var sentAttachments: [[String: String]] = []
attachmentComposer.onSend = { sentAttachments = $0["attachments"] as! [[String: String]] }
func sendAttachment() {
  for action in attachmentSend.actions(forTarget: attachmentComposer, forControlEvent: .touchUpInside) ?? [] {
    attachmentComposer.perform(NSSelectorFromString(action))
  }
}
sendAttachment()
precondition(sentAttachments.first?["id"] == "synthetic-file", "First turn must carry the picked file")
attachmentComposer.restoreDraft(token: 1)
precondition(attachmentSend.isEnabled, "Upload failure must restore attachment-only draft")
sentAttachments = []
sendAttachment()
precondition(sentAttachments.first?["uri"] == "file:///tmp/lody-composer-test.txt", "Retry must preserve the original attachment URI")
print("Composer: plus menu and attachment-only send/restore/retry passed")

let draftComposer = ChatComposerView(frame: CGRect(x: 0, y: 0, width: 390, height: 64))
draftComposer.setComposerState(ready)
let draftInput = descendants(draftComposer).compactMap { $0 as? UITextView }.first!
var savedDrafts: [String] = []
draftComposer.onDraftChange = { savedDrafts.append($0) }
draftComposer.setStoredDraft("上次没发出去的话")
precondition(draftInput.text == "上次没发出去的话", "Empty input must restore the stored draft")
draftComposer.setStoredDraft("其他会话的草稿")
precondition(draftInput.text == "上次没发出去的话", "A stored draft must never overwrite typed text")
draftComposer.textViewDidEndEditing(draftInput)
precondition(savedDrafts == ["上次没发出去的话"], "Ending editing must persist the draft")
draftComposer.clearDraft(token: 1)
precondition(savedDrafts.last == "" && draftInput.text.isEmpty, "Sending must clear the stored draft")
print("Composer: stored draft restore, no-overwrite, save on end editing and clear on send passed")
