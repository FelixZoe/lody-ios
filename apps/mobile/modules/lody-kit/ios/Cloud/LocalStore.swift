import Foundation
import SQLite3

/// Access only on queue. Display projections, never credentials or CRDT state.
final class LocalStore {
  static let queue = DispatchQueue(label: "app.innei.lody.local-store", qos: .userInitiated)
  private var db: OpaquePointer?
  private let url: URL

  init(url: URL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Lody/catalog.sqlite")) {
    self.url = url
  }
  deinit { sqlite3_close(db) }

  private func open() throws {
    if db != nil { return }
    try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    do {
      guard sqlite3_open(url.path, &db) == SQLITE_OK else { throw failure() }
      try execute("CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    } catch {
      sqlite3_close(db); db = nil
      throw error
    }
  }
  private func failure() -> NSError {
    NSError(domain: "Lody.LocalStore", code: Int(sqlite3_errcode(db)))
  }
  private func execute(_ sql: String, _ values: [String] = []) throws {
    let statement = try prepare(sql, values)
    defer { sqlite3_finalize(statement) }
    guard sqlite3_step(statement) == SQLITE_DONE else { throw failure() }
  }
  private func prepare(_ sql: String, _ values: [String]) throws -> OpaquePointer {
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement else { throw failure() }
    for (index, value) in values.enumerated() {
      sqlite3_bind_text(statement, Int32(index + 1), value, -1, unsafeBitCast(-1, to: sqlite3_destructor_type.self))
    }
    return statement
  }
  func read(_ key: String) throws -> String? {
    try open()
    let statement = try prepare("SELECT value FROM cache WHERE key = ?", [key])
    defer { sqlite3_finalize(statement) }
    let result = sqlite3_step(statement)
    if result == SQLITE_DONE { return nil }
    guard result == SQLITE_ROW, let value = sqlite3_column_text(statement, 0) else { throw failure() }
    return String(cString: value)
  }
  func write(_ key: String, _ value: String) throws {
    // ponytail: one complete projection per workspace, bounded by the runtime's 12 MiB output limit.
    // Move to indexed rows and paged reads if measured catalog restore exceeds the startup budget.
    guard key.utf8.count <= 1024, value.utf8.count <= 12 * 1024 * 1024 else {
      throw NSError(domain: "Lody.LocalStoreLimit", code: 1)
    }
    try open()
    try execute("INSERT INTO cache VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value])
  }
  func startup() throws -> [String: String] {
    let started = ProcessInfo.processInfo.systemUptime
    defer {
      #if DEBUG
      NSLog("LodyLocal startup_ms=%.2f", (ProcessInfo.processInfo.systemUptime - started) * 1000)
      #endif
    }
    guard let account = try read("account"),
      let data = account.data(using: .utf8),
      let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
      let user = object["user"] as? [String: Any], let id = user["id"] as? String,
      let workspaces = object["workspaces"] as? [[String: Any]] else { return [:] }
    let selection = try read("workspace:\(id)")
    let selected = selection.flatMap { $0.data(using: .utf8) }.flatMap { try? JSONSerialization.jsonObject(with: $0, options: .fragmentsAllowed) as? String }
    let workspace = (workspaces.first { $0["id"] as? String == selected } ?? workspaces.first)?["id"] as? String ?? ""
    return ["account": account, "workspace": workspace, "catalog": try read("catalog:\(id):\(workspace)") ?? "null"]
  }
  func clear() throws {
    try open()
    try execute("DELETE FROM cache")
  }
}
