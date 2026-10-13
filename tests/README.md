# Browser validation

`npm run build && npm run test:assets` checks the production bundle on both `/` and `/Ares/`, with desktop and mobile viewports. It verifies the intro poster, loop video, and light sprite, actual image decoding, the portrait source, fonts, and a working design-tab interaction, and fails on missing assets. It starts and stops its own static servers.

Start the development server with `npm run dev`, then run `npm run test:browser` in a second terminal.

The check uses Playwright with the cloud environment's Chromium at `/usr/bin/chromium`. Override `ARES_CHROMIUM_PATH` for another browser executable, `ARES_TEST_URL` for a different server address, or `ARES_SCREENSHOT_DIR` for another artifact directory. The default URL is `http://127.0.0.1:5173`, and screenshots plus `report.json` are written to `/tmp/ares-shots`.

The check covers the opening sequence (loop playback, the light growing to white, the hero handoff, Skip intro, and the reduced-motion bypass), desktop and mobile overflow, local photograph loading including lazy scenes, scroll-driven film motion, concept tabs and keyboard interaction, the mobile menu and its focus trap, form labels and invalid email validation, email-draft contents, reduced motion, and browser or asset-loading errors. It captures native-size desktop and mobile scenes for visual review. It intercepts email-draft opening; it does not send messages.
