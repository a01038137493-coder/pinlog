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
    let items: [String]      // 미완료 할 일 상위 3개
    let ev: String           // 다음 일정 "오후 2:00 팀 미팅" (없으면 "")
    let fresh: Bool          // 오늘 데이터인지
}

struct TodayProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayEntry {
        TodayEntry(date: Date(), left: 5, total: 8, done: 3,
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
            return TodayEntry(date: Date(), left: 0, total: 0, done: 0, items: [], ev: "", fresh: false)
        }
        return TodayEntry(
            date: Date(),
            left: obj["left"] as? Int ?? 0,
            total: obj["total"] as? Int ?? 0,
            done: obj["done"] as? Int ?? 0,
            items: obj["items"] as? [String] ?? [],
            ev: obj["ev"] as? String ?? "",
            fresh: (obj["date"] as? String) == todayStr
        )
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

    /* ── 잠금화면 사각형: 헤더 + 실제 할 일 2줄 (부족하면 다음 일정으로 채움) ── */
    var rectangularView: some View {
        VStack(alignment: .leading, spacing: 2.5) {
            HStack(spacing: 4) {
                Text(headerTitle).font(.system(size: 13, weight: .heavy))
                Spacer(minLength: 0)
                if entry.fresh && entry.total > 0 {
                    Text("\(entry.done)/\(entry.total)")
                        .font(.system(size: 11, weight: .bold)).opacity(0.65)
                }
            }
            ForEach(Array(bodyLines.enumerated()), id: \.offset) { _, line in
                HStack(spacing: 5) {
                    Image(systemName: line.icon)
                        .font(.system(size: line.icon == "circle" ? 10 : 11, weight: .semibold))
                        .opacity(line.icon == "circle" ? 0.55 : 0.85)
                    Text(line.text)
                        .font(.system(size: 12.5, weight: .semibold))
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var headerTitle: String {
        if !entry.fresh || entry.total == 0 { return "오늘 할 일 없음" }
        if entry.left == 0 { return "오늘 다 했어요!" }
        return "남은 할 일 \(entry.left)"
    }

    private struct Line { let icon: String; let text: String }
    private var bodyLines: [Line] {
        var lines: [Line] = []
        if entry.fresh {
            for t in entry.items.prefix(2) { lines.append(Line(icon: "circle", text: t)) }
        }
        if lines.count < 2 && !entry.ev.isEmpty {
            lines.append(Line(icon: "calendar", text: entry.ev))
        }
        if lines.isEmpty {
            lines.append(Line(icon: "plus.circle", text: entry.fresh && entry.left == 0 && entry.total > 0
                              ? "\(entry.done)개 완료 · 수고했어요" : "핀로그에서 추가해보세요"))
        }
        return lines
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
