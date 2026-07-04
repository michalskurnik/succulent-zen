import UIKit
import Capacitor
import AppTrackingTransparency

class ViewController: CAPBridgeViewController {

    private var attRequested = false

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        requestATTIfNeeded()
    }

    private func requestATTIfNeeded() {
        guard !attRequested else { return }
        guard #available(iOS 14, *) else { return }
        guard ATTrackingManager.trackingAuthorizationStatus == .notDetermined else { return }
        attRequested = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            guard let self, self.view.window != nil else { return }
            ATTrackingManager.requestTrackingAuthorization { _ in
                // AdMob initialises from JavaScript after the user responds
            }
        }
    }
}
