(() => {
  const root = document.documentElement;
  let activeRegistration = null;

  const dispatchPwaStateChange = detail => {
    window.dispatchEvent(new CustomEvent("focus-pwa-state-change", { detail }));
  };

  const updateConnectivityState = () => {
    root.toggleAttribute("data-offline", !navigator.onLine);
    dispatchPwaStateChange({ kind: "connectivity" });
  };

  const updateDisplayMode = () => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    root.dataset.displayMode = isStandalone ? "standalone" : "browser";
    dispatchPwaStateChange({ kind: "display-mode" });
  };

  const markUpdateAvailable = registration => {
    activeRegistration = registration;
    root.dataset.pwaUpdate = "available";
    dispatchPwaStateChange({ kind: "update", status: "available" });
  };

  const watchRegistration = registration => {
    activeRegistration = registration;

    if (registration.waiting && navigator.serviceWorker.controller) {
      markUpdateAvailable(registration);
    }

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;

      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          markUpdateAvailable(registration);
        }
      });
    });
  };

  updateConnectivityState();
  updateDisplayMode();

  window.addEventListener("online", updateConnectivityState);
  window.addEventListener("offline", updateConnectivityState);
  const displayModeMedia = window.matchMedia("(display-mode: standalone)");
  if (typeof displayModeMedia.addEventListener === "function") {
    displayModeMedia.addEventListener("change", updateDisplayMode);
  } else if (typeof displayModeMedia.addListener === "function") {
    displayModeMedia.addListener(updateDisplayMode);
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    window.focusInstallPrompt = event;
    root.dataset.pwaInstallable = "true";
    dispatchPwaStateChange({ kind: "installable" });
  });

  window.addEventListener("appinstalled", () => {
    root.dataset.pwaInstalled = "true";
    root.removeAttribute("data-pwa-installable");
    window.focusInstallPrompt = null;
    dispatchPwaStateChange({ kind: "installed" });
  });

  if (!("serviceWorker" in navigator)) {
    root.dataset.pwaReady = "unsupported";
    dispatchPwaStateChange({ kind: "service-worker", status: "unsupported" });
    return;
  }

  window.focusPwaCheckForUpdate = async () => {
    const registration = activeRegistration || await navigator.serviceWorker.ready;
    activeRegistration = registration;
    await registration.update();

    if (registration.waiting) {
      markUpdateAvailable(registration);
      return { status: "available" };
    }

    root.dataset.pwaUpdate = "checked";
    dispatchPwaStateChange({ kind: "update", status: "checked" });
    return { status: "checked" };
  };

  window.focusPwaApplyUpdate = async () => {
    const registration = activeRegistration || await navigator.serviceWorker.ready;
    activeRegistration = registration;

    if (!registration.waiting) {
      return { status: "none" };
    }

    root.dataset.pwaApplyingUpdate = "true";
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    return { status: "applying" };
  };

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (root.dataset.pwaApplyingUpdate !== "true") {
      dispatchPwaStateChange({ kind: "service-worker", status: "controller-changed" });
      return;
    }
    if (root.dataset.pwaReloading === "true") return;
    root.dataset.pwaReloading = "true";
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js", { scope: "/" })
      .then(registration => {
        watchRegistration(registration);
        root.dataset.pwaReady = registration.active ? "active" : "installing";
        dispatchPwaStateChange({ kind: "service-worker", status: root.dataset.pwaReady });
      })
      .catch(error => {
        root.dataset.pwaReady = "failed";
        dispatchPwaStateChange({ kind: "service-worker", status: "failed" });
        console.warn("Focus PWA service worker registration failed.", error);
      });
  });
})();
