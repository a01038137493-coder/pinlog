//
//  AppViewController.swift
//  핀로그
//
//  앱 내장 플러그인(VisionOCR)을 브리지에 등록하는 커스텀 브리지 컨트롤러.
//  (npm 플러그인은 packageClassList 로 자동 등록되지만, 앱 로컬 플러그인은
//   cap sync 가 목록을 덮어쓰므로 여기서 직접 등록한다)
//

import UIKit
import Capacitor

class AppViewController: CAPBridgeViewController {

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(VisionOCRPlugin())
        bridge?.registerPluginInstance(WidgetBridgePlugin())
    }

    override open func viewDidLoad() {
        super.viewDidLoad()
        // 태블릿은 책상 위 상시 디스플레이로 쓰므로 앱이 떠 있는 동안 화면이 꺼지지 않게 한다
        if UIDevice.current.userInterfaceIdiom == .pad {
            UIApplication.shared.isIdleTimerDisabled = true
        }
    }
}
