//
//  WidgetBridgePlugin.swift
//  핀로그 — 위젯 데이터 브리지
//
//  웹(JS)이 오늘 할 일 요약을 App Group에 저장하고 위젯 타임라인을 갱신한다.
//  JS: window.Capacitor.Plugins.WidgetBridge.update({ left, total, done, top, date })
//

import Foundation
import Capacitor
import WidgetKit

@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise)
    ]

    @objc func update(_ call: CAPPluginCall) {
        let payload: [String: Any] = [
            "left": call.getInt("left") ?? 0,
            "total": call.getInt("total") ?? 0,
            "done": call.getInt("done") ?? 0,
            "items": call.getArray("items", String.self) ?? [],
            "ev": call.getString("ev") ?? "",
            "date": call.getString("date") ?? ""
        ]
        if let d = UserDefaults(suiteName: "group.com.pinlog.app"),
           let data = try? JSONSerialization.data(withJSONObject: payload) {
            d.set(data, forKey: "dt_widget")
        }
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }
}
