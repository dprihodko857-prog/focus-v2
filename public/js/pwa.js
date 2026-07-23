(() => {
  const root = document.documentElement;
  let activeRegistration = null;
  const hadServiceWorkerController = Boolean(navigator.serviceWorker?.controller);

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

  const activateWaitingWorker = registration => {
    if (!registration.waiting || !navigator.serviceWorker.controller) {
      return false;
    }

    root.dataset.pwaApplyingUpdate = "true";
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    return true;
  };

  const reloadAfterControllerChange = () => {
    if (root.dataset.pwaReloading === "true") return;
    root.dataset.pwaReloading = "true";
    window.location.reload();
  };

  const watchRegistration = registration => {
    activeRegistration = registration;

    if (registration.waiting && navigator.serviceWorker.controller) {
      markUpdateAvailable(registration);
      activateWaitingWorker(registration);
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
    dispatchPwaStateChange({ kind: "service-worker", status: "controller-changed" });

    if (root.dataset.pwaApplyingUpdate === "true" || hadServiceWorkerController) {
      reloadAfterControllerChange();
      return;
    }
  });

  window.focusPwaClearCaches = async () => {
    const registration = activeRegistration || await navigator.serviceWorker.ready;
    const worker = registration.active || navigator.serviceWorker.controller;

    if (!worker) {
      return { status: "none" };
    }

    const channel = new MessageChannel();

    const result = await new Promise(resolve => {
      const timeout = window.setTimeout(() => resolve({ status: "timeout" }), 3000);

      channel.port1.onmessage = () => {
        window.clearTimeout(timeout);
        resolve({ status: "cleared" });
      };

      worker.postMessage({ type: "FOCUS_CLEAR_CACHES" }, [channel.port2]);
    });

    await registration.update();
    return result;
  };

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js", { scope: "/" })
      .then(async registration => {
        watchRegistration(registration);
        root.dataset.pwaReady = registration.active ? "active" : "installing";
        dispatchPwaStateChange({ kind: "service-worker", status: root.dataset.pwaReady });
        await registration.update().catch(() => null);
      })
      .catch(error => {
        root.dataset.pwaReady = "failed";
        dispatchPwaStateChange({ kind: "service-worker", status: "failed" });
        console.warn("Focus PWA service worker registration failed.", error);
      });
  });
})();
