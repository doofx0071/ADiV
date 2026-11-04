const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");

const MARKER = "# ADiV: Keep Expo Location next TaskManager consumers for reflection.";
const KEEP_RULES = `${MARKER}
-keep class expo.modules.location.next.locationProviders.AndroidLocationTaskConsumer { *; }
-keep class expo.modules.location.next.locationProviders.GmsLocationTaskConsumer { *; }
`;

module.exports = function withExpoLocationNextConsumers(config) {
  return withDangerousMod(config, ["android", async (modConfig) => {
    const rulesPath = path.join(
      modConfig.modRequest.platformProjectRoot,
      "app",
      "proguard-rules.pro",
    );
    const currentRules = await fs.readFile(rulesPath, "utf8");

    if (!currentRules.includes(MARKER)) {
      await fs.writeFile(rulesPath, `${currentRules.trimEnd()}\n\n${KEEP_RULES}`);
    }

    return modConfig;
  }]);
};
