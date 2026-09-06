import Foundation

struct ChatEntry: Decodable {
  let id: String
  let role: String
  let status: String
  var finished: Bool
  let endedAt: Double?
  let startedAt: Double?
  var items: [ChatItem]
}

struct ChatImage: Decodable, Equatable {
  let id: String
  let fileName: String
  let storageSessionId: String?
  let width: Double?
  let height: Double?
}

struct ChatItem: Decodable {
  struct Permission: Decodable { let requestId: String; let pending: Bool }
  struct Plan: Decodable { let content: String; let status: String }
  let itemId: String
  let type: String
  var text: String?
  let kind: String?
  let title: String?
  let status: String?
  let path: String?
  let hasDetail: Bool?
  let permission: Permission?
  let entries: [Plan]?
  let description: String?
  let actor: String?
  let image: ChatImage?
}

struct ChatRow: Equatable {
  let id: String
  let entryID: String
  var kind: String
  var text: String
  var symbol = ""
  var itemID = ""
  var processStartID = ""
  var actionable = false
  var running = false
  var attention = false
  var streaming = false
  var image: ChatImage? = nil
}

/// Stable identities belong to the protocol, never to the streamed text.
struct ChatTranscript {
  var entries: [ChatEntry] = []

  func rows(processEntryID: String = "", processStartID: String = "") -> [ChatRow] {
    entries.flatMap { entry -> [ChatRow] in
      let processOnly = !processEntryID.isEmpty
      if processOnly && entry.id != processEntryID { return [] }
      if entry.role == "user" {
        if processOnly { return [] }
        var result: [ChatRow] = []
        for item in entry.items where item.type == "image" {
          guard let image = item.image else { continue }
          result.append(ChatRow(id: result.isEmpty ? entry.id + ":user" : entry.id + ":" + item.itemId,
            entryID: entry.id, kind: "image", text: image.fileName, itemID: item.itemId, image: image))
        }
        let text = entry.items.compactMap { $0.type == "text" ? $0.text : nil }.joined(separator: "\n\n")
        if !text.isEmpty {
          result.append(ChatRow(id: entry.id + (result.isEmpty ? ":user" : ":user-text"), entryID: entry.id, kind: "user", text: text))
        }
        return result
      }
      let finalText = entry.items.lastIndex { $0.type == "text" && !($0.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
      var visible: [Int] = []
      var groups: [Int: [Int]] = [:]
      if processOnly {
        if !processStartID.isEmpty, let start = entry.items.firstIndex(where: { $0.itemId == processStartID }) {
          let end = entry.items.indices.dropFirst(start + 1).first { entry.items[$0].type == "text" } ?? entry.items.endIndex
          visible = Array(start..<end)
        } else {
          visible = entry.items.indices.filter { $0 != finalText }
        }
      } else if entry.finished {
        let process = entry.items.indices.filter { $0 != finalText }
        if let first = process.first { groups[first] = process }
        visible = process.first.map { [$0] } ?? []
        if let finalText { visible.append(finalText) }
      } else {
        for index in entry.items.indices {
          if entry.items[index].type == "text" {
            visible.append(index)
          } else if let previous = visible.last, groups[previous] != nil {
            groups[previous]!.append(index)
          } else {
            groups[index] = [index]
            visible.append(index)
          }
        }
      }
      var result: [ChatRow] = []
      for index in visible {
        if let indices = groups[index] {
          let process = indices.map { entry.items[$0] }
          let tools = process.filter { $0.type == "tool_call" }.count
          let needsPermission = process.contains { $0.permission?.pending == true }
          let failed = process.contains { $0.status == "failed" }
          let running = !entry.finished && indices.last == entry.items.indices.last
          let title = needsPermission ? "等待批准" : failed ? "处理失败" : running ? "正在处理" : "执行过程"
          let firstGroup = index == groups.keys.min()
          result.append(ChatRow(id: entry.id + ":process" + (firstGroup ? "" : ":" + entry.items[index].itemId), entryID: entry.id, kind: "summary",
            text: title + (tools > 0 ? " · \(tools) 项操作" : ""), symbol: "chevron.right",
            processStartID: entry.finished ? "" : entry.items[index].itemId,
            actionable: true, running: running, attention: needsPermission || failed))
          continue
        }
        let item = entry.items[index]
        let attention = item.status == "failed" || item.permission?.pending == true
        var row = ChatRow(id: entry.id + ":" + item.itemId, entryID: entry.id,
          kind: item.type, text: item.text ?? "", itemID: item.itemId,
          running: !entry.finished && item.status == "in_progress", attention: attention,
          streaming: !entry.finished && (item.type == "text" || item.type == "thought"))
        switch item.type {
        case "text": break
        case "thought": row.symbol = "brain"
        case "tool_call":
          row.symbol = ["read": "doc.text.magnifyingglass", "search": "magnifyingglass", "edit": "square.and.pencil",
            "write": "square.and.pencil", "execute": "terminal", "bash": "terminal", "fetch": "globe"][item.kind ?? ""] ?? "wrench.and.screwdriver"
          row.text = item.title.flatMap { $0.isEmpty ? nil : $0 } ?? item.path ?? "调用工具"
          if item.permission?.pending == true { row.text = "等待批准 · " + row.text }
          else if item.status == "failed" { row.text = "失败 · " + row.text }
          row.actionable = item.hasDetail == true || item.permission?.pending == true
        case "plan":
          row.text = (item.entries ?? []).map { ($0.status == "completed" ? "✓ " : $0.status == "in_progress" ? "› " : "○ ") + $0.content }.joined(separator: "\n")
        case "subagent_task":
          row.symbol = "person.2"
          row.text = item.description ?? item.actor ?? "子任务"
          if item.status == "failed" { row.text = "失败 · " + row.text }
        default:
          row.text = item.title ?? "会话事件"
          row.symbol = "info.circle"
        }
        if !row.text.isEmpty { result.append(row) }
      }
      return result
    }
  }
}
