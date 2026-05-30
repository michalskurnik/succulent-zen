import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function assertMatches(pattern, message, input = source) {
  if (!pattern.test(input)) {
    throw new Error(message);
  }
}

assertMatches(
  /viewport-fit=cover/,
  "Viewport must expose iPhone safe-area insets to the web view.",
  html
);

assertMatches(
  /top:\s*"max\(64px,\s*calc\(env\(safe-area-inset-top,\s*0px\) \+ 12px\)\)"/,
  "Sound button must have a hard minimum below the iPhone status bar."
);

assertMatches(
  /right:\s*"calc\(env\(safe-area-inset-right,\s*0px\) \+ 12px\)"/,
  "Sound button must respect the right safe area."
);

assertMatches(
  /width:\s*52[\s\S]*height:\s*52/,
  "Sound button must be at least a 52px touch target."
);

assertMatches(
  /onTouchEnd=\{activateMuteToggle\}/,
  "Sound button must toggle on a direct iOS touch-end gesture."
);

assertMatches(
  /onClick=\{handleMuteClick\}/,
  "Sound button must keep a click fallback for non-touch activation."
);

console.log("Mobile UI guard passed.");
