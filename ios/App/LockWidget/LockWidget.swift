//
//  LockWidget.swift
//  핀로그 — 잠금화면·홈화면 위젯
//
//  앱이 App Group(UserDefaults)에 저장한 오늘 요약을 표시한다.
//  데이터 키: dt_widget = { left, total, done, items[], ev, date(YYYY-MM-DD) }
//

import WidgetKit
import SwiftUI

private let APP_GROUP = "group.com.pinlog.app"
private let BRAND = Color(red: 0.941, green: 0.267, blue: 0.220)   // #f04438

struct TodayEntry: TimelineEntry {
    let date: Date
    let left: Int
    let total: Int
    let done: Int
    let msg: String          // 오늘의 한 문장 (리마인더·날씨·요약)
    let items: [String]      // 미완료 할 일 상위 3개
    let ev: String           // 다음 일정 "오후 2:00 팀 미팅" (없으면 "")
    let fresh: Bool          // 오늘 데이터인지
}

struct TodayProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayEntry {
        TodayEntry(date: Date(), left: 5, total: 8, done: 3,
                   msg: "비가 와요! 우산 꼭 챙기세요 ☔",
                   items: ["프로젝트 기획안 작성", "병원 예약 전화", "운동 30분"],
                   ev: "오후 2:00 팀 미팅", fresh: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        completion(load())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [load()], policy: .after(next)))
    }

    private func load() -> TodayEntry {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        fmt.timeZone = TimeZone.current
        let todayStr = fmt.string(from: Date())

        guard let d = UserDefaults(suiteName: APP_GROUP),
              let raw = d.data(forKey: "dt_widget"),
              let obj = try? JSONSerialization.jsonObject(with: raw) as? [String: Any] else {
            return empty
        }
        return TodayEntry(
            date: Date(),
            left: obj["left"] as? Int ?? 0,
            total: obj["total"] as? Int ?? 0,
            done: obj["done"] as? Int ?? 0,
            msg: obj["msg"] as? String ?? "",
            items: obj["items"] as? [String] ?? [],
            ev: obj["ev"] as? String ?? "",
            fresh: (obj["date"] as? String) == todayStr
        )
    }

    private var empty: TodayEntry {
        TodayEntry(date: Date(), left: 0, total: 0, done: 0, msg: "", items: [], ev: "", fresh: false)
    }
}

struct TodayWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: TodayEntry

    var body: some View {
        switch family {
        case .accessoryCircular: circularView
        case .accessoryRectangular: rectangularView
        default: smallView
        }
    }

    /* ── 잠금화면 원형: 진행률 게이지 + 남은 개수 ── */
    var circularView: some View {
        Gauge(value: entry.fresh && entry.total > 0 ? Double(entry.done) / Double(entry.total) : 0) {
            Image(systemName: "pin.fill").font(.system(size: 9))
        } currentValueLabel: {
            VStack(spacing: -2) {
                Text(entry.fresh && entry.total > 0 ? "\(entry.left)" : "0")
                    .font(.system(size: 20, weight: .heavy))
                Text("남음").font(.system(size: 9, weight: .semibold)).opacity(0.7)
            }
        }
        .gaugeStyle(.accessoryCircular)
    }

    /* ── 잠금화면 사각형: 오늘의 한 문장 + 컨텍스트 한 줄 ── */
    var rectangularView: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(mainSentence)
                .font(.system(size: 14, weight: .heavy))
                .lineLimit(2)
                .minimumScaleFactor(0.85)
            Text(contextLine)
                .font(.system(size: 11, weight: .semibold))
                .opacity(0.62)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var mainSentence: String {
        if entry.fresh && !entry.msg.isEmpty { return entry.msg }
        if !entry.fresh { return "좋은 하루 보내세요!" }
        if entry.total == 0 { return "오늘은 여유로운 날이에요" }
        if entry.left == 0 { return "오늘 할 일 모두 완료! 🎉" }
        return "오늘 할 일 \(entry.left)개 남았어요"
    }

    private var contextLine: String {
        var parts: [String] = []
        if entry.fresh && entry.total > 0 { parts.append("할 일 \(entry.done)/\(entry.total)") }
        if !entry.ev.isEmpty { parts.append(entry.ev) }
        if parts.isEmpty { parts.append("핀로그 — 오늘을 계획해보세요") }
        return parts.joined(separator: " · ")
    }

    /* ── 홈화면 스몰: 앱과 같은 진행률 링 카드 ── */
    var smallView: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text("오늘의 진행률").font(.system(size: 11, weight: .bold)).foregroundColor(.secondary)
                Spacer()
                Image(systemName: "pin.fill").font(.system(size: 10)).foregroundColor(BRAND)
            }
            HStack(spacing: 10) {
                ZStack {
                    Circle().stroke(BRAND.opacity(0.15), lineWidth: 5.5)
                    Circle()
                        .trim(from: 0, to: entry.fresh && entry.total > 0 ? CGFloat(entry.done) / CGFloat(entry.total) : 0)
                        .stroke(BRAND, style: StrokeStyle(lineWidth: 5.5, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Text(entry.fresh && entry.total > 0 ? "\(entry.done)/\(entry.total)" : "0")
                        .font(.system(size: 11, weight: .heavy)).foregroundColor(BRAND)
                }
                .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 1) {
                    Text(entry.fresh && entry.left > 0 ? "\(entry.left)개 남음"
                         : entry.fresh && entry.total > 0 ? "모두 완료!" : "할 일 없음")
                        .font(.system(size: 15, weight: .heavy))
                    if !entry.ev.isEmpty {
                        Text(entry.ev).font(.system(size: 10.5, weight: .semibold))
                            .foregroundColor(.secondary).lineLimit(1)
                    }
                }
            }
            VStack(alignment: .leading, spacing: 3.5) {
                if entry.fresh && !entry.items.isEmpty {
                    ForEach(Array(entry.items.prefix(2).enumerated()), id: \.offset) { _, t in
                        HStack(spacing: 5) {
                            Circle().strokeBorder(Color.secondary.opacity(0.5), lineWidth: 1.4)
                                .frame(width: 11, height: 11)
                            Text(t).font(.system(size: 11.5, weight: .semibold)).lineLimit(1)
                        }
                    }
                } else {
                    Text(entry.fresh && entry.total > 0 ? "오늘 할 일을 전부 끝냈어요 🎉" : "새 할 일을 추가해보세요")
                        .font(.system(size: 11)).foregroundColor(.secondary)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(1)
    }
}

struct PinlogTodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "PinlogTodayWidget", provider: TodayProvider()) { entry in
            if #available(iOSApplicationExtension 17.0, *) {
                TodayWidgetView(entry: entry).containerBackground(for: .widget) { Color(UIColor.systemBackground) }
            } else {
                TodayWidgetView(entry: entry)
            }
        }
        .configurationDisplayName("오늘 할 일")
        .description("남은 할 일과 다음 일정을 잠금화면에서 바로 확인해요.")
        .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryCircular])
    }
}

@main
struct PinlogWidgetBundle: WidgetBundle {
    var body: some Widget {
        PinlogTodayWidget()
    }
}
