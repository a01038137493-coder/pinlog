//
//  LockWidget.swift
//  핀로그 — 잠금화면·홈화면 위젯
//
//  앱이 App Group(UserDefaults)에 저장한 오늘 할 일 요약을 표시한다.
//  데이터 키: dt_widget = { left, total, done, top, date(YYYY-MM-DD) }
//

import WidgetKit
import SwiftUI

private let APP_GROUP = "group.com.pinlog.app"

struct TodayEntry: TimelineEntry {
    let date: Date
    let left: Int
    let total: Int
    let done: Int
    let top: String
    let fresh: Bool          // 오늘 데이터인지 (앱을 안 연 날은 false)
}

struct TodayProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayEntry {
        TodayEntry(date: Date(), left: 3, total: 8, done: 5, top: "프로젝트 기획안 작성", fresh: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        completion(load())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let entry = load()
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func load() -> TodayEntry {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        fmt.timeZone = TimeZone.current
        let todayStr = fmt.string(from: Date())

        guard let d = UserDefaults(suiteName: APP_GROUP),
              let raw = d.data(forKey: "dt_widget"),
              let obj = try? JSONSerialization.jsonObject(with: raw) as? [String: Any] else {
            return TodayEntry(date: Date(), left: 0, total: 0, done: 0, top: "", fresh: false)
        }
        let fresh = (obj["date"] as? String) == todayStr
        return TodayEntry(
            date: Date(),
            left: obj["left"] as? Int ?? 0,
            total: obj["total"] as? Int ?? 0,
            done: obj["done"] as? Int ?? 0,
            top: obj["top"] as? String ?? "",
            fresh: fresh
        )
    }
}

private let BRAND = Color(red: 0.941, green: 0.267, blue: 0.220)   // #f04438

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

    /* 잠금화면 원형: 진행률 게이지 */
    var circularView: some View {
        Gauge(value: entry.fresh && entry.total > 0 ? Double(entry.done) / Double(entry.total) : 0) {
            Image(systemName: "checkmark")
        } currentValueLabel: {
            Text(entry.fresh && entry.total > 0 ? "\(entry.left)" : "—")
                .font(.system(size: 18, weight: .bold))
        }
        .gaugeStyle(.accessoryCircular)
    }

    /* 잠금화면 사각형: 상태 문구 (스크린샷 스타일) */
    var rectangularView: some View {
        HStack(spacing: 8) {
            Image(systemName: entry.fresh && entry.total > 0 && entry.left == 0
                  ? "checkmark.circle.fill" : "checkmark.circle")
                .font(.system(size: 22, weight: .medium))
            VStack(alignment: .leading, spacing: 1) {
                if !entry.fresh || entry.total == 0 {
                    Text("비어 있어요").font(.system(size: 15, weight: .bold))
                    Text("새 할 일을 추가해보세요").font(.system(size: 12)).opacity(0.75)
                } else if entry.left == 0 {
                    Text("모두 완료했어요!").font(.system(size: 15, weight: .bold))
                    Text("오늘 할 일 \(entry.done)개 끝").font(.system(size: 12)).opacity(0.75)
                } else {
                    Text("할 일 \(entry.left)개 남음").font(.system(size: 15, weight: .bold))
                    Text(entry.top.isEmpty ? "오늘도 화이팅!" : entry.top)
                        .font(.system(size: 12)).opacity(0.75).lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /* 홈화면 스몰: 브랜드 카드 */
    var smallView: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("오늘 할 일").font(.system(size: 12, weight: .bold)).foregroundColor(.secondary)
                Spacer()
                Image(systemName: "pin.fill").font(.system(size: 11)).foregroundColor(BRAND)
            }
            if !entry.fresh || entry.total == 0 {
                Text("비어 있어요").font(.system(size: 19, weight: .heavy))
                Text("새 할 일을 추가해보세요").font(.system(size: 12)).foregroundColor(.secondary)
            } else {
                HStack(alignment: .firstTextBaseline, spacing: 3) {
                    Text("\(entry.done)").font(.system(size: 26, weight: .heavy)).foregroundColor(BRAND)
                    Text("/ \(entry.total) 완료").font(.system(size: 13, weight: .bold)).foregroundColor(.secondary)
                }
                ProgressView(value: Double(entry.done), total: Double(max(entry.total, 1)))
                    .tint(BRAND)
                if entry.left > 0 && !entry.top.isEmpty {
                    Text(entry.top).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                        .foregroundColor(.primary)
                } else if entry.left == 0 {
                    Text("모두 완료했어요! 🎉").font(.system(size: 12, weight: .semibold))
                }
            }
            Spacer(minLength: 0)
        }
        .padding(2)
        .containerBackgroundCompat()
    }
}

extension View {
    /* iOS 17 containerBackground 필수 대응 + 16 호환 */
    @ViewBuilder func containerBackgroundCompat() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(for: .widget) { Color(UIColor.systemBackground) }
        } else {
            self
        }
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
        .description("남은 할 일을 잠금화면과 홈화면에서 바로 확인해요.")
        .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryCircular])
    }
}

@main
struct PinlogWidgetBundle: WidgetBundle {
    var body: some Widget {
        PinlogTodayWidget()
    }
}
