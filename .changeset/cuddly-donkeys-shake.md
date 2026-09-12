---
'@arcanewizards/net-utils-native': minor
'@arcanewizards/net-utils': minor
---

Request macOS local network access via NWBrowser

Since macOS 15, an app must be granted Local Network access before it can reach
LAN hosts, and without it a UDP send fails with `EHOSTUNREACH`. The permission
is only evaluated when the app uses one of Apple's own networking APIs.

`ensureLocalNetworkAccess` previously used `bonjour-service`, a pure-JavaScript
mDNS implementation sending multicast over `dgram`. That never calls an Apple
API, so it did not trigger the permission, and it failed silently: the denied
multicast was dropped, no error was surfaced, and the function resolved on a
timer regardless — reporting success while access was still denied.

It has now moved to the new `@arcanewizards/net-utils-native` package,
which calls `NWBrowser` from Network.framework through a small N-API module.

`ensureLocalNetworkAccess` is no longer exported from `@arcanewizards/net-utils`,
which drops its `bonjour-service` dependency and stays free of any native build
step. Import it from `@arcanewizards/net-utils-native` instead.

This is considered a breaking change for `@arcanewizards/net-utils`,
but given that it's still pre-v1, we're doing a minor version bump.
