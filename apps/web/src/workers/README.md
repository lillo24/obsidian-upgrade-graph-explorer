# Desktop Workers

Status: **STABLE — KG12B1 W1 client transport and worker entry are isolated behind the desktop chunk.**

This folder owns browser Worker transport code for desktop-only processing.
Domain state and protocol behavior live in the platform-independent package;
the web application owns Worker lifecycle and Vite construction.

```text
workspace.worker.ts          Dedicated Worker entry and localized worker-global typing.
workspace-worker-client.ts   Promise client, response validation, and fatal transport cleanup.
workspace-worker-client.test.ts  Fake-transport correlation and failure tests.
```

The worker is instantiated only after a local-vault open starts. Sample and
imported-report browser paths do not create it.
