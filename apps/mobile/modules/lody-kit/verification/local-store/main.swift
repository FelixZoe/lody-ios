import Foundation
let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathComponent("catalog.sqlite")
defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
let account = #"{"user":{"id":"a"},"workspaces":[{"id":"first"},{"id":"second"}]}"#
do {
  let store = LocalStore(url: url)
  try store.write("account", account)
  try store.write("workspace:a", #""second""#)
  try store.write("catalog:a:second", #"{"catalog":{"sessions":[{"id":"cached"}]}}"#)
  try store.write("catalog:b:second", "other-user")
}
let reopened = LocalStore(url: url)
let boot = try reopened.startup()
assert(boot["workspace"] == "second")
assert(boot["catalog"]?.contains("cached") == true)
try reopened.write("workspace:a", #""removed""#)
let fallback = try reopened.startup()
assert(fallback["workspace"] == "first")
try reopened.clear()
let cleared = try reopened.startup()
assert(cleared.isEmpty)
print("PASS: durable reopen, selected workspace, account isolation, removed selection and logout")
