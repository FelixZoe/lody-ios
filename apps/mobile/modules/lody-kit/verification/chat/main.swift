import Foundation

let json = """
[{"id":"reply","role":"assistant","status":"running","finished":false,"items":[
{"itemId":"intro","type":"thought","text":"先检查"},
{"itemId":"tool","type":"tool_call","title":"读取文件","status":"completed"},
{"itemId":"answer","type":"text","text":"最终答案"}]}]
"""
var transcript = ChatTranscript(entries: try JSONDecoder().decode([ChatEntry].self, from: Data(json.utf8)))
let streaming = transcript.rows()
assert(!streaming.contains { $0.itemID == "tool" || $0.itemID == "intro" })
assert(streaming.contains { $0.kind == "summary" && $0.actionable })
let process = transcript.rows(processEntryID: "reply")
assert(process.map(\.itemID) == ["intro", "tool"])
assert(!process.contains { $0.kind == "summary" || $0.itemID == "answer" })
assert(transcript.rows(processEntryID: "other").isEmpty)
let finished = json.replacingOccurrences(of: "\"finished\":false", with: "\"finished\":true")
transcript.entries = try JSONDecoder().decode([ChatEntry].self, from: Data(finished.utf8))
assert(transcript.rows().map(\.id) == streaming.map(\.id), "Completion must not insert or remove main-list rows")
assert(transcript.rows(processEntryID: "reply").map(\.id) == process.map(\.id), "The process sheet stays flat after completion")
let failure = finished.replacingOccurrences(of: "\"status\":\"completed\"", with: "\"status\":\"failed\"")
transcript.entries = try JSONDecoder().decode([ChatEntry].self, from: Data(failure.utf8))
assert(transcript.rows().contains { $0.kind == "summary" && $0.attention })
assert(transcript.rows(processEntryID: "reply").contains { $0.itemID == "tool" && $0.attention })
let permission = finished.replacingOccurrences(of: "\"status\":\"completed\"", with: "\"permission\":{\"requestId\":\"p\",\"pending\":true}")
transcript.entries = try JSONDecoder().decode([ChatEntry].self, from: Data(permission.utf8))
assert(transcript.rows().contains { $0.kind == "summary" && $0.attention })
assert(transcript.rows(processEntryID: "reply").contains { $0.itemID == "tool" && $0.actionable && $0.attention })
print("Chat: stable main rows, flat process sheet, errors and permissions passed")

let trailingTool = finished.replacingOccurrences(of: "\"text\":\"最终答案\"}", with: "\"text\":\"最终答案\"},{\"itemId\":\"tail\",\"type\":\"tool_call\"}")
transcript.entries = try JSONDecoder().decode([ChatEntry].self, from: Data(trailingTool.utf8))
assert(transcript.rows().contains { $0.itemID == "answer" }, "A trailing status must not hide the answer")
assert(!transcript.rows().contains { $0.itemID == "tail" })

let proseBeforeTool = trailingTool.replacingOccurrences(of: "\"type\":\"thought\"", with: "\"type\":\"text\"")
transcript.entries = try JSONDecoder().decode([ChatEntry].self, from: Data(proseBeforeTool.utf8))
assert(!transcript.rows().contains { $0.itemID == "intro" }, "Completed intermediate prose belongs to the process")
assert(transcript.rows(processEntryID: "reply").contains { $0.itemID == "intro" })

let multiStep = """
[{"id":"steps","role":"assistant","status":"running","finished":false,"items":[
{"itemId":"first","type":"text","text":"先检查"},
{"itemId":"think1","type":"thought","text":"分析路径"},
{"itemId":"read","type":"tool_call","title":"读取","status":"completed"},
{"itemId":"middle","type":"text","text":"继续验证"},
{"itemId":"think2","type":"thought","text":"分析结果"},
{"itemId":"write","type":"tool_call","title":"修改","status":"completed"},
{"itemId":"final","type":"text","text":"结论"}]}]
"""
transcript.entries = try JSONDecoder().decode([ChatEntry].self, from: Data(multiStep.utf8))
assert(transcript.rows().map(\.kind) == ["text", "summary", "text", "summary", "text"])
assert(transcript.rows(processEntryID: "steps", processStartID: "think1").map(\.itemID) == ["think1", "read"])
assert(transcript.rows(processEntryID: "steps", processStartID: "think2").map(\.itemID) == ["think2", "write"])
transcript.entries[0].finished = true
assert(transcript.rows().map(\.kind) == ["summary", "text"])
assert(transcript.rows().last?.itemID == "final")
assert(transcript.rows(processEntryID: "steps").map(\.itemID) == ["first", "think1", "read", "middle", "think2", "write"])
assert(transcript.rows(processEntryID: "steps", processStartID: "think1").map(\.itemID) == ["think1", "read"], "An open segment must not change scope on completion")
print("Chat folding: live text boundaries, scoped process, and conclusion-only completion passed")

var stream = ChatStream()
stream.receive([], animate: true)
let live = try JSONDecoder().decode([ChatEntry].self, from: Data(json.utf8))
stream.receive(live, animate: true)
assert(stream.hasPending)
assert(stream.presentation[0].items[2].text == "")
stream.advance()
assert(stream.presentation[0].items[2].text == "最")
let complete = try JSONDecoder().decode([ChatEntry].self, from: Data(finished.utf8))
stream.receive(complete, animate: true)
assert(!stream.presentation[0].finished, "Do not finish before the visible text drains")
for _ in 0..<30 { stream.advance() }
assert(!stream.hasPending && stream.presentation[0].finished)
assert(stream.presentation[0].items[2].text == "最终答案")
var historyStream = ChatStream()
historyStream.receive(live, animate: true)
assert(!historyStream.hasPending, "Opening history must not replay it")
let corrected = json.replacingOccurrences(of: "最终答案", with: "更正后的答案")
stream.receive(try JSONDecoder().decode([ChatEntry].self, from: Data(corrected.utf8)), animate: true)
assert(stream.presentation[0].items[2].text == "更正后的答案", "Replacement must not replay an obsolete suffix")
var unicodeStream = ChatStream()
unicodeStream.receive([], animate: true)
let unicode = json.replacingOccurrences(of: "最终答案", with: "👩🏽‍💻你好é")
unicodeStream.receive(try JSONDecoder().decode([ChatEntry].self, from: Data(unicode.utf8)), animate: true)
unicodeStream.advance()
assert(unicodeStream.presentation[0].items[2].text == "👩🏽‍💻")
unicodeStream.finish()
assert(!unicodeStream.hasPending && unicodeStream.presentation[0].items[2].text == "👩🏽‍💻你好é")
print("Chat stream: paced bursts, completion drain, history, replacement and Unicode passed")
var burstStream = ChatStream()
burstStream.receive([], animate: true)
let burst = json.replacingOccurrences(of: "最终答案", with: String(repeating: "文", count: 3000))
burstStream.receive(try JSONDecoder().decode([ChatEntry].self, from: Data(burst.utf8)), animate: true)
for _ in 0..<30 { burstStream.advance() }
assert(!burstStream.hasPending, "Large bursts must increase batch size instead of taking minutes")

var fade = ChatTextFade()
fade.update("已有文字", animate: false, at: 0, reset: true)
fade.update("已有文字👩🏽‍💻你好", animate: true, at: 1)
assert(fade.active.count == 3 && fade.active[0].range.location == 4)
assert(fade.active[0].range.length == "👩🏽‍💻".utf16.count)
assert(fade.active[0].opacity(at: 1) == 0 && fade.active[0].opacity(at: 1.11) > 0.49)
assert(fade.active[0].opacity(at: 1.3) == 1 && !fade.isAnimating(at: 1.3))
fade.update("已有文字👩🏽‍💻你好", animate: true, at: 2)
assert(!fade.isAnimating(at: 2), "Reconfiguration must not restart old characters")
fade.update("**hello", animate: false, at: 3, reset: true)
fade.update("hello", animate: true, at: 4)
assert(fade.active.isEmpty, "Closing Markdown must not fade the existing word again")
fade.update("hello world", animate: false, at: 5)
assert(fade.active.isEmpty, "Reduced motion inserts text immediately")
print("Character fade: graphemes, opacity, stable text, Markdown edits and reduced motion passed")
fade.update("aa", animate: false, at: 6, reset: true)
fade.update("aaa", animate: true, at: 7)
assert(fade.active.count == 1 && fade.active[0].range.location == 2)

var tracking = ChatScroll()
tracking.update(entryID: "live", rows: [("text", [22, 22])], initialEnd: 600, viewport: 200, minimum: -100)
assert(tracking.target == 400)
tracking.update(entryID: "live", rows: [("text", [30, 30])], initialEnd: 616, viewport: 200, minimum: -100)
assert(tracking.target == 400, "Reformatting existing lines cannot drive the scroll")
tracking.update(entryID: "live", rows: [("text", [30, 30, 22])], initialEnd: 638, viewport: 200, minimum: -100)
assert(tracking.target == 438, "Only a newly laid-out line advances tracking")
tracking.update(entryID: "live", rows: [("text", [22])], initialEnd: 500, viewport: 200, minimum: -100)
assert(tracking.target == 438, "Markdown contraction must not reverse tracking")
tracking.update(entryID: "live", rows: [("text", [22, 22, 22]), ("tool", [44])], initialEnd: 682, viewport: 200, minimum: -100)
assert(tracking.target == 482, "Reappearing lines must not be counted twice")
assert(tracking.isWithinReach(of: 481) && !tracking.isWithinReach(of: 480))
assert(!tracking.isWithinReach(of: 463), "A small upward drag must not resume tracking inside the old 80 pt range")
var offset = 400.0
let next = tracking.nextOffset(from: offset, elapsed: 1.0 / 60, reducedMotion: false)
assert(next > offset && next < 441, "Scrolling must ease toward the new line")
for _ in 0..<90 { offset = tracking.nextOffset(from: offset, elapsed: 1.0 / 60, reducedMotion: false) }
assert(abs(offset - 482) < 0.25)
assert(tracking.nextOffset(from: 0, elapsed: 0, reducedMotion: true) == 482)
tracking.finish()
assert(tracking.entryID == nil && tracking.target == nil, "Completion must release the scroll target")
assert(tracking.nextOffset(from: 123, elapsed: 1, reducedMotion: false) == 123)
assert(!tracking.isWithinReach(of: 123), "A completed turn must not re-enable tracking")
print("Scroll tracking: new-line progress, Markdown reflow, threshold release/resume, smoothing and completion passed")

var fastTracking = ChatScroll()
fastTracking.update(entryID: "burst", rows: [("text", Array(repeating: 22, count: 50))], initialEnd: 1200, viewport: 200, minimum: 0)
var fastOffset = 0.0
for _ in 0..<9 { fastOffset = fastTracking.nextOffset(from: fastOffset, elapsed: 1.0 / 60, reducedMotion: false) }
assert(1000 - fastOffset < 24, "A fast burst must be caught within a line, not trail behind for seconds")
fastTracking.finish()
assert(fastTracking.target == nil)
print("Fast stream: adaptive catch-up and final paragraph spacing passed")

// Image history keeps media above the text bubble and reserves the user anchor.
let imageHistory = """
[{"id":"picture-turn","role":"user","status":"pending","finished":true,"items":[
{"itemId":"caption","type":"text","text":"What is this?"},
{"itemId":"photo","type":"image","image":{"id":"image1","fileName":"sample.png","width":800,"height":600}}
]}]
"""
var imageTranscript = ChatTranscript(entries: try JSONDecoder().decode([ChatEntry].self, from: Data(imageHistory.utf8)))
let pictureRows = imageTranscript.rows()
assert(pictureRows.map(\.kind) == ["image", "user"])
assert(pictureRows.first?.id == "picture-turn:user")
assert(pictureRows.first?.image?.id == "image1")
assert(pictureRows.last?.text == "What is this?", "Attachment filenames must not be flattened into the message bubble")
imageTranscript.entries[0].items.removeFirst()
assert(imageTranscript.rows().map(\.kind) == ["image"], "Image-only messages must not add an empty bubble")
print("Chat image rows: media before caption, stable anchor, and image-only layout passed")
